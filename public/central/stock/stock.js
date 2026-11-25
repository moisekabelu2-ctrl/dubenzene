const STORAGE_KEY='dubenzen_produits';
const PASSWORD_KEY='dub_mot_de_passe_admin';
function getMotDePasse(){ try{ return localStorage.getItem(PASSWORD_KEY) || '1234'; }catch(e){ return '1234'; } }
function setMotDePasse(n){ try{ localStorage.setItem(PASSWORD_KEY, n); }catch(e){} }
function checkMotDePasse(s){ return (s||'').trim() === getMotDePasse(); }
let allProd=[], filtered=[], pendingId=null, pendingSite=null, vueActuelle='global', siteActuel='';
let pageActuelle = 1;
let totalPages = 1;
let totalFiltre = 0;
let debounceTimer = null;
function afficherSuggestions(){ return; }
function norm(s){ return (s||'').toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim(); }
function compact(s){ return norm(s).replace(/\s+/g,''); }
function matchIntelligent(p, q){
  let qq = norm(q); if(!qq) return true;
  let mots = qq.split(/\s+/).filter(Boolean);
  let texte = norm((p.nom||'')+' '+(p.fournisseur||'')+' '+(p.categorie||'')+' '+(p.site||'')+' '+(p.site_nom||''));
  let texteCompact = compact(texte);
  return mots.every(mot => {
    if(texte.includes(mot)) return true;
    if(texteCompact.includes(mot)) return true;
    if(mot.length >= 5){
      for(let w of texte.split(' ')){
        if(w.length === mot.length){
          let diff=0; for(let i=0;i<w.length;i++) if(w[i]!==mot[i]) diff++;
          if(diff<=1) return true;
        }
      }
    }
    return false;
  });
}
function toggleExcelMenu(e){e.stopPropagation();document.getElementById('excelMenu').classList.toggle('show');document.getElementById('viderMenu').classList.remove('show');document.getElementById('vueMenu').classList.remove('show');}
function closeExcelMenu(){document.getElementById('excelMenu').classList.remove('show');}
function toggleViderMenu(e){e.stopPropagation();document.getElementById('viderMenu').classList.toggle('show');document.getElementById('excelMenu').classList.remove('show');document.getElementById('vueMenu').classList.remove('show');}
function closeViderMenu(){document.getElementById('viderMenu').classList.remove('show');}
function toggleVueMenu(e){e.stopPropagation();document.getElementById('vueMenu').classList.toggle('show');document.getElementById('excelMenu').classList.remove('show');document.getElementById('viderMenu').classList.remove('show');}
function closeVueMenu(){document.getElementById('vueMenu').classList.remove('show');}
document.addEventListener('click',function(e){document.querySelectorAll('.excel-wrap').forEach(el=>{if(!el.contains(e.target))el.querySelector('.excel-menu')?.classList.remove('show');});});
function showImportResult(texte,isErreur){
  let el=document.getElementById('importStatus'); if(!el){alert(texte);return;}
  el.style.display='block'; el.style.background=isErreur?'#dc3545':'#22c55e'; el.textContent=texte;
  setTimeout(()=>{el.style.display='none';},15000);
  let hist=JSON.parse(localStorage.getItem('dub_import_history')||'[]');
  hist.unshift({date:new Date().toLocaleString(),texte:texte}); hist=hist.slice(0,5);
  localStorage.setItem('dub_import_history',JSON.stringify(hist)); afficherHistoriqueImport();
}
function afficherHistoriqueImport(){
  let el=document.getElementById('importHistoryList'); if(!el) return;
  let hist=JSON.parse(localStorage.getItem('dub_import_history')||'[]');
  if(!hist.length){el.innerHTML='Aucun import pour l’instant';return;}
  el.innerHTML='📥 Historique : '+hist.map(h=>h.date+' - '+h.texte).join('<br>');
}
function openChangePassword(){document.getElementById('oldPass').value='';document.getElementById('newPass').value='';document.getElementById('confirmNewPass').value='';document.getElementById('showPassCheck').checked=false;document.getElementById('changePassError').style.display='none';document.getElementById('changePassSuccess').style.display='none';document.getElementById('changePassModal').classList.add('show');}
function closeChangePassword(){document.getElementById('changePassModal').classList.remove('show');}
function toggleShowPass(){let s=document.getElementById('showPassCheck').checked;let t=s?'text':'password';document.getElementById('oldPass').type=t;document.getElementById('newPass').type=t;document.getElementById('confirmNewPass').type=t;}
function confirmChangePassword(){let a=document.getElementById('oldPass').value.trim();let n=document.getElementById('newPass').value.trim();let c=document.getElementById('confirmNewPass').value.trim();let err=document.getElementById('changePassError');let ok=document.getElementById('changePassSuccess');err.style.display='none';ok.style.display='none';if(a!==getMotDePasse()){err.textContent='❌ Ancien incorrect';err.style.display='block';return;}if(!n||n.length<4){err.textContent='❌ Trop court';err.style.display='block';return;}if(n!==c){err.textContent='❌ Pas identiques';err.style.display='block';return;}setMotDePasse(n);ok.textContent='✅ Changé : '+n;ok.style.display='block';setTimeout(()=>{closeChangePassword();alert('✅ Changé : '+n);},800);}
function getUserRole(){let r=localStorage.getItem('user_role')||localStorage.getItem('dub_user_role')||localStorage.getItem('role')||'';try{let u=JSON.parse(localStorage.getItem('dub_user')||localStorage.getItem('currentUser')||localStorage.getItem('user')||localStorage.getItem('dub_current_user')||'null');if(u&&u.role)r=u.role;else if(u&&u.type)r=u.type;else if(u&&u.fonction)r=u.fonction;}catch(e){}return (r||'').toString().toLowerCase().trim();}
function isGerantOuVendeur(){let r=getUserRole();return r.includes('gerant')||r.includes('gérant')||r.includes('vendeur')||r.includes('vendeuse')||r.includes('caissier')||r.includes('seller')||r.includes('manager');}
function isAdminOuDepot(){let r=getUserRole();if(!r)return false;return r.includes('admin')||r.includes('depot')||r.includes('dépôt')||r.includes('super')||r.includes('patron')||r.includes('proprietaire');}
function doitCacherPA(){if(isAdminOuDepot())return false;if(isGerantOuVendeur())return true;return false;}
function fmt(n){return (+n||0).toLocaleString();}
function calcMarge(pa,pv){const m=pv-pa;const pct=pa>0?((m/pa)*100).toFixed(0):0;return{m,pct};}

// ===== CORRIGÉ : enrich() - Qté = Max - Stock, sans diviser =====
function enrich(p){
  let stockBrut = p.stock_site ?? p.stock ?? p.quantite ?? p.qte ?? 0;
  p.stock = Number(stockBrut) || 0;
  p.stock_site = p.stock;
  p.quantite = p.stock;
  p.qte = p.stock;
  p.pa=+p.pa||+p.pau||0; p.pau=p.pa; p.pat=p.pa*p.stock;
  let pvBrut=+p.pv||+p.prix||0; let margeBrute=+p.marge||+p.MARGE||0;
  if(!pvBrut && margeBrute>0 && p.pa>0){ pvBrut=p.pa+margeBrute; }
  if(!margeBrute && pvBrut>0 && p.pa>0){ margeBrute=pvBrut-p.pa; }
  p.pv=pvBrut; p.prix=pvBrut; p.marge=margeBrute; p.pvt=p.pv*p.stock;
  p.contenance=+p.contenance||1;
  p.stock_alerte = Number(p.alerte ?? p.stock_alerte ?? 5);
  if(isNaN(p.stock_alerte)) p.stock_alerte = 5;
  p.alerte = p.stock_alerte;
  p.stock_max = Number(p.stock_max ?? p.max ?? 0) || 0;
  p.max = p.stock_max;
  // ★ RÈGLE : Stock 0 = toujours à commander, Qté = Max - Stock
  if(p.stock === 0){
    p.a_commander = p.stock_max > 0 ? p.stock_max : 0;
  } else if(p.stock_max > 0 && p.stock <= p.stock_alerte){
    p.a_commander = Math.max(0, p.stock_max - p.stock);
  } else {
    p.a_commander = 0;
  }
  return p;
}
function getDepotProducts(){try{return JSON.parse(localStorage.getItem(STORAGE_KEY)||localStorage.getItem('produits')||'[]').map(p=>enrich({...p}));}catch(e){return[];}}
function getSitesList(){try{let s=JSON.parse(localStorage.getItem('dub_sites')||'[]');if(Array.isArray(s)&&s.length)return s.map(x=>typeof x==='string'?{nom:x,id:x}:{nom:x.nom||x.name||x.id,id:x.id||x.nom||x.name});}catch(e){}try{let sp=JSON.parse(localStorage.getItem('dub_sites_produits')||'{}');let keys=Object.keys(sp);if(keys.length)return keys.map(k=>({nom:k,id:k}));}catch(e){}let all=getDepotProducts();let noms=[...new Set(all.map(p=>p.site||p.site_nom).filter(Boolean))].filter(n=>n!=='Dépôt');return noms.map(n=>({nom:n,id:n}));}
function getSiteProducts(siteId){
  try{
    let sp=JSON.parse(localStorage.getItem('dub_sites_produits')||'{}');
    let liste=null; let vraiId=siteId;
    if(sp[siteId]&&Array.isArray(sp[siteId])){ liste=sp[siteId]; }
    else{ for(let k of Object.keys(sp)){ if(k.toLowerCase()===String(siteId).toLowerCase()){ liste=sp[k]; vraiId=k; break; } } }
    if(liste) return liste.map(p=>enrich({...p,_site:vraiId,_siteNom:vraiId}));
    let sites=JSON.parse(localStorage.getItem('dub_sites')||'[]');
    let existe=sites.some(x=>(x.nom||x)===siteId||(x.nom||'').toLowerCase()===String(siteId).toLowerCase());
    if(existe) return [];
    return getDepotProducts().filter(p=>(p.site===siteId||p.site_nom===siteId)).map(p=>enrich({...p,_site:siteId,_siteNom:siteId}));
  }catch(e){return[];}
}
function getAllSitesProducts(){let sites=getSitesList();let out=[];sites.forEach(s=>{let list=getSiteProducts(s.id);out.push(...list.filter(p=>(p._site||p.site)!=='Dépôt'));});return out;}
function getStats(list){let qte=list.reduce((s,p)=>s+(+p.stock||0),0);let valPA=list.reduce((s,p)=>s+((+p.pa||0)*(+p.stock||0)),0);let valPV=list.reduce((s,p)=>s+(((+p.pv||0))*(+p.stock||0)),0);return{qte,valPA,valPV,marge:valPV-valPA,nb:list.length};}
function getCurrentList(){let depot=getDepotProducts().filter(p=>!p.site||p.site==='Dépôt'||p.site==='Dépôt Central');let sitesAll=getAllSitesProducts();if(vueActuelle==='depot')return depot.map(p=>enrich({...p,_site:'Dépôt',_siteNom:'Dépôt Central'}));if(vueActuelle==='sites')return sitesAll;if(vueActuelle==='site')return siteActuel?getSiteProducts(siteActuel):sitesAll;let hasSP=false;try{let sp=JSON.parse(localStorage.getItem('dub_sites_produits')||'{}');hasSP=Object.keys(sp).length>0;}catch(e){}if(hasSP)return[...depot.map(p=>enrich({...p,_site:'Dépôt',_siteNom:'Dépôt Central'})),...sitesAll];return getDepotProducts().map(p=>enrich({...p,_site:p.site||'Dépôt',_siteNom:p.site_nom||p.site||'Dépôt Central'}));}
function updateVueButton(){let label = vueActuelle==='depot' ? '🏭 Dépôt' : vueActuelle==='sites' ? '🏪 Sites' : vueActuelle==='site' ? '📍 '+(siteActuel||'') : '🌍 Global';let b=document.getElementById('btnVue'); if(b) b.textContent = '👁️ '+label+' ▾';['depot','global','sites','site'].forEach(v=>{let el=document.getElementById('vueBtn-'+v);if(el) el.classList.toggle('active', v===vueActuelle);});}
function setVue(v){vueActuelle=v;let sel=document.getElementById('selSite');if(v==='site'){sel.style.display='block';let sites=getSitesList();sel.innerHTML=sites.map(s=>`<option value="${s.id}">${s.nom}</option>`).join('')||'<option value="">Aucun site</option>';if(!siteActuel&&sites.length)siteActuel=sites[0].id;sel.value=siteActuel;}else{sel.style.display='none';}updateVueButton();pageActuelle=1; load();}
function onSiteChange(){siteActuel=document.getElementById('selSite').value;updateVueButton();pageActuelle=1; load();}
function getData(){return getDepotProducts();}
function saveData(){localStorage.setItem(STORAGE_KEY,JSON.stringify(allProd));localStorage.setItem('produits',JSON.stringify(allProd));}
function renderArticlesCounts(depotList,sitesList,globalList){
  let sites=getSitesList();
  let e1=document.getElementById('stockDepotNb'); if(e1) e1.textContent='📦 '+fmt(depotList.length)+' articles';
  let e2=document.getElementById('stockSiteNb'); if(e2) e2.textContent='📦 '+fmt(sitesList.length)+' articles';
  let e3=document.getElementById('stockGlobalNb'); if(e3) e3.textContent='📦 '+fmt(globalList.length)+' articles';
  let e4=document.getElementById('articlesTotal'); if(e4) e4.textContent='Total : '+fmt(globalList.length);
  let html=`<div class="article-chip"><div style="font-size:11px;color:#5a6080">🏭 DÉPÔT</div><div style="font-size:22px;font-weight:900;color:#facc15">${fmt(depotList.length)}</div><div style="font-size:11px;color:#6a7085">Qté ${fmt(depotList.reduce((s,p)=>s+(+p.stock||0),0))}</div></div>`;
  sites.forEach(s=>{ let list=getSiteProducts(s.id); html+=`<div class="article-chip"><div style="font-size:11px;color:#5a6080">📍 ${s.nom}</div><div style="font-size:22px;font-weight:900;color:#22c55e">${fmt(list.length)}</div><div style="font-size:11px;color:#6a7085">Qté ${fmt(list.reduce((a,p)=>a+(+p.stock||0),0))}</div></div>`; });
  html+=`<div class="article-chip" style="border-color:#22c55e"><div style="font-size:11px;color:#5a6080">🌍 GLOBAL</div><div style="font-size:22px;font-weight:900">${fmt(globalList.length)}</div><div style="font-size:11px;color:#6a7085">Dépôt + Sites</div></div>`;
  let ab=document.getElementById('articlesBar'); if(ab) ab.innerHTML=html;
}
function load(){
  updateVueButton();
  let q = (document.getElementById('search')?.value || '').trim();
  let sug=document.getElementById('searchSuggestions'); if(sug){ sug.innerHTML=''; sug.style.display='none'; }
  let tout = getCurrentList();
  allProd = tout;
  try{
    let depotList=getDepotProducts().filter(p=>!p.site||p.site==='Dépôt'||p.site==='Dépôt Central');
    let sitesList=getAllSitesProducts();
    let hasSP=false;try{let sp=JSON.parse(localStorage.getItem('dub_sites_produits')||'{}');hasSP=Object.keys(sp).length>0;}catch(e){}
    let globalList=hasSP?[...depotList,...sitesList]:getDepotProducts();
    let sDepot=getStats(depotList);let sSites=getStats(sitesList);let sGlobal=getStats(globalList);
    renderArticlesCounts(depotList,sitesList,globalList);
    let a=document.getElementById('stockDepot'); if(a) a.textContent=fmt(sDepot.qte);
    let b=document.getElementById('stockDepotDetail'); if(b) b.textContent=`PAT ${fmt(sDepot.valPA)}`;
    let c=document.getElementById('stockSite'); if(c) c.textContent=fmt(sSites.qte);
    let d=document.getElementById('stockSiteDetail'); if(d) d.textContent=`PAT ${fmt(sSites.valPA)} • PVT ${fmt(sSites.valPV)}`;
    let e=document.getElementById('stockGlobal'); if(e) e.textContent=fmt(sGlobal.qte);
    let f=document.getElementById('stockGlobalDetail'); if(f) f.textContent=`PAT ${fmt(sGlobal.valPA)} • PVT ${fmt(sSites.valPV)}`;
    let sv=document.getElementById('stockVue'); if(sv) sv.textContent=fmt(sGlobal.qte);
    let svs=document.getElementById('stockVueSub'); if(svs) svs.textContent='🌍 Global';
    let vpa=document.getElementById('valeurPAVue'); if(vpa && !doitCacherPA()) vpa.textContent=fmt(sGlobal.valPA);
    let vpv=document.getElementById('valeurPVVue'); if(vpv) vpv.textContent=fmt(sSites.valPV);
    let al=document.getElementById('stockAlerte'); if(al) al.textContent=globalList.filter(p=>(+p.stock||0)<=(+p.stock_alerte||+p.alerte||5)).length;
  }catch(err){}
  let listeFiltree = tout;
  if(q){
    listeFiltree = tout.filter(p => matchIntelligent(p, q));
    let premier = norm(q).split(' ')[0];
    listeFiltree.sort((a,b)=>{
      let an = norm(a.nom||'').startsWith(premier) ? 0 : 1;
      let bn = norm(b.nom||'').startsWith(premier) ? 0 : 1;
      return an - bn;
    });
  }
  totalFiltre = listeFiltree.length;
  totalPages = Math.max(1, Math.ceil(totalFiltre / 20));
  if(pageActuelle > totalPages) pageActuelle = totalPages;
  let debut = (pageActuelle - 1) * 20;
  filtered = listeFiltree.slice(debut, debut + 20);
  let label=vueActuelle==='depot'?'🏭 Dépôt':vueActuelle==='sites'?'🏪 Sites':vueActuelle==='site'?`📍 ${siteActuel||''}`:'🌍 Global';
  let vl=document.getElementById('vueLabel'); if(vl) vl.textContent=label+` • ${totalFiltre}`;
  let titreEl=document.getElementById('titreListeProduits'); if(titreEl) titreEl.textContent='Liste Produits - '+label;
  let countEl=document.getElementById('countListeProduits'); if(countEl) countEl.textContent = q?`"${q}" : ${totalFiltre}`:`${totalFiltre}`;
  let infoEl=document.getElementById('searchInfo'); if(infoEl) infoEl.textContent = q?`${totalFiltre} trouvé(s)`:'';
  let sites=getSitesList();
  let qs=(document.getElementById('searchSite')?.value||'').toLowerCase().trim();
  if(qs) sites=sites.filter(s=>s.nom.toLowerCase().includes(qs));
  let htmlSites='';
  if(sites.length===0)htmlSites=`<tr><td colspan="8" style="text-align:center;padding:20px;color:#6a7085">Aucun site</td></tr>`;
  else{
    let sSites2=getStats(getAllSitesProducts());
    let sDepot2=getStats(getDepotProducts().filter(p=>!p.site||p.site==='Dépôt'||p.site==='Dépôt Central'));
    let sGlobal2=getStats(getCurrentList());
    htmlSites=sites.map(s=>{let list=getSiteProducts(s.id);let st=getStats(list);let margeTxt=doitCacherPA()?'••••':fmt(st.marge);return`<tr><td style="font-weight:700">${s.nom}</td><td style="font-weight:900;color:#22c55e">${fmt(st.nb)}</td><td>${fmt(st.qte)}</td><td>${doitCacherPA()?'••••':fmt(st.valPA)}</td><td style="color:#22c55e;font-weight:700">${fmt(st.valPV)}</td><td>${margeTxt}</td><td><button onclick="voirSite('${s.id}')" class="btn-mini btn-mini-yellow">Voir</button></td><td><button onclick="openClearSite('${s.id}')" class="btn-mini btn-mini-red">🗑️ Vider</button> <button onclick="openZeroSiteQty('${s.id}')" class="btn-mini btn-mini-purple">0️⃣ Qté=0</button></td></tr>`;}).join('');
    if(!qs){
      htmlSites+=`<tr style="background:#0f1115;font-weight:900"><td>TOTAL SITES</td><td>${fmt(sSites2.nb)}</td><td>${fmt(sSites2.qte)}</td><td>${doitCacherPA()?'••••':fmt(sSites2.valPA)}</td><td style="color:#22c55e">${fmt(sSites2.valPV)}</td><td>${doitCacherPA()?'••••':fmt(sSites2.marge)}</td><td>-</td><td>-</td></tr>`;
      htmlSites+=`<tr style="background:rgba(250,204,21,.08);font-weight:900"><td>🏭 DÉPÔT</td><td>${fmt(sDepot2.nb)}</td><td>${fmt(sDepot2.qte)}</td><td>${doitCacherPA()?'••••':fmt(sDepot2.valPA)}</td><td>—</td><td>—</td><td><button onclick="setVue('depot')" class="btn-mini btn-mini-yellow">Voir</button></td><td><button onclick="openClearDepot()" class="btn-mini btn-mini-red">🗑️ Vider</button> <button onclick="openZeroQty()" class="btn-mini btn-mini-orange">0️⃣ Qté=0</button></td></tr>`;
      htmlSites+=`<tr style="background:rgba(34,197,94,.08);font-weight:900"><td>🌍 GLOBAL</td><td>${fmt(sGlobal2.nb)}</td><td>${fmt(sGlobal2.qte)}</td><td>${doitCacherPA()?'••••':fmt(sGlobal2.valPA)}</td><td style="color:#22c55e">${fmt(sSites2.valPV)}</td><td>${doitCacherPA()?'••••':fmt(sSites2.marge)}</td><td><button onclick="setVue('global')" class="btn-mini btn-mini-yellow">Voir</button></td><td><button onclick="openClearAll()" class="btn-mini btn-mini-red">🗑️ Tout</button> <button onclick="openZeroQty()" class="btn-mini btn-mini-orange">0️⃣ Tout</button></td></tr>`;
    }
  }
  let ts=document.getElementById('tbodySites'); if(ts) ts.innerHTML=htmlSites;
  render(filtered); renderPagination(); afficherHistoriqueImport();
}
function renderPagination(){
  let old=document.getElementById('paginationStock');
  if(old) old.remove();
  let tbody=document.getElementById('tbody');
  if(!tbody) return;
  let div=document.createElement('div');
  div.id='paginationStock';
  div.style.cssText='display:flex;gap:8px;justify-content:center;align-items:center;padding:14px;flex-wrap:wrap';
  div.innerHTML=`
    <button onclick="allerPage(1)" ${pageActuelle<=1?'disabled':''} style="padding:8px 14px;border-radius:8px;background:#1f2937;color:#fff;border:1px solid #333;cursor:pointer">⏮️ Début</button>
    <button onclick="allerPage(${pageActuelle-1})" ${pageActuelle<=1?'disabled':''} style="padding:8px 14px;border-radius:8px;background:#1f2937;color:#fff;border:1px solid #333;cursor:pointer">◀️ Préc.</button>
    <span style="font-weight:900;color:#facc15">Page ${pageActuelle} / ${totalPages} • ${totalFiltre}</span>
    <button onclick="allerPage(${pageActuelle+1})" ${pageActuelle>=totalPages?'disabled':''} style="padding:8px 14px;border-radius:8px;background:#facc15;color:#000;border:none;font-weight:900;cursor:pointer">Suiv. ▶️</button>
    <button onclick="allerPage(${totalPages})" ${pageActuelle>=totalPages?'disabled':''} style="padding:8px 14px;border-radius:8px;background:#1f2937;color:#fff;border:1px solid #333;cursor:pointer">Fin ⏭️</button>
  `;
  tbody.parentElement.parentElement.appendChild(div);
}
function allerPage(p){ if(p<1) p=1; if(p>totalPages) p=totalPages; pageActuelle=p; load(); window.scrollTo({top:0,behavior:'smooth'}); }
function onSearchInput(){ clearTimeout(debounceTimer); debounceTimer=setTimeout(()=>{ pageActuelle=1; load(); }, 200); }
function filterSearch(){ onSearchInput(); }
function onSearchSite(){ load(); }
function clearSearch(){let inp = document.getElementById('search');if(inp) inp.value = '';pageActuelle = 1;load();}
function voirSite(id){siteActuel=id;setVue('site');}
function render(list){
 let pvSeulement=doitCacherPA(); let isDepotVue=vueActuelle==='depot';
 if(isDepotVue){document.getElementById('theadRow').innerHTML = pvSeulement ? `<th>Produit</th><th>Site</th><th>Qté</th><th>Statut</th><th>À Commander</th><th>Voir</th><th>Modifier</th><th>Suppr</th>` : `<th>Produit</th><th>Site</th><th>Stock</th><th>PAU</th><th>PAT</th><th>Alerte</th><th>Max</th><th>Cont.</th><th>Fournisseur</th><th>Catégorie</th><th>Péremption</th><th>À Commander</th><th>Statut</th><th>Voir</th><th>Modifier</th><th>Suppr</th>`;}
 else{document.getElementById('theadRow').innerHTML = pvSeulement ? `<th>Produit</th><th>Site</th><th>Qté</th><th>PV</th><th>PVT</th><th>Statut</th><th>Voir</th><th>Modifier</th><th>Suppr</th>` : `<th>Produit</th><th>Site</th><th>Stock</th><th>PAU</th><th>PAT</th><th>MARGE</th><th>PV</th><th>PVT</th><th>Alerte</th><th>Max</th><th>Cont.</th><th>Fournisseur</th><th>Catégorie</th><th>Péremption</th><th>À Commander</th><th>Statut</th><th>Voir</th><th>Modifier</th><th>Suppr</th>`;}
 document.getElementById('tbody').innerHTML=list.map(p=>{
  const pa=+p.pa||0; const pv=+p.pv||0; const {m,pct}=calcMarge(pa,pv);
  const statut=(+p.stock||0)<=(+p.stock_alerte||5)?'Alerte':(p.statut||'Disponible');
  let pvHtml=(!pv||pv<=0)?`<span class="pv-missing">⛔ PV ?</span>`:`<span style="color:#22c55e;font-weight:700">${fmt(pv)}</span>`;
  let siteLabel=p._siteNom||p.site_nom||p.site||'Dépôt';
  let siteIdForEdit=p._site||siteLabel;
  let cmdHtml = p.a_commander>0 ? `<span style="color:#f87171;font-weight:900">${p.a_commander}</span>` : `<span style="color:#22c55e">-</span>`;
  let peremp = p.peremption||p.date_peremption||'-';
  let btnVoir=`<button onclick="goDetail('${p.id}')" class="btn-mini btn-mini-yellow">Voir</button>`;
  let btnEdit=`<button onclick="openEditProduct('${p.id}','${siteIdForEdit}')" class="btn-mini" style="background:#facc15;color:#000;border:0">✏️</button>`;
  let btnDel=`<button onclick="askDelete('${p.id}')" class="btn-mini btn-mini-red">Suppr.</button>`;
  if(isDepotVue){
    if(pvSeulement){return`<tr><td class="prod-name">${p.nom}<div style="font-size:10px;color:#6a7085">${p.fournisseur||''}</div></td><td>${siteLabel}</td><td>${p.stock||0}</td><td><span class="badge ${statut==='Disponible'?'badge-green':'badge-red'}">${statut}</span></td><td>${cmdHtml}</td><td>${btnVoir}</td><td>${btnEdit}</td><td>${btnDel}</td></tr>`;}
    return`<tr><td class="prod-name">${p.nom}<div style="font-size:10px;color:#6a7085">${p.fournisseur||''}</div></td><td>${siteLabel}</td><td style="font-weight:800">${p.stock||0}</td><td>${fmt(pa)}</td><td style="color:#facc15;font-weight:700">${fmt(p.pat)}</td><td>${p.stock_alerte}</td><td>${p.stock_max}</td><td style="font-weight:900">${p.contenance}</td><td>${p.fournisseur||''}</td><td>${p.categorie||''}</td><td>${peremp}</td><td>${cmdHtml}</td><td><span class="badge ${statut==='Disponible'?'badge-green':'badge-red'}">${statut}</span></td><td>${btnVoir}</td><td>${btnEdit}</td><td>${btnDel}</td></tr>`;
  }
  if(pvSeulement){return`<tr><td class="prod-name">${p.nom}<div style="font-size:10px;color:#6a7085">${p.fournisseur||''}</div></td><td>${siteLabel}</td><td>${p.stock||0}</td><td>${pvHtml}</td><td style="color:#22c55e;font-weight:700">${fmt(p.pvt)}</td><td><span class="badge ${statut==='Disponible'?'badge-green':'badge-red'}">${statut}</span></td><td>${btnVoir}</td><td>${btnEdit}</td><td>${btnDel}</td></tr>`;}
  else{return`<tr><td class="prod-name">${p.nom}<div style="font-size:10px;color:#6a7085">${p.fournisseur||''}</div></td><td>${siteLabel}</td><td style="font-weight:800">${p.stock||0}</td><td>${fmt(pa)}</td><td style="color:#facc15;font-weight:700">${fmt(p.pat)}</td><td><span class="badge badge-mb">${fmt(m)} (${pct}%)</span></td><td>${pvHtml}</td><td style="color:#22c55e;font-weight:700">${fmt(p.pvt)}</td><td>${p.stock_alerte}</td><td>${p.stock_max}</td><td style="font-weight:900">${p.contenance}</td><td>${p.fournisseur||''}</td><td>${p.categorie||''}</td><td>${peremp}</td><td>${cmdHtml}</td><td><span class="badge ${statut==='Disponible'?'badge-green':'badge-red'}">${statut}</span></td><td>${btnVoir}</td><td>${btnEdit}</td><td>${btnDel}</td></tr>`;}
 }).join('')||`<tr><td colspan="19" style="text-align:center;padding:30px;color:#6a7085">Aucun produit</td></tr>`;
}
let editProdKey = null;
let editProdSite = null;
function escHtml(s){ return (s||'').toString().replace(/"/g,'&quot;').replace(/</g,'&lt;'); }
function openEditProduct(id, site){
  let p = null;
  if(site && site !== 'Dépôt' && site !== 'Dépôt Central'){
    try{
      let sp = JSON.parse(localStorage.getItem('dub_sites_produits')||'{}');
      let list = sp[site] || [];
      p = list.find(x=>String(x.id)===String(id));
      if(p) editProdSite = site;
    }catch(e){}
  }
  if(!p){
    p = allProd.find(x=>String(x.id)===String(id));
    editProdSite = null;
  }
  if(!p) return alert('Produit introuvable');
  editProdKey = (p.nom||'').toLowerCase().trim();
  let old = document.getElementById('editProdModal');
  if(old) old.remove();
  let div = document.createElement('div');
  div.id = 'editProdModal';
  div.className = 'modal-overlay show';
  div.innerHTML = `
    <div class="modal-box">
      <div class="modal-head"><span>✏️ Modifier Produit</span><button onclick="closeEditProduct()" style="background:transparent;border:0;color:#fff;font-size:20px;cursor:pointer">×</button></div>
      <div class="modal-body" style="display:grid;gap:10px">
        <div><label class="label-mini">Nom</label><input id="e_nom" class="input-code" value="${escHtml(p.nom)}"></div>
        <div><label class="label-mini">Fournisseur</label><input id="e_fournisseur" class="input-code" value="${escHtml(p.fournisseur)}"></div>
        <div><label class="label-mini">Catégorie</label><input id="e_categorie" class="input-code" value="${escHtml(p.categorie)}"></div>
        <div><label class="label-mini">Lot</label><input id="e_lot" class="input-code" value="${escHtml(p.lot)}"></div>
        <div><label class="label-mini">Péremption</label><input id="e_peremption" class="input-code" value="${escHtml(p.peremption)}"></div>
        <div style="display:flex;gap:8px">
          <div style="flex:1"><label class="label-mini">PA</label><input id="e_pa" type="number" class="input-code" value="${p.pa||0}"></div>
          <div style="flex:1"><label class="label-mini">PV</label><input id="e_pv" type="number" class="input-code" value="${p.pv||0}"></div>
        </div>
        <div style="display:flex;gap:8px">
          <div style="flex:1"><label class="label-mini">Alerte</label><input id="e_alerte" type="number" class="input-code" value="${p.stock_alerte||5}"></div>
          <div style="flex:1"><label class="label-mini">Max</label><input id="e_max" type="number" class="input-code" value="${p.stock_max||0}"></div>
        </div>
        <p style="font-size:11px;color:#facc15">✅ Modifié au Dépôt + dans tous les Sites où ce produit existe. Le stock ne change pas.</p>
      </div>
      <div class="modal-foot"><button onclick="closeEditProduct()" class="btn btn-dark">Annuler</button><button onclick="saveEditProduct()" class="btn btn-green">💾 Sauver partout</button></div>
    </div>`;
  document.body.appendChild(div);
}
function closeEditProduct(){
  let m = document.getElementById('editProdModal');
  if(m) m.remove();
  editProdKey = null; editProdSite = null;
}
function saveEditProduct(){
  let nom = document.getElementById('e_nom').value.trim();
  let four = document.getElementById('e_fournisseur').value.trim();
  let cat = document.getElementById('e_categorie').value.trim();
  let lot = document.getElementById('e_lot').value.trim();
  let per = document.getElementById('e_peremption').value.trim();
  let pa = parseFloat(document.getElementById('e_pa').value)||0;
  let pv = parseFloat(document.getElementById('e_pv').value)||0;
  let alerte = parseInt(document.getElementById('e_alerte').value)||5;
  let max = parseFloat(document.getElementById('e_max').value)||0;
  if(!nom) return alert('Nom obligatoire');
  try{
    let depot = JSON.parse(localStorage.getItem(STORAGE_KEY)||'[]');
    depot.forEach(p=>{
      if((p.nom||'').toLowerCase().trim() === editProdKey){
        p.nom = nom; p.fournisseur = four; p.categorie = cat; p.lot = lot; p.peremption = per;
        p.pa = pa; p.pau = pa; p.pv = pv; p.prix = pv;
        p.stock_alerte = alerte; p.alerte = alerte; p.stock_max = max;
        if(pa>0 && pv>0) p.marge = ((pv-pa)/pa*100);
      }
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(depot));
    localStorage.setItem('produits', JSON.stringify(depot));
  }catch(e){}
  try{
    let sp = JSON.parse(localStorage.getItem('dub_sites_produits')||'{}');
    Object.keys(sp).forEach(siteId=>{
      (sp[siteId]||[]).forEach(p=>{
        if((p.nom||'').toLowerCase().trim() === editProdKey){
          p.nom = nom; p.fournisseur = four; p.categorie = cat; p.lot = lot; p.peremption = per;
          if(p.margePropre && p.marge>0){
            p.pa = pa; p.prixAchat = pa;
            p.pv = Math.round(pa*(1+p.marge/100)); p.prix = p.pv;
          } else {
            p.pa = pa; p.prixAchat = pa; p.pv = pv; p.prix = pv;
            if(pa>0 && pv>0) p.marge = ((pv-pa)/pa*100);
          }
          p.stock_alerte = alerte; p.alerte = alerte; p.stock_max = max;
        }
      });
    });
    localStorage.setItem('dub_sites_produits', JSON.stringify(sp));
  }catch(e){}
  closeEditProduct();
  load();
  alert('✅ Modifié partout : Dépôt + Sites');
}
function askDelete(id){let foundInSite=null;let foundProd=null;try{let sp=JSON.parse(localStorage.getItem('dub_sites_produits')||'{}');for(let k of Object.keys(sp)){let p=sp[k].find(x=>String(x.id)===String(id));if(p){foundInSite=k;foundProd=p;break;}}}catch(e){}if(foundProd){pendingId=id;pendingSite=foundInSite;document.getElementById('deleteName').innerText=foundProd.nom+' ('+foundInSite+')';document.getElementById('deleteCode').value='';document.getElementById('codeError').style.display='none';document.getElementById('deleteModal').classList.add('show');return;}const p=allProd.find(x=>String(x.id)===String(id));if(!p)return;pendingId=id;pendingSite=null;document.getElementById('deleteName').innerText=p.nom;document.getElementById('deleteCode').value='';document.getElementById('codeError').style.display='none';document.getElementById('deleteModal').classList.add('show');}
function closeModal(){document.getElementById('deleteModal').classList.remove('show');}
function confirmDelete(){if(!checkMotDePasse(document.getElementById('deleteCode').value)){document.getElementById('codeError').style.display='block';return;}if(pendingSite){try{let sp=JSON.parse(localStorage.getItem('dub_sites_produits')||'{}');sp[pendingSite]=sp[pendingSite].filter(p=>String(p.id)!==String(pendingId));localStorage.setItem('dub_sites_produits',JSON.stringify(sp));}catch(e){}pendingSite=null;}else{allProd=allProd.filter(p=>String(p.id)!==String(pendingId));saveData();}closeModal();load();}
function openClearDepot(){let c=getDepotProducts().filter(p=>!p.site||p.site==='Dépôt'||p.site==='Dépôt Central').length;if(c===0){alert('Dépôt vide');return;}document.getElementById('clearDepotCount').textContent='Supprimer '+c+' produits ?';document.getElementById('clearDepotPass').value='';document.getElementById('clearDepotConfirm').value='';document.getElementById('clearDepotError').style.display='none';document.getElementById('clearDepotModal').classList.add('show');}
function closeClearDepot(){document.getElementById('clearDepotModal').classList.remove('show');}
function confirmClearDepot(){let pass=document.getElementById('clearDepotPass').value;let cf=document.getElementById('clearDepotConfirm').value.trim();let err=document.getElementById('clearDepotError');if(!checkMotDePasse(pass)){err.textContent='❌ Incorrect';err.style.display='block';return;}if(cf!=='VIDER'){err.textContent='❌ Tape VIDER';err.style.display='block';return;}if(!confirm('Vider Dépôt ?')){return;}allProd=[];localStorage.setItem(STORAGE_KEY,JSON.stringify([]));localStorage.setItem('produits',JSON.stringify([]));closeClearDepot();load();alert('✅ Dépôt vidé.');}
function openClearSite(pre){let sites=getSitesList();if(sites.length===0){alert('Aucun site');return;}let sel=document.getElementById('clearSiteSelect');sel.innerHTML=sites.map(s=>`<option value="${s.id}">${s.nom}</option>`).join('');if(pre)sel.value=pre;updateClearSiteCount();document.getElementById('clearSitePass').value='';document.getElementById('clearSiteConfirm').value='';document.getElementById('clearSiteError').style.display='none';document.getElementById('clearSiteModal').classList.add('show');}
function updateClearSiteCount(){let id=document.getElementById('clearSiteSelect').value;let list=getSiteProducts(id);let n=document.getElementById('clearSiteSelect').options[document.getElementById('clearSiteSelect').selectedIndex]?.text||id;document.getElementById('clearSiteCount').textContent=n+' - '+list.length+' articles - Qté : '+fmt(list.reduce((s,p)=>s+(+p.stock||0),0));}
function closeClearSite(){document.getElementById('clearSiteModal').classList.remove('show');}
function confirmClearSite(){let id=document.getElementById('clearSiteSelect').value;let pass=document.getElementById('clearSitePass').value;let cf=document.getElementById('clearSiteConfirm').value.trim();let err=document.getElementById('clearSiteError');if(!checkMotDePasse(pass)){err.textContent='❌ Incorrect';err.style.display='block';return;}if(cf!=='VIDER'){err.textContent='❌ Tape VIDER';err.style.display='block';return;}let n=document.getElementById('clearSiteSelect').options[document.getElementById('clearSiteSelect').selectedIndex]?.text||id;if(!confirm('Vider '+n+' ?')){return;}try{let sp=JSON.parse(localStorage.getItem('dub_sites_produits')||'{}');sp[id]=[];localStorage.setItem('dub_sites_produits',JSON.stringify(sp));}catch(e){}closeClearSite();load();alert('✅ '+n+' vidé.');}
function openClearAll(){let d=getDepotProducts().length;let s=getAllSitesProducts().length;let t=d+s;if(t===0){alert('Déjà vide');return;}document.getElementById('clearAllCount').textContent='Supprimer TOUT : '+d+' Dépôt + '+s+' Sites = '+t;document.getElementById('clearAllPass').value='';document.getElementById('clearAllConfirm').value='';document.getElementById('clearAllError').style.display='none';document.getElementById('clearAllModal').classList.add('show');}
function closeClearAll(){document.getElementById('clearAllModal').classList.remove('show');}
function confirmClearAll(){let pass=document.getElementById('clearAllPass').value;let cf=document.getElementById('clearAllConfirm').value.trim();let err=document.getElementById('clearAllError');if(!checkMotDePasse(pass)){err.textContent='❌ Incorrect';err.style.display='block';return;}if(cf!=='TOUT'){err.textContent='❌ Tape TOUT';err.style.display='block';return;}if(!confirm('Tout supprimer ?')){return;}allProd=[];localStorage.setItem(STORAGE_KEY,JSON.stringify([]));localStorage.setItem('produits',JSON.stringify([]));localStorage.setItem('dub_sites_produits',JSON.stringify({}));closeClearAll();load();alert('✅ Tout vidé.');}
function openZeroQty(){let d=getDepotProducts().length;let s=getAllSitesProducts().length;let t=d+s;if(t===0){alert('Aucun produit');return;}document.getElementById('zeroQtyCount').textContent='Mettre à 0 : '+t+' articles ('+d+' + '+s+')';document.getElementById('zeroQtyPass').value='';document.getElementById('zeroQtyConfirm').value='';document.getElementById('zeroQtyError').style.display='none';document.getElementById('zeroQtyOnlyDepot').checked=false;document.getElementById('zeroQtyModal').classList.add('show');}
function closeZeroQty(){document.getElementById('zeroQtyModal').classList.remove('show');}
function confirmZeroQty(){let pass=document.getElementById('zeroQtyPass').value;let cf=document.getElementById('zeroQtyConfirm').value.trim();let only=document.getElementById('zeroQtyOnlyDepot').checked;let err=document.getElementById('zeroQtyError');if(!checkMotDePasse(pass)){err.textContent='❌ Incorrect';err.style.display='block';return;}if(cf!=='ZERO'){err.textContent='❌ Tape ZERO';err.style.display='block';return;}if(!confirm(only?'Mettre à 0 Dépôt ?':'Mettre à 0 Dépôt + Sites ?')){return;}let depot=getDepotProducts();depot.forEach(p=>{p.stock=0;p.quantite=0;p.qte=0;p.pat=0;p.stock_site=0;});localStorage.setItem(STORAGE_KEY,JSON.stringify(depot));localStorage.setItem('produits',JSON.stringify(depot));if(!only){try{let sp=JSON.parse(localStorage.getItem('dub_sites_produits')||'{}');Object.keys(sp).forEach(k=>{sp[k].forEach(p=>{p.stock=0;p.quantite=0;p.qte=0;p.pat=0;p.pvt=0;p.stock_site=0;});});localStorage.setItem('dub_sites_produits',JSON.stringify(sp));}catch(e){}}closeZeroQty();load();alert('✅ Qté = 0.');}
function openZeroSiteQty(pre){let sites=getSitesList();if(sites.length===0){alert('Aucun site');return;}let sel=document.getElementById('zeroSiteSelect');sel.innerHTML=sites.map(s=>`<option value="${s.id}">${s.nom}</option>`).join('');if(pre)sel.value=pre;updateZeroSiteCount();document.getElementById('zeroSitePass').value='';document.getElementById('zeroSiteConfirm').value='';document.getElementById('zeroSiteError').style.display='none';document.getElementById('zeroSiteQtyModal').classList.add('show');}
function updateZeroSiteCount(){let id=document.getElementById('zeroSiteSelect').value;let list=getSiteProducts(id);let n=document.getElementById('zeroSiteSelect').options[document.getElementById('zeroSiteSelect').selectedIndex]?.text||id;document.getElementById('zeroSiteCount').textContent=n+' - '+list.length+' articles - Qté '+fmt(list.reduce((s,p)=>s+(+p.stock||0),0));}
function closeZeroSiteQty(){document.getElementById('zeroSiteQtyModal').classList.remove('show');}
function confirmZeroSiteQty(){let id=document.getElementById('zeroSiteSelect').value;let pass=document.getElementById('zeroSitePass').value;let cf=document.getElementById('zeroSiteConfirm').value.trim();let err=document.getElementById('zeroSiteError');if(!checkMotDePasse(pass)){err.textContent='❌ Incorrect';err.style.display='block';return;}if(cf!=='ZERO'){err.textContent='❌ Tape ZERO';err.style.display='block';return;}let n=document.getElementById('zeroSiteSelect').options[document.getElementById('zeroSiteSelect').selectedIndex]?.text||id;if(!confirm('Mettre à 0 '+n+' ?')){return;}try{let sp=JSON.parse(localStorage.getItem('dub_sites_produits')||'{}');if(sp[id]){sp[id].forEach(p=>{p.stock=0;p.quantite=0;p.qte=0;p.pat=0;p.pvt=0;p.stock_site=0;});localStorage.setItem('dub_sites_produits',JSON.stringify(sp));}}catch(e){}closeZeroSiteQty();load();alert('✅ '+n+' à 0.');}
function goDetail(id){try{sessionStorage.setItem('dub_last_produit_vu',id);sessionStorage.setItem('dub_return_to','stock');}catch(e){}let target=`../produits/details.html?id=${id}`;try{const parentDoc=window.parent.document;let iframe=parentDoc.querySelector('iframe');if(iframe){iframe.src=target;return;}}catch(e){}window.location.href=target;}
load();