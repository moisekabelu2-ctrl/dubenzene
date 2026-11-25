function fmtFC(n){ return Number(n||0).toLocaleString('fr-FR',{minimumFractionDigits:2}) + ' FC'; }
function getSP(){ try{ return JSON.parse(localStorage.getItem('dub_sites_produits')||'{}'); }catch(e){ return {}; } }
function getCurrentSiteId(){
  try{
    var u = JSON.parse(localStorage.getItem('user')||'{}');
    if(u.siteId) return u.siteId;
    var uid = localStorage.getItem('dub_current_user_id');
    var users = JSON.parse(localStorage.getItem('dub_users')||'[]');
    var me = null;
    for(var i=0;i<users.length;i++){ if(String(users[i].id)===String(uid)){ me=users[i]; break; } }
    if(me && me.siteId) return me.siteId;
    if(me && me.siteName){
      var sites = JSON.parse(localStorage.getItem('dub_sites')||'[]');
      for(var s=0;s<sites.length;s++){ if(sites[s].nom===me.siteName){ return sites[s].id; } }
    }
  }catch(e){}
  return 'victoire';
}
var SITE_ID = getCurrentSiteId();
function getTauxComptoir(){
  var site = String(SITE_ID||'victoire').toLowerCase().trim();
  var t = Number(localStorage.getItem('dub_taux_comptoir_'+site)||'0');
  if(t > 0) return t;
  for(var i=0;i<localStorage.length;i++){
    var k = localStorage.key(i);
    if(k && k.indexOf('dub_taux_comptoir_')===0){
      var v = Number(localStorage.getItem(k)||'0');
      if(v > 0) return v;
    }
  }
  try{
    var obj = JSON.parse(localStorage.getItem('dub_taux_sites')||localStorage.getItem('dub_taux')||'null');
    if(obj && typeof obj==='object'){ for(var kk in obj){ if(Number(obj[kk])>0) return Number(obj[kk]); } }
    if(typeof obj==='number' && obj>0) return obj;
  }catch(e){}
  var tg = Number(localStorage.getItem('dub_taux_comptoir')||'0');
  return tg > 0 ? tg : 0;
}
function afficherTauxVente(){
  var t = getTauxComptoir();
  var h = document.getElementById('tauxHVente');
  var p = document.getElementById('tauxPanier');
  var pill = document.getElementById('pillTauxVente');
  var h2 = document.getElementById('tauxComptoirHeader');
  var badge = document.getElementById('badgeTauxComptoir');
  if(t <= 0){
    if(h) h.innerText = 'Chargement...';
    if(p) p.innerText = 'Chargement...';
    if(h2) h2.innerText = 'Chargement...';
    return 0;
  }
  var txt = '1 $ = '+t.toLocaleString('fr-FR')+' FC';
  if(h) h.innerText = txt;
  if(p) p.innerText = 'Taux : '+txt;
  if(h2) h2.innerText = txt;
  if(pill){ pill.style.background = '#f59e0b'; pill.style.color = '#000'; }
  if(badge){ badge.style.background = '#f59e0b'; badge.style.color = '#000'; }
  return t;
}
function getStock(p){ return +p.stock || +p.stock_site || +p.quantite || +p.qte || 0; }
function setStock(p, v){ p.stock=v; p.stock_site=v; p.quantite=v; p.qte=v; }