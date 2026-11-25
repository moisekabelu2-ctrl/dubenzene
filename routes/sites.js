const express = require('express');
const router = express.Router();
const db = require('../db/database');

// LISTE - On envoie juste id (caché) + nom (visible)
// Pas de ville, pas d'adresse, pas de code visible
router.get('/', (req, res) => {
  db.all("SELECT id, nom FROM sites ORDER BY id DESC", [], (err, rows) => {
    if (err) return res.status(500).json({error: err.message});
    res.json(rows);
  });
});

router.post('/', (req, res) => {
  const { nom, ville, adresse } = req.body;
  if(!nom || !ville) return res.status(400).json({message: 'Nom et ville obligatoires'});
  db.run("INSERT INTO sites (nom, ville, adresse) VALUES (?, ?, ?)", [nom, ville, adresse], function(err){
    if(err) return res.status(500).json({error: err.message});
    res.json({message: 'Site créé avec succès', id: this.lastID});
  });
});

module.exports = router;