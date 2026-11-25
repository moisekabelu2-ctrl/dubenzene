const KEY='dubenzen_produits';
const KEY_SP='dub_sites_produits';
const KEY_SITES='dub_sites';
let vue='global', siteActuel='', pageActuelle=1, totalPages=1, totalFiltre=0, debounceTimer=null;
let editOldKey=''; let editId=null; let visibiliteChoisie='depot';
let _cache={depot:null,sp:null,sites:null,four:null};
function norm(s){ return (s||'').toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim(); }
function compact(s){ return norm(s).replace(/\s+/g,''); }
function matchIntelligent(p,q){
  let qq=norm(q); if(!qq) return true;
  let mots=qq.split(/\s+/).filter(Boolean);
  let texte=norm((p.nom||'')+' '+(p.fournisseur||'')+' '+(p.lot||'')+' '+(p.categorie||'')+' '+(p.conditionnement||''));
  let texteCompact=compact(texte);
  return mots.every(mot=>{
    if(texte.includes(mot)) return true;
    if(texteCompact.includes(mot)) return true;
    if(mot.length>=5){ for(let w of texte.split(' ')){ if(w.length===mot.length){ let d=0; for(let i=0;i<w.length;i++) if(w[i]!==mot[i]) d++; if(d<=1) return true; } } }
    return false;
  });
}
// ✅ RÈGLE BOSS : Même NOM + Même FOURNISSEUR = Même produit. Lot / Péremption ignorés.
function cleProduit(p){ return norm(p.nom||'')+'|'+norm(p.fournisseur||''); }
function groupKeyOf(p){ return cleProduit(p); }
function getDepot(){ if(_cache.depot) return _cache.depot; try{ _cache.depot=JSON.parse(localStorage.getItem(KEY)||'[]'); }catch(e){ _cache.depot=[]; } return _cache.depot; }
function saveDepot(l){ _cache.depot=l; localStorage.setItem(KEY,JSON.stringify(l)); localStorage.setItem('produits',JSON.stringify(l)); localStorage.setItem('dub_produits',JSON.stringify(l)); }
function getSP(){ if(_cache.sp) return _cache.sp; try{ _cache.sp=JSON.parse(localStorage.getItem(KEY_SP)||'{}'); }catch(e){ _cache.sp={}; } return _cache.sp; }
function saveSP(o){ _cache.sp=o; localStorage.setItem(KEY_SP,JSON.stringify(o)); }
function getSites(){ if(_cache.sites) return _cache.sites; try{ let s=JSON.parse(localStorage.getItem(KEY_SITES)||'[]'); _cache.sites=s.map(x=>typeof x==='string'?{nom:x,id:x,margeDefaut:null}:{nom:x.nom||x.name||x.id,id:x.id||x.nom,margeDefaut:x.margeDefaut??x.marge??null}); }catch(e){ _cache.sites=[]; } return _cache.sites; }
function getSiteMarge(siteObj){ if(!siteObj) return null; let m=siteObj.margeDefaut; if(m!==null && m!=='' && !isNaN(+m) && +m>0) return +m; return null; }
function calcPV(pa,marge){ return Math.round(pa*(1+marge/100)); }
function getFour(){
  if(_cache.four) return _cache.four;
  let keys=['dub_fournisseurs','fournisseurs','dubenzen_fournisseurs','liste_fournisseurs'];
  let out=[];
  for(let k of keys){ try{ let raw=localStorage.getItem(k); if(!raw) continue; let parsed=JSON.parse(raw); if(!Array.isArray(parsed)) continue; parsed.forEach(v=>{ let n=typeof v==='string'?v:(v.nom||v.name||''); if(n && !out.some(x=>x.toLowerCase()===n.toLowerCase())) out.push(n); }); }catch(e){} }
  getDepot().forEach(p=>{ if(p.fournisseur && !out.some(x=>x.toLowerCase()===p.fournisseur.toLowerCase())) out.push(p.fournisseur); });
  let sp=getSP(); Object.keys(sp).forEach(k=>{ (sp[k]||[]).forEach(p=>{ if(p.fournisseur && !out.some(x=>x.toLowerCase()===p.fournisseur.toLowerCase())) out.push(p.fournisseur); }); });
  _cache.four=out.sort(); return _cache.four;
}
function saveFournisseur(nom){
  let list=getFour(); if(list.some(f=>f.toLowerCase()===nom.toLowerCase())) return;
  list.push(nom); _cache.four=null;
  localStorage.setItem('dub_fournisseurs', JSON.stringify(list.map(n=>({nom:n}))));
  localStorage.setItem('fournisseurs', JSON.stringify(list));
}
function fillFournisseurSelect(selId, selected){
  let sel=document.getElementById(selId); if(!sel) return;
  let f=getFour();
  sel.innerHTML='<option value="">-- Choisir Fournisseur --</option>'+f.map(x=>`<option value="${x}">${x}</option>`).join('')+'<option value="__MANUAL__">+ Nouveau fournisseur...</option>';
  if(selected) sel.value=selected;
  let info=document.getElementById('alert-four'); if(info && selId==='a_fournisseur') info.textContent=`✅ ${f.length} fournisseurs trouvés - Clique pour choisir`;
}
function onFournisseurChange(){
  let v=document.getElementById('a_fournisseur').value;
  document.getElementById('a_fournisseur_manual').style.display = v==='__MANUAL__'?'block':'none';
  document.getElementById('btn-quick-add').style.display = v==='__MANUAL__'?'block':'none';
  if(v==='__MANUAL__') document.getElementById('a_fournisseur_manual').focus();
}
function quickAddFournisseur(){
  let nom=document.getElementById('a_fournisseur_manual').value.trim(); if(!nom) return alert('Tape le nom');
  saveFournisseur(nom); fillFournisseurSelect('a_fournisseur', nom);
  document.getElementById('a_fournisseur_manual').style.display='none'; document.getElementById('btn-quick-add').style.display='none';
  alert('✅ Fournisseur "'+nom+'" enregistré !');
}
function onFournisseurEditChange(){
  let v=document.getElementById('e_fournisseur').value;
  document.getElementById('e_fournisseur_manual').style.display = v==='__MANUAL__'?'block':'none';
  document.getElementById('btn-quick-edit').style.display = v==='__MANUAL__'?'block':'none';
}
function quickAddFournisseurEdit(){
  let nom=document.getElementById('e_fournisseur_manual').value.trim(); if(!nom) return alert('Tape le nom');
  saveFournisseur(nom); fillFournisseurSelect('e_fournisseur', nom);
  document.getElementById('e_fournisseur_manual').style.display='none'; document.getElementById('btn-quick-edit').style.display='none';
}
function setVisibilite(v){
  visibiliteChoisie=v;
  document.querySelectorAll('.visi-opt').forEach(el=>el.classList.remove('sel'));
  document.getElementById('opt-'+v).classList.add('sel');
  document.querySelector('input[name="visibilite"][value="'+v+'"]').checked=true;
  let choix=document.getElementById('choixSites');
  if(v==='specifiques'){
    choix.style.display='grid';
    let sites=getSites();
    if(!sites.length) choix.innerHTML='<span style="font-size:12px;color:#f87171">Aucun site créé. Crée un site d\'abord dans Sites.</span>';
    else choix.innerHTML=sites.map(s=>`<label class="site-check"><input type="checkbox" class="chk-site-crea" value="${s.id}"> 📍 ${s.nom}</label>`).join('');
  } else choix.style.display='none';
}
function getSitesCiblesCreation(){
  if(visibiliteChoisie==='tous') return getSites();
  if(visibiliteChoisie==='specifiques'){
    let ids=[...document.querySelectorAll('.chk-site-crea:checked')].map(c=>c.value);
    return getSites().filter(s=>ids.includes(String(s.id)));
  }
  return [];
}
function creerDansSite(siteObj, prodDepot){
  let sp=getSP();
  if(!sp[siteObj.id]) sp[siteObj.id]=[];
  if(sp[siteObj.id].some(p=>String(p.originalId)===String(prodDepot.id) || cleProduit(p)===cleProduit(prodDepot))) return false;
  let marge=getSiteMarge(siteObj);
  let pv=marge!==null?calcPV(prodDepot.pa, marge):prodDepot.pa;
  sp[siteObj.id].push({
    id:Date.now().toString()+Math.random().toString(36).slice(2,5),
    originalId:prodDepot.id, nom:prodDepot.nom, fournisseur:prodDepot.fournisseur,
    lot:prodDepot.lot, peremption:prodDepot.peremption, categorie:prodDepot.categorie||'',
    conditionnement:prodDepot.conditionnement||'', barcode:prodDepot.barcode||'',
    pa:prodDepot.pa, prixAchat:prodDepot.pa, pv:pv, prix:pv,
    marge:marge!==null?marge:0, margin:marge!==null?marge:0, margePropre:false,
    stock_site:0, stock:0, desactive:false, actif:true, statut:'actif'
  });
  saveSP(sp); return true;
}
function getListeGlobale(){
  let out=[];
  getDepot().forEach(p=>{ out.push({...p, _ou:'Dépôt', _ouId:'__DEPOT__', _stock:+(p.stock||p.quantite||p.qte||0)}); });
  let sp=getSP(); let sites=getSites(); let mapNom={}; sites.forEach(s=>mapNom[String(s.id)]=s.nom);
  Object.keys(sp).forEach(siteId=>{
    let siteNom = mapNom[String(siteId)] || siteId;
    (sp[siteId]||[]).forEach(p=>{ out.push({...p, _ou:siteNom, _ouId:siteId, _stock:+(p.stock_site ?? p.stock ?? p.quantite ?? 0)}); });
  });
  return out;
}
function getListe(){
  let tout=getListeGlobale();
  if(vue==='depot') return tout.filter(p=>p._ouId==='__DEPOT__');
  if(vue==='sites') return tout.filter(p=>p._ouId!=='__DEPOT__');
  if(vue==='site' && siteActuel) return tout.filter(p=>String(p._ouId)===String(siteActuel));
  return tout;
}
function setVue(v){
  vue=v; pageActuelle=1;
  ['vGlobal','vDepot','vSites'].forEach(id=>document.getElementById(id).classList.remove('active'));
  if(v==='global') document.getElementById('vGlobal').classList.add('active');
  if(v==='depot') document.getElementById('vDepot').classList.add('active');
  if(v==='sites') document.getElementById('vSites').classList.add('active');
  let sel=document.getElementById('selSite');
  if(v==='site'){ sel.style.display='block'; let sites=getSites(); sel.innerHTML=sites.map(s=>`<option value="${s.id}">${s.nom}</option>`).join('')||'<option value="">Aucun site</option>'; if(!siteActuel && sites.length) siteActuel=sites[0].id; sel.value=siteActuel; }
  else sel.style.display='none';
  renderPage();
}
function onSiteChange(){ siteActuel=document.getElementById('selSite').value; vue='site'; pageActuelle=1; renderPage(); }
function renderPage(){
  let q=(document.getElementById('search')?.value||'').trim();
  let list=getListe();
  if(q){
    list=list.filter(p=>matchIntelligent(p,q));
    let premier=norm(q).split(' ')[0];
    list=[...list].sort((a,b)=>{ let an=norm(a.nom||'').startsWith(premier)?0:1; let bn=norm(b.nom||'').startsWith(premier)?0:1; return an-bn; });
  }
  totalFiltre=list.length; totalPages=Math.max(1, Math.ceil(totalFiltre/20));
  if(pageActuelle>totalPages) pageActuelle=totalPages;
  let debut=(pageActuelle-1)*20;
  let page=list.slice(debut, debut+20);
  document.getElementById('countProduits').textContent = q?`${totalFiltre} trouvé(s)`:`${totalFiltre} produits - Dépôt + Sites`;
  document.getElementById('tbody').innerHTML=page.map(p=>{
    let badge = p._ouId==='__DEPOT__' ? `<span class="badge b-depot">🏭 Dépôt</span>` : `<span class="badge b-site">📍 ${p._ou}</span>`;
    return `<tr><td class="prod-name">${p.nom}</td><td>${badge}</td><td class="pa-cell">${(+p.pa||0).toLocaleString()} CDF</td><td>🏭 ${p.fournisseur||''}</td><td><div style="font-size:11px">Lot: <b>${p.lot||'-'}</b></div><div style="font-size:10px;color:#a0a6c0">${p.peremption||'-'}</div></td><td style="font-weight:900">${p._stock}</td><td><button onclick="goDetail('${p.id}')" class="btn-mini btn-y">Voir →</button></td><td><button onclick="openEdit('${p.id}')" class="btn-mini btn-y">✏️</button></td><td><button onclick="delProd('${p.id}')" class="btn-mini btn-r">Suppr</button></td></tr>`;
  }).join('')||`<tr><td colspan="9" style="text-align:center;padding:30px;color:#6a7085">Aucun produit</td></tr>`;
  renderPagination();
}
function renderPagination(){
  let el=document.getElementById('paginationProduits'); if(!el) return;
  if(totalPages<=1){ el.innerHTML=`<span style="font-weight:900;color:#facc15">Page 1 / 1 • ${totalFiltre}</span>`; return; }
  el.innerHTML=`<button onclick="allerPage(1)" ${pageActuelle<=1?'disabled':''}>⏮️ Début</button><button onclick="allerPage(${pageActuelle-1})" ${pageActuelle<=1?'disabled':''}>◀️ Préc.</button><span style="font-weight:900;color:#facc15">Page ${pageActuelle} / ${totalPages} • ${totalFiltre}</span><button class="pag-next" onclick="allerPage(${pageActuelle+1})" ${pageActuelle>=totalPages?'disabled':''}>Suiv. ▶️</button><button onclick="allerPage(${totalPages})" ${pageActuelle>=totalPages?'disabled':''}>Fin ⏭️</button>`;
}
function allerPage(p){ if(p<1) p=1; if(p>totalPages) p=totalPages; pageActuelle=p; renderPage(); window.scrollTo({top:0,behavior:'smooth'}); }
function onSearchInput(){ clearTimeout(debounceTimer); debounceTimer=setTimeout(()=>{ pageActuelle=1; renderPage(); }, 250); }
function clearSearch(){ document.getElementById('search').value=''; pageActuelle=1; renderPage(); }
function goDetail(id){ let url=`/central/produits/details.html?id=${id}`; try{ let iframe=window.parent.document.querySelector('iframe'); if(iframe){ iframe.src=url; return; } }catch(e){} location.href=url; }
function openAdd(){ fillFournisseurSelect('a_fournisseur',''); setVisibilite('depot'); document.getElementById('addModal').classList.add('show'); }
function closeAdd(){ document.getElementById('addModal').classList.remove('show'); }
function delProd(id){
  if(!confirm('Supprimer ce produit PARTOUT ? Dépôt + tous les Sites')) return;
  let depot=getDepot().filter(p=>String(p.id)!==String(id));
  saveDepot(depot);
  let sp=getSP(); Object.keys(sp).forEach(k=>{ sp[k]=(sp[k]||[]).filter(p=>String(p.id)!==String(id) && String(p.originalId)!==String(id)); }); saveSP(sp);
  renderPage();
}
function saveNew(){
  let nom=document.getElementById('a_nom').value.trim();
  let four=document.getElementById('a_fournisseur').value==='__MANUAL__' ? document.getElementById('a_fournisseur_manual').value.trim() : document.getElementById('a_fournisseur').value.trim();
  let lot=document.getElementById('a_lot').value.trim();
  let per=document.getElementById('a_peremption').value;
  let pa=document.getElementById('a_pa').value;
  if(!nom) return alert('Nom obligatoire'); if(!four) return alert('Fournisseur obligatoire'); if(!lot) return alert('Lot obligatoire'); if(!per) return alert('Péremption obligatoire'); if(!pa) return alert('PA obligatoire');
  if(visibiliteChoisie==='specifiques'){
    let nb=[...document.querySelectorAll('.chk-site-crea:checked')].length;
    if(nb===0) return alert('❌ Tu as choisi Sites spécifiques, coche au moins 1 site.');
  }
  if(four) saveFournisseur(four);
  let obj={id:Date.now().toString(),nom:nom,fournisseur:four,barcode:document.getElementById('a_barcode').value,conditionnement:document.getElementById('a_conditionnement').value,lot:lot,peremption:per,pa:+pa||0,devise:'CDF',site:'Dépôt',stock:0,quantite:0,qte:0};
  let depot=getDepot();
  let existe=depot.find(p=>cleProduit(p)===cleProduit(obj));
  if(existe){ existe.pa=obj.pa; existe.barcode=obj.barcode; existe.conditionnement=obj.conditionnement; existe.lot=obj.lot; existe.peremption=obj.peremption; saveDepot(depot); closeAdd(); renderPage(); alert('⚠️ Ce produit existe déjà (même nom + même fournisseur). PA mis à jour, pas de doublon.'); return; }
  depot.unshift(obj); saveDepot(depot);
  let cibles=getSitesCiblesCreation();
  let ajoutes=0;
  cibles.forEach(s=>{ if(creerDansSite(s, obj)) ajoutes++; });
  closeAdd(); renderPage();
  document.getElementById('a_nom').value=''; document.getElementById('a_lot').value=''; document.getElementById('a_pa').value='';
  if(cibles.length===0) alert('✅ Créé au Dépôt seulement.');
  else if(visibiliteChoisie==='tous') alert(`✅ Créé au Dépôt + visible dans TOUS les sites (${ajoutes} site(s)).`);
  else alert(`✅ Créé au Dépôt + visible dans ${ajoutes} site(s) coché(s).`);
}
function openEdit(id){
  let p=getDepot().find(x=>String(x.id)===String(id));
  if(!p){ let sp=getSP(); for(let k of Object.keys(sp)){ p=(sp[k]||[]).find(x=>String(x.id)===String(id) || String(x.originalId)===String(id)); if(p) break; } }
  if(!p){ p=getDepot().find(x=>cleProduit(x)===id); }
  if(!p) return alert('Produit introuvable');
  editId=p.id; editOldKey=cleProduit(p);
  document.getElementById('e_nom').value=p.nom||'';
  fillFournisseurSelect('e_fournisseur', p.fournisseur||'');
  document.getElementById('e_fournisseur').onchange=onFournisseurEditChange;
  document.getElementById('e_lot').value=p.lot||'';
  document.getElementById('e_peremption').value=p.peremption||'';
  document.getElementById('e_pa').value=p.pa||0;
  document.getElementById('e_conditionnement').value=p.conditionnement||'';
  document.getElementById('e_barcode').value=p.barcode||'';
  document.getElementById('e_categorie').value=p.categorie||'';
  let sp=getSP(); let sites=getSites();
  document.getElementById('editChoixSites').innerHTML=sites.map(s=>{
    let present=(sp[s.id]||[]).some(x=>String(x.originalId)===String(editId) || String(x.id)===String(editId) || cleProduit(x)===editOldKey);
    let stockSite=0; if(present){ let it=(sp[s.id]||[]).find(x=>String(x.originalId)===String(editId)) || (sp[s.id]||[]).find(x=>cleProduit(x)===editOldKey); stockSite=+(it?.stock_site ?? 0); }
    return `<label class="site-check"><input type="checkbox" class="chk-site-edit" value="${s.id}" ${present?'checked':''}> 📍 ${s.nom} ${present?`<span style="color:#22c55e;font-size:11px">• déjà visible - stock ${stockSite}</span>`:''}</label>`;
  }).join('')||'<span style="font-size:12px;color:#6a7085">Aucun site créé</span>';
  document.getElementById('editModal').classList.add('show');
}
function closeEdit(){ document.getElementById('editModal').classList.remove('show'); editOldKey=''; editId=null; }
function saveEdit(){
  let nom=document.getElementById('e_nom').value.trim();
  let four=document.getElementById('e_fournisseur').value==='__MANUAL__' ? document.getElementById('e_fournisseur_manual').value.trim() : document.getElementById('e_fournisseur').value.trim();
  let lot=document.getElementById('e_lot').value.trim();
  let per=document.getElementById('e_peremption').value;
  let pa=parseFloat(document.getElementById('e_pa').value)||0;
  let cond=document.getElementById('e_conditionnement').value.trim();
  let barcode=document.getElementById('e_barcode').value.trim();
  let cat=document.getElementById('e_categorie').value.trim();
  if(!nom) return alert('Nom obligatoire'); if(!four) return alert('Fournisseur obligatoire');
  if(four) saveFournisseur(four);
  let depot=getDepot();
  let prodDepot=depot.find(p=>String(p.id)===String(editId));
  if(!prodDepot) prodDepot=depot.find(p=>cleProduit(p)===editOldKey);
  if(!prodDepot){ alert('Produit introuvable, pas recréé'); return; }
  let oldId=prodDepot.id;
  prodDepot.nom=nom; prodDepot.fournisseur=four; prodDepot.lot=lot; prodDepot.peremption=per; prodDepot.pa=pa; prodDepot.pau=pa; prodDepot.conditionnement=cond; prodDepot.barcode=barcode; prodDepot.categorie=cat;
  if(pa>0 && prodDepot.pv>0) prodDepot.marge=((prodDepot.pv-pa)/pa*100);
  saveDepot(depot);
  let sp=getSP(); let sites=getSites();
  let coches=new Set([...document.querySelectorAll('.chk-site-edit:checked')].map(c=>c.value));
  sites.forEach(siteObj=>{
    let list=sp[siteObj.id]||[];
    let idx=list.findIndex(x=>String(x.originalId)===String(oldId) || String(x.id)===String(oldId) || cleProduit(x)===editOldKey);
    let deja=idx>=0;
    if(coches.has(String(siteObj.id)) && !deja){ creerDansSite(siteObj, prodDepot); }
    if(!coches.has(String(siteObj.id)) && deja){
      let item=list[idx];
      let stockItem=+(item?.stock_site ?? item?.stock ?? 0);
      if(stockItem===0){ sp[siteObj.id]=list.filter((_,i)=>i!==idx); }
    }
  });
  sp=getSP();
  Object.keys(sp).forEach(siteId=>{
    (sp[siteId]||[]).forEach(item=>{
      let meme = String(item.originalId)===String(oldId) || String(item.id)===String(oldId) || cleProduit(item)===editOldKey;
      if(meme){
        item.originalId=oldId;
        item.nom=nom; item.fournisseur=four; item.lot=lot; item.peremption=per; item.conditionnement=cond; item.barcode=barcode; item.categorie=cat;
        if(item.margePropre && item.marge>0){ item.pa=pa; item.prixAchat=pa; item.pv=Math.round(pa*(1+item.marge/100)); item.prix=item.pv; }
        else { item.pa=pa; item.prixAchat=pa; }
      }
    });
  });
  saveSP(sp);
  closeEdit(); renderPage();
  alert('✅ Modifié partout + visibilité mise à jour. Pas recréé.');
}
renderPage();