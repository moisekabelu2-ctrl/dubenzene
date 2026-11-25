
const sqlite3=require('sqlite3').verbose();
const db=new sqlite3.Database('db/benzene.db');
db.exec("PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL;");
function vendre(data, cb){
  const {site_id, vendeur_id, items}=data;
  db.serialize(()=>{
    db.run("BEGIN IMMEDIATE");
    let checks=0; let ok=true;
    if(items.length===0){db.run("ROLLBACK"); return cb(new Error('Panier vide'));}
    items.forEach(it=>{
      db.get('SELECT quantite FROM stocks WHERE produit_id=? AND site_id=?',[it.produit_id,site_id],(e,row)=>{
        if(!row || row.quantite < it.quantite) ok=false;
        checks++;
        if(checks===items.length){
          if(!ok){ db.run("ROLLBACK"); return cb(new Error('Stock insuffisant')); }
          let total=0; items.forEach(i=>total+=i.quantite*i.prix);
          db.run('INSERT INTO ventes (site_id,vendeur_id,total) VALUES (?,?,?)',[site_id,vendeur_id,total],function(){
            const vente_id=this.lastID;
            const stmt=db.prepare('INSERT INTO vente_items (vente_id,produit_id,quantite,prix) VALUES (?,?,?,?)');
            items.forEach(i=>{ stmt.run(vente_id,i.produit_id,i.quantite,i.prix); db.run('UPDATE stocks SET quantite=quantite-? WHERE produit_id=? AND site_id=?',[i.quantite,i.produit_id,site_id]); });
            stmt.finalize(()=>{ db.run("COMMIT",()=>cb(null,{vente_id,total})); });
          });
        }
      });
    });
  });
}
module.exports={vendre};
