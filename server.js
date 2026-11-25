const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const db = require('./db/database');
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/central', express.static(path.join(__dirname, 'central')));
app.use('/vendeurs', express.static(path.join(__dirname, 'central', 'vendeurs')));
app.use('/vendeur', express.static(path.join(__dirname, 'central', 'vendeurs')));

function dbAll(sql, params = []) {
  return new Promise((res, rej) => db.all(sql, params, (e, rows) => e ? rej(e) : res(rows || [])));
}
function dbGet(sql, params = []) {
  return new Promise((res, rej) => db.get(sql, params, (e, row) => e ? rej(e) : res(row)));
}
function dbRun(sql, params = []) {
  return new Promise((res, rej) => db.run(sql, params, function(e) { e ? rej(e) : res(this); }));
}

// ===== ✅ CORRIGÉ POUR EN LIGNE : On crée les tables si elles n'existent pas =====
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS sites (id INTEGER PRIMARY KEY AUTOINCREMENT, nom TEXT, ville TEXT)`);
  db.run(`CREATE TABLE IF NOT EXISTS produits (id INTEGER PRIMARY KEY AUTOINCREMENT, sku TEXT, nom TEXT, prix REAL, categorie TEXT, fournisseur TEXT)`);
  db.run(`CREATE TABLE IF NOT EXISTS stocks (id INTEGER PRIMARY KEY AUTOINCREMENT, produit_id INTEGER, site_id INTEGER, quantite REAL DEFAULT 0)`);
  db.run(`CREATE TABLE IF NOT EXISTS ventes (id INTEGER PRIMARY KEY AUTOINCREMENT, site_id INTEGER, vendeur_id INTEGER, total REAL, client_id TEXT, data TEXT, date DATETIME DEFAULT CURRENT_TIMESTAMP, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);
  db.run(`CREATE TABLE IF NOT EXISTS vente_items (id INTEGER PRIMARY KEY AUTOINCREMENT, vente_id INTEGER, produit_id INTEGER, quantite REAL, prix REAL)`);
  db.run(`CREATE TABLE IF NOT EXISTS commandes (id INTEGER PRIMARY KEY AUTOINCREMENT, site_id INTEGER, vendeur_id INTEGER, client_nom TEXT, total REAL, statut TEXT, client_id TEXT, data TEXT, date DATETIME DEFAULT CURRENT_TIMESTAMP, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);
  db.run(`CREATE TABLE IF NOT EXISTS commande_items (id INTEGER PRIMARY KEY AUTOINCREMENT, commande_id INTEGER, produit_id INTEGER, quantite REAL, prix REAL)`);

  db.all("PRAGMA table_info(commandes)", (e, cols) => {
    if(!e && cols && !cols.find(c=>c.name==='data')){
      db.run("ALTER TABLE commandes ADD COLUMN data TEXT", ()=>{ console.log('Colonne data ajoutée à commandes'); });
    }
    if(!e && cols && !cols.find(c=>c.name==='client_id')){
      db.run("ALTER TABLE commandes ADD COLUMN client_id TEXT", ()=>{ console.log('Colonne client_id ajoutée à commandes'); });
    }
  });
  db.all("PRAGMA table_info(ventes)", (e, cols) => {
    if(!e && cols && !cols.find(c=>c.name==='data')){
      db.run("ALTER TABLE ventes ADD COLUMN data TEXT", ()=>{ console.log('Colonne data ajoutée à ventes'); });
    }
    if(!e && cols && !cols.find(c=>c.name==='client_id')){
      db.run("ALTER TABLE ventes ADD COLUMN client_id TEXT", ()=>{ console.log('Colonne client_id ajoutée à ventes'); });
    }
  });

  db.get("SELECT COUNT(*) as c FROM sites", async (e, r) => {
    if (!e && r && r.c === 0) {
      await dbRun("INSERT INTO sites (nom, ville) VALUES (?, ?)", ['Bukavu', 'Bukavu']);
      await dbRun("INSERT INTO sites (nom, ville) VALUES (?, ?)", ['Goma', 'Goma']);
      await dbRun("INSERT INTO produits (sku, nom, prix, categorie) VALUES (?, ?, ?, ?)", ['SUCRE-25', 'Sucre 25kg', 20000, 'Alimentaire']);
      await dbRun("INSERT INTO produits (sku, nom, prix, categorie) VALUES (?, ?, ?, ?)", ['FARINE-25', 'Farine 25kg', 18000, 'Alimentaire']);
      await dbRun("INSERT INTO produits (sku, nom, prix, categorie) VALUES (?, ?, ?, ?)", ['HUILE-20', 'Huile 20L', 25000, 'Alimentaire']);
      console.log('Seed OK dans benzene.db');
    }
  });
});

function normIntelligent(s) {
  return (s || '').toString().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}
function compactIntelligent(s) { return normIntelligent(s).replace(/\s+/g, ''); }
function matchIntelligent(produit, query) {
  let q = normIntelligent(query);
  if (!q) return true;
  let mots = q.split(/\s+/).filter(Boolean);
  let texte = normIntelligent((produit.nom || '') + ' ' + (produit.fournisseur || '') + ' ' + (produit.categorie || ''));
  let texteCompact = compactIntelligent(texte);
  return mots.every(mot => {
    if (texte.includes(mot)) return true;
    if (texteCompact.includes(mot.replace(/\s+/g, ''))) return true;
    if (mot.length >= 5) {
      for (let w of texte.split(' ')) {
        if (w.length === mot.length) {
          let diff = 0; for (let i = 0; i < w.length; i++) if (w[i] !== mot[i]) diff++;
          if (diff <= 1) return true;
        }
      }
    }
    return false;
  });
}
function triIntelligent(filtres, q) {
  if (!q) return filtres;
  let premier = normIntelligent(q).split(' ')[0];
  if (!premier) return filtres;
  return [...filtres].sort((a, b) => {
    let an = normIntelligent(a.nom || '').startsWith(premier) ? 0 : 1;
    let bn = normIntelligent(b.nom || '').startsWith(premier) ? 0 : 1;
    return an - bn;
  });
}

app.get('/api/stock/site/:site_id/search', async (req, res) => {
  const q = (req.query.q || '').trim();
  try {
    let produits = await dbAll(`SELECT p.id, p.nom, p.prix, p.categorie, COALESCE(s.quantite,0) as stock 
      FROM produits p LEFT JOIN stocks s ON s.produit_id=p.id AND s.site_id=?`, [req.params.site_id]);
    let filtres = triIntelligent(produits.filter(p => matchIntelligent(p, q)), q);
    res.json(filtres.slice(0, 50).map(p => ({ id: p.id, nom: p.nom, quantite: p.stock, prix: p.prix, pa_usd: p.prix })));
  } catch (e) { res.json([]); }
});

app.get('/api/stock/central', async (req, res) => {
  const q = (req.query.q || '').trim();
  const page = parseInt(req.query.page || 1) || 1;
  const limit = 20;
  try {
    let produits = await dbAll(`SELECT p.*, COALESCE(SUM(s.quantite),0) as stock FROM produits p LEFT JOIN stocks s ON s.produit_id=p.id GROUP BY p.id`);
    let filtres = triIntelligent(produits.filter(p => matchIntelligent(p, q)), q);
    let total = filtres.length;
    let totalPages = Math.max(1, Math.ceil(total / limit));
    let pageSafe = page > totalPages ? totalPages : page;
    let offsetSafe = (pageSafe - 1) * limit;
    res.json({ produits: filtres.slice(offsetSafe, offsetSafe + limit), total, page: pageSafe, limit, totalPages, hasMore: (offsetSafe + limit) < total });
  } catch (e) { res.json({ produits: [], total: 0, page: 1, limit, totalPages: 1, hasMore: false }); }
});

app.post('/api/vente', async (req, res) => {
  let { site_id, vendeur_id, items } = req.body;
  if (!items || items.length === 0) return res.json({ error: 'Panier vide Boss' });
  try {
    let total = 0;
    for (let it of items) {
      let stock = await dbGet("SELECT * FROM stocks WHERE produit_id=? AND site_id=?", [it.produit_id, site_id]);
      if (!stock || stock.quantite < it.quantite) return res.json({ error: 'Stock insuffisant' });
      let prod = await dbGet("SELECT * FROM produits WHERE id=?", [it.produit_id]);
      total += (prod.prix * it.quantite);
    }
    let r = await dbRun("INSERT INTO ventes (site_id, vendeur_id, total) VALUES (?, ?, ?)", [site_id || 1, vendeur_id || 1, total]);
    let vente_id = r.lastID;
    for (let it of items) {
      let prod = await dbGet("SELECT * FROM produits WHERE id=?", [it.produit_id]);
      await dbRun("INSERT INTO vente_items (vente_id, produit_id, quantite, prix) VALUES (?, ?, ?, ?)", [vente_id, it.produit_id, it.quantite, prod.prix]);
      await dbRun("UPDATE stocks SET quantite = quantite - ? WHERE produit_id=? AND site_id=?", [it.quantite, it.produit_id, site_id]);
    }
    console.log('✅ VENTE #' + vente_id + ' dans benzene.db');
    res.json({ success: true, vente_id });
  } catch (e) { console.error(e); res.json({ error: e.message }); }
});

app.post('/api/commandes', async (req, res) => {
  try {
    let c = req.body;
    let clientId = String(c.id || ('C' + Date.now()));
    let json = JSON.stringify(c);
    let exist = await dbGet("SELECT id FROM commandes WHERE client_id=?", [clientId]);
    if(exist){
      await dbRun("UPDATE commandes SET site_id=?, vendeur_id=?, client_nom=?, total=?, statut=?, data=? WHERE client_id=?",
        [c.site_id || c.siteId || 1, c.vendeur_id || 1, c.client_nom || c.titre || '', c.total || 0, c.statut || 'en_attente', json, clientId]);
      console.log('✅ COMMANDE MAJ ' + clientId + ' dans benzene.db');
      return res.json({ success: true, id: clientId });
    }
    let r = await dbRun("INSERT INTO commandes (site_id, vendeur_id, client_nom, total, statut, client_id, data) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [c.site_id || c.siteId || 1, c.vendeur_id || 1, c.client_nom || c.titre || '', c.total || 0, c.statut || 'en_attente', clientId, json]);
    if (c.groupes) {
      for (let g of c.groupes) {
        for (let p of (g.produits || [])) {
          let prod = await dbGet("SELECT id FROM produits WHERE nom=?", [p.produit_nom]);
          if (prod) await dbRun("INSERT INTO commande_items (commande_id, produit_id, quantite, prix) VALUES (?, ?, ?, ?)",
            [r.lastID, prod.id, p.quantite_commande || 0, p.prix_achat || 0]);
        }
      }
    }
    console.log('✅ COMMANDE #' + clientId + ' dans benzene.db');
    res.json({ success: true, id: clientId });
  } catch (e) { console.error(e); res.json({ error: e.message }); }
});

app.post('/api/ventes', async (req, res) => {
  try {
    let v = req.body;
    let clientId = String(v.id || ('V' + Date.now()));
    let json = JSON.stringify(v);
    let exist = await dbGet("SELECT id FROM ventes WHERE client_id=?", [clientId]);
    if(exist){
      await dbRun("UPDATE ventes SET site_id=?, vendeur_id=?, total=?, data=? WHERE client_id=?",
        [v.site_id || v.siteId || 1, v.vendeur_id || 1, v.total || v.valeurPV || 0, json, clientId]);
      return res.json({ success: true, id: clientId });
    }
    let r = await dbRun("INSERT INTO ventes (site_id, vendeur_id, total, client_id, data) VALUES (?, ?, ?, ?, ?)",
      [v.site_id || v.siteId || 1, v.vendeur_id || 1, v.total || v.valeurPV || 0, clientId, json]);
    res.json({ success: true, id: clientId });
  } catch (e) { res.json({ error: e.message }); }
});

app.get('/api/sites', async (req, res) => res.json(await dbAll("SELECT * FROM sites")));
app.get('/api/produits', async (req, res) => res.json(await dbAll("SELECT * FROM produits")));

app.get('/api/ventes', async (req, res) => {
  let rows = await dbAll("SELECT * FROM ventes ORDER BY id DESC");
  let out = rows.map(r=>{
    if(r.data){ try{ let o = JSON.parse(r.data); o.id = o.id || r.client_id || String(r.id); return o; }catch(e){} }
    return { id: r.client_id || String(r.id), site_id: r.site_id, siteId: r.site_id, vendeur_id: r.vendeur_id, total: r.total, date: r.date || r.created_at };
  });
  res.json(out);
});

app.get('/api/commandes', async (req, res) => {
  let rows = await dbAll("SELECT * FROM commandes ORDER BY id DESC");
  let out = rows.map(r=>{
    if(r.data){ try{ let o = JSON.parse(r.data); o.id = o.id || r.client_id || String(r.id); return o; }catch(e){} }
    return { id: r.client_id || String(r.id), site_id: r.site_id, siteId: r.site_id, vendeur_id: r.vendeur_id, client_nom: r.client_nom, titre: r.client_nom, total: r.total, statut: r.statut, groupes: [] };
  });
  res.json(out);
});

app.delete('/api/commandes/:id', async (req, res) => {
  await dbRun("DELETE FROM commandes WHERE client_id=? OR id=?", [req.params.id, req.params.id]);
  res.json({ success: true });
});
app.delete('/api/ventes/:id', async (req, res) => {
  await dbRun("DELETE FROM ventes WHERE client_id=? OR id=?", [req.params.id, req.params.id]);
  res.json({ success: true });
});

app.get('/api/parametres', (req, res) => res.json({ taux_depot: 28500 }));
app.get('/health', (req, res) => res.json({ ok: true }));
app.get('/', (req, res) => res.redirect('/central/login.html'));

// ✅ CORRIGÉ POUR EN LIGNE : Render donne le PORT
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('🚀 SERVEUR OK sur port ' + PORT + ' - TOUT DANS benzene.db'));