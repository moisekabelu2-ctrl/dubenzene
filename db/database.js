const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

// ✅ CORRIGÉ POUR EN LIGNE : On peut changer le chemin de la DB avec une variable
// Sur Render avec Disk, tu mettras DATABASE_PATH=/opt/render/project/src/db/benzene.db
const dbPath = process.env.DATABASE_PATH || path.join(__dirname, 'benzene.db');
const schemaPath = path.join(__dirname, 'schema.sql');

// ✅ On crée le dossier si il n'existe pas (en ligne il n'existe pas toujours)
const dir = path.dirname(dbPath);
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
  console.log('Dossier DB créé:', dir);
}

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Erreur connexion DB:', err.message);
  } else {
    console.log('DB connectée:', dbPath);
  }
});

db.serialize(() => {
  db.exec("PRAGMA journal_mode=WAL;");
  db.exec("PRAGMA foreign_keys=ON;");

  // ✅ 1. On essaie schema.sql SI il existe
  if (fs.existsSync(schemaPath)) {
    try {
      const schema = fs.readFileSync(schemaPath, 'utf-8');
      db.exec(schema, (err) => {
        if (err) console.error('Erreur schema.sql:', err.message);
        else console.log('Schema OK - toutes les tables créées');
      });
    } catch (e) {
      console.error('Erreur lecture schema.sql:', e.message);
    }
  } else {
    console.log('schema.sql introuvable, on crée les tables de secours...');
    // ✅ 2. Si pas de schema.sql, on crée les tables nous-mêmes pour ne pas planter en ligne
    db.exec(`
      CREATE TABLE IF NOT EXISTS sites (id INTEGER PRIMARY KEY AUTOINCREMENT, nom TEXT, ville TEXT);
      CREATE TABLE IF NOT EXISTS produits (id INTEGER PRIMARY KEY AUTOINCREMENT, sku TEXT, nom TEXT, prix REAL, categorie TEXT, fournisseur TEXT);
      CREATE TABLE IF NOT EXISTS stocks (id INTEGER PRIMARY KEY AUTOINCREMENT, produit_id INTEGER, site_id INTEGER, quantite REAL DEFAULT 0);
      CREATE TABLE IF NOT EXISTS ventes (id INTEGER PRIMARY KEY AUTOINCREMENT, site_id INTEGER, vendeur_id INTEGER, total REAL, client_id TEXT, data TEXT, date DATETIME DEFAULT CURRENT_TIMESTAMP, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
      CREATE TABLE IF NOT EXISTS vente_items (id INTEGER PRIMARY KEY AUTOINCREMENT, vente_id INTEGER, produit_id INTEGER, quantite REAL, prix REAL);
      CREATE TABLE IF NOT EXISTS commandes (id INTEGER PRIMARY KEY AUTOINCREMENT, site_id INTEGER, vendeur_id INTEGER, client_nom TEXT, total REAL, statut TEXT, client_id TEXT, data TEXT, date DATETIME DEFAULT CURRENT_TIMESTAMP, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
      CREATE TABLE IF NOT EXISTS commande_items (id INTEGER PRIMARY KEY AUTOINCREMENT, commande_id INTEGER, produit_id INTEGER, quantite REAL, prix REAL);
    `, (err) => {
      if (err) console.error('Erreur création tables secours:', err.message);
      else console.log('Tables de secours créées OK');
    });
  }
});

module.exports = db;