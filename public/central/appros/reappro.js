let modalCallback=null;
function openProModal({title,msg,okText,onOk}){document.getElementById('modalTitle').textContent=title;document.getElementById('modalMsg').textContent=msg;document.getElementById('modalOk').textContent=okText;modalCallback=onOk;document.getElementById('proModal').classList.add('open');}
function closeProModal(){document.getElementById('proModal').classList.remove('open');modalCallback=null;}
document.getElementById('modalOk').onclick=()=>{if(modalCallback)modalCallback();closeProModal();};
const KEY_DEPOT='dubenzen_produits';
const KEY_SITES='dub_sites';
const KEY_SITE_PRODS='dub_sites_produits';
const KEY_PANIER='dub_reappro_panier';
const KEY_HISTO='dub_reappro_histo';
const KEY_HISTO_ALL='dub_reappro_histo_all';
const KEY_HISTO_BACKUP='dub_historique_reappro';
const KEY_TAUX='dub_taux';
let selected=null, productCache=[], paniersParSite={}, histoParSite={}, tauxComptoirParSite={};
let sitesList=[];
let tauxDepotUniversel=2500;
let showAllHisto=false;
// ✅ FIX LAG
let cachedSiteProds=null, reapproPage=1, reapproDebounce=null;
const REAPPRO_PAR_PAGE=50;
function getSiteProdsCached(){ if(cachedSiteProds) return cachedSiteProds; try{ cachedSiteProds=JSON.parse(localStorage.getItem(KEY_SITE_PRODS)||'{}'); }catch(e){ cachedSiteProds={}; } return cachedSiteProds; }
function clearReapproCache(){ cachedSiteProds=null; }
function norm(s){ return (s||'').toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim(); }
function levenshtein(a,b){
  a=norm(a); b=norm(b);
  if(a===b) return 0; if(!a.length) return b.length; if(!b.length) return a.length;
  if(Math.abs(a.length-b.length)>2) return 99;
  let m=a.length, n=b.length, prev=Array.from({length:n+1},(_,i)=>i), cur=new Array(n+1);
  for(let i=1;i<=m;i++){ cur[0]=i; for(let j=1;j<=n;j++){ let c=a[i-1]===b[j-1]?0:1; cur[j]=Math.min(prev[j]+1, cur[j-1]+1, prev[j-1]+c); } [prev,cur]=[cur,prev]; }
  return prev[n];
}
function scoreProduit(p, queryRaw){
  let q = norm(queryRaw);
  if(!q) return 100;
  let tokens = q.split(' ').filter(t=>t.length>0);
  let nom = norm(p.nom);
  let four = norm(p.fournisseur);
  let lot = norm(p.lot);
  let cat = norm(p.categorie);
  let cont = norm(p.contenance)+' '+norm(p.cond);
  let all = nom+' '+four+' '+lot+' '+cat+' '+cont;
  let score = 0;
  if(nom===q) score+=1000;
  else if(nom.startsWith(q)) score+=800;
  else if(all.includes(q)) score+=600;
  let allTokensFound = tokens.every(t=> all.includes(t));
  if(allTokensFound) score+=500;
  tokens.forEach(t=>{
    if(nom.startsWith(t)) score+=200;
    else if(nom.includes(t)) score+=120;
    else if(four.includes(t)||cat.includes(t)||lot.includes(t)) score+=80;
    else {
      let words = nom.split(' ');
      let best = 99;
      for(let w of words){ let d=levenshtein(t,w); if(d<best) best=d; if(best===1) break; }
      if(best===1) score+=150;
      else if(best===2 && t.length>=5) score+=90;
      else if(best===2 && t.length>=4) score+=40;
    }
    if(t.length>=3){
      let words = nom.split(' ');
      if(words.some(w=>w.startsWith(t))) score+=100;
    }
  });
  if(score>0 && nom.length<25) score+=10;
  return score;
}
function smartSearch(list, query){
  let q = query.trim();
  if(!q) return list;
  if(q.length===1) return list.filter(p=> norm(p.nom).startsWith(norm(q)) ).slice(0,200);
  // ✅ On ne garde que les 200 meilleurs, pas de tri de 2000
  let scored=[];
  for(let p of list){ let s=scoreProduit(p,q); if(s>0) scored.push({p,s}); if(scored.length>400) break; }
  scored.sort((a,b)=> b.s - a.s || a.p.nom.localeCompare(b.p.nom));
  return scored.slice(0,200).map(x=>x.p);
}
function highlightNom(nom, query){
  let q = query.trim(); if(!q) return nom;
  let n = norm(nom); let qq = norm(q);
  let idx = n.indexOf(qq);
  if(idx===-1){
    let tokens = qq.split(' ');
    let out = nom;
    tokens.forEach(t=>{
      if(t.length<2) return;
      let re = new RegExp('('+t.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+')','i');
      out = out.replace(re,'<mark>$1</mark>');
    });
    return out;
  }
  return nom.slice(0,idx)+'<mark>'+nom.slice(idx, idx+q.length)+'</mark>'+nom.slice(idx+q.length);
}
let lastQuery = '';
function readHistoFromStorage(){
  let all = [];
  let seen = new Set();
  function pushList(list){
    if(!Array.isArray(list)) return;
    list.forEach(h=>{
      let key = String(h.id)+'|'+h.timestamp;
      if(seen.has(key)) return;
      seen.add(key);
      all.push(h);
    });
  }
  try{ pushList(JSON.parse(localStorage.getItem(KEY_HISTO_ALL)||'[]')); }catch(e){}
  try{ pushList(JSON.parse(localStorage.getItem(KEY_HISTO_BACKUP)||'[]')); }catch(e){}
  try{
    let bySite = JSON.parse(localStorage.getItem(KEY_HISTO)||'{}');
    Object.keys(bySite).forEach(k=> pushList(bySite[k]||[]));
  }catch(e){}
  try{ Object.keys(histoParSite||{}).forEach(k=> pushList(histoParSite[k]||[])); }catch(e){}
  all.sort((a,b)=> new Date(b.timestamp)-new Date(a.timestamp));
  return all;
}
function saveHistoAll(){
  try{ localStorage.setItem(KEY_HISTO, JSON.stringify(histoParSite)); }catch(e){}
  try{
    let all = readHistoFromStorage();
    if(all.length>2000) all = all.slice(0,2000);
    localStorage.setItem(KEY_HISTO_ALL, JSON.stringify(all));
    localStorage.setItem(KEY_HISTO_BACKUP, JSON.stringify(all));
    let el=document.getElementById('histoSaved');
    if(el){ el.textContent='● Enregistré • '+all.length+' réappro(s)'; el.style.color='#059669'; }
    let dbg=document.getElementById('histoDebug');
    if(dbg) dbg.textContent='Debug: '+all.length+' réappro(s) en mémoire • Si vide, clique 🔄 Restaurer';
  }catch(e){ console.log('saveHisto err',e); }
}
function loadHistoAll(){
  try{ histoParSite = JSON.parse(localStorage.getItem(KEY_HISTO)||'{}'); }catch(e){ histoParSite={}; }
  let all = readHistoFromStorage();
  all.forEach(h=>{
    let sid = h.siteId || 'central';
    if(!histoParSite[sid]) histoParSite[sid]=[];
    if(!histoParSite[sid].some(x=>String(x.id)===String(h.id))) histoParSite[sid].push(h);
  });
  try{ localStorage.setItem(KEY_HISTO, JSON.stringify(histoParSite)); }catch(e){}
}
function getDepot(){ try{return JSON.parse(localStorage.getItem(KEY_DEPOT)||'[]')}catch(e){return []} }
function getSites(){ try{return JSON.parse(localStorage.getItem(KEY_SITES)||'[]')}catch(e){return []} }
function getSiteProds(){ return getSiteProdsCached(); }
function saveDepot(l){ localStorage.setItem(KEY_DEPOT, JSON.stringify(l)); localStorage.setItem('produits', JSON.stringify(l)); localStorage.setItem('dub_produits', JSON.stringify(l)); }
function saveSiteProds(o){ localStorage.setItem(KEY_SITE_PRODS, JSON.stringify(o)); cachedSiteProds=o; }
function buildSites(){
  sitesList = getSites();
  let sel = document.getElementById('siteSelect');
  let oldVal = sel.value || 'central';
  sel.innerHTML = '<option value="central">🏦 DÉPÔT CENTRAL</option>' + sitesList.map(s=>`<option value="${s.id}">📍 ${s.nom}</option>`).join('');
  if([...sel.options].some(o=>o.value===oldVal)) sel.value = oldVal;
  let allKeys = ['central', ...sitesList.map(s=>String(s.id))];
  allKeys.forEach(k=>{ if(!paniersParSite[k]) paniersParSite[k]=[]; if(!histoParSite[k]) histoParSite[k]=[]; });
  document.getElementById('sourceInfo').textContent = `● Connecté • ${getDepot().length} produits dépôt • ${sitesList.length} sites • Site actuel: ${getSiteName(getSiteId())}`;
}
function getSiteId(){ return document.getElementById('siteSelect').value || 'central'; }
function getSiteName(id){
  if(id==='central') return '🏦 DÉPÔT CENTRAL';
  let s = sitesList.find(x=>String(x.id)===String(id));
  return s ? '📍 '+s.nom : '🏦 DÉPÔT';
}
function getSiteShort(id){
  if(id==='central') return 'DÉPÔT';
  let s = sitesList.find(x=>String(x.id)===String(id));
  return s ? s.nom.toUpperCase().slice(0,10) : 'SITE';
}
function getPVForSite(p, siteId){
  if(siteId==='central'){ return p.pv_central || p.pa_fc || 0; }
  let list = getSiteProdsCached()[siteId]||[];
  let found = list.find(x=>String(x.originalId)===String(p.id) || String(x.id)===String(p.id) || (x.nom||'').toUpperCase().trim()===(p.nom||'').toUpperCase().trim());
  if(found) return found.pv || found.prix || 0;
  return p.pv_central || 0;
}
function getPAForSite(p, siteId){
  if(siteId==='central') return p.pa_fc || 0;
  let list = getSiteProdsCached()[siteId]||[];
  let found = list.find(x=>String(x.originalId)===String(p.id) || String(x.id)===String(p.id) || (x.nom||'').toUpperCase().trim()===(p.nom||'').toUpperCase().trim());
  if(found) return found.pa || 0;
  return p.pa_fc || 0;
}
function getProduitsPourSite(siteId){
  if(siteId === 'central'){ return productCache; }
  let sp = getSiteProdsCached();
  let listSite = sp[siteId] || [];
  if(!Array.isArray(listSite) || listSite.length === 0) return [];
  let seen = new Set();
  let out = [];
  let byId = new Map();
  productCache.forEach(p=>{ byId.set(String(p.id), p); });
  listSite.forEach(s => {
    let key = String(s.originalId || s.id || s.nom).toUpperCase() + '|' + (s.nom||'').toUpperCase().trim();
    if(seen.has(key)) {
      let ex = out.find(o=> String(o.id)===String(s.originalId||s.id));
      if(ex) ex.qte = (parseInt(ex.qte)||0) + (parseInt(s.stock_site)||parseInt(s.stock)||0);
      return;
    }
    seen.add(key);
    let depotP = byId.get(String(s.originalId)) || byId.get(String(s.id));
    if(!depotP) depotP = productCache.find(p => (p.nom||'').toUpperCase().trim() === (s.nom||'').toUpperCase().trim());
    out.push({
      id: s.originalId || s.id,
      nom: s.nom,
      pa_fc: s.pa || 0,
      pv_central: s.pv || s.prix || 0,
      qte: s.stock_site ?? s.stock ?? 0,
      seuil_alerte: depotP ? depotP.seuil_alerte : 50,
      stock_max: depotP ? depotP.stock_max : 500,
      contenance: depotP ? depotP.contenance : (s.contenance||'Boîte'),
      cond: depotP ? depotP.cond : (s.conditionnement||'Boîte'),
      fournisseur: depotP ? depotP.fournisseur : (s.fournisseur||''),
      lot: s.lot || '',
      categorie: depotP ? depotP.categorie : (s.categorie||''),
      isSite: true,
      siteId: siteId
    });
  });
  return out;
}
function checkProduitValide(pa, marge, pv, siteId){
  if(siteId === 'central'){
    if(!pa || pa <= 0) return {ok:false, msg:'⛔ DÉPÔT : Mets un PA > 0'};
    return {ok:true};
  }
  if(!pa || pa <= 0) return {ok:false, msg:'⛔ SITE : PA manquant. Un produit sans PA ne doit pas passer pour les sites.'};
  if(!marge || marge <= 0) return {ok:false, msg:'⛔ SITE : Marge 0%. Mets une Marge > 0.'};
  if(!pv || pv <= 0) return {ok:false, msg:'⛔ SITE : PV manquant.'};
  if(pv <= pa) return {ok:false, msg:'⛔ SITE : PV doit être > PA.'};
  return {ok:true};
}
function refreshMargeError(){
  let siteId = getSiteId();
  let pa = parseFloat(document.getElementById('f_prix_achat').value)||0;
  let marge = parseFloat(document.getElementById('f_marge_pct').value)||0;
  let pv = parseFloat(document.getElementById('f_prix_vente').value)||0;
  let errEl = document.getElementById('margeError');
  let box = document.getElementById('margeBox');
  if(siteId === 'central'){ if(errEl) errEl.style.display = 'none'; if(box) box.classList.remove('marge-error'); return true; }
  let chk = checkProduitValide(pa, marge, pv, siteId);
  if(!chk.ok){ if(errEl){ errEl.style.display='block'; errEl.textContent = chk.msg; } if(box) box.classList.add('marge-error'); return false; }
  else { if(errEl) errEl.style.display='none'; if(box) box.classList.remove('marge-error'); return true; }
}
function saveAll(){
  localStorage.setItem(KEY_PANIER, JSON.stringify(paniersParSite));
  saveHistoAll();
  localStorage.setItem(KEY_TAUX, JSON.stringify({universel:tauxDepotUniversel, parSite:tauxComptoirParSite}));
  if(getSiteId()!=='central'){ return; }
  let existing = getDepot();
  let byId = {}; let byNom = {};
  existing.forEach(p=>{ byId[String(p.id)] = p; if(p.nom) byNom[p.nom.toUpperCase().trim()] = p; });
  let depot = productCache.map(p=>{
    let old = byId[String(p.id)] || byNom[p.nom.toUpperCase().trim()];
    let stockToKeep = p.qte;
    if(old && typeof old.stock !== 'undefined' && old.stock !== null){
      if((parseInt(old.stock)||0) > (parseInt(p.qte)||0) && p._justValidated !== true){
        let isManualEdit = selected && String(selected.id)===String(p.id);
        if(!isManualEdit) stockToKeep = parseInt(old.stock)||0;
      }
    }
    return { id: p.id, nom: p.nom, pa: p.pa_fc, pv: p.pv_central, prix: p.pv_central, stock: stockToKeep, stock_max: p.stock_max, alerte: p.seuil_alerte, stock_min: p.seuil_alerte, contenance: p.contenance, conditionnement: p.cond, fournisseur: p.fournisseur||'', lot: p.lot||'', peremption: p.peremption||'', categorie: p.categorie||'', site: 'Dépôt Central' };
  });
  existing.forEach(oldP=>{
    let found = depot.find(d=>String(d.id)===String(oldP.id) || (d.nom||'').toUpperCase().trim()===(oldP.nom||'').toUpperCase().trim());
    if(!found) depot.push(oldP);
  });
  saveDepot(depot);
}
function loadAll(){
  let depot = getDepot();
  productCache = depot.map(p=>({ id: p.id, nom: p.nom||'', pa_fc: p.pa||0, pv_central: p.pv||p.prix||0, pv_gombe: p.pv||p.prix||0, pv_masina: p.pv||p.prix||0, qte: p.stock||0, seuil_alerte: p.alerte||p.stock_min||50, stock_max: p.stock_max||500, contenance: p.contenance||'Boîte', cond: p.conditionnement||'Boîte', fournisseur: p.fournisseur||'', lot: p.lot||'', peremption: p.peremption||'', categorie: p.categorie||'' }));
  try{ paniersParSite = JSON.parse(localStorage.getItem(KEY_PANIER)||'{}'); }catch(e){ paniersParSite={}; }
  loadHistoAll();
  try{ let t = JSON.parse(localStorage.getItem(KEY_TAUX)||'null'); if(t){ tauxDepotUniversel = t.universel||2500; tauxComptoirParSite = t.parSite||{}; } }catch(e){}
  document.getElementById('tauxDepot').value = tauxDepotUniversel;
  buildSites();
  let sid = getSiteId();
  document.getElementById('tauxComptoir').value = getTauxComptoirSite(sid);
}
const genLot=()=>'LOT'+Math.floor(10000+Math.random()*90000);
function getTauxDepotUniversel(){return tauxDepotUniversel||2500}
function getTauxComptoirSite(siteId){return tauxComptoirParSite[siteId]||2500}
function getStockState(qte,a,max){qte=+qte||0;a=+a||0;max=+max||0;if(qte===0)return{cls:'stock-0',color:'#dc2626',label:'RUPTURE'};if(qte>max&&max>0)return{cls:'stock-max',color:'#2563eb',label:'SURSTOCK'};if(qte<=a)return{cls:'stock-alert',color:'#d97706',label:'ALERTE'};return{cls:'stock-ok',color:'#059669',label:'OK'};}
function updateStock(){let s=+document.getElementById('f_stock_actuel_input').value||0,a=+document.getElementById('f_stock_alerte').value||0,m=+document.getElementById('f_stock_max').value||0;let st=getStockState(s,a,m);document.getElementById('etatStockBadge').textContent=st.label+' • '+s+' pcs';document.getElementById('etatStockBadge').style.background=st.color;}
let isCalc=false; let paLock=false;
function applyDepotZero(){
  let m=document.getElementById('f_marge_pct'),pv=document.getElementById('f_prix_vente');
  m.disabled=false; m.style.background='#0f172a'; m.style.color='white';
  pv.disabled=false; pv.style.background='white';
  refreshMargeError();
}
function updateMargeDisplay(pa,pv,pct){let td=getTauxDepotUniversel();let tc=getTauxComptoirSite(getSiteId());document.getElementById('pvDollarComptoir').textContent='$'+(pv/tc).toFixed(2);document.getElementById('margeDetail').textContent='UNIV '+td+' / SITE '+tc+' • Gain '+(pv-pa).toLocaleString()+' FC • Marge '+pct+'%'; refreshMargeError();}
function calcPAFromFC(){if(paLock) return; paLock=true;let td=getTauxDepotUniversel();let paFC=parseFloat(document.getElementById('f_prix_achat').value)||0;let paDollar=td>0 ? paFC/td : 0;document.getElementById('f_prix_achat_dollar').value=paDollar>0?paDollar.toFixed(2):'';let mg=parseFloat(document.getElementById('f_marge_pct').value)||0;let pv=Math.round(paFC*(1+mg/100));document.getElementById('f_prix_vente').value=pv;updateMargeDisplay(paFC,pv,mg);paLock=false;}
function calcPAFromDollar(){if(paLock) return; paLock=true;let td=getTauxDepotUniversel();let paDollar=parseFloat(document.getElementById('f_prix_achat_dollar').value)||0;let paFC=Math.round(paDollar*td);document.getElementById('f_prix_achat').value=paFC>0?paFC:'';let mg=parseFloat(document.getElementById('f_marge_pct').value)||0;let pv=Math.round(paFC*(1+mg/100));document.getElementById('f_prix_vente').value=pv;updateMargeDisplay(paFC,pv,mg);paLock=false;}
function calcFromPV(){if(isCalc)return;isCalc=true;let pa=+document.getElementById('f_prix_achat').value||0,pv=+document.getElementById('f_prix_vente').value||0;let mg=pa>0?Math.round(((pv-pa)/pa*100)*10)/10:0;document.getElementById('f_marge_pct').value=mg;updateMargeDisplay(pa,pv,mg);isCalc=false}
function calcFromMarge(){if(isCalc)return;isCalc=true;let pa=+document.getElementById('f_prix_achat').value||0,mg=+document.getElementById('f_marge_pct').value||0;let pv=Math.round(pa*(1+mg/100));document.getElementById('f_prix_vente').value=pv;updateMargeDisplay(pa,pv,mg);isCalc=false}
function updateTauxLabels(){let siteId=getSiteId();document.getElementById('tauxSiteLabel').textContent=getSiteShort(siteId);document.querySelectorAll('.pvSiteLabel').forEach(el=>el.textContent=getSiteShort(siteId));document.getElementById('panierSiteLabel').textContent=getSiteShort(siteId);}
function clearForm(){
  selected=null;
  document.getElementById('f_designation').value='';
  document.getElementById('f_prix_achat').value='';
  document.getElementById('f_prix_achat_dollar').value='';
  document.getElementById('f_prix_vente').value='';
  document.getElementById('f_marge_pct').value='';
  document.getElementById('f_contenance').value='';
  document.getElementById('f_cond').value='Boîte';
  document.getElementById('f_stock_actuel_input').value='';
  document.getElementById('f_stock_alerte').value='';
  document.getElementById('f_stock_max').value='';
  document.getElementById('f_qte').value=0;
  document.getElementById('margeDetail').textContent='Choisis un produit de '+getSiteName(getSiteId());
  updateStock();
}
function renderProductList(list){
  let siteId=getSiteId();let td=getTauxDepotUniversel();let tc=getTauxComptoirSite(siteId);updateTauxLabels();
  if(!list.length){
    document.getElementById('productList').innerHTML=`<div style="padding:30px 12px;text-align:center;color:#94a3b8;font-size:12px;line-height:1.6">Aucun produit pour <b style="color:#0f172a">${getSiteName(siteId)}</b><br><span style="font-size:11px">Ce site n'a encore aucun produit validé.<br>Pour ajouter un produit à ce site, va d'abord valider un réappro pour ce site.<br>Recherche : "<b style="color:#0f172a">${lastQuery}</b>"</span><br><br><button onclick="document.getElementById('searchInput').value='';reapproPage=1;searchProduits()" style="padding:8px 14px;border-radius:999px;border:1px solid #e2e8f0;background:white;font-weight:800;cursor:pointer">Voir tout ${getSiteName(siteId)}</button><br><br><span style="font-size:10px">Source : ${siteId==='central' ? 'dubenzen_produits (DÉPÔT)' : 'dub_sites_produits['+siteId+'] (SITE UNIQUEMENT)'}</span></div>`;
    return;
  }
  let totalPages=Math.max(1,Math.ceil(list.length/REAPPRO_PAR_PAGE));
  if(reapproPage>totalPages) reapproPage=totalPages;
  let debut=(reapproPage-1)*REAPPRO_PAR_PAGE;
  let pageItems=list.slice(debut,debut+REAPPRO_PAR_PAGE);
  document.getElementById('productList').innerHTML=pageItems.map(p=>{let st=getStockState(p.qte, p.seuil_alerte, p.stock_max);let paFC=p.pa_fc;let pvSite=getPVForSite(p,siteId);let paDollar=(paFC/td).toFixed(2);let pvDollar=(pvSite/tc).toFixed(2);let nomAff = highlightNom(p.nom, lastQuery);let warn = (siteId!=='central' && (!paFC || paFC<=0)) ? '<span style="background:#fef2f2;color:#991b1b;font-size:8px;padding:2px 6px;border-radius:6px;font-weight:800">⛔ SANS PA - BLOQUÉ POUR SITE</span>' : '';return `<div onclick='selectProduit("${p.id}")' class="card-pro ${st.cls}"><div style="display:flex;justify-content:space-between;align-items:center;gap:10px"><div style="flex:1;min-width:0"><div style="font-weight:800;font-size:12.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${nomAff}</div><div style="font-size:9px;color:#94a3b8;margin-top:2px">${p.fournisseur? '🏭 '+p.fournisseur+' • ':''}${p.lot? 'Lot '+p.lot+' • ':''}${p.categorie||''} • ${siteId==='central'?'DÉPÔT':getSiteName(siteId)}</div><div style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap"><span style="font-weight:800;font-size:11px;background:#f1f5f9;border:1px solid #e2e8f0;padding:3px 8px;border-radius:8px">${paFC.toLocaleString()} FC</span><span style="font-size:9px;background:#fef3c7;padding:3px 8px;border-radius:8px">$${paDollar}</span><span style="color:#64748b">→</span><span style="font-weight:800;font-size:11px;background:#eff6ff;border:1px solid #bfdbfe;padding:3px 8px;border-radius:8px">${pvSite.toLocaleString()} FC</span><span style="font-size:9px;background:#dbeafe;padding:3px 8px;border-radius:8px">$${pvDollar}</span>${warn}</div></div><div style="text-align:center;flex-shrink:0"><div style="font-size:15px;font-weight:800;color:${st.color}">${p.qte}</div><div style="font-size:6.5px;font-weight:800;color:${st.color}">${st.label}</div></div></div></div>`}).join('')+`<div style="display:flex;justify-content:center;gap:8px;padding:12px;align-items:center"><button onclick="reapproPage=Math.max(1,reapproPage-1);searchProduits()" style="padding:8px 14px;border-radius:999px;border:1px solid #e2e8f0;background:white;font-weight:800;cursor:pointer">◀️ Préc.</button><span style="font-weight:800;font-size:11px">Page ${reapproPage} / ${totalPages} • ${list.length}</span><button onclick="reapproPage=Math.min(${totalPages},reapproPage+1);searchProduits()" style="padding:8px 14px;border-radius:999px;background:#0f172a;color:white;font-weight:800;cursor:pointer">Suiv. ▶️</button></div>`;
}
function searchProduits(){
  let q=document.getElementById('searchInput').value||'';
  lastQuery=q;
  let siteId = getSiteId();
  let produitsDuSite = getProduitsPourSite(siteId);
  let filtered = smartSearch(produitsDuSite, q);
  let hint = document.getElementById('searchHint');
  if(!q.trim()) hint.textContent = siteId==='central' ? 'DÉPÔT : '+produitsDuSite.length+' produits dépôt' : getSiteName(siteId)+' : '+produitsDuSite.length+' produits UNIQUEMENT de ce site';
  else if(!filtered.length) hint.textContent='Aucun résultat dans '+getSiteName(siteId)+' - essaie plus court';
  else hint.textContent=filtered.length+' résultat(s) dans '+getSiteName(siteId)+' • trié par pertinence';
  renderProductList(filtered);
}
function selectProduit(id){
  let siteId = getSiteId();
  let produitsDuSite = getProduitsPourSite(siteId);
  let p = produitsDuSite.find(x=>String(x.id)===String(id));
  if(!p){ console.log('Produit '+id+' pas dans le site '+siteId, produitsDuSite); return; }
  selected=p;
  document.getElementById('f_designation').value=p.nom;
  document.getElementById('f_prix_achat').value=p.pa_fc;
  document.getElementById('f_prix_achat_dollar').value=(p.pa_fc/getTauxDepotUniversel()).toFixed(2);
  document.getElementById('f_contenance').value=p.contenance;
  document.getElementById('f_cond').value=p.cond;
  document.getElementById('f_stock_actuel_input').value=p.qte;
  document.getElementById('f_stock_alerte').value=p.seuil_alerte;
  document.getElementById('f_stock_max').value=p.stock_max;
  document.getElementById('f_lot').value=genLot();
  let pvSite=getPVForSite(p,siteId);
  let pct=p.pa_fc>0?Math.round(((pvSite-p.pa_fc)/p.pa_fc*100)*10)/10:0;
  document.getElementById('f_marge_pct').value=pct;
  document.getElementById('f_prix_vente').value=pvSite;
  document.getElementById('f_qte').value=0;
  applyDepotZero();
  updateMargeDisplay(p.pa_fc,pvSite,pct);
  updateStock();
}
function renderPanier(){let siteId=getSiteId(),panier=paniersParSite[siteId]||[],l=document.getElementById('panierList');let td=getTauxDepotUniversel();let tc=getTauxComptoirSite(siteId);document.getElementById('panierSiteLabel').textContent=getSiteShort(siteId);updateTauxLabels();if(!panier.length){l.innerHTML=`<div style="height:58px;display:flex;align-items:center;justify-content:center;font-size:11px;color:#94a3b8">Panier vide - ${getSiteName(siteId)}</div>`;}else{l.innerHTML=panier.map((it,i)=>{let pat=it.pa*it.qte;let margeAff = it.pa>0 ? Math.round(((it.pv-it.pa)/it.pa*100)*10)/10 : 0;return `<div class="panier-row-pro"><div style="min-width:0"><div style="font-weight:800;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${it.nom}</div><div style="font-size:7px;color:#94a3b8">Lot ${it.lot} • Marge ${margeAff}%</div></div><div style="text-align:center"><span style="background:#0f172a;color:white;padding:6px 11px;border-radius:999px;font-size:11px;font-weight:800">${it.qte}</span></div><div class="pau-box"><div style="font-size:12px;font-weight:800">${it.pa.toLocaleString()} FC</div><div style="font-size:9px;color:#92400e">$${(it.pa/td).toFixed(2)}</div></div><div class="pat-box"><div style="font-size:12.5px;font-weight:800;color:#1e40af">${pat.toLocaleString()} FC</div><div style="font-size:9px;color:#3b82f6">$${(pat/tc).toFixed(2)}</div></div><div style="text-align:center"><button onclick="removeItem(${i})" style="width:28px;height:28px;border-radius:9px;border:1px solid #e2e8f0;background:white;font-size:12px;cursor:pointer">×</button></div></div>`}).join('');}let total=panier.reduce((a,b)=>a+b.pa*b.qte,0);document.getElementById('totalFranc').textContent=total.toLocaleString()+' FC';document.getElementById('totalDollarSysteme').textContent='$'+(total/td).toFixed(2);document.getElementById('totalDollarComptoir').textContent='$'+(total/tc).toFixed(2);document.getElementById('header_total').textContent=total.toLocaleString()+' FC';document.getElementById('panierCount').textContent=panier.length;document.getElementById('nombreLignes').textContent=panier.length+' lignes';}
function getFilteredHisto(){
  let siteId=getSiteId();
  let searchRaw=document.getElementById('histoSearch').value||'';
  let search=norm(searchRaw);
  let duStr=document.getElementById('histoDu').value,auStr=document.getElementById('histoAu').value;
  let duDate=duStr?new Date(duStr):null,auDate=auStr?new Date(auStr):null; if(duDate)duDate.setHours(0,0,0,0); if(auDate)auDate.setHours(23,59,59,999);
  let allHisto = readHistoFromStorage();
  if(!showAllHisto){
    allHisto = allHisto.filter(h=> String(h.siteId)===String(siteId) || (siteId==='central' && (!h.siteId || h.siteId==='central')));
  }
  let flat=[];
  allHisto.forEach(h=>{let hd=new Date(h.timestamp);if(duDate&&hd<duDate)return; if(auDate&&hd>auDate)return;(h.items||[]).forEach(it=>{
    if(search){
      let hay = norm(it.nom+' '+it.lot+' '+(h.site||''));
      let toks = search.split(' ');
      let ok = toks.every(t=> hay.includes(t) || hay.split(' ').some(w=>levenshtein(t,w)<=1));
      if(!ok) return;
    }
    flat.push({...it,timestamp:h.timestamp, siteName:h.site||getSiteName(h.siteId||siteId), siteId:h.siteId||siteId});
  });});
  flat.sort((a,b)=>new Date(b.timestamp)-new Date(a.timestamp));return flat;
}
function renderHisto(){
  let flat=getFilteredHisto();
  let siteId=getSiteId();
  let td=getTauxDepotUniversel();let tc=getTauxComptoirSite(siteId);let total=flat.reduce((a,b)=>a+b.pa*b.qte,0);
  let allCount = readHistoFromStorage().length;
  document.getElementById('histoTitle').textContent = showAllHisto ? 'Historique - TOUS SITES - '+flat.length+' lignes' : 'Historique - '+getSiteName(siteId)+' - '+flat.length+' lignes';
  document.getElementById('histoTotal').textContent=total.toLocaleString()+' FC';
  let dbg=document.getElementById('histoDebug');
  if(dbg) dbg.textContent = 'En mémoire : '+allCount+' réappro(s) au total • Affichés : '+flat.length+' • Site actuel : '+getSiteName(siteId)+' • Si tu ne vois pas ton réappro, clique TOUS SITES';
  let l=document.getElementById('histoList');
  if(!flat.length){
    l.innerHTML=`<div style="min-height:80px;display:flex;align-items:center;justify-content:center;font-size:11px;color:#94a3b8;text-align:center;line-height:1.6;padding:16px">Aucun historique pour ${showAllHisto?'TOUS SITES':getSiteName(siteId)}<br><span style="font-size:10px">Total en mémoire : ${allCount} réappro(s)<br>1. Clique <b>TOUS SITES</b> pour voir tout<br>2. Clique <b>🔄 Restaurer</b> si c'est vide alors que tu as déjà validé<br>3. Valide un réappro, il apparaît ici immédiatement</span><br><br><button onclick="showAllHisto=true;renderHisto()" style="padding:8px 14px;border-radius:999px;border:1px solid #e2e8f0;background:white;font-weight:800;cursor:pointer">Voir TOUS SITES</button></div>`;
    return;
  }
  l.innerHTML=flat.slice(0,200).map(it=>{let pat=it.pa*it.qte;let d=new Date(it.timestamp);return `<div class="histo-row-spaced"><div style="min-width:0"><div style="font-weight:800;font-size:12.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${it.nom}</div><div style="font-size:7px;color:#94a3b8">Lot ${it.lot} • ${it.siteName||''}</div></div><div style="text-align:center"><span style="background:#0f172a;color:white;padding:6px 12px;border-radius:999px;font-size:12px;font-weight:800">${it.qte}</span></div><div class="pau-box"><div style="font-size:13px;font-weight:800">${it.pa.toLocaleString()} FC</div><div style="font-size:9px;color:#92400e">$${(it.pa/td).toFixed(2)}</div></div><div class="pat-box"><div style="font-size:13.5px;font-weight:800;color:#1e40af">${pat.toLocaleString()} FC</div><div style="font-size:9px;color:#3b82f6">$${(pat/tc).toFixed(2)}</div></div><div style="text-align:center;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:8px 6px"><div style="font-size:11px;font-weight:800">${d.toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit'})}</div><div style="font-size:9px;color:#64748b;margin-top:2px">${d.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}</div></div></div>`}).join('');
}
function exportHistoCSV(){let siteId=getSiteId();let flat=getFilteredHisto(); if(!flat.length){alert('Aucun historique à exporter');return;}let td=getTauxDepotUniversel();let tc=getTauxComptoirSite(siteId);let headers=['Produit','Qte','PAU FC','PAU $','PAT FC','PAT $','Site','Date','Heure']; let rows=flat.map(it=>{let d=new Date(it.timestamp); let pat=it.pa*it.qte; return [it.nom.replace(/;/g,','), it.qte, it.pa, (it.pa/td).toFixed(2), pat, (pat/tc).toFixed(2), getSiteName(siteId), d.toLocaleDateString('fr-FR'), d.toLocaleTimeString('fr-FR')].join(';');});let csv=[headers.join(';'),...rows].join('\n');let blob=new Blob(['\uFEFF'+csv],{type:'text/csv'}); let url=URL.createObjectURL(blob); let a=document.createElement('a'); a.href=url; a.download=`DUBENZENNE_${getSiteShort(siteId)}_${new Date().toISOString().slice(0,10)}.csv`; a.click(); URL.revokeObjectURL(url);}
function printHisto(){let siteId=getSiteId();let flat=getFilteredHisto(); if(!flat.length){alert('Aucun historique à imprimer');return;}let td=getTauxDepotUniversel(); let tc=getTauxComptoirSite(siteId); let total=flat.reduce((a,b)=>a+b.pa*b.qte,0);let html=`<div style="padding:18px;font-family:Inter,Arial"><h2 style="margin:0;font-size:19px">${getSiteName(siteId)}</h2><div style="font-size:11px;color:#64748b;margin-top:6px">${total.toLocaleString()} FC • ${flat.length} produits</div><table style="width:100%;border-collapse:collapse;margin-top:16px;font-size:11px"><thead><tr style="background:#0f172a;color:white"><th style="padding:11px;text-align:left">Produit</th><th>Qté</th><th>PAU FC</th><th>PAU $</th><th>PAT FC</th><th>PAT $</th><th>Date</th></tr></thead><tbody>${flat.map(it=>{let d=new Date(it.timestamp); let pat=it.pa*it.qte; return `<tr style="border-bottom:1px solid #e2e8f0"><td style="padding:10px;font-weight:600">${it.nom}</td><td style="text-align:center">${it.qte}</td><td style="text-align:right">${it.pa.toLocaleString()} FC</td><td style="text-align:right">$${(it.pa/td).toFixed(2)}</td><td style="text-align:right;font-weight:700">${pat.toLocaleString()} FC</td><td style="text-align:right">$${(pat/tc).toFixed(2)}</td><td style="text-align:center">${d.toLocaleDateString('fr-FR')} ${d.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}</td></tr>`}).join('')}</tbody></table></div>`;let w=window.open('','','width=1200,height=700'); w.document.write(`<html><head><title>Historique ${getSiteName(siteId)}</title></head><body>${html}</body></html>`); w.document.close(); w.focus(); setTimeout(()=>{w.print(); w.close();},500);}
document.getElementById('searchInput').addEventListener('input',()=>{ clearTimeout(reapproDebounce); reapproDebounce=setTimeout(()=>{ reapproPage=1; searchProduits(); },300); });
document.getElementById('siteSelect').addEventListener('change',()=>{
  showAllHisto=false;
  let siteId=getSiteId();
  document.getElementById('tauxComptoir').value=getTauxComptoirSite(siteId);
  document.getElementById('searchInput').value='';
  lastQuery='';
  reapproPage=1;
  clearForm();
  updateTauxLabels();
  searchProduits();
  renderPanier();
  renderHisto();
  saveAll();
});
function onDepotUniverselChange(){let newVal=parseFloat(document.getElementById('tauxDepot').value)||2500;tauxDepotUniversel=newVal;saveAll();updateTauxLabels();calcPAFromFC();searchProduits();renderPanier();renderHisto();}
function onComptoirSiteChange(){let siteId=getSiteId();let newVal=parseFloat(document.getElementById('tauxComptoir').value)||2300;tauxComptoirParSite[siteId]=newVal;saveAll();updateTauxLabels();if(selected){let pa=parseFloat(document.getElementById('f_prix_achat').value)||0;let pv=parseFloat(document.getElementById('f_prix_vente').value)||0;updateMargeDisplay(pa,pv,parseFloat(document.getElementById('f_marge_pct').value)||0);}searchProduits();renderPanier();renderHisto();}
document.getElementById('tauxDepot').addEventListener('input',onDepotUniverselChange);
document.getElementById('tauxComptoir').addEventListener('input',onComptoirSiteChange);
document.getElementById('f_prix_achat').addEventListener('input',calcPAFromFC);
document.getElementById('f_prix_achat_dollar').addEventListener('input',calcPAFromDollar);
document.getElementById('f_prix_vente').addEventListener('input',calcFromPV);
document.getElementById('f_marge_pct').addEventListener('input',calcFromMarge);
['f_stock_actuel_input','f_stock_alerte','f_stock_max'].forEach(id=>document.getElementById(id).addEventListener('input',()=>{updateStock(); if(selected && getSiteId()==='central'){selected.qte=+document.getElementById('f_stock_actuel_input').value||0; selected.seuil_alerte=+document.getElementById('f_stock_alerte').value||0; selected.stock_max=+document.getElementById('f_stock_max').value||0; saveAll(); searchProduits();}}));
document.getElementById('qteMinus').onclick=()=>{let v=+document.getElementById('f_qte').value||0;if(v>0)document.getElementById('f_qte').value=v-1};
document.getElementById('qtePlus').onclick=()=>{document.getElementById('f_qte').value=(+document.getElementById('f_qte').value||0)+1};
document.getElementById('histoSearch').addEventListener('input',()=>{ clearTimeout(reapproDebounce); reapproDebounce=setTimeout(renderHisto,300); });
document.getElementById('btnFiltreDuAu').onclick=renderHisto;
document.getElementById('histoDu').addEventListener('change',renderHisto);
document.getElementById('histoAu').addEventListener('change',renderHisto);
document.getElementById('btnResetDuAu').onclick=()=>{document.getElementById('histoDu').value='';document.getElementById('histoAu').value='';document.getElementById('histoSearch').value='';showAllHisto=false;renderHisto();};
document.getElementById('btnPrintHisto').onclick=printHisto;
document.getElementById('btnExportCSV').onclick=exportHistoCSV;
document.getElementById('btnHistoTous').onclick=()=>{showAllHisto=!showAllHisto; document.getElementById('btnHistoTous').textContent=showAllHisto?'SITE ACTUEL':'TOUS SITES'; document.getElementById('btnHistoTous').style.background=showAllHisto?'#0f172a':'#fef3c7'; document.getElementById('btnHistoTous').style.color=showAllHisto?'white':'#0f172a'; renderHisto();};
document.getElementById('btnHistoRestaurer').onclick=()=>{ loadHistoAll(); saveHistoAll(); renderHisto(); alert('✅ Historique restauré : '+readHistoFromStorage().length+' réappro(s) retrouvés'); };
document.getElementById('btnClearHisto').onclick=()=>{let siteId=getSiteId();openProModal({title:'Effacer '+getSiteName(siteId)+' ?',msg:'Effacer SEULEMENT '+getSiteName(siteId)+' ? Le reste reste en mémoire.',okText:'Effacer '+getSiteShort(siteId),onOk:()=>{
  if(histoParSite[siteId]) histoParSite[siteId]=[];
  try{
    let all = readHistoFromStorage().filter(h=> String(h.siteId)!==String(siteId));
    localStorage.setItem(KEY_HISTO_ALL, JSON.stringify(all));
    localStorage.setItem(KEY_HISTO_BACKUP, JSON.stringify(all));
    localStorage.setItem(KEY_HISTO, JSON.stringify(histoParSite));
  }catch(e){}
  renderHisto();
}})};
document.getElementById('btnAgrandir').onclick=()=>{let c=document.getElementById('histoContainer'); if(c.style.height==='80vh'){c.style.height='52vh';document.getElementById('btnAgrandir').textContent='↕️';}else{c.style.height='80vh';document.getElementById('btnAgrandir').textContent='↕️';}};
let isDragging=false,startY=0,startH=0;
document.getElementById('histoDrag').addEventListener('pointerdown',e=>{isDragging=true;startY=e.clientY;startH=document.getElementById('histoContainer').offsetHeight;});
window.addEventListener('pointermove',e=>{if(!isDragging)return;let diff=startY-e.clientY;let newH=Math.min(85,Math.max(20,(startH+diff)/window.innerHeight*100));document.getElementById('histoContainer').style.height=newH+'vh';});
window.addEventListener('pointerup',()=>{isDragging=false;});
document.getElementById('btnAjouter').onclick=function(){
let designation=document.getElementById('f_designation').value.trim();
let pa=parseFloat(document.getElementById('f_prix_achat').value)||0;
let pv=parseFloat(document.getElementById('f_prix_vente').value)||0;
let marge=parseFloat(document.getElementById('f_marge_pct').value)||0;
let qte=parseInt(document.getElementById('f_qte').value)||0;
let qteStock=+document.getElementById('f_stock_actuel_input').value||0;
let siteId=getSiteId();
if(!designation||qte<=0){alert('Mets une quantité : Qté = 0, tape ta vraie quantité');return;}
if(!selected){ alert('Choisis d\'abord un produit de '+getSiteName(siteId)+' dans la liste de gauche'); return; }
if(!pa || pa<=0){ alert('⛔ PA manquant. Mets un PA > 0.'); return; }
if(siteId!=='central'){
  let chk = checkProduitValide(pa, marge, pv, siteId);
  if(!chk.ok){ refreshMargeError(); openProModal({title:'⛔ Bloqué pour '+getSiteName(siteId), msg: chk.msg + ' Au dépôt seulement, Marge 0 est autorisée.', okText:"J'ai compris", onOk:()=>{ document.getElementById('f_marge_pct').focus(); }}); return; }
  pv = Math.round(pa*(1+marge/100));
  document.getElementById('f_prix_vente').value=pv;
} else {
  pv = Math.round(pa*(1+marge/100));
  document.getElementById('f_prix_vente').value=pv;
}
if(selected){selected.pa_fc=pa; selected.pv_central=pv;}
if(!paniersParSite[siteId]) paniersParSite[siteId]=[];
let nomN = norm(designation);
let newId = selected ? String(selected.id) : '';
let existant = paniersParSite[siteId].find(it => {
  if(newId && String(it.id)===newId) return true;
  if(norm(it.nom)===nomN) return true;
  return false;
});
if(existant){
  existant.qte = (parseInt(existant.qte)||0) + qte;
  existant.pa = pa;
  existant.pv = pv;
  existant.marge = marge;
  existant.contenance = document.getElementById('f_contenance').value||'';
  existant.cond = document.getElementById('f_cond').value||'';
  existant.qteStock = qteStock;
} else {
  let item={id: selected ? selected.id : Date.now(), nom:designation, qte:qte, qteStock:qteStock, pa:pa, pv:pv, marge:marge, contenance:document.getElementById('f_contenance').value||'', cond:document.getElementById('f_cond').value||'', lot:genLot(), timestamp:new Date().toISOString()};
  paniersParSite[siteId].unshift(item);
}
saveAll();searchProduits();renderPanier();document.getElementById('f_qte').value=0;
};
window.removeItem=i=>{let siteId=getSiteId();openProModal({title:'Retirer ?',msg:'Retirer de '+getSiteName(siteId)+' ?',okText:'Retirer',onOk:()=>{paniersParSite[siteId].splice(i,1);saveAll();renderPanier();}})};
document.getElementById('btnVider').onclick=()=>{let siteId=getSiteId();if(!paniersParSite[siteId].length)return;openProModal({title:'Vider panier '+getSiteName(siteId)+' ?',msg:paniersParSite[siteId].length+' produits',okText:'Vider',onOk:()=>{paniersParSite[siteId]=[];saveAll();renderPanier();}})};
document.getElementById('btnValider').onclick=()=>{
  let siteId=getSiteId();let panier=paniersParSite[siteId]||[];if(!panier.length){alert('Panier vide');return}
  if(siteId!=='central'){
    let bad = panier.find(it=>{ let m = it.marge!=null ? it.marge : (it.pa>0 ? Math.round(((it.pv-it.pa)/it.pa*100)*10)/10 : 0); return !it.pa || it.pa<=0 || !m || m<=0 || !it.pv || it.pv<=it.pa; });
    if(bad){ alert('⛔ VALIDER BLOQUÉ pour '+getSiteName(siteId)+' : "'+bad.nom+'" sans PA ou sans marge bénéficiaire.'); return; }
  }
  openProModal({title:`Valider ${getSiteName(siteId)} ?`,msg:`${panier.length} lignes • ${panier.reduce((a,b)=>a+b.pa*b.qte,0).toLocaleString()} FC`,okText:'Valider '+getSiteShort(siteId),onOk:()=>{
    let depot = getDepot();
    let siteProds = getSiteProdsCached();
    panier.forEach(it=>{
      let nomU = (it.nom||'').toUpperCase().trim();
      let ex = depot.find(p=>String(p.id)===String(it.id) || (p.nom||'').toUpperCase().trim()===nomU);
      let centralId = ex ? ex.id : it.id;
      if(ex){
        if(siteId==='central') ex.stock = (parseInt(ex.stock)||0) + it.qte;
        ex.pa = it.pa; ex.pv = it.pv; ex.prix = it.pv;
        depot.forEach(p=>{ if((p.nom||'').toUpperCase().trim()===nomU){ p.pa=it.pa; if(it.pv){p.pv=it.pv; p.prix=it.pv;} }});
      } else {
        depot.unshift({id:centralId, nom:it.nom, lot:it.lot, pa:it.pa, pv:it.pv, prix:it.pv, stock: siteId==='central'?it.qte:0, conditionnement:it.cond||'Boîte', contenance:it.contenance||'', site:'Dépôt Central'});
      }
      let pc = productCache.find(p=>String(p.id)===String(centralId) || (p.nom||'').toUpperCase().trim()===nomU);
      if(pc){
        pc.pa_fc = it.pa; pc.pv_central = it.pv;
        if(siteId==='central'){
          let depAfter = depot.find(p=>String(p.id)===String(centralId) || (p.nom||'').toUpperCase().trim()===nomU);
          if(depAfter) pc.qte = parseInt(depAfter.stock)||0;
        }
      } else {
        let depAfter = depot.find(p=>String(p.id)===String(centralId) || (p.nom||'').toUpperCase().trim()===nomU);
        productCache.unshift({id:centralId, nom:it.nom, pa_fc:it.pa, pv_central:it.pv, pv_gombe:it.pv, pv_masina:it.pv, qte: depAfter ? (parseInt(depAfter.stock)||0) : (siteId==='central'?it.qte:0), seuil_alerte:50, stock_max:500, contenance:it.contenance||'Boîte', cond:it.cond||'Boîte', fournisseur:'', lot:it.lot||'', peremption:'', categorie:''});
      }
      if(siteId!=='central'){
        if(!siteProds[siteId]) siteProds[siteId]=[];
        let exS = siteProds[siteId].find(p=>String(p.originalId)===String(centralId) || String(p.id)===String(centralId) || ((p.nom||'').toUpperCase().trim()===nomU));
        if(exS){ exS.stock_site=(parseInt(exS.stock_site)||parseInt(exS.stock)||0)+it.qte; exS.stock=exS.stock_site; exS.pa=it.pa; exS.pv=it.pv; exS.prix=it.pv; if(!exS.originalId) exS.originalId=centralId; }
        else{ siteProds[siteId].push({id:Date.now().toString()+Math.random(), originalId:centralId, produitId:centralId, nom:it.nom, lot:it.lot, pa:it.pa, pv:it.pv, prix:it.pv, stock_site:it.qte, stock:it.qte}); }
      }
      localStorage.setItem('dub_prix_last_sync', JSON.stringify({id:centralId, nom:it.nom, pa:it.pa, pv:it.pv, prix:it.pv, date:Date.now()}));
    });
    saveDepot(depot);
    saveSiteProds(siteProds);
    clearReapproCache();
    let histo={id:'H'+Date.now()+'_'+Math.floor(Math.random()*9999),timestamp:new Date().toISOString(),site:getSiteName(siteId),siteId:siteId,total:panier.reduce((a,b)=>a+b.pa*b.qte,0),tauxDepotUniv:getTauxDepotUniversel(),tauxComptoirSite:getTauxComptoirSite(siteId),items:JSON.parse(JSON.stringify(panier))};
    if(!histoParSite[siteId])histoParSite[siteId]=[];histoParSite[siteId].push(histo);
    try{
      localStorage.setItem(KEY_HISTO, JSON.stringify(histoParSite));
      let allNow = readHistoFromStorage();
      localStorage.setItem(KEY_HISTO_ALL, JSON.stringify(allNow));
      localStorage.setItem(KEY_HISTO_BACKUP, JSON.stringify(allNow));
    }catch(e){ console.log('histo save err',e); }
    paniersParSite[siteId]=[];
    saveAll();
    loadAll(); searchProduits(); renderPanier(); renderHisto();
    alert('✅ Enregistré ! Historique : '+readHistoFromStorage().length+' réappro(s)');
  }});
};
loadAll();
searchProduits();
if(getSiteId()==='central' && productCache.length) selectProduit(productCache[0].id);
else clearForm();
renderPanier();renderHisto();updateStock();updateMargeDisplay(2500,3500,40);
document.getElementById('btnRetourMenu').onclick=function(){
if(window.history.length > 1){ window.history.back(); }else{ window.location.href = '/'; }
};
window.debugSite = ()=>{
  let sid = getSiteId();
  console.log('Site actuel:', sid, getSiteName(sid));
  console.log('dub_sites_produits:', JSON.parse(localStorage.getItem(KEY_SITE_PRODS)||'{}'));
  console.log('Produits pour ce site:', getProduitsPourSite(sid));
  console.log('Produits dépôt:', productCache.length);
  return getProduitsPourSite(sid);
};
window.showHisto = ()=>{ console.log('Histo global:', readHistoFromStorage()); return readHistoFromStorage().length; };