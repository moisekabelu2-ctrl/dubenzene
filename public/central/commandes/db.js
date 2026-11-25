// db.js - DUBENZEN : IndexedDB = Petit Cahier + Synchro vers benzene.db
let DB = null;
let DB_PROMISE = null;

function dbInit(){
  if(DB_PROMISE) return DB_PROMISE;
  DB_PROMISE = new Promise((resolve)=>{
    let req = indexedDB.open('dubenzen_db', 2);
    req.onupgradeneeded = (e)=>{
      let db = e.target.result;
      if(!db.objectStoreNames.contains('commandes')) db.createObjectStore('commandes', {keyPath:'id'});
      if(!db.objectStoreNames.contains('ventes')) db.createObjectStore('ventes', {keyPath:'id'});
      if(!db.objectStoreNames.contains('archives')) db.createObjectStore('archives', {keyPath:'id'});
      if(!db.objectStoreNames.contains('pending')) db.createObjectStore('pending', {keyPath:'id'});
    };
    req.onsuccess = (e)=>{ DB = e.target.result; resolve(DB); };
    req.onerror = ()=>{ resolve(null); };
  });
  return DB_PROMISE;
}

function dbGetAll(store){
  return dbInit().then(db=>{
    if(!db) return [];
    return new Promise((res)=>{
      let tx = db.transaction([store], 'readonly');
      let st = tx.objectStore(store);
      let req = st.getAll();
      req.onsuccess = ()=>{ res(req.result || []); };
      req.onerror = ()=>{ res([]); };
    });
  });
}

function dbPut(store, obj){
  return dbInit().then(db=>{
    return new Promise((res, rej)=>{
      let tx = db.transaction([store], 'readwrite');
      let st = tx.objectStore(store);
      st.put(obj);
      tx.oncomplete = ()=>res(true);
      tx.onerror = ()=>rej(tx.error);
    });
  });
}

function dbDelete(store, id){
  return dbInit().then(db=>{
    return new Promise((res)=>{
      let tx = db.transaction([store], 'readwrite');
      tx.objectStore(store).delete(id);
      tx.oncomplete = ()=>res(true);
      tx.onerror = ()=>res(false);
    });
  });
}

// ===== SYNCHRO VERS BENZENE.DB =====
async function dbSyncVersServeur(type, data){
  try{
    let url = type === 'commande' ? '/api/commandes' : '/api/ventes';
    let res = await fetch(url, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(data)
    });
    if(res.ok) return true;
    return false;
  }catch(e){
    return false;
  }
}

// ✅ CORRECTION 1 : On n'efface PLUS le local après envoi
async function dbSyncPending(){
  let pendings = await dbGetAll('pending');
  for(let p of pendings){
    let ok = await dbSyncVersServeur(p.type, p.data);
    if(ok){
      await dbDelete('pending', p.id);
      // ON GARDE commandes / ventes en local comme miroir
      // Sinon l'historique disparaît
    }
  }
  if(pendings.length) console.log('Synchro OK:', pendings.length, 'envoyés vers benzene.db');
}

window.addEventListener('online', ()=> dbSyncPending());
setInterval(()=> dbSyncPending(), 30000);

// ===== COMMANDES =====
// ✅ CORRECTION 2 : FUSION Chrome + benzene.db, l'historique ne disparaît plus
async function dbGetCommandes(){
  let local = await dbGetAll('commandes');
  if(!Array.isArray(local)) local = [];

  try{
    let res = await fetch('/api/commandes');
    if(res.ok){
      let data = await res.json();
      let serveur = [];
      if(Array.isArray(data)) serveur = data;
      else if(Array.isArray(data.commandes)) serveur = data.commandes;
      else if(Array.isArray(data.data)) serveur = data.data;
      else if(Array.isArray(data.rows)) serveur = data.rows;

      serveur = serveur.map(c=>{
        if(typeof c.groupes === 'string'){ try{ c.groupes = JSON.parse(c.groupes); }catch(e){ c.groupes = []; } }
        return c;
      });

      console.log('Serveur :', serveur.length, '| Chrome :', local.length);

      let map = new Map();
      local.forEach(c => map.set(String(c.id), c));
      serveur.forEach(c => map.set(String(c.id), c));
      let fusion = Array.from(map.values());
      for(let c of fusion.slice(0,200)){ try{ await dbPut('commandes', c); }catch(e){} }
      fusion.sort((a,b)=> String(b.id).localeCompare(String(a.id)));
      return fusion;
    }
  }catch(e){}

  local.sort((a,b)=> String(b.id).localeCompare(String(a.id)));
  return local;
}

async function dbSaveCommande(c){
  if(!c.id) c.id = 'C'+Date.now();
  let legere = {
    id: String(c.id), date: c.date || new Date().toISOString(), titre: c.titre, total: c.total,
    siteId: c.siteId || c.site, site: c.site || c.siteId,
    site_id: c.site_id || c.siteId || 1,
    vendeur_id: c.vendeur_id || 1,
    client_nom: c.client_nom || c.titre || '',
    type: c.type, statut: c.statut || 'en_attente',
    modifiee: c.modifiee || false, date_modif: c.date_modif || '',
    groupes: (c.groupes||[]).map(g=>({
      fournisseur: g.fournisseur, total: g.total,
      produits: (g.produits||[]).map(p=>({
        produit_nom: p.produit_nom || p.n,
        site: p.site, fournisseur: p.fournisseur || g.fournisseur,
        selected: p.selected !== false && p.actif !== false && !p.desactive,
        actif: p.selected !== false && p.actif !== false && !p.desactive,
        desactive: p.desactive || false,
        quantite_commande: p.quantite_commande ?? p.q,
        quantite_boites: p.quantite_boites ?? p.quantite_commande ?? p.q,
        unite_achat: p.unite_achat || p.u,
        unite_vente: p.unite_vente || p.uv,
        prix_achat: p.prix_achat ?? p.p,
        total_ligne: p.total_ligne ?? p.t,
        stock_actuel: p.stock_actuel,
        stock_alerte: p.stock_alerte,
        stock_max: p.stock_max,
        contenance: p.contenance,
        raison: p.raison
      }))
    }))
  };
  await dbPut('commandes', legere);
  let ok = await dbSyncVersServeur('commande', legere);
  if(!ok){
    await dbPut('pending', {id: 'P_'+legere.id, type:'commande', data: legere});
  }
  return true;
}

async function dbDeleteCommande(id){
  await dbDelete('commandes', String(id));
  await dbDelete('pending', 'P_'+String(id));
  try{ await fetch('/api/commandes/'+String(id), {method:'DELETE'}); }catch(e){}
}

// ===== VENTES =====
async function dbGetVentes(){
  let local = await dbGetAll('ventes');
  if(!Array.isArray(local)) local = [];
  try{
    let res = await fetch('/api/ventes');
    if(res.ok){
      let data = await res.json();
      let serveur = Array.isArray(data) ? data : (data.ventes || data.data || []);
      let map = new Map();
      local.forEach(v => map.set(String(v.id), v));
      serveur.forEach(v => map.set(String(v.id), v));
      let fusion = Array.from(map.values());
      fusion.sort((a,b)=>String(b.id).localeCompare(String(a.id)));
      return fusion;
    }
  }catch(e){}
  local.sort((a,b)=>String(b.id).localeCompare(String(a.id)));
  return local;
}

async function dbSaveVente(v){
  if(!v.id) v.id = 'V'+Date.now();
  await dbPut('ventes', v);
  let ok = await dbSyncVersServeur('vente', v);
  if(!ok) await dbPut('pending', {id: 'P_'+String(v.id), type:'vente', data: v});
  return true;
}

async function dbDeleteVente(id){
  await dbDelete('ventes', id);
  await dbDelete('pending', 'P_'+String(id));
  try{ await fetch('/api/ventes/'+String(id), {method:'DELETE'}); }catch(e){}
}

// ===== MIGRATION : 1 seule fois =====
async function dbMigrerAncien(){
  if(localStorage.getItem('dub_migre_db')==='1') return;
  try{
    let anciennes = JSON.parse(localStorage.getItem('dub_commandes')||'[]');
    if(!Array.isArray(anciennes)) anciennes = [];
    for(let c of anciennes){ await dbSaveCommande(c); }
    let anciennesVentes = JSON.parse(localStorage.getItem('dub_ventes')||'[]');
    if(Array.isArray(anciennesVentes)){
      for(let v of anciennesVentes){ await dbSaveVente(v); }
    }
    localStorage.removeItem('dub_commandes');
    localStorage.removeItem('commandes');
    localStorage.removeItem('dub_ventes');
    localStorage.setItem('dub_migre_db','1');
    console.log('Migration OK :', anciennes.length, 'commandes déplacées');
  }catch(e){ console.error('Migration', e); }
}

// ===== RÉCUPÉRER L'HISTORIQUE PERDU =====
async function dbRecupererHistorique(){
  let commandes = await dbGetAll('commandes');
  let ventes = await dbGetAll('ventes');
  console.log('Jai trouvé :', commandes.length, 'commandes,', ventes.length, 'ventes en local');
  for(let c of commandes) await dbSyncVersServeur('commande', c);
  for(let v of ventes) await dbSyncVersServeur('vente', v);
  console.log('✅ Historique déplacé dans benzene.db');
  return {commandes: commandes.length, ventes: ventes.length};
}

// ===== SAUVEGARDE / EXPORT =====
async function dbExporterSauvegarde(){
  let commandes = await dbGetCommandes();
  let ventes = await dbGetVentes();
  let data = { date: new Date().toISOString(), commandes, ventes };
  let blob = new Blob([JSON.stringify(data)], {type:'application/json'});
  let a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'dubenzen-sauvegarde-' + new Date().toISOString().slice(0,10) + '.json';
  a.click();
}