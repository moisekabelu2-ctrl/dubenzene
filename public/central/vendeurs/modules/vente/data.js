function fmtFC(n){ return Number(n||0).toLocaleString('fr-FR',{minimumFractionDigits:0}) + ' FC'; }
function fmtFC2(n){ return Number(n||0).toLocaleString('fr-FR',{minimumFractionDigits:2}) + ' FC'; }
function getSP(){try{return JSON.parse(localStorage.getItem('dub_sites_produits')||'{}')}catch(e){return{}}}
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
var CART = [];
var STOCK_GROUPED = [];
var PAGE_SIZE = 20;
var CURRENT_PAGE = 1;
var FILTERED_LIST = [];
var searchTimer = null;
var DERNIERE_FACTURE = null;
var DERNIERE_PROFORMA = null;
var FILTRE_PROFORMA = 'TOUT';
var toastTimer = null;
function getTaux(){
  try{
    var m = JSON.parse(localStorage.getItem('dub_taux_map')||'{}');
    var t = m[SITE_ID] || m[String(SITE_ID).toLowerCase()] || localStorage.getItem('dub_taux') || localStorage.getItem('BENZENE_TAUX') || 2800;
    return parseFloat(t) || 2800;
  }catch(e){ return 2800; }
}
function esc(s){ return String(s||'').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function getStock(p){ return +p.stock || +p.stock_site || +p.quantite || +p.qte || 0; }
function setStock(p, v){ p.stock=v; p.stock_site=v; p.quantite=v; p.qte=v; }
function toast(msg, type){
  var t = document.getElementById('toast');
  t.innerText = msg;
  t.className = 'show ' + (type||'ok');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function(){ t.className=''; }, 2200);
}