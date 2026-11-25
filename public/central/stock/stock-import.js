// IMPORT / EXPORT - PV = PAU + MARGE auto
// ANTI-DOUBLON : Nom+Fournisseur+Lot nettoyé (espaces/majuscules) => Mise à jour, jamais de doublon

function cleanNom(s){ return String(s||'').trim().toUpperCase().replace(/\s+/g,' '); }
function cleanTxt(s){ return String(s||'').trim().toUpperCase().replace(/\s+/g,' '); }

// === SYNC SITES -> DÉPÔT : copie TOUT sauf stock = 0 ===
function syncSiteVersDepot(){
  try{
    var sp={}; try{sp=JSON.parse(localStorage.getItem('dub_sites_produits')||'{}');}catch(e){sp={};}
    var ajoutes=0;
    for(var sid in sp){
      (sp[sid]||[]).forEach(function(p){
        var nom=cleanNom(p.nom); if(!nom) return;
        var four=cleanTxt(p.fournisseur); var lot=cleanTxt(p.lot);
        var idx=allProd.findIndex(function(d){
          return cleanNom(d.nom)===nom && cleanTxt(d.fournisseur)===four && cleanTxt(d.lot)===lot;
        });
        if(idx>=0){
          // Déjà au dépôt : on met à jour les infos, mais on NE TOUCHE PAS au stock dépôt
          var dep=allProd[idx];
          dep.pa=p.pa ?? dep.pa; dep.pau=p.pa ?? dep.pau;
          dep.pv=p.pv ?? dep.pv; dep.prix=p.pv ?? dep.prix;
          dep.marge=p.marge ?? dep.marge;
          dep.stock_alerte=p.stock_alerte ?? dep.stock_alerte; dep.alerte=p.alerte ?? dep.alerte;
          dep.stock_max=p.stock_max ?? dep.stock_max;
          dep.contenance=p.contenance ?? dep.contenance;
          dep.categorie=p.categorie || dep.categorie;
          dep.peremption=p.peremption || dep.peremption;
          dep.fournisseur=p.fournisseur || dep.fournisseur;
          allProd[idx]=enrich(dep);
        } else {
          var copie={}; for(var k in p){ copie[k]=p[k]; }
          copie.id=p.originalId || p.id || (Date.now().toString()+Math.random().toString().slice(2,6));
          copie.nom=p.nom; copie.site='Dépôt'; copie.site_nom='Dépôt Central';
          copie.stock=0; copie.stock_depot=0; copie.quantite=0; copie.qte=0; copie.stock_site=0;
          allProd.unshift(enrich(copie)); ajoutes++;
        }
      });
    }
    if(ajoutes>0) saveData();
    return ajoutes;
  }catch(e){ console.log('sync erreur',e); return 0; }
}
function syncSitesVersDepotTout(){
  var avant=allProd.length;
  var ajoutes=syncSiteVersDepot();
  try{ localStorage.setItem('dubenzen_produits', JSON.stringify(allProd)); }catch(e){}
  try{ localStorage.setItem('dub_produits', JSON.stringify(allProd)); }catch(e){}
  saveData(); load();
  alert('✅ Sync Fait ! Nouveaux au Dépôt : '+ajoutes+' | Total Dépôt : '+allProd.length+'\nStock Dépôt = 0 pour les nouveaux, tout le reste copié (PA, PV, marge, stock max, alerte...)');
}

function openImportSiteModal(){
  let sites=getSitesList(); if(sites.length===0){alert('Crée d’abord un Site');return;}
  let sel=document.getElementById('importSiteSelect');
  sel.innerHTML=sites.map(s=>`<option value="${s.id}">${s.nom}</option>`).join('');
  updateImportSiteInfo(); sel.onchange=updateImportSiteInfo;
  document.getElementById('importSiteModal').classList.add('show');
}
function updateImportSiteInfo(){
  let id=document.getElementById('importSiteSelect').value;
  let nom=document.getElementById('importSiteSelect').options[document.getElementById('importSiteSelect').selectedIndex]?.text||id;
  let list=getSiteProducts(id);
  document.getElementById('importSiteInfo').innerHTML=`Tu vas importer dans : <b style="color:#22c55e;font-size:14px">${nom}</b><br>Ce site a déjà ${list.length} articles.`;
}
function closeImportSiteModal(){document.getElementById('importSiteModal').classList.remove('show');}
function confirmImportSite(){ importSiteChoisi=document.getElementById('importSiteSelect').value; if(!importSiteChoisi){alert('Choisis un site');return;} closeImportSiteModal(); document.getElementById('fileImportSite').click(); }
function openExportSiteModal(){
  let sites=getSitesList(); if(sites.length===0){alert('Aucun site');return;}
  let sel=document.getElementById('exportSiteSelect');
  sel.innerHTML=sites.map(s=>`<option value="${s.id}">${s.nom}</option>`).join('');
  updateExportSiteInfo(); sel.onchange=updateExportSiteInfo;
  document.getElementById('exportSiteModal').classList.add('show');
}
function updateExportSiteInfo(){
  let id=document.getElementById('exportSiteSelect').value;
  let nom=document.getElementById('exportSiteSelect').options[document.getElementById('exportSiteSelect').selectedIndex]?.text||id;
  let list=getSiteProducts(id);
  document.getElementById('exportSiteInfo').innerHTML=`Tu vas exporter : <b style="color:#22c55e">${nom}</b> - ${list.length} articles`;
}
function closeExportSiteModal(){document.getElementById('exportSiteModal').classList.remove('show');}
function confirmExportSite(){
  let id=document.getElementById('exportSiteSelect').value;
  let nom=document.getElementById('exportSiteSelect').options[document.getElementById('exportSiteSelect').selectedIndex]?.text||id;
  closeExportSiteModal();
  let list=getSiteProducts(id);
  let data=[["NOM","STOCK DISPONIBLE","PAU","MARGE","PV","PVT","STOCK ALERTE","STOCK MAX","CONTENANCE","FOURNISSEUR","CATEGORIE","DATE DE PEREMPTION","A COMMANDER"],...list.map(p=>{let m=(+p.pv||0)-(+p.pa||0);return [p.nom,p.stock,p.pa,p.pat,m,p.pv,p.pvt,p.stock_alerte,p.stock_max,p.contenance,p.fournisseur,p.categorie,p.peremption,p.a_commander];})];
  let ws=XLSX.utils.aoa_to_sheet(data);let wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,nom.substring(0,30));XLSX.writeFile(wb,"export-site-"+nom+".xlsx");
}
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
      // NETTOIE LES DOUBLONS DÉJÀ PRÉSENTS DANS LE DÉPÔT (garde le 1er)
      let vu={}; let propre=[];
      allProd.forEach(function(p){
        let cle=cleanNom(p.nom)+'|'+cleanTxt(p.fournisseur)+'|'+cleanTxt(p.lot);
        if(vu[cle]) return;
        vu[cle]=true; propre.push(p);
      });
      allProd=propre;
      let totalLignes=rows.length; let count=0,ajoutes=0,misAJour=0,ignores=0,autoPV=0;
      rows.forEach(r=>{
        let nom=(r.NOM||r.Nom||'').toString().trim().toUpperCase(); if(!nom){ignores++;return;}
        let pa=+r.PAU||+r.PA||+r['PRIX ACHAT']||0;
        let marge=+r.MARGE||+r['MARGE BENEFICIAIRE']||+r['MARGE BENEF']||+r.BENEFICE||0;
        let pv=+r.PV||+r.PVU||+r['PRIX VENTE']||+r['PRIX DE VENTE']||0;
        if(!pv && pa>0 && marge>0){ pv=pa+marge; autoPV++; }
        if(!marge && pv>0 && pa>0){ marge=pv-pa; }
        let lot=(r.LOT||r.Lot||'').toString().trim(); let four=(r.FOURNISSEUR||'').toString().toUpperCase().trim();
        let idx=allProd.findIndex(x=>cleanNom(x.nom)===cleanNom(nom) && cleanTxt(x.lot)===cleanTxt(lot) && cleanTxt(x.fournisseur)===cleanTxt(four));
        let p=enrich({nom:nom,stock:+r['STOCK DISPONIBLE']||+r.STOCK||0,pa:pa,pau:pa,stock_alerte:+r['STOCK ALERTE']||+r.ALERTE||0,alerte:+r['STOCK ALERTE']||+r.ALERTE||0,stock_max:+r['STOCK MAX']||+r.MAX||0,contenance:+r.CONTENANCE||1,fournisseur:four,categorie:(r.CATEGORIE||'').toString(),peremption:(r['DATE DE PEREMPTION']||'').toString(),lot:lot,site:'Dépôt',site_nom:'Dépôt Central',pv:pv,prix:pv,marge:marge});
        p.stock_site=p.stock; p.quantite=p.stock; p.qte=p.stock;
        if(idx>=0){p.id=allProd[idx].id;allProd[idx]=p;misAJour++;} else {p.id=Date.now().toString()+count+Math.floor(Math.random()*100000);allProd.push(p);ajoutes++;}
        count++;
      });
      saveData(); load();
      let msg='✅ IMPORT DÉPÔT : '+count+'/'+totalLignes+' | Ajoutées : '+ajoutes+' | Mises à jour : '+misAJour+' | PV auto (PA+MARGE) : '+autoPV+' | TOTAL : '+allProd.length;
      showImportResult(msg,false); alert(msg);
    }catch(err){ showImportResult('❌ ERREUR : '+err.message,true); alert('❌ Erreur : '+err.message); }
  };
  reader.readAsArrayBuffer(f); e.target.value='';
}
function importExcelSite(e){
  let f=e.target.files[0];if(!f)return;
  let siteChoisi=importSiteChoisi;
  if(!siteChoisi){ showImportResult('❌ Choisis d’abord le site',true); e.target.value=''; return; }
  let sites=getSitesList(); let siteObj=sites.find(s=>String(s.id)===String(siteChoisi)); let siteNom=siteObj?siteObj.nom:siteChoisi;
  showImportResult('⏳ Lecture '+f.name+' pour '+siteNom+' ...',false);
  let reader=new FileReader();
  reader.onload=function(ev){
    try{
      let wb=XLSX.read(new Uint8Array(ev.target.result),{type:'array'});
      let rows=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
      let totalLignes=rows.length;
      let sp={}; try{sp=JSON.parse(localStorage.getItem('dub_sites_produits')||'{}');}catch(err){sp={};}
      if(!sp[siteChoisi]) sp[siteChoisi]=[];
      // NETTOIE LES DOUBLONS DÉJÀ PRÉSENTS DANS CE SITE (garde le 1er)
      let vuSite={}; let sitePropre=[];
      sp[siteChoisi].forEach(function(p){
        let cle=cleanNom(p.nom)+'|'+cleanTxt(p.fournisseur)+'|'+cleanTxt(p.lot);
        if(vuSite[cle]) return;
        vuSite[cle]=true; sitePropre.push(p);
      });
      sp[siteChoisi]=sitePropre;
      let count=0,ajoutes=0,misAJour=0,autoPV=0,sansPVniMarge=0;
      rows.forEach(r=>{
        let nom=(r.NOM||r.Nom||'').toString().trim().toUpperCase(); if(!nom) return;
        let pa=+r.PAU||+r.PA||+r['PRIX ACHAT']||0;
        let marge=+r.MARGE||+r['MARGE BENEFICIAIRE']||+r['MARGE BENEF']||+r.BENEFICE||0;
        let pv=+r.PV||+r.PVU||+r['PRIX VENTE']||+r['PRIX DE VENTE']||+r['PVU']||0;
        if(!pv && pa>0 && marge>0){ pv=pa+marge; autoPV++; }
        if(!marge && pv>0 && pa>0){ marge=pv-pa; }
        if(!pv && !marge){ sansPVniMarge++; }
        let lot=(r.LOT||r.Lot||'').toString().trim(); let four=(r.FOURNISSEUR||'').toString().toUpperCase().trim();
        let idx=sp[siteChoisi].findIndex(x=>cleanNom(x.nom)===cleanNom(nom) && cleanTxt(x.lot)===cleanTxt(lot) && cleanTxt(x.fournisseur)===cleanTxt(four));
        let p=enrich({nom:nom,stock:+r['STOCK DISPONIBLE']||+r.STOCK||0,pa:pa,pau:pa,stock_alerte:+r['STOCK ALERTE']||+r.ALERTE||0,alerte:+r['STOCK ALERTE']||+r.ALERTE||0,stock_max:+r['STOCK MAX']||+r.MAX||0,contenance:+r.CONTENANCE||1,fournisseur:four,categorie:(r.CATEGORIE||'').toString(),peremption:(r['DATE DE PEREMPTION']||'').toString(),lot:lot,site:siteChoisi,site_nom:siteNom,pv:pv,prix:pv,marge:marge});
        p.stock_site=p.stock; p.quantite=p.stock; p.qte=p.stock;
        if(idx>=0){p.id=sp[siteChoisi][idx].id;sp[siteChoisi][idx]=p;misAJour++;} else {p.id=Date.now().toString()+count+Math.floor(Math.random()*100000);sp[siteChoisi].push(p);ajoutes++;}
        count++;
      });
      localStorage.setItem('dub_sites_produits',JSON.stringify(sp));
      // SYNC AUTO : crée au dépôt avec stock 0 si pas encore là
      syncSiteVersDepot();
      saveData(); load();
      let msg='✅ IMPORT SITE '+siteNom+' : '+count+'/'+totalLignes+' | Ajoutées : '+ajoutes+' | Mises à jour : '+misAJour+' | PV auto : '+autoPV+' | Sans PV ni Marge : '+sansPVniMarge+' | TOTAL : '+sp[siteChoisi].length;
      showImportResult(msg,false); alert(msg);
    }catch(err){ showImportResult('❌ ERREUR : '+err.message,true); alert('❌ Erreur : '+err.message); }
  };
  reader.readAsArrayBuffer(f); e.target.value='';
}
function exportDepot(){let depot=getDepotProducts().filter(p=>!p.site||p.site==='Dépôt'||p.site==='Dépôt Central').map(enrich);let data=[["NOM","STOCK DISPONIBLE","PAU","MARGE","PAT","STOCK ALERTE","STOCK MAX","CONTENANCE","FOURNISSEUR","CATEGORIE","DATE DE PEREMPTION","A COMMANDER"],...depot.map(p=>[p.nom,p.stock,p.pa,p.marge,p.pat,p.stock_alerte,p.stock_max,p.contenance,p.fournisseur,p.categorie,p.peremption,p.a_commander])];let ws=XLSX.utils.aoa_to_sheet(data);let wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,"Depot");XLSX.writeFile(wb,"export-depot.xlsx");}
function exportSite(){openExportSiteModal();}
function exportGlobal(){let wb=XLSX.utils.book_new();let depot=getDepotProducts().filter(p=>!p.site||p.site==='Dépôt'||p.site==='Dépôt Central').map(enrich);let dataDepot=[["NOM","STOCK DISPONIBLE","PAU","MARGE","PAT","STOCK ALERTE","STOCK MAX","CONTENANCE","FOURNISSEUR","CATEGORIE","DATE DE PEREMPTION"],...depot.map(p=>[p.nom,p.stock,p.pa,p.marge,p.pat,p.stock_alerte,p.stock_max,p.contenance,p.fournisseur,p.categorie,p.peremption])];XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(dataDepot),"Depot");let sites=getSitesList();sites.forEach(s=>{let list=getSiteProducts(s.id);let data=[["NOM","STOCK DISPONIBLE","PAU","MARGE","PV","PVT","STOCK ALERTE","STOCK MAX","CONTENANCE","FOURNISSEUR","CATEGORIE","DATE DE PEREMPTION"],...list.map(p=>{return [p.nom,p.stock,p.pa,p.marge,p.pv,p.pvt,p.stock_alerte,p.stock_max,p.contenance,p.fournisseur,p.categorie,p.peremption];})];XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(data),s.nom.substring(0,30));});XLSX.writeFile(wb,"export-global.xlsx");}