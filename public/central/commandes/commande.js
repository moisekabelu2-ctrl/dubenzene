// ===== COMMANDE.JS - COMPLET CORRIGÉ - VERSION IndexedDB =====
function getSitesListCommande(){
  try{
    let s = JSON.parse(localStorage.getItem('dub_sites')||'[]');
    if(Array.isArray(s) && s.length) return s.map(x => typeof x==='string' ? {nom:x,id:x} : {nom:x.nom||x.name||x.id, id:x.id||x.nom||x.name});
  }catch(e){}
  try{
    let sp = JSON.parse(localStorage.getItem('dub_sites_produits')||'{}');
    return Object.keys(sp).map(k=>({nom:k,id:k}));
  }catch(e){ return []; }
}
function fmtCmd(n){ return (Number(n)||0).toLocaleString(); }
function getStockDepotCmd(){
  try{ return JSON.parse(localStorage.getItem('dubenzen_produits')||localStorage.getItem('produits')||'[]'); }catch(e){ return []; }
}
function getStockSiteCmd(siteId){
  try{
    let sp = JSON.parse(localStorage.getItem('dub_sites_produits')||'{}');
    if(sp[siteId]) return sp[siteId];
    for(let k of Object.keys(sp)){ if(k.toLowerCase()===String(siteId).toLowerCase()) return sp[k]; }
    return [];
  }catch(e){ return []; }
}
function normaliserSite(id){
  let s = String(id||'DEPOT').toLowerCase().trim();
  if(s.includes('dépôt') || s.includes('depot') || s === 'dépôt central' || s === 'depot central') return 'DEPOT';
  return String(id||'DEPOT').toUpperCase().trim();
}
function normaliserNom(nom){ return String(nom||'').toLowerCase().trim(); }
function getFournisseurProduit(p){
  let f = p.fournisseur || p.fournisseur_nom || p.fournisseurNom || p.supplier || p.nom_fournisseur || p.fournisseur_name || '';
  f = String(f||'').trim();
  return f || 'Sans Fournisseur';
}
function getListeFournisseursCmd(){
  let map = {};
  ['dub_fournisseurs','dubenzen_fournisseurs','fournisseurs'].forEach(k=>{
    try{
      let arr = JSON.parse(localStorage.getItem(k)||'[]');
      if(!Array.isArray(arr)) return;
      arr.forEach(v=>{
        let nom = typeof v==='string' ? v : (v.nom||v.name||v.raison||'');
        if(!nom || !nom.trim()) return;
        let key = normaliserNom(nom);
        if(!map[key]) map[key] = { nom: nom.trim(), priorites: {}, priorite: null };
        if(typeof v==='object' && v){
          if(v.priorites && typeof v.priorites==='object'){
            Object.keys(v.priorites).forEach(sk=>{
              let nk = normaliserSite(sk);
              if(map[key].priorites[nk] == null) map[key].priorites[nk] = +v.priorites[sk];
            });
          }
          if(v.priorite != null && map[key].priorite == null) map[key].priorite = +v.priorite;
          if(v.ordre != null && map[key].priorite == null) map[key].priorite = +v.ordre;
        }
      });
    }catch(e){}
  });
  return Object.values(map);
}
function getPrioriteFournisseurCmd(nomFournisseur, siteId){
  try{
    let site = normaliserSite(siteId);
    let liste = getListeFournisseursCmd();
    let f = liste.find(x=> normaliserNom(x.nom) === normaliserNom(nomFournisseur));
    if(!f) return 999;
    if(f.priorites && f.priorites[site] != null) return +f.priorites[site];
    if(f.priorite != null) return +f.priorite;
    return 999;
  }catch(e){ return 999; }
}
function trierGroupesParPrioriteCmd(groupes, siteId){
  if(!Array.isArray(groupes)) return groupes;
  let site = normaliserSite(siteId);
  return [...groupes].sort((a,b)=>{
    let pa = getPrioriteFournisseurCmd(a.fournisseur, site);
    let pb = getPrioriteFournisseurCmd(b.fournisseur, site);
    if(pa !== pb) return pa - pb;
    return String(a.fournisseur||'').localeCompare(String(b.fournisseur||''));
  });
}
function trouverContenance(p){
  let c = Number(p.contenance || 1) || 1;
  if(c > 1) return c;
  let uniteVente = (p.unite_vente || p.unite_stock || 'PLQ').toString().toUpperCase().trim();
  let uniteAchat = (p.unite_achat || p.conditionnement || 'BT').toString().toUpperCase().trim();
  try{
    let list = JSON.parse(localStorage.getItem('dubenzen_contenances')||'[]');
    if(Array.isArray(list)){
      let f = list.find(x => (x.de||'').toString().toUpperCase().trim()===uniteAchat && (x.vers||'').toString().toUpperCase().trim()===uniteVente);
      if(f && +f.val > 1) return +f.val;
    }
  }catch(e){}
  try{
    let list2 = JSON.parse(localStorage.getItem('dubenzen_conditionnements')||'[]');
    if(Array.isArray(list2)){
      let f2 = list2.find(x => (x.nom||'').toString().toUpperCase().trim()===uniteAchat || (x.unite_achat||'').toString().toUpperCase().trim()===uniteAchat);
      if(f2 && +f2.contenance > 1) return +f2.contenance;
      let f3 = list2.find(x => (x.unite_vente||'').toString().toUpperCase().trim()===uniteVente && (x.unite_achat||'').toString().toUpperCase().trim()===uniteAchat);
      if(f3 && +f3.contenance > 1) return +f3.contenance;
    }
  }catch(e){}
  try{
    let list3 = JSON.parse(localStorage.getItem('dub_conditionnements')||'[]');
    if(Array.isArray(list3)){
      let f4 = list3.find(x => (x.nom||'').toString().toUpperCase().trim()===uniteAchat);
      if(f4 && +f4.contenance > 1) return +f4.contenance;
    }
  }catch(e){}
  if(uniteVente==='AMP' && uniteAchat==='BT') return 10;
  if(uniteVente==='PLQ' && uniteAchat==='BT') return 3;
  if(uniteVente==='L' && uniteAchat==='BIDON') return 25;
  return 1;
}
function calculerLigneCommande(p, nomEndroit){
  let estDepot = normaliserSite(nomEndroit) === 'DEPOT';
  let stockExistant = estDepot ? Number(p.stock ?? p.stock_site ?? p.quantite ?? p.qte ?? 0) : Number(p.stock_site ?? p.stock ?? p.quantite ?? p.qte ?? 0);
  stockExistant = stockExistant || 0;
  let stockAlerte = Number(p.alerte ?? p.stock_alerte ?? 0) || 0;
  let stockMax = Number(p.stock_max ?? p.max ?? 0) || 0;
  let pa = Number(p.pa ?? p.pau ?? p.prix_achat ?? 0) || 0;
  let uniteVente = p.unite_vente || p.unite_stock || 'PLQ';
  let uniteAchat = p.unite_achat || p.conditionnement || 'BT';
  let contenance = trouverContenance(p);
  if(String(uniteVente).toUpperCase()===String(uniteAchat).toUpperCase()) contenance = 1;
  let fournisseurNom = getFournisseurProduit(p);
  if(stockExistant === 0){
    if(!stockMax) stockMax = 10;
    let besoinVente = stockMax;
    let qteAchat = Math.ceil(besoinVente / contenance);
    return { produit_id: p.id, produit_nom: p.nom, site: nomEndroit, stock_actuel: 0, stock_alerte: stockAlerte, stock_max: stockMax, contenance: contenance, unite_vente: uniteVente, unite_achat: uniteAchat, quantite_unites: besoinVente, quantite_boites: qteAchat, quantite_commande: qteAchat, quantite_a_commander: qteAchat, prix_achat: pa, total_ligne: qteAchat * pa, total_achat: qteAchat * pa, fournisseur_nom: fournisseurNom, fournisseur: fournisseurNom, selected: true, raison: '⛔ Stock 0', texte_commande: `${qteAchat} ${uniteAchat} (= ${besoinVente} ${uniteVente})` };
  }
  if(!stockAlerte || !stockMax) return null;
  if(stockExistant > stockAlerte) return null;
  if(stockExistant >= stockMax) return null;
  let besoinVente = stockMax - stockExistant;
  if(besoinVente <= 0) return null;
  let qteAchat = Math.ceil(besoinVente / contenance);
  return { produit_id: p.id, produit_nom: p.nom, site: nomEndroit, stock_actuel: stockExistant, stock_alerte: stockAlerte, stock_max: stockMax, contenance: contenance, unite_vente: uniteVente, unite_achat: uniteAchat, quantite_unites: besoinVente, quantite_boites: qteAchat, quantite_commande: qteAchat, quantite_a_commander: qteAchat, prix_achat: pa, total_ligne: qteAchat * pa, total_achat: qteAchat * pa, fournisseur_nom: fournisseurNom, fournisseur: fournisseurNom, selected: true, raison: '⚠️ Stock bas', texte_commande: `${qteAchat} ${uniteAchat} (= ${besoinVente} ${uniteVente})` };
}
function getBesoinsPourUnEndroit(nomEndroit, siteId){
  let brut = (normaliserSite(nomEndroit)==='DEPOT') ? getStockDepotCmd() : getStockSiteCmd(siteId||nomEndroit);
  let out = [];
  brut.forEach(p=>{ let b = calculerLigneCommande(p, nomEndroit); if(b) out.push(b); });
  return out;
}
function genererGroupesCommande(type, siteChoisi){
  let tous = [];
  let sitePourPriorite = 'DEPOT';
  if(type==='DEPOT'){ tous = getBesoinsPourUnEndroit('Dépôt Central'); sitePourPriorite = 'DEPOT'; }
  else if(type==='UN_SITE'){ let s = getSitesListCommande().find(x=>String(x.id)===String(siteChoisi) || x.nom===siteChoisi); let nom = s ? s.nom : siteChoisi; let id = s ? s.id : siteChoisi; tous = getBesoinsPourUnEndroit(nom, id); sitePourPriorite = id; }
  else if(type==='TOUS_SITES'){ getSitesListCommande().forEach(s=> tous.push(...getBesoinsPourUnEndroit(s.nom, s.id))); sitePourPriorite = 'DEPOT'; }
  else if(type==='DEPOT_TOUS'){ tous.push(...getBesoinsPourUnEndroit('Dépôt Central')); getSitesListCommande().forEach(s=> tous.push(...getBesoinsPourUnEndroit(s.nom, s.id))); sitePourPriorite = 'DEPOT'; }
  let parF = {};
  tous.forEach(b=>{ let nomOriginal = (b.fournisseur_nom || b.fournisseur || 'Sans Fournisseur').toString().trim() || 'Sans Fournisseur'; let cle = normaliserNom(nomOriginal); if(!parF[cle]) parF[cle] = { nomAffiche: nomOriginal, produits: [] }; parF[cle].produits.push(b); });
  let groupes = Object.values(parF).map(g=>{ let total = g.produits.reduce((s,p)=>s+(Number(p.total_ligne)||0),0); return { fournisseur: g.nomAffiche, produits: g.produits, total }; });
  groupes = trierGroupesParPrioriteCmd(groupes, sitePourPriorite);
  return groupes;
}

// ===== SAUVEGARDE IndexedDB - NE BLOQUE PLUS =====
// On garde les mêmes noms pour que l'Historique marche
let CACHE_COMMANDES = [];
async function chargerCommandesCache(){
  if(typeof dbGetCommandes === 'function'){
    CACHE_COMMANDES = await dbGetCommandes();
  }
  return CACHE_COMMANDES;
}
function getCommandesSauvegardees(){ return CACHE_COMMANDES; }
function getCommandeParId(id){ return CACHE_COMMANDES.find(c=>String(c.id)===String(id)); }
function compacterCommande(cmd){
  return {
    id: cmd.id, date: cmd.date, titre: cmd.titre, type: cmd.type, siteId: cmd.siteId, site: cmd.site, total: cmd.total, statut: cmd.statut || 'En attente',
    groupes: (cmd.groupes||[]).map(g=>({
      fournisseur: g.fournisseur, total: g.total,
      produits: (g.produits||[]).map(p=>({
        produit_nom: p.produit_nom || p.n,
        site: p.site,
        quantite_commande: p.quantite_commande ?? p.q,
        quantite_boites: p.quantite_commande ?? p.q,
        unite_achat: p.unite_achat || p.u,
        unite_vente: p.unite_vente || p.uv,
        prix_achat: p.prix_achat ?? p.p,
        total_ligne: p.total_ligne ?? p.t
      }))
    }))
  };
}
async function sauverCommande(commande){
  let legere = compacterCommande(commande);
  if(legere.groupes) legere.groupes = trierGroupesParPrioriteCmd(legere.groupes, legere.siteId);
  // Si db.js est chargé, on sauve dans IndexedDB
  if(typeof dbSaveCommande === 'function'){
    await dbSaveCommande(legere);
    await chargerCommandesCache();
    console.log('✅ Commande sauvée IndexedDB, total:', CACHE_COMMANDES.length);
    return legere;
  }
  // Secours si db.js n'est pas chargé : ancien localStorage
  try{
    let list = CACHE_COMMANDES.slice();
    list.unshift(legere);
    localStorage.setItem('dub_commandes', JSON.stringify(list.slice(0,20)));
    CACHE_COMMANDES = list.slice(0,20);
    return legere;
  }catch(e){ throw e; }
}
async function supprimerCommande(id){
  if(typeof dbDeleteCommande === 'function'){
    await dbDeleteCommande(id);
    CACHE_COMMANDES = CACHE_COMMANDES.filter(c=>String(c.id)!==String(id));
  } else {
    try{
      let list = CACHE_COMMANDES.filter(c=>String(c.id)!==String(id));
      localStorage.setItem('dub_commandes', JSON.stringify(list));
      CACHE_COMMANDES = list;
    }catch(e){}
  }
}