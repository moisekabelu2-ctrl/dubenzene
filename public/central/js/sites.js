if(!localStorage.getItem('dub_current_user_id') || localStorage.getItem('isLogged')!=='true'){ alert('⚠️ Connecte-toi d\'abord'); location.href='login.html'; }
const KEY_SITES='dub_sites';const KEY_PROD='dubenzen_produits';const KEY_SITE_PRODS='dub_sites_produits';const KEY_USERS='dub_users';const KEY_CURRENT='dub_current_user_id';const KEY_VENTES='dub_ventes';
let _cache={sites:null,prods:null,siteProds:null,users:null};
function invalidateCache(){ _cache={sites:null,prods:null,siteProds:null,users:null}; }
function getSites(){ if(_cache.sites) return _cache.sites; try{ _cache.sites=JSON.parse(localStorage.getItem(KEY_SITES)||'[]'); }catch(e){ _cache.sites=[]; } return _cache.sites; }
function getAllProds(){ if(_cache.prods) return _cache.prods; try{ _cache.prods=JSON.parse(localStorage.getItem(KEY_PROD)||'[]'); }catch(e){ _cache.prods=[]; } return _cache.prods; }
function getSiteProds(){ if(_cache.siteProds) return _cache.siteProds; try{ _cache.siteProds=JSON.parse(localStorage.getItem(KEY_SITE_PRODS)||'{}'); }catch(e){ _cache.siteProds={}; } return _cache.siteProds; }
function saveSites(l){ _cache.sites=l; localStorage.setItem(KEY_SITES,JSON.stringify(l)); }
function saveSiteProds(o){ _cache.siteProds=o; localStorage.setItem(KEY_SITE_PRODS,JSON.stringify(o)); }
function saveProds(l){ _cache.prods=l; localStorage.setItem(KEY_PROD,JSON.stringify(l)); }
function getUsers(){ if(_cache.users) return _cache.users; try{ _cache.users=JSON.parse(localStorage.getItem(KEY_USERS)||'[]'); }catch(e){ _cache.users=[]; } return _cache.users; }
function getCurrentUser(){let id=localStorage.getItem(KEY_CURRENT);if(!id)return null;let u=getUsers().find(x=>String(x.id)===String(id));return u||null}
let currentSiteId=null;let isDepotView=false;let renameId=null;let pendingQty={};let editingProdId=null;let editingOriginalPA=0;let editingDepotId=null;let editingGroupKey=null;
let filtreStatut='tous';
let pageDetail=1, pageDepot=1, pageDepotView=1;
let debounceDetail=null, debounceDepot=null;
let importSiteChoisi='';
let _lastSyncHash='';
let _groupCache=new Map();
function clearGroupCache(){ _groupCache.clear(); }
function normSearch(s){ return (s||'').toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim(); }
function compactSearch(s){ return normSearch(s).replace(/\s+/g,''); }
function matchIntelligent(p, q){
  let qq=normSearch(q); if(!qq) return true;
  let mots=qq.split(/\s+/).filter(Boolean);
  let texte=normSearch((p.nom||'')+' '+(p.fournisseur||'')+' '+(p.lot||'')+' '+(p.categorie||''));
  let texteCompact=compactSearch(texte);
  return mots.every(mot=>{
    if(texte.includes(mot)) return true;
    if(texteCompact.includes(mot)) return true;
    if(mot.length>=5){
      for(let w of texte.split(' ')){
        if(w.length===mot.length){ let diff=0; for(let i=0;i<w.length;i++) if(w[i]!==mot[i]) diff++; if(diff<=1) return true; }
      }
    }
    return false;
  });
}
function matchGroupIntelligent(g, q){
  let qq=normSearch(q); if(!qq) return true;
  let mots=qq.split(/\s+/).filter(Boolean);
  let texte=normSearch((g.nom||'')+' '+(g.fournisseur||'')+' '+g.lots.map(l=>l.lot).join(' '));
  let texteCompact=compactSearch(texte);
  return mots.every(mot=>{
    if(texte.includes(mot)) return true;
    if(texteCompact.includes(mot)) return true;
    if(mot.length>=5){
      for(let w of texte.split(' ')){
        if(w.length===mot.length){ let diff=0; for(let i=0;i<w.length;i++) if(w[i]!==mot[i]) diff++; if(diff<=1) return true; }
      }
    }
    return false;
  });
}
function triIntelligent(list, q){
  if(!q) return list;
  let premier=normSearch(q).split(' ')[0]; if(!premier) return list;
  return [...list].sort((a,b)=>{
    let an=normSearch(a.nom||'').startsWith(premier)?0:1;
    let bn=normSearch(b.nom||'').startsWith(premier)?0:1;
    return an-bn;
  });
}
function paginate(list, page){
  let total=list.length, totalPages=Math.max(1, Math.ceil(total/20));
  if(page>totalPages) page=totalPages; if(page<1) page=1;
  let debut=(page-1)*20;
  return { items:list.slice(debut, debut+20), total, totalPages, page };
}
function renderPagination(elId, page, totalPages, total, fnName){
  let el=document.getElementById(elId); if(!el) return;
  if(totalPages<=1){ el.innerHTML=`<span style="font-weight:900;color:#facc15">Page 1 / 1 • ${total}</span>`; return; }
  el.innerHTML=`<button onclick="${fnName}(1)" ${page<=1?'disabled':''}>⏮️ Début</button><button onclick="${fnName}(${page-1})" ${page<=1?'disabled':''}>◀️ Préc.</button><span style="font-weight:900;color:#facc15">Page ${page} / ${totalPages} • ${total}</span><button class="pag-next" onclick="${fnName}(${page+1})" ${page>=totalPages?'disabled':''}>Suiv. ▶️</button><button onclick="${fnName}(${totalPages})" ${page>=totalPages?'disabled':''}>Fin ⏭️</button>`;
}
function allerPageDetail(p){ pageDetail=p; renderDetail(); window.scrollTo({top:0,behavior:'smooth'}); }
function allerPageDepot(p){ pageDepot=p; renderDepot(); }
function allerPageDepotView(p){ pageDepotView=p; renderDepotView(); }
function onSearchDetail(){ clearTimeout(debounceDetail); debounceDetail=setTimeout(()=>{ pageDetail=1; pageDepotView=1; renderDetail(); }, 250); }
function onSearchDepot(){ clearTimeout(debounceDepot); debounceDepot=setTimeout(()=>{ pageDepot=1; renderDepot(); }, 250); }
function calcMarge(pa,pv){ if(!pa||pa<=0) return 0; return ((pv-pa)/pa*100); }
function calcPV(pa,marge){ return Math.round(pa*(1+marge/100)); }
function paOf(p){ return +p.pa||+p.prixAchat||0; }
function pvOf(p){ let v=+p.pv||+p.prix||+p.prixVente||0; if(v>0) return v; return paOf(p); }
function getMargeOf(p){ if(p.marge!==undefined && p.marge!==null && p.marge!=='') return +p.marge||0; if(p.margin!==undefined) return +p.margin||0; let pa=paOf(p); let pv=pvOf(p); return pa>0 ? calcMarge(pa,pv) : 0; }
function getSiteMarge(siteId){ let s=getSites().find(x=>String(x.id)===String(siteId)); if(!s) return null; if(s.margeDefaut!==undefined && s.margeDefaut!==null && s.margeDefaut!=='' && !isNaN(+s.margeDefaut) && +s.margeDefaut>0) return +s.margeDefaut; if(s.marge!==undefined && s.marge!==null && s.marge!=='' && !isNaN(+s.marge) && +s.marge>0) return +s.marge; return null; }
function resolveMargePourSite(prodDepot, siteId){ let margeSite=getSiteMarge(siteId); if(margeSite!==null && margeSite>0) return {marge:margeSite,peutVendre:true}; return {marge:null,peutVendre:false}; }
function depotStockOf(p){ if(p.stock!==undefined && p.stock!==null && p.stock!=='') return parseInt(p.stock)||0; if(p.quantite!==undefined && p.quantite!==null && p.quantite!=='') return parseInt(p.quantite)||0; if(p.qte!==undefined && p.qte!==null && p.qte!=='') return parseInt(p.qte)||0; return 1; }
function siteStockOf(p){ return p.stock_site!==undefined ? parseInt(p.stock_site)||0 : depotStockOf(p); }
function isDesactive(p){ return p.desactive===true || p.actif===false || p.statut==='desactive' || p.statut==='inactif'; }
function groupKeyOf(p){ return (p.nom||'').toLowerCase().trim(); }
function groupProducts(list, isSite, cacheKey){
  if(cacheKey && _groupCache.has(cacheKey)) return _groupCache.get(cacheKey);
  let map={};
  list.forEach(p=>{
    let k=groupKeyOf(p); if(!k) return;
    let st = isSite ? siteStockOf(p) : depotStockOf(p);
    if(!map[k]){ map[k]={ key:k, nom:p.nom, fournisseur:p.fournisseur||'', pa:paOf(p), pv:pvOf(p), marge:getMargeOf(p), margePropre:!!p.margePropre, stock:0, lots:[], ids:[], peremptions:[], originalIds:[], desactive:isDesactive(p) }; }
    let g=map[k]; g.stock+=st; g.ids.push(p.id); if(p.originalId) g.originalIds.push(p.originalId);
    g.lots.push({ lot:p.lot||'-', stock:st, peremption:p.peremption||'', pa:paOf(p), id:p.id });
    if(p.peremption) g.peremptions.push(p.peremption);
    if(p.margePropre){ g.margePropre=true; g.marge=getMargeOf(p); g.pv=pvOf(p); }
    if(isDesactive(p)) g.desactive=true;
  });
  Object.values(map).forEach(g=>{ g.lots.sort((a,b)=>{ if(!a.peremption) return 1; if(!b.peremption) return -1; return new Date(a.peremption)-new Date(b.peremption); }); g.peremptionProche=g.peremptions.length?g.peremptions.sort()[0]:''; g.lotsTxt=g.lots.map(l=>`Lot ${l.lot} : ${l.stock}`).join('<br>'); g.lotsCourt=g.lots.length>1?g.lots.length+' lots':'1 lot'; });
  let out=Object.values(map);
  if(cacheKey) _groupCache.set(cacheKey,out);
  return out;
}
function normalizeSites(){ let sites=getSites();let sp=getSiteProds();let changed=false; sites.forEach(s=>{ if(!s.id){s.id='site_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,7);changed=true;} if(sp[s.nom] && Array.isArray(sp[s.nom]) && !sp[s.id]){sp[s.id]=sp[s.nom];changed=true;} if(sp[s.nom] && s.nom!==s.id){delete sp[s.nom];changed=true;} if(!sp[s.id] || !Array.isArray(sp[s.id])){sp[s.id]=[];changed=true;} }); Object.keys(sp).forEach(k=>{ let existe=sites.some(s=>String(s.id)===String(k)); if(!existe && k!=='__DEPOT__'){ let existeParNom=sites.some(s=>s.nom===k); if(!existeParNom) delete sp[k]; changed=true; } }); if(changed){saveSites(sites);saveSiteProds(sp);} return {sites,sp}; }
function normalizeRole(r){ return String(r||'').toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g,''); }
function isVendeurRole(){ let u=getCurrentUser(); if(!u) return false; let r=normalizeRole(u.role); return r==='vendeur' || r==='vendeuse'; }
function isManagerRole(){ let u=getCurrentUser(); if(!u) return false; let r=normalizeRole(u.role); return r==='manager' || r==='gerant' || r==='responsable' || r==='gestionnaire'; }
function cleanOrphanUsers(){ let sites=getSites(); let users=getUsers(); let changed=false; users.forEach(u=>{ if(u.siteId || u.siteName){ let existe=sites.some(s=>String(s.id)===String(u.siteId) || s.nom===u.siteName); if(!existe){ u.siteId=null; u.siteName=''; u.site=''; changed=true; } } }); if(changed) localStorage.setItem(KEY_USERS,JSON.stringify(users)); }
function showList(){document.getElementById('view-list').classList.add('show');document.getElementById('view-detail').classList.remove('show');currentSiteId=null;isDepotView=false;render();}
function showDetail(){document.getElementById('view-list').classList.remove('show');document.getElementById('view-detail').classList.add('show');}
function logout(){localStorage.removeItem(KEY_CURRENT);localStorage.removeItem('isLogged');localStorage.removeItem('user');location.href='login.html';}
function setFiltreStatut(f){ filtreStatut=f; pageDetail=1; document.getElementById('fTous').classList.toggle('active',f==='tous'); document.getElementById('fActifs').classList.toggle('active',f==='actifs'); document.getElementById('fDesactives').classList.toggle('active',f==='desactives'); renderDetail(); }
function openDepot(){ isDepotView=true;currentSiteId='__DEPOT__'; pageDepotView=1; document.getElementById('detail-title').textContent='👑 DEPOT CENTRAL'; document.getElementById('detail-sub').textContent='PA seulement'; document.getElementById('loadSection').style.display='none'; document.getElementById('btnLoadDepot').style.display='none'; document.getElementById('btnImport').style.display='none'; document.getElementById('btnExportSite').style.display='none'; document.getElementById('btnExportGlobal').style.display='none'; document.getElementById('btnModele').style.display='none'; document.getElementById('siteMargeBar').style.display='none'; showDetail(); renderDepotView(); }
function renderDepotView(){
  let all=getAllProds(); let q=(document.getElementById('search-site').value||'').trim();
  let grouped=groupProducts(all,false,'depot');
  if(q) grouped=triIntelligent(grouped.filter(g=>matchGroupIntelligent(g,q)), q);
  let ts=grouped.reduce((a,g)=>a+g.stock,0); let tvPA=grouped.reduce((a,g)=>a+g.pa*g.stock,0);
  document.getElementById('detail-stats').innerHTML=`<span class="stat">📦 ${grouped.length} produits</span><span class="stat stat-g">Stock ${ts}</span><span class="stat stat-y">Valeur PA ${tvPA.toLocaleString()} CDF</span>`;
  document.getElementById('thead-site').innerHTML=`<tr><th>Produit</th><th>Lots</th><th>Péremption proche</th><th>Stock Dépôt</th><th>PA</th><th>Valeur PA</th><th>Action</th></tr>`;
  let pg=paginate(grouped, pageDepotView); pageDepotView=pg.page;
  document.getElementById('tbody-site').innerHTML=pg.items.map(g=>{ let jr=g.peremptionProche?Math.ceil((new Date(g.peremptionProche)-new Date())/(1000*60*60*24)):9999; let col=jr<0?'#f87171':jr<30?'#fb923c':'#22c55e'; return `<tr><td style="font-weight:700">${g.nom}<br><small style="color:#6a7085">🏭 ${g.fournisseur}</small></td><td><span style="background:rgba(96,165,250,.15);color:#60a5fa;padding:3px 8px;border-radius:999px;font-size:11px;font-weight:900">${g.lotsCourt}</span><br><small style="color:#6a7085">${g.lotsTxt}</small></td><td style="color:${col}">${g.peremptionProche||'-'}</td><td style="font-weight:900;color:#22c55e">${g.stock}</td><td style="color:#facc15">${g.pa.toLocaleString()}</td><td>${(g.pa*g.stock).toLocaleString()}</td><td><button onclick="openDepotPAModalGroup('${g.key}')" style="background:#facc15;color:#000;border:0;padding:6px 10px;border-radius:6px;font-weight:900;font-size:11px">✏️ PA</button> <button onclick="goToProduits()" style="background:#171a23;color:#fff;border:1px solid #222735;padding:6px 10px;border-radius:6px;font-weight:800;font-size:11px">Voir →</button></td></tr>`; }).join('')||`<tr><td colspan="7" style="text-align:center;padding:20px;color:#6a7085">Aucun produit au dépôt</td></tr>`;
  renderPagination('paginationDetail', pg.page, pg.totalPages, pg.total, 'allerPageDepotView');
}
document.addEventListener('input',(e)=>{ if(e.target.id==='search-site' && isDepotView) renderDepotView(); });
function goToProduits(){ try{ let iframe=window.parent.document.querySelector('iframe'); if(iframe){iframe.src='produits.html';localStorage.setItem('lastPage','produits.html');localStorage.setItem('lastId','m2');return;} }catch(e){} location.href='produits.html'; }
function applyPrixSync(){
  try{
    let all=getAllProds(); if(!all.length) return;
    let hash=all.length+'|'+all.reduce((a,p)=>a+(+p.pa||0),0)+'|'+all.reduce((a,p)=>a+(p.nom||'').length,0);
    if(hash===_lastSyncHash) return;
    _lastSyncHash=hash;
    let byId={}; let byNom={};
    all.forEach(p=>{ byId[String(p.id)]=p; if(p.nom) byNom[p.nom.toLowerCase().trim()]=p; });
    let sp=getSiteProds(); let changed=false;
    for(let siteId of Object.keys(sp)){
      let list=sp[siteId]; if(!Array.isArray(list)) continue;
      for(let item of list){
        let central=null;
        if(item.originalId && byId[String(item.originalId)]) central=byId[String(item.originalId)];
        else if(item.id && byId[String(item.id)]) central=byId[String(item.id)];
        else if(item.nom && byNom[item.nom.toLowerCase().trim()]) central=byNom[item.nom.toLowerCase().trim()];
        if(!central) continue;
        if(!item.originalId){ item.originalId=central.id; changed=true; }
        if(central.fournisseur && item.fournisseur!==central.fournisseur){ item.fournisseur=central.fournisseur; changed=true; }
        if(central.categorie && item.categorie!==central.categorie){ item.categorie=central.categorie; changed=true; }
        if(central.lot && item.lot!==central.lot){ item.lot=central.lot; changed=true; }
        if(central.peremption && item.peremption!==central.peremption){ item.peremption=central.peremption; changed=true; }
        if(central.conditionnement && item.conditionnement!==central.conditionnement){ item.conditionnement=central.conditionnement; changed=true; }
        if(central.barcode && item.barcode!==central.barcode){ item.barcode=central.barcode; changed=true; }
        if(central.code && item.code!==central.code){ item.code=central.code; changed=true; }
        if(item.pa!==central.pa){
          let margeAUtiliser=item.margePropre?getMargeOf(item):(getSiteMarge(siteId)!==null?getSiteMarge(siteId):getMargeOf(item));
          item.pa=central.pa; item.prixAchat=central.pa;
          if(margeAUtiliser>0){ item.pv=calcPV(central.pa,margeAUtiliser); item.prix=item.pv; }
          else { item.pv=central.pa; item.prix=central.pa; }
          changed=true;
        }
        if(item.stock_site!==undefined && (item.stock===undefined || item.stock!==item.stock_site)){ item.stock=item.stock_site; changed=true; }
      }
    }
    if(changed){ saveSiteProds(sp); clearGroupCache(); }
  }catch(e){ console.error(e); }
}
function render(){
  let cur=getCurrentUser(); let sites=getSites();let sp=getSiteProds();let all=getAllProds(); let who=document.getElementById('whoami');
  if(cur){who.innerHTML=`Connecté: <b style="color:#fff">${cur.nom}</b> <span class="badge b-${normalizeRole(cur.role)}">${cur.role.toUpperCase()}</span> ${cur.siteName?`• 📍 ${cur.siteName}`:''} <span style="margin-left:8px;color:#facc15;cursor:pointer" onclick="logout()">[Logout]</span>`;}else{who.innerHTML='⚠️ Aucun utilisateur';}
  let sitesToShow=sites; if(cur && (isManagerRole() || isVendeurRole())){ sitesToShow=sites.filter(s=>String(s.id)===String(cur.siteId)); document.getElementById('btnNewSite').style.display='none'; if(sitesToShow.length===1 && !currentSiteId){setTimeout(()=>openSite(sitesToShow[0].id),300);} } else {document.getElementById('btnNewSite').style.display='block';}
  let groupedDepot=groupProducts(all,false,'depot');
  let depotStock=groupedDepot.reduce((a,g)=>a+g.stock,0); let depotVal=groupedDepot.reduce((a,g)=>a+g.pa*g.stock,0);
  let depotCard='';
  if(!cur || !isVendeurRole()){ depotCard=`<div class="card" style="border-left:4px solid #c9a86a" onclick="openDepot()"><div style="display:flex;justify-content:space-between"><div style="display:flex;gap:10px"><span style="font-size:20px">👑</span><div><div style="font-weight:900;font-size:13px">DUBENZENNE<br>DEPOT CENTRAL</div><div style="font-size:10px;color:#8a8fa8">PA seulement</div></div></div><span style="font-size:8px;padding:4px 8px;border-radius:999px;background:rgba(201,168,106,.15);color:#c9a86a">DEPOT</span></div><div style="margin-top:14px;display:flex;gap:14px;border-top:1px solid #1f2438;padding-top:10px"><div><div style="font-size:9px;color:#6a7085">Produits</div><div style="font-weight:900">${groupedDepot.length}</div></div><div><div style="font-size:9px;color:#6a7085">Stock</div><div style="font-weight:900;color:#22c55e">${depotStock}</div></div><div><div style="font-size:9px;color:#6a7085">Valeur PA</div><div style="font-weight:900;color:#c9a86a">${depotVal.toLocaleString()} CDF</div></div></div></div>`; }
  if(sitesToShow.length===0 && depotCard===''){document.getElementById('grid').innerHTML=`<div style="grid-column:1/-1;text-align:center;padding:30px;color:#6a7085">Aucun site pour toi.</div>`;return;}
  if(sitesToShow.length===0 && depotCard!==''){document.getElementById('grid').innerHTML=depotCard+`<div style="grid-column:1/-1;text-align:center;padding:20px;color:#6a7085">Aucun site créé</div>`;return;}
  document.getElementById('grid').innerHTML=depotCard+sitesToShow.map(s=>{ let list=sp[s.id]||[]; let grouped=groupProducts(list,true,'site-'+s.id); let actifs=grouped.filter(g=>!g.desactive); let stock=actifs.reduce((a,g)=>a+g.stock,0); let valPA=actifs.reduce((a,g)=>a+g.pa*g.stock,0); let valPV=actifs.reduce((a,g)=>a+g.pv*g.stock,0); let margeDef=getSiteMarge(s.id); let margeTxt=margeDef===null?'⚠️ Marge non définie':'🏷️ Marge : '+margeDef+'%'; let margeColor=margeDef===null?'#f87171':'#22c55e'; let nbDes=grouped.length-actifs.length; return `<div class="card"><div onclick="openSite('${s.id}')" style="display:flex;justify-content:space-between"><div style="display:flex;gap:8px"><span>🏢</span><div><div style="font-weight:900;font-size:13px">${s.nom}</div><div style="font-size:10px;color:#6a7085">📍 ${s.localisation||'-'} • 👤 ${s.responsable||'-'}</div><div style="margin-top:4px"><span style="background:rgba(34,197,94,.12);color:${margeColor};padding:3px 8px;border-radius:999px;font-size:10px;font-weight:900">${margeTxt}</span>${nbDes?`<span style="background:rgba(239,68,68,.15);color:#f87171;padding:3px 8px;border-radius:999px;font-size:10px;font-weight:900;margin-left:4px">⏸️ ${nbDes} désactivé(s)</span>`:''}</div></div></div><span style="font-size:8px;padding:3px 7px;border-radius:999px;border:1px solid #222735;color:#6a7085">SITE</span></div><div onclick="openSite('${s.id}')" style="margin-top:12px;display:flex;gap:12px;border-top:1px solid #1f2438;padding-top:10px"><div><div style="font-size:9px;color:#6a7085">Prod actifs</div><div style="font-weight:800">${actifs.length}</div></div><div><div style="font-size:9px;color:#6a7085">Stock</div><div style="font-weight:800;color:#22c55e">${stock}</div></div><div><div style="font-size:9px;color:#6a7085">Valeur PA</div><div style="font-weight:800">${valPA.toLocaleString()} CDF</div></div><div><div style="font-size:9px;color:#6a7085">Valeur PV</div><div style="font-weight:800;color:#22c55e">${valPV.toLocaleString()} CDF</div></div></div><div style="display:flex;gap:6px;margin-top:10px;border-top:1px solid #1f2438;padding-top:10px"><button class="btn-small" onclick="event.stopPropagation();openRename('${s.id}')">✏️ Renommer</button><button class="btn-small" onclick="event.stopPropagation();openSiteMargeModalFor('${s.id}')" style="color:#22c55e">🏷️ ${margeDef===null?'Définir marge':'Marge '+margeDef+'%'}</button><button class="btn-small" onclick="event.stopPropagation();viderStock('${s.id}')" style="color:#facc15">🧹 Vider stock</button><button class="btn-small" onclick="event.stopPropagation();delSite('${s.id}')" style="color:#f87171">🗑️ Supprimer</button></div></div>`; }).join('');
  setTimeout(()=>{ let before=_lastSyncHash; applyPrixSync(); if(_lastSyncHash!==before){ render(); } }, 0);
}
function openCreate(){document.getElementById('s_marge').value='';document.getElementById('createModal').classList.add('show')}
function closeCreate(){document.getElementById('createModal').classList.remove('show');}
function openRename(id){ renameId=id; let s=getSites().find(x=>String(x.id)===String(id)); document.getElementById('r_nom').value=s?s.nom:''; document.getElementById('renameModal').classList.add('show'); }
function closeRename(){ document.getElementById('renameModal').classList.remove('show'); renameId=null; }
function confirmRename(){ if(!renameId) return; let nouveau=document.getElementById('r_nom').value.trim(); if(!nouveau) return alert('Nom obligatoire'); let sites=getSites(); if(sites.some(s=>String(s.id)!==String(renameId) && s.nom.toLowerCase()===nouveau.toLowerCase())) return alert('Ce nom existe déjà'); let idx=sites.findIndex(s=>String(s.id)===String(renameId)); if(idx<0) return; let ancien=sites[idx].nom; sites[idx].nom=nouveau; saveSites(sites); let sp=getSiteProds(); if(sp[ancien]) delete sp[ancien]; saveSiteProds(sp); closeRename(); render(); alert('✅ Renommé : '+ancien+' → '+nouveau); }
function viderStock(id){ let s=getSites().find(x=>String(x.id)===String(id)); if(!s) return; let sp=getSiteProds(); let list=sp[id]||[]; if(list.length===0) return alert('Ce site est déjà vide ✅'); if(!confirm('🧹 Vider le stock de '+s.nom+' ? Retour au Dépôt.')) return; let all=getAllProds(); let grouped=groupProducts(list,true,'site-'+id); grouped.forEach(g=>{ let reste=g.stock; let depotLots=all.filter(p=>groupKeyOf(p)===g.key).sort((a,b)=>new Date(a.peremption||'9999')-new Date(b.peremption||'9999')); depotLots.forEach(dl=>{ if(reste<=0) return; let add=reste; dl.stock=depotStockOf(dl)+add; reste=0; }); }); saveProds(all); sp[id]=[]; saveSiteProds(sp); clearGroupCache(); render(); alert('✅ Stock vidé - '+s.nom+' à 0'); }
function saveSite(){ let cur=getCurrentUser(); if(cur && isVendeurRole()){alert('❌ Vendeur ne peut pas créer de site');return} let nom=s_nom.value.trim(); if(!nom) return; let sites=getSites(); if(sites.some(s=>s.nom.toLowerCase()===nom.toLowerCase())){document.getElementById('msg').textContent='❌ Ce site existe déjà';return;} let margeInput=document.getElementById('s_marge').value.trim(); let margeDef=margeInput==='' ? null : (parseFloat(margeInput)||0); if(margeDef!==null && margeDef<0) margeDef=0; if(margeDef===0) margeDef=null; let newId='site_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,7); sites.unshift({id:newId,nom:nom,localisation:s_loc.value.trim(),responsable:s_resp.value.trim(),margeDefaut:margeDef,marge:margeDef}); saveSites(sites); let sp=getSiteProds(); sp[newId]=[]; if(sp[nom]) delete sp[nom]; saveSiteProds(sp); clearGroupCache(); render();closeCreate();s_nom.value='';s_loc.value='';s_resp.value='';document.getElementById('s_marge').value=''; document.getElementById('msg').textContent=''; alert('✅ Site créé - '+(margeDef===null?'Marge non définie':'Marge : '+margeDef+'%')); }
function delSite(id){ let cur=getCurrentUser(); if(cur && normalizeRole(cur.role)!=='admin'){alert('❌ Seul ADMIN');return} if(!confirm('Supprimer ?')) return; let s=getSites().find(x=>String(x.id)===String(id)); let nomSite=s?s.nom:''; let sp=getSiteProds(); let list=sp[id]||[]; let all=getAllProds(); let grouped=groupProducts(list,true,'site-'+id); grouped.forEach(g=>{ let dl=all.find(p=>groupKeyOf(p)===g.key); if(dl) dl.stock=depotStockOf(dl)+g.stock; }); saveProds(all); let sites=getSites().filter(x=>String(x.id)!==String(id)); saveSites(sites); delete sp[id]; saveSiteProds(sp); let users=getUsers(); let touches=0; users.forEach(u=>{ if(String(u.siteId)===String(id) || (nomSite && u.siteName===nomSite)){ u.siteId=null; u.siteName=''; u.site=''; touches++; } }); if(touches>0) localStorage.setItem(KEY_USERS,JSON.stringify(users)); clearGroupCache(); alert(touches>0?'✅ Site supprimé + '+touches+' utilisateur(s) libérés.':'✅ Site supprimé'); render(); }
function openSite(id){isDepotView=false;let cur=getCurrentUser();if(cur && (isManagerRole() || isVendeurRole()) && String(cur.siteId)!==String(id)){alert('❌ Accès refusé');return}currentSiteId=id;pendingQty={};pageDetail=1;pageDepot=1;let s=getSites().find(x=>String(x.id)===String(id));if(!s)return;document.getElementById('detail-title').textContent=`🏢 ${s.nom}`;document.getElementById('detail-sub').textContent=`📍 ${s.localisation||'-'} • 👤 ${s.responsable||'-'}`;document.getElementById('loadSection').style.display='none';document.getElementById('btnLoadDepot').style.display='block';document.getElementById('btnImport').style.display='block';document.getElementById('btnExportSite').style.display='block';document.getElementById('btnExportGlobal').style.display='block';document.getElementById('btnModele').style.display='block';showDetail();renderDetail();}
function openSiteMargeModal(){ if(!currentSiteId || currentSiteId==='__DEPOT__') return; openSiteMargeModalFor(currentSiteId); }
function openSiteMargeModalFor(siteId){ let cur=getCurrentUser(); if(cur && isVendeurRole()){alert('❌ Vendeur ne peut pas changer la marge');return;} let s=getSites().find(x=>String(x.id)===String(siteId)); if(!s) return; currentSiteId=siteId; let curMarge=getSiteMarge(siteId); document.getElementById('smSiteName').textContent=s.nom+' - Marge actuelle : '+(curMarge===null?'Non définie':curMarge+'%'); document.getElementById('sm_marge').value=curMarge===null?'':curMarge; document.getElementById('sm_applyAll').checked=true; updateSiteMargePreview(); document.getElementById('siteMargeModal').classList.add('show'); }
function closeSiteMargeModal(){ document.getElementById('siteMargeModal').classList.remove('show'); }
function updateSiteMargePreview(){ let marge=parseFloat(document.getElementById('sm_marge').value); if(isNaN(marge)){document.getElementById('smPreview').innerHTML='Tape ta marge. Ex : 45 → PV = PA + 45%';return;} let s=getSites().find(x=>String(x.id)===String(currentSiteId)); let oldMarge=s?getSiteMarge(s.id):null; let sp=getSiteProds(); let list=sp[currentSiteId]||[]; let ex1=list[0]?paOf(list[0]):1000; let exPV=calcPV(ex1,marge); document.getElementById('smPreview').innerHTML=`Ancienne : <b>${oldMarge===null?'Non définie':oldMarge+'%'}</b> → Nouvelle : <b style="color:#22c55e">${marge}%</b><br>Exemple : PA ${ex1.toLocaleString()} → PV <b style="color:#22c55e">${exPV.toLocaleString()} CDF</b>`; }
function saveSiteMarge(){ if(!currentSiteId) return; let nouvelle=parseFloat(document.getElementById('sm_marge').value); if(isNaN(nouvelle) || nouvelle<=0) return alert('❌ Mets ta marge. Ex : 45'); let sites=getSites(); let idx=sites.findIndex(s=>String(s.id)===String(currentSiteId)); if(idx<0) return; let old=sites[idx].margeDefaut; sites[idx].margeDefaut=nouvelle; sites[idx].marge=nouvelle; saveSites(sites); let applyAll=document.getElementById('sm_applyAll').checked; if(applyAll){ let sp=getSiteProds(); let list=sp[currentSiteId]||[]; list.forEach(item=>{ if(item.margePropre) return; let pa=paOf(item); item.marge=nouvelle; item.margin=nouvelle; item.pv=calcPV(pa,nouvelle); item.prix=item.pv; item.margePropre=false; }); saveSiteProds(sp); } clearGroupCache(); closeSiteMargeModal(); render(); renderDetail(); alert('✅ Marge : '+(old===null?'Non définie':old+'%')+' → '+nouvelle+'%'); }
function openDepotPAModalGroup(groupKey){ let all=getAllProds(); let lots=all.filter(p=>groupKeyOf(p)===groupKey); if(!lots.length) return; editingDepotId=lots[0].id; editingGroupKey=groupKey; let pa=paOf(lots[0]); document.getElementById('depotPAProdName').textContent=lots[0].nom; document.getElementById('depotPAProdInfo').textContent=lots.length+' lot(s) • Stock total : '+lots.reduce((a,p)=>a+depotStockOf(p),0)+' • PA seulement'; document.getElementById('editDepotPA').value=pa; document.getElementById('depotPAModal').classList.add('show'); }
function openDepotPAModal(depotProdId){ let all=getAllProds(); let p=all.find(x=>String(x.id)===String(depotProdId)); if(p) openDepotPAModalGroup(groupKeyOf(p)); }
function closeDepotPAModal(){ document.getElementById('depotPAModal').classList.remove('show'); editingDepotId=null; editingGroupKey=null; }
function saveDepotPA(){ if(!editingGroupKey) return; let newPA=parseFloat(document.getElementById('editDepotPA').value)||0; if(newPA<=0) return alert('❌ PA doit être > 0'); let all=getAllProds(); let lots=all.filter(p=>groupKeyOf(p)===editingGroupKey); if(!lots.length) return; let oldPA=paOf(lots[0]); lots.forEach(prod=>{ prod.pa=newPA; prod.prixAchat=newPA; delete prod.marge; delete prod.margin; delete prod.margePropre; delete prod.pv; delete prod.prix; }); saveProds(all); let sp=getSiteProds(); Object.keys(sp).forEach(siteId=>{ let list=sp[siteId]; if(!Array.isArray(list)) return; list.forEach(item=>{ if(groupKeyOf(item)===editingGroupKey){ let margeAUtiliser=item.margePropre?getMargeOf(item):getSiteMarge(siteId); item.pa=newPA; item.prixAchat=newPA; if(margeAUtiliser && margeAUtiliser>0){item.pv=calcPV(newPA,margeAUtiliser);item.prix=item.pv;item.marge=margeAUtiliser;} else {item.pv=newPA;item.prix=newPA;} } }); }); saveSiteProds(sp); clearGroupCache(); _lastSyncHash=''; closeDepotPAModal(); alert('✅ PA : '+oldPA+' → '+newPA+' (tous les lots)'); render(); if(isDepotView) renderDepotView(); else renderDetail(); }
function openPriceModal(groupKey){ let sp=getSiteProds(); let list=sp[currentSiteId]||[]; let grouped=groupProducts(list,true,'site-'+currentSiteId); let g=grouped.find(x=>x.key===groupKey); if(!g) return; editingProdId=groupKey; editingGroupKey=groupKey; editingOriginalPA=g.pa; let pa=g.pa; let pv=g.pv; let mg=g.marge; let siteName=getSites().find(s=>String(s.id)===String(currentSiteId))?.nom||''; document.getElementById('priceProdName').textContent=g.nom+(g.margePropre?' • ⭐ Marge propre':' • Marge par défaut'); document.getElementById('priceSiteName').textContent='Site : '+siteName+' • '+g.lotsCourt+' • PA : '+pa.toLocaleString(); document.getElementById('priceSiteMargeHint').textContent='Marge par défaut : '+(getSiteMarge(currentSiteId)===null?'Non définie':getSiteMarge(currentSiteId)+'%'); document.getElementById('priceTitle').textContent='✏️ Prix / Marge - '+g.nom; document.getElementById('editPA').value=pa; document.getElementById('editMarge').value=mg.toFixed(1); document.getElementById('editPV').value=pv; updatePricePreview(); document.getElementById('priceModal').classList.add('show'); }
function closePriceModal(){ document.getElementById('priceModal').classList.remove('show'); editingProdId=null; editingGroupKey=null; }
function onPriceInput(source){ let pa=parseFloat(document.getElementById('editPA').value)||0; let mg=parseFloat(document.getElementById('editMarge').value)||0; let pv=parseFloat(document.getElementById('editPV').value)||0; if(source==='pa' || source==='marge'){ if(pa>0 && mg>=0){let newPV=calcPV(pa,mg); document.getElementById('editPV').value=newPV; pv=newPV;} } else if(source==='pv'){ if(pa>0 && pv>0){let newMarge=calcMarge(pa,pv); document.getElementById('editMarge').value=newMarge.toFixed(1); mg=newMarge;} } updatePricePreview(); }
function updatePricePreview(){ let pa=parseFloat(document.getElementById('editPA').value)||0; let mg=parseFloat(document.getElementById('editMarge').value)||0; let pv=parseFloat(document.getElementById('editPV').value)||0; let gain=pv-pa; let txt=pv>pa?'<span style="color:#22c55e">✅ Peut se vendre - Gain : '+gain.toLocaleString()+' CDF</span>':'<span style="color:#f87171">⛔ NE PEUT PAS SE VENDRE - PV = PA</span>'; document.getElementById('pricePreview').innerHTML=`PA : <b style="color:#facc15">${pa.toLocaleString()} CDF</b><br>Marge : <b style="color:#22c55e">${mg.toFixed(1)}%</b><br>PV : <b style="color:#22c55e">${pv.toLocaleString()} CDF</b><br>${txt}`; }
function savePrice(){ if(!editingGroupKey) return; let newPA=parseFloat(document.getElementById('editPA').value)||0; let newMarge=parseFloat(document.getElementById('editMarge').value)||0; let newPV=parseFloat(document.getElementById('editPV').value)||0; if(newPA<=0) return alert('❌ PA doit être > 0'); if(newPV<=newPA){return alert('⛔ IMPOSSIBLE - PV <= PA. Sans marge, ne se vend pas.');} let sp=getSiteProds(); let list=sp[currentSiteId]||[]; let items=list.filter(x=>groupKeyOf(x)===editingGroupKey); if(!items.length) return; let paChanged=newPA!==paOf(items[0]); items.forEach(item=>{ item.pa=newPA; item.prixAchat=newPA; item.pv=newPV; item.prix=newPV; item.marge=newMarge; item.margin=newMarge; item.margePropre=true; }); if(paChanged){ let all=getAllProds(); all.filter(p=>groupKeyOf(p)===editingGroupKey).forEach(p=>{ p.pa=newPA; p.prixAchat=newPA; delete p.marge; delete p.margin; delete p.margePropre; delete p.pv; delete p.prix; }); saveProds(all); Object.keys(sp).forEach(siteId=>{ if(String(siteId)===String(currentSiteId)) return; let l=sp[siteId]; if(!Array.isArray(l)) return; l.filter(x=>groupKeyOf(x)===editingGroupKey).forEach(other=>{ if(!other.margePropre){ let margeOther=getSiteMarge(siteId); other.pa=newPA; other.prixAchat=newPA; if(margeOther!==null){other.pv=calcPV(newPA,margeOther);other.prix=other.pv;other.marge=margeOther;} else {other.pv=newPA;other.prix=newPA;} } else { other.pa=newPA; other.prixAchat=newPA; let m=getMargeOf(other); if(m>0){other.pv=calcPV(newPA,m);other.prix=other.pv;} } }); }); } saveSiteProds(sp); clearGroupCache(); _lastSyncHash=''; closePriceModal(); alert('✅ Prix changé - '+editingGroupKey+' - Marge propre : '+newMarge+'% - PV : '+newPV.toLocaleString()+' (tous les lots)'); renderDetail(); render(); }
function toggleProduit(groupKey){
  let sp=getSiteProds(); let list=sp[currentSiteId]||[];
  let items=list.filter(x=>groupKeyOf(x)===groupKey);
  if(!items.length) return;
  let estDesactive = items.some(x=>isDesactive(x));
  let nouvelEtat = !estDesactive;
  items.forEach(item=>{
    item.desactive = nouvelEtat;
    item.actif = !nouvelEtat;
    item.statut = nouvelEtat ? 'desactive' : 'actif';
  });
  saveSiteProds(sp); clearGroupCache();
  renderDetail(); render();
  alert(nouvelEtat ? '⏸️ Produit désactivé dans ce site.' : '✅ Produit réactivé dans ce site.');
}
function renderDetail(){
 if(isDepotView){renderDepotView();return;} let cur=getCurrentUser(); let sp=getSiteProds(); let list=sp[currentSiteId]||[]; let s=getSites().find(x=>String(x.id)===String(currentSiteId)); let margeDef=s?getSiteMarge(currentSiteId):null; let bar=document.getElementById('siteMargeBar');
 if(s && !isVendeurRole()){ bar.style.display='flex'; if(margeDef===null) document.getElementById('siteMargeText').textContent='⚠️ '+s.nom+' : Marge par défaut non définie.'; else document.getElementById('siteMargeText').textContent='🏷️ Marge par défaut de '+s.nom+' : '+margeDef+'%'; } else if(s){bar.style.display='flex'; document.getElementById('siteMargeText').textContent='🏷️ Marge : '+(margeDef===null?'Non définie':margeDef+'%');} else {bar.style.display='none';}
 let q=document.getElementById('search-site').value.trim();
 let grouped=groupProducts(list,true,'site-'+currentSiteId);
 if(q) grouped=triIntelligent(grouped.filter(g=>matchGroupIntelligent(g,q)), q);
 let isVendeur=isVendeurRole();
 if(isVendeur) grouped=grouped.filter(g=>!g.desactive);
 else {
   if(filtreStatut==='actifs') grouped=grouped.filter(g=>!g.desactive);
   if(filtreStatut==='desactives') grouped=grouped.filter(g=>g.desactive);
 }
 let ts=grouped.reduce((a,g)=>a+g.stock,0); let tvPA=grouped.reduce((a,g)=>a+g.pa*g.stock,0); let tvPV=grouped.reduce((a,g)=>a+g.pv*g.stock,0);
 let isManager=isManagerRole();
 document.getElementById('detail-stats').innerHTML=`<span class="stat">📦 ${grouped.length} produits</span><span class="stat stat-g">Stock ${ts}</span><span class="stat stat-y">Valeur PA ${tvPA.toLocaleString()} CDF</span><span class="stat stat-pv">Valeur PV ${tvPV.toLocaleString()} CDF</span>`;
 document.getElementById('thead-site').innerHTML=`<tr><th>Produit</th><th>Lots</th><th>Péremption proche</th><th>Stock Site</th><th>PA</th><th>PV</th><th>Marge</th><th>Valeur PA</th><th>Valeur PV</th><th>Statut</th><th>Action</th></tr>`;
 let pg=paginate(grouped, pageDetail); pageDetail=pg.page;
 document.getElementById('tbody-site').innerHTML=pg.items.map(g=>{ let jr=g.peremptionProche?Math.ceil((new Date(g.peremptionProche)-new Date())/(1000*60*60*24)):9999; let col=jr<0?'#f87171':jr<30?'#fb923c':'#22c55e'; let pa=g.pa; let pv=g.pv; let st=g.stock; let mg=g.marge; let peutVendre=pv>pa && !g.desactive; let badgeMarge=!peutVendre && g.desactive ? `<span style="background:rgba(239,68,68,.2);color:#f87171;padding:3px 8px;border-radius:999px;font-size:11px;font-weight:900">⏸️ DÉSACTIVÉ</span>` : !peutVendre ? `<span style="background:rgba(239,68,68,.2);color:#f87171;padding:3px 8px;border-radius:999px;font-size:11px;font-weight:900">⛔ SANS MARGE</span>` : g.margePropre?`<span style="background:rgba(34,197,94,.2);color:#22c55e;padding:3px 8px;border-radius:999px;font-size:11px;font-weight:900">⭐ ${mg.toFixed(1)}% propre</span>`:`<span style="background:rgba(250,204,21,.15);color:#facc15;padding:3px 8px;border-radius:999px;font-size:11px;font-weight:900">${mg.toFixed(1)}% défaut</span>`; let pvTxt=pv?pv.toLocaleString():'—';
  let badgeStatut = g.desactive ? `<span style="background:rgba(239,68,68,.2);color:#f87171;padding:4px 8px;border-radius:999px;font-size:11px;font-weight:900">⏸️ Désactivé</span>` : `<span style="background:rgba(34,197,94,.15);color:#22c55e;padding:4px 8px;border-radius:999px;font-size:11px;font-weight:900">✅ Actif</span>`;
  let btnToggle = g.desactive ? `<button onclick="toggleProduit('${g.key}')" style="background:#22c55e;color:#000;border:0;padding:6px 8px;border-radius:6px;font-weight:900;font-size:11px">▶️ Activer</button>` : `<button onclick="toggleProduit('${g.key}')" style="background:rgba(250,204,21,.2);color:#facc15;border:0;padding:6px 8px;border-radius:6px;font-weight:900;font-size:11px">⏸️ Désactiver</button>`;
  if(isVendeur){ if(!peutVendre){return `<tr style="opacity:.6"><td style="font-weight:700">${g.nom}<br><small style="color:#f87171">⛔ NE PEUT PAS SE VENDRE</small></td><td><small>${g.lotsTxt}</small></td><td style="color:${col}">${g.peremptionProche||'-'}</td><td style="font-weight:900;color:#22c55e">${st}</td><td style="color:#facc15">${pa.toLocaleString()}</td><td style="color:#f87171;font-weight:900">${pvTxt}</td><td>${badgeMarge}</td><td>${(pa*st).toLocaleString()}</td><td style="color:#f87171;font-weight:700">${(pv*st).toLocaleString()}</td><td>${badgeStatut}</td><td><span style="background:rgba(239,68,68,.2);color:#f87171;padding:6px 10px;border-radius:8px;font-size:11px;font-weight:900">⛔ BLOQUÉ</span></td></tr>`;} return `<tr><td style="font-weight:700">${g.nom}</td><td><small>${g.lotsTxt}</small></td><td style="color:${col}">${g.peremptionProche||'-'}</td><td style="font-weight:900;color:#22c55e">${st}</td><td style="color:#facc15">${pa.toLocaleString()}</td><td style="color:#22c55e;font-weight:900">${pvTxt}</td><td>${badgeMarge}</td><td>${(pa*st).toLocaleString()}</td><td style="color:#22c55e;font-weight:700">${(pv*st).toLocaleString()}</td><td>${badgeStatut}</td><td><div style="display:flex;gap:4px;align-items:center"><input id="vte-${g.key}" type="number" min="1" max="${st}" value="1" style="width:50px;background:#0f1115;border:1px solid #22c55e;border-radius:8px;padding:6px;color:#fff;font-size:12px"><button onclick="vendre('${g.key}')" style="background:#22c55e;color:#000;border:0;padding:6px 10px;border-radius:8px;font-weight:900;font-size:11px">VENDRE</button></div></td></tr>`; }
  if(isManager){ return `<tr class="${g.desactive?'row-desactive':''}"><td style="font-weight:700">${g.nom} ${g.desactive?'<br><small style="color:#f87171">⏸️ Désactivé - invisible pour la vente</small>':''}</td><td><small>${g.lotsTxt}</small></td><td style="color:${col}">${g.peremptionProche||'-'}</td><td style="font-weight:900">${st}</td><td style="color:#facc15">${pa.toLocaleString()}</td><td style="color:${peutVendre?'#22c55e':'#f87171'};font-weight:900">${pvTxt}</td><td>${badgeMarge}</td><td>${(pa*st).toLocaleString()}</td><td style="color:#22c55e;font-weight:700">${(pv*st).toLocaleString()}</td><td>${badgeStatut}</td><td><div style="display:flex;gap:4px;flex-wrap:wrap">${btnToggle}</div></td></tr>`; }
  return `<tr class="${g.desactive?'row-desactive':''}"><td style="font-weight:700">${g.nom} ${g.desactive?'<br><small style="color:#f87171">⏸️ Désactivé</small>':''} ${!peutVendre && !g.desactive?'<br><small style="color:#f87171">⛔ NE PEUT PAS SE VENDRE</small>':''}</td><td><small>${g.lotsTxt}</small></td><td style="color:${col}">${g.peremptionProche||'-'}</td><td style="font-weight:900">${st}</td><td style="color:#facc15">${pa.toLocaleString()}</td><td style="color:${peutVendre?'#22c55e':'#f87171'};font-weight:900">${pvTxt}</td><td>${badgeMarge}</td><td>${(pa*st).toLocaleString()}</td><td style="color:#22c55e;font-weight:700">${(pv*st).toLocaleString()}</td><td>${badgeStatut}</td><td><div style="display:flex;gap:4px;flex-wrap:wrap"><button onclick="openPriceModal('${g.key}')" style="background:#facc15;color:#000;border:0;padding:6px 8px;border-radius:6px;font-weight:900;font-size:11px">✏️ Marge</button>${btnToggle}<button onclick="removeProd('${g.key}')" style="background:rgba(239,68,68,.15);color:#f87171;border:0;padding:6px 8px;border-radius:6px;font-size:11px">Retirer</button></div></td></tr>`;
 }).join('')||`<tr><td colspan="11" style="text-align:center;padding:20px;color:#6a7085">Aucun produit</td></tr>`;
 renderPagination('paginationDetail', pg.page, pg.totalPages, pg.total, 'allerPageDetail');
 let btnLoad=document.getElementById('btnLoadDepot'); let btnImp=document.getElementById('btnImport'); let btnExp=document.getElementById('btnExportSite'); let btnExpG=document.getElementById('btnExportGlobal'); let btnMod=document.getElementById('btnModele'); if(isVendeur || isManager){btnLoad.style.display='none';btnImp.style.display='none';btnExp.style.display='none';btnExpG.style.display='none';btnMod.style.display='none';}else{btnLoad.style.display='block';btnImp.style.display='block';btnExp.style.display='block';btnExpG.style.display='block';btnMod.style.display='block';} }
function toggleLoad(){let cur=getCurrentUser();if(cur && (isVendeurRole() || isManagerRole())){alert('❌ Tu ne peux pas charger');return}let sec=document.getElementById('loadSection');sec.style.display=sec.style.display==='none'?'block':'none';if(sec.style.display==='block'){pendingQty={};pageDepot=1;renderDepot();}}
function updateMultiBar(){ let bar=document.getElementById('multiBar'); let info=document.getElementById('multiInfo'); let ids=Object.keys(pendingQty).filter(id=>(pendingQty[id]||0)>0); if(ids.length===0){bar.style.display='none';return;} bar.style.display='flex'; let total=ids.reduce((s,id)=>s+(pendingQty[id]||0),0); info.textContent=`✅ ${ids.length} produit(s) - Total : ${total}`; }
function onQtyChange(key,maxStock,el){ let qte=parseInt(el.value)||0; let msg=document.getElementById('err-'+CSS.escape(key)); let row=el.closest('tr'); if(qte>maxStock){el.style.border='2px solid #f87171';el.style.color='#f87171'; if(msg){msg.style.display='block';msg.textContent='❌ Max '+maxStock;} pendingQty[key]=qte; if(row) row.classList.add('row-selected'); updateMultiBar(); return false;} if(qte<=0){el.style.border='1px solid #222735';el.style.color='#fff'; if(msg) msg.style.display='none'; delete pendingQty[key]; if(row) row.classList.remove('row-selected'); updateMultiBar(); return false;} el.style.border='1px solid #22c55e'; el.style.color='#fff'; if(msg) msg.style.display='none'; pendingQty[key]=qte; if(row) row.classList.add('row-selected'); updateMultiBar(); return true; }
function renderDepot(){ let all=getAllProds(); let q=document.getElementById('searchDepot').value.trim(); let grouped=groupProducts(all,false,'depot'); if(q) grouped=triIntelligent(grouped.filter(g=>matchGroupIntelligent(g,q)), q); let pg=paginate(grouped, pageDepot); pageDepot=pg.page; document.getElementById('tbody-depot').innerHTML=pg.items.map(g=>{ let st=g.stock; let qty=pendingQty[g.key]||0; let isSelected=qty>0; let pa=g.pa; let res=resolveMargePourSite(g,currentSiteId); let pvSite=res.peutVendre?calcPV(pa,res.marge):pa; let margeTxt=!res.peutVendre?`<span style="color:#f87171;font-weight:900">⛔ SANS MARGE</span>`: `<span style="color:#facc15;font-weight:900">🏷️ ${res.marge}%</span>`; let pvTxt=!res.peutVendre?`<span style="color:#f87171">${pvSite.toLocaleString()}</span>`:`<span style="color:#22c55e;font-weight:900">${pvSite.toLocaleString()}</span>`; if(st<=0) return `<tr style="opacity:.5"><td style="font-weight:700">${g.nom}</td><td><small>${g.lotsTxt}</small></td><td style="color:#f87171;font-weight:900">${st} - RUPTURE</td><td>${pa.toLocaleString()}</td><td>${margeTxt}</td><td>${pvTxt}</td><td><input disabled value="0" style="width:80px;background:#0f1115;border:1px solid #222735;border-radius:6px;padding:7px;color:#6a7085;text-align:center"></td><td><span style="font-size:10px;color:#f87171">⛔ Rupture</span></td></tr>`; if(!res.peutVendre){ return `<tr style="background:rgba(239,68,68,.06)"><td style="font-weight:700">${g.nom}<br><small style="color:#f87171">⛔ Sans marge</small></td><td><small>${g.lotsTxt}</small></td><td style="font-weight:900;color:#22c55e">${st}</td><td style="color:#facc15">${pa.toLocaleString()}</td><td>${margeTxt}</td><td>${pvTxt}</td><td><input disabled placeholder="BLOQUÉ" style="width:80px;background:#0f1115;border:1px solid #f87171;border-radius:8px;padding:8px;color:#f87171;text-align:center;font-size:11px"></td><td><button onclick="alert('⛔ BLOCAGE - Sans marge. Définis une marge par défaut pour ce site.')" style="background:rgba(239,68,68,.2);color:#f87171;border:0;padding:7px 10px;border-radius:6px;font-weight:900;font-size:11px">⛔ BLOCAGE</button></td></tr>`; } return `<tr class="${isSelected?'row-selected':''}"><td style="font-weight:700">${g.nom}<br><small style="color:#6a7085">Dispo : ${st}</small></td><td><small>${g.lotsTxt}</small></td><td style="font-weight:900;color:#22c55e">${st}</td><td style="color:#facc15">${pa.toLocaleString()}</td><td>${margeTxt}</td><td style="color:#22c55e;font-weight:900">${pvTxt}</td><td><input id="qte-${g.key}" type="number" min="0" max="${st}" value="${qty}" placeholder="0" oninput="onQtyChange('${g.key}', ${st}, this)" style="width:80px;background:#0f1115;border:1px solid ${isSelected?'#22c55e':'#222735'};border-radius:8px;padding:8px;color:#fff;font-weight:900;text-align:center;font-size:14px"><div id="err-${g.key}" style="display:none;color:#f87171;font-size:10px;font-weight:800;margin-top:3px"></div></td><td><button onclick="transferOne('${g.key}')" style="background:rgba(34,197,94,.15);color:#22c55e;border:0;padding:7px 10px;border-radius:6px;font-weight:800;font-size:11px">Charger</button></td></tr>`; }).join('')||`<tr><td colspan="8" style="text-align:center;padding:20px;color:#6a7085">Aucun produit au dépôt</td></tr>`; renderPagination('paginationDepot', pg.page, pg.totalPages, pg.total, 'allerPageDepot'); updateMultiBar(); }
function transferOne(key){ let all=getAllProds(); let grouped=groupProducts(all,false,'depot'); let g=grouped.find(x=>x.key===key); if(!g) return; let res=resolveMargePourSite(g,currentSiteId); if(!res.peutVendre){return alert('⛔ BLOCAGE - Sans marge. Définis une marge par défaut pour ce site.');} let qte=pendingQty[key]||parseInt(document.getElementById('qte-'+key)?.value||0)||0; if(qte<=0) return alert('❌ Mets une quantité'); if(qte>g.stock) return alert('⛔ Dépôt n\'a que '+g.stock); doTransferList([{key:key,qte:qte,pa:g.pa,nom:g.nom}]); }
function transferMultiple(){ let cur=getCurrentUser(); if(cur && (isVendeurRole() || isManagerRole())){alert('❌ Tu ne peux pas charger');return} let keys=Object.keys(pendingQty).filter(k=>(pendingQty[k]||0)>0); if(keys.length===0) return alert('❌ Mets des quantités'); let all=getAllProds(); let grouped=groupProducts(all,false,'depot'); let erreurs=[]; let sansMarge=[]; let toLoad=[]; keys.forEach(key=>{ let g=grouped.find(x=>x.key===key); if(!g){erreurs.push('Produit introuvable');return;} let qte=pendingQty[key]||0; let res=resolveMargePourSite(g,currentSiteId); if(!res.peutVendre) sansMarge.push(g.nom); else if(qte<=0) erreurs.push(g.nom+' : Qté 0'); else if(qte>g.stock) erreurs.push('⛔ '+g.nom+' : Dépôt n\'a que '+g.stock); else toLoad.push({key:key,qte:qte,pa:g.pa,nom:g.nom}); }); if(sansMarge.length){alert('⛔ BLOCAGE - Sans marge :\n'+sansMarge.map(n=>'• '+n).join('\n')+'\nDéfinis une marge par défaut pour ce site.');return;} if(erreurs.length){alert('❌ '+erreurs.join('\n'));return;} let siteName=getSites().find(s=>String(s.id)===String(currentSiteId))?.nom||'Site'; if(!confirm(`✅ Charger ${toLoad.length} produit(s) vers ${siteName} ?`)) return; doTransferList(toLoad); }
function doTransferList(toLoad){ let all=getAllProds(); let sp=getSiteProds(); let list=sp[currentSiteId]||[]; let charges=[]; toLoad.forEach(({key,qte,pa,nom})=>{ let res=resolveMargePourSite({nom:nom},currentSiteId); if(!res.peutVendre) return; let pvSite=calcPV(pa,res.marge); let depotLots=all.filter(p=>groupKeyOf(p)===key).sort((a,b)=>new Date(a.peremption||'9999')-new Date(b.peremption||'9999')); let reste=qte; depotLots.forEach(dl=>{ if(reste<=0) return; let dispo=depotStockOf(dl); let take=Math.min(dispo,reste); dl.stock=dispo-take; reste-=take; }); let ex=list.find(x=>groupKeyOf(x)===key); if(ex){ ex.stock_site=(ex.stock_site||0)+qte; ex.stock=ex.stock_site; ex.pa=pa; if(!ex.originalId) ex.originalId=depotLots[0]?.id||''; if(isDesactive(ex)){ ex.desactive=false; ex.actif=true; ex.statut='actif'; } } else { let firstLot=depotLots[0]||{}; list.push({id:Date.now().toString()+Math.random().toString(36).slice(2,5),originalId:firstLot.id||'',nom:nom,fournisseur:firstLot.fournisseur||'',lot:firstLot.lot||'',peremption:firstLot.peremption||'',pa:pa,pv:pvSite,prix:pvSite,marge:res.marge,margin:res.marge,margePropre:false,stock_site:qte,stock:qte,desactive:false,actif:true,statut:'actif'}); } charges.push(qte+' x '+nom+' → PV '+pvSite.toLocaleString()); delete pendingQty[key]; }); saveProds(all); sp[currentSiteId]=list; saveSiteProds(sp); clearGroupCache(); renderDetail(); renderDepot(); render(); alert('✅ Chargement réussi\n'+charges.join('\n')); }
function transfer(pid){transferOne(pid);}
function removeProd(groupKey){let cur=getCurrentUser();if(cur && normalizeRole(cur.role)!=='admin'){alert('❌ Seul Admin');return}if(!confirm('Retirer ? Retour dépôt'))return;let sp=getSiteProds();let list=sp[currentSiteId]||[];let items=list.filter(p=>groupKeyOf(p)===groupKey);if(!items.length)return;let total=items.reduce((a,p)=>a+siteStockOf(p),0);let all=getAllProds();let dl=all.find(p=>groupKeyOf(p)===groupKey);if(dl) dl.stock=depotStockOf(dl)+total;saveProds(all);sp[currentSiteId]=list.filter(p=>groupKeyOf(p)!==groupKey);saveSiteProds(sp);clearGroupCache();renderDetail();render();}
function vendre(groupKey){ let cur=getCurrentUser(); let sp=getSiteProds(); let list=sp[currentSiteId]||[]; let grouped=groupProducts(list,true,'site-'+currentSiteId); let g=grouped.find(x=>x.key===groupKey); if(!g) return; if(g.desactive){return alert('⛔ Ce produit est désactivé dans ce site.');} if(!(g.pv>g.pa)){return alert('⛔ IMPOSSIBLE - Sans marge. PV = PA.');} let input=document.getElementById('vte-'+groupKey); let qte=parseInt(input.value)||0; if(qte<=0 || qte>g.stock) return alert('❌ Qté invalide - Dispo: '+g.stock); if(!confirm(`Vendre ${qte} x ${g.nom} ? PV : ${g.pv.toLocaleString()}`)) return; let siteLots=list.filter(p=>groupKeyOf(p)===groupKey).sort((a,b)=>new Date(a.peremption||'9999')-new Date(b.peremption||'9999')); let reste=qte; siteLots.forEach(l=>{ if(reste<=0) return; let dispo=siteStockOf(l); let take=Math.min(dispo,reste); l.stock_site=dispo-take; l.stock=l.stock_site; reste-=take; }); sp[currentSiteId]=list.filter(p=>siteStockOf(p)>0); saveSiteProds(sp); clearGroupCache(); let ventes=JSON.parse(localStorage.getItem(KEY_VENTES)||'[]'); ventes.unshift({id:Date.now().toString(),siteId:currentSiteId,siteName:document.getElementById('detail-title').textContent,produit:g.nom,lot:g.lots.map(l=>l.lot).join(','),qte:qte,pa:g.pa,pv:g.pv,valeur:qte*g.pa,valeurPV:qte*g.pv,vendeurId:cur?cur.id:'',vendeurNom:cur?cur.nom:'',date:new Date().toISOString()}); localStorage.setItem(KEY_VENTES,JSON.stringify(ventes)); renderDetail(); render(); alert(`✅ Vendu ! ${qte} x ${g.nom}\nReste: ${g.stock-qte}`); }
function showImportResult(texte,isErreur){
  let el=document.getElementById('importStatus'); if(!el){alert(texte);return;}
  el.style.display='block'; el.style.background=isErreur?'#dc3545':'#22c55e'; el.textContent=texte;
  setTimeout(()=>{el.style.display='none';},15000);
}
function openImportSiteModal(){ let sites=getSites(); if(sites.length===0){alert('Crée d’abord un Site');return;} importSiteChoisi=currentSiteId||sites[0].id; document.getElementById('fileExcel').click(); }
function updateImportSiteInfo(){}
function closeImportSiteModal(){}
function confirmImportSite(){ document.getElementById('fileExcel').click(); }
function openExportSiteModal(){ exportSite(); }
function updateExportSiteInfo(){}
function closeExportSiteModal(){}
function confirmExportSite(){ exportSite(); }
function telechargerModele(){let data=[["NOM","STOCK DISPONIBLE","PAU","MARGE","PAT","STOCK ALERTE","STOCK MAX","CONTENANCE","FOURNISSEUR","CATEGORIE","DATE DE PEREMPTION"],["SHALINA SUPER",100,6000,2400,"",190,200,3,"SHALINA","Cosmétique","2027-12-31"]];let ws=XLSX.utils.aoa_to_sheet(data);let wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,"Depot");XLSX.writeFile(wb,"depot.xlsx");}
function telechargerModeleSite(){let data=[["NOM","STOCK DISPONIBLE","PAU","MARGE","PV","PVT","STOCK ALERTE","STOCK MAX","CONTENANCE","FOURNISSEUR","CATEGORIE","DATE DE PEREMPTION"],["SHALINA SUPER",50,6000,2400,8400,"",10,100,3,"SHALINA","Cosmétique","2027-12-31"]];let ws=XLSX.utils.aoa_to_sheet(data);let wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,"Site");XLSX.writeFile(wb,"site.xlsx");}
function importExcelDepot(e){
  let f=e.target.files[0];if(!f)return;
  showImportResult('⏳ Lecture '+f.name+' ...',false);
  let reader=new FileReader();
  reader.onload=function(ev){
    try{
      let wb=XLSX.read(new Uint8Array(ev.target.result),{type:'array'});
      let rows=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
      let totalLignes=rows.length; let count=0,ajoutes=0,misAJour=0,ignores=0,autoPV=0;
      let allProd=getAllProds();
      rows.forEach(r=>{
        let nom=(r.NOM||r.Nom||'').toString().trim().toUpperCase(); if(!nom){ignores++;return;}
        let pa=+r.PAU||+r.PA||+r['PRIX ACHAT']||0;
        let marge=+r.MARGE||+r['MARGE BENEFICIAIRE']||+r['MARGE BENEF']||+r.BENEFICE||0;
        let pv=+r.PV||+r.PVU||+r['PRIX VENTE']||+r['PRIX DE VENTE']||0;
        if(!pv && pa>0 && marge>0){ pv=pa+marge; autoPV++; }
        if(!marge && pv>0 && pa>0){ marge=pv-pa; }
        let lot=(r.LOT||r.Lot||'').toString().trim(); let four=(r.FOURNISSEUR||'').toString().toUpperCase().trim();
        let idx=allProd.findIndex(x=>(x.nom||'').toUpperCase()===nom && String(x.lot||'').trim()===lot && (x.fournisseur||'').toUpperCase().trim()===four);
        let p={nom:nom,stock:+r['STOCK DISPONIBLE']||+r.STOCK||0,pa:pa,pau:pa,stock_alerte:+r['STOCK ALERTE']||+r.ALERTE||0,alerte:+r['STOCK ALERTE']||+r.ALERTE||0,stock_max:+r['STOCK MAX']||+r.MAX||0,contenance:+r.CONTENANCE||1,fournisseur:four,categorie:(r.CATEGORIE||'').toString(),peremption:(r['DATE DE PEREMPTION']||'').toString(),lot:lot,site:'Dépôt',site_nom:'Dépôt Central',pv:pv,prix:pv,marge:marge};
        p.stock_site=p.stock; p.quantite=p.stock; p.qte=p.stock;
        if(idx>=0){p.id=allProd[idx].id;allProd[idx]=p;misAJour++;} else {p.id=Date.now().toString()+count+Math.floor(Math.random()*100000);allProd.push(p);ajoutes++;}
        count++;
      });
      saveProds(allProd); clearGroupCache(); _lastSyncHash=''; render();
      let msg='✅ IMPORT DÉPÔT : '+count+'/'+totalLignes+' | Ajoutées : '+ajoutes+' | Mises à jour : '+misAJour+' | PV auto (PA+MARGE) : '+autoPV+' | TOTAL : '+allProd.length;
      showImportResult(msg,false); alert(msg);
    }catch(err){ showImportResult('❌ ERREUR : '+err.message,true); alert('❌ Erreur : '+err.message); }
  };
  reader.readAsArrayBuffer(f); e.target.value='';
}
function importExcelSite(e){
  let f=e.target.files[0];if(!f)return;
  let siteChoisi=currentSiteId||importSiteChoisi;
  if(!siteChoisi || siteChoisi==='__DEPOT__'){ importExcelDepot(e); return; }
  let sites=getSites(); let siteObj=sites.find(s=>String(s.id)===String(siteChoisi)); let siteNom=siteObj?siteObj.nom:siteChoisi;
  showImportResult('⏳ Lecture '+f.name+' pour '+siteNom+' ...',false);
  let reader=new FileReader();
  reader.onload=function(ev){
    try{
      let wb=XLSX.read(new Uint8Array(ev.target.result),{type:'array'});
      let rows=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
      let totalLignes=rows.length;
      let sp=getSiteProds();
      if(!sp[siteChoisi]) sp[siteChoisi]=[];
      let count=0,ajoutes=0,misAJour=0,autoPV=0,sansPVniMarge=0;
      let margeSiteDefaut=getSiteMarge(siteChoisi);
      rows.forEach(r=>{
        let nom=(r.NOM||r.Nom||'').toString().trim().toUpperCase(); if(!nom) return;
        let pa=+r.PAU||+r.PA||+r['PRIX ACHAT']||0;
        let marge=+r.MARGE||+r['MARGE BENEFICIAIRE']||+r['MARGE BENEF']||+r.BENEFICE||0;
        let pv=+r.PV||+r.PVU||+r['PRIX VENTE']||+r['PRIX DE VENTE']||+r['PVU']||0;
        if(!pv && pa>0 && marge>0){ pv=pa+marge; autoPV++; }
        else if(!pv && pa>0 && margeSiteDefaut!==null && margeSiteDefaut>0){ marge=margeSiteDefaut; pv=calcPV(pa,marge); autoPV++; }
        if(!marge && pv>0 && pa>0){ marge=pv-pa; }
        if(!pv && !marge){ sansPVniMarge++; }
        let lot=(r.LOT||r.Lot||'').toString().trim(); let four=(r.FOURNISSEUR||'').toString().toUpperCase().trim();
        let idx=sp[siteChoisi].findIndex(x=>(x.nom||'').toUpperCase()===nom && String(x.lot||'').trim()===lot && (x.fournisseur||'').toUpperCase().trim()===four);
        let p={nom:nom,stock:+r['STOCK DISPONIBLE']||+r.STOCK||0,pa:pa,pau:pa,stock_alerte:+r['STOCK ALERTE']||+r.ALERTE||0,alerte:+r['STOCK ALERTE']||+r.ALERTE||0,stock_max:+r['STOCK MAX']||+r.MAX||0,contenance:+r.CONTENANCE||1,fournisseur:four,categorie:(r.CATEGORIE||'').toString(),peremption:(r['DATE DE PEREMPTION']||'').toString(),lot:lot,site:siteChoisi,site_nom:siteNom,pv:pv,prix:pv,marge:marge};
        p.stock_site=p.stock; p.quantite=p.stock; p.qte=p.stock;
        if(idx>=0){
          let old=sp[siteChoisi][idx];
          p.id=old.id; p.originalId=old.originalId||old.id; p.margePropre=old.margePropre;
          if(old.margePropre){ p.marge=getMargeOf(old); p.pv=calcPV(p.pa,p.marge); p.prix=p.pv; }
          else { p.margePropre = !!(r.MARGE||r['MARGE BENEFICIAIRE']||r.PV); }
          sp[siteChoisi][idx]=p; misAJour++;
        } else {
          p.id=Date.now().toString()+count+Math.floor(Math.random()*100000);
          let depotMatch=getAllProds().find(x=>(x.nom||'').toUpperCase()===nom);
          p.originalId=depotMatch?depotMatch.id:'';
          p.margePropre = !!(r.MARGE||r['MARGE BENEFICIAIRE']||r.PV);
          sp[siteChoisi].push(p); ajoutes++;
        }
        count++;
      });
      saveSiteProds(sp); clearGroupCache(); renderDetail(); render();
      let msg='✅ IMPORT SITE '+siteNom+' : '+count+'/'+totalLignes+' | Ajoutées : '+ajoutes+' | Mises à jour : '+misAJour+' | PV auto : '+autoPV+' | Sans PV ni Marge : '+sansPVniMarge+' | TOTAL : '+sp[siteChoisi].length;
      showImportResult(msg,false); alert(msg);
    }catch(err){ showImportResult('❌ ERREUR : '+err.message,true); alert('❌ Erreur : '+err.message); }
  };
  reader.readAsArrayBuffer(f); e.target.value='';
}
function exportDepot(){let depot=getAllProds();let data=[["NOM","STOCK DISPONIBLE","PAU","MARGE","PAT","STOCK ALERTE","STOCK MAX","CONTENANCE","FOURNISSEUR","CATEGORIE","DATE DE PEREMPTION","A COMMANDER"],...depot.map(p=>[p.nom,depotStockOf(p),paOf(p),getMargeOf(p),paOf(p)*depotStockOf(p),p.stock_alerte||p.alerte||0,p.stock_max||0,p.contenance||1,p.fournisseur||'',p.categorie||'',p.peremption||'',0])];let ws=XLSX.utils.aoa_to_sheet(data);let wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,"Depot");XLSX.writeFile(wb,"export-depot.xlsx");}
function exportSite(){
  if(!currentSiteId || currentSiteId==='__DEPOT__'){ exportDepot(); return; }
  let id=currentSiteId;
  let nom=getSites().find(s=>String(s.id)===String(id))?.nom||id;
  let list=getSiteProds()[id]||[];
  let data=[["NOM","STOCK DISPONIBLE","PAU","MARGE","PV","PVT","STOCK ALERTE","STOCK MAX","CONTENANCE","FOURNISSEUR","CATEGORIE","DATE DE PEREMPTION","A COMMANDER"],...list.map(p=>{let m=(+p.pv||0)-(+p.pa||0);let st=siteStockOf(p);return [p.nom,st,paOf(p),paOf(p)*st,m,pvOf(p),pvOf(p)*st,p.stock_alerte||p.alerte||0,p.stock_max||0,p.contenance||1,p.fournisseur||'',p.categorie||'',p.peremption||'',0];})];
  let ws=XLSX.utils.aoa_to_sheet(data);let wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,nom.substring(0,30));XLSX.writeFile(wb,"export-site-"+nom+".xlsx");
}
function exportGlobal(){let wb=XLSX.utils.book_new();let depot=getAllProds();let dataDepot=[["NOM","STOCK DISPONIBLE","PAU","MARGE","PAT","STOCK ALERTE","STOCK MAX","CONTENANCE","FOURNISSEUR","CATEGORIE","DATE DE PEREMPTION"],...depot.map(p=>[p.nom,depotStockOf(p),paOf(p),getMargeOf(p),paOf(p)*depotStockOf(p),p.stock_alerte||p.alerte||0,p.stock_max||0,p.contenance||1,p.fournisseur||'',p.categorie||'',p.peremption||''])];XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(dataDepot),"Depot");let sites=getSites();sites.forEach(s=>{let list=getSiteProds()[s.id]||[];let data=[["NOM","STOCK DISPONIBLE","PAU","MARGE","PV","PVT","STOCK ALERTE","STOCK MAX","CONTENANCE","FOURNISSEUR","CATEGORIE","DATE DE PEREMPTION"],...list.map(p=>{return [p.nom,siteStockOf(p),paOf(p),getMargeOf(p),pvOf(p),pvOf(p)*siteStockOf(p),p.stock_alerte||p.alerte||0,p.stock_max||0,p.contenance||1,p.fournisseur||'',p.categorie||'',p.peremption||''];})];XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(data),s.nom.substring(0,30));});XLSX.writeFile(wb,"export-global.xlsx");}
requestAnimationFrame(()=>{ render(); });