// ===== PANIER.JS - COTE GERANT - SANS ALERT / SANS CONFIRM =====

var CART = [];
var STOCK_GROUPED = [];
var PAGE_SIZE = 20;
var CURRENT_PAGE = 1;
var FILTERED_LIST = [];
var searchTimer = null;

function toast(msg, type){
  var t = document.getElementById('toast');
  if(!t){ return; }
  t.innerText = msg;
  t.style.display = 'block';
  t.style.background = type==='err' ? '#ef4444' : '#22c55e';
  t.style.color = '#fff';
  t.style.padding = '12px 16px';
  t.style.borderRadius = '12px';
  t.style.position = 'fixed';
  t.style.top = '12px';
  t.style.right = '12px';
  t.style.left = '12px';
  t.style.textAlign = 'center';
  t.style.zIndex = '99999';
  t.style.fontWeight = '800';
  t.style.fontSize = '13px';
  setTimeout(function(){ t.style.display='none'; }, 2500);
}

function getGrouped(){
  var sp=getSP();
  var list=sp[SITE_ID]||[];
  if(!list.length){ for(var k in sp){ if(k.toLowerCase()===String(SITE_ID).toLowerCase()){ list=sp[k]; SITE_ID=k; break; } } }
  if(!list.length){ for(var k2 in sp){ if(sp[k2]&&sp[k2].length>0){ list=sp[k2]; SITE_ID=k2; break; } } }
  list = list.filter(function(p){ return !p.desactive && p.actif !== false && p.statut !== 'desactive' && p.statut !== 'inactif'; });
  var map={};
  list.forEach(function(p){
    var key=(p.nom||'').toLowerCase().trim();
    if(!key) return;
    if(!map[key]) map[key]={key:key, nom:p.nom, stock:0, pv:+p.pv||+p.prix||0, pa:+p.pa||0};
    map[key].stock += getStock(p);
  });
  var out=[]; for(var kk in map){ out.push(map[kk]); }
  return out;
}
function getStockMax(key){
  for(var i=0;i<STOCK_GROUPED.length;i++){ if(STOCK_GROUPED[i].key===key) return STOCK_GROUPED[i].stock; }
  return 0;
}
function applyFilter(){
  var list = getGrouped();
  STOCK_GROUPED = list;
  var sn=document.getElementById('siteName'); if(sn) sn.innerText = String(SITE_ID).toUpperCase();
  var cp=document.getElementById('countProd'); if(cp) cp.innerText = list.length;
  var q=document.getElementById('search').value.toLowerCase().trim();
  if(q.length>=2){
    var mots=q.split(' ').filter(function(s){ return s.length>0; });
    list=list.filter(function(p){ return mots.every(function(m){ return p.nom.toLowerCase().includes(m); }); });
  }
  list = list.filter(function(p){ return p.pv > 0; });
  FILTERED_LIST = list;
  var totalPages = Math.max(1, Math.ceil(FILTERED_LIST.length / PAGE_SIZE));
  if(CURRENT_PAGE > totalPages) CURRENT_PAGE = 1;
}
function render(){
  applyFilter();
  var totalPages = Math.max(1, Math.ceil(FILTERED_LIST.length / PAGE_SIZE));
  var start = (CURRENT_PAGE-1)*PAGE_SIZE;
  var pageItems = FILTERED_LIST.slice(start, start+PAGE_SIZE);
  var pi=document.getElementById('pageInfo'); if(pi) pi.innerText = FILTERED_LIST.length ? 'Page '+CURRENT_PAGE+' / '+totalPages : '';
  var html = '';
  for(var ii=0;ii<pageItems.length;ii++){
    var p = pageItems[ii];
    var idx = -1;
    for(var j=0;j<STOCK_GROUPED.length;j++){ if(STOCK_GROUPED[j].key===p.key){ idx=j; break; } }
    html += '<div class="prod-square" onclick="addProduit('+idx+')">'
      + '<div><b>'+p.nom+'</b><small style="margin-top:6px;color:'+(p.stock>0?'#22c55e':'#ef4444')+';font-weight:800">Stock: '+p.stock+'</small></div>'
      + '<div style="margin-top:10px"><div style="color:#22c55e;font-weight:900;font-size:13px">'+p.pv.toLocaleString()+' CDF</div><div style="margin-top:8px;background:#22c55e;color:#000;text-align:center;padding:7px;border-radius:10px;font-weight:900;font-size:11px">+ AJOUTER</div></div>'
      + '</div>';
  }
  document.getElementById('listProd').innerHTML = html || '<p style="text-align:center;color:#888">Aucun stock</p>';
  renderPagination(totalPages);
}
function renderPagination(totalPages){
  var box = document.getElementById('pagination');
  if(!box) return;
  if(totalPages<=1){ box.innerHTML=''; return; }
  var h = '';
  h += '<button class="pag-btn" '+(CURRENT_PAGE===1?'disabled':'')+' onclick="goPage('+(CURRENT_PAGE-1)+')">Prec.</button>';
  var debut = Math.max(1, CURRENT_PAGE-2);
  var fin = Math.min(totalPages, CURRENT_PAGE+2);
  if(debut>1) h += '<button class="pag-btn" onclick="goPage(1)">1</button><span style="color:#64748b">...</span>';
  for(var i=debut;i<=fin;i++){ h += '<button class="pag-btn '+(i===CURRENT_PAGE?'active':'')+'" onclick="goPage('+i+')">'+i+'</button>'; }
  if(fin<totalPages) h += '<span style="color:#64748b">...</span><button class="pag-btn" onclick="goPage('+totalPages+')">'+totalPages+'</button>';
  h += '<button class="pag-btn" '+(CURRENT_PAGE===totalPages?'disabled':'')+' onclick="goPage('+(CURRENT_PAGE+1)+')">Suiv.</button>';
  box.innerHTML = h;
}
function goPage(p){ CURRENT_PAGE = p; render(); }
function onSearchInput(){ clearTimeout(searchTimer); searchTimer = setTimeout(function(){ CURRENT_PAGE = 1; render(); }, 150); }
function addProduit(idx){
  var p = STOCK_GROUPED[idx];
  if(!p) return;
  if(p.stock<=0){ toast('Stock epuise : '+p.nom,'err'); return; }
  var exIndex = -1;
  for(var i=0;i<CART.length;i++){ if(CART[i].key===p.key){ exIndex=i; break; } }
  var deja = exIndex>=0 ? CART[exIndex].qty : 0;
  if(deja+1 > p.stock){ toast('Stock insuffisant : '+p.stock+' pour '+p.nom,'err'); return; }
  if(exIndex>=0){ CART[exIndex].qty++; var item=CART.splice(exIndex,1)[0]; CART.unshift(item); renderPanier(true); }
  else { CART.unshift({key:p.key, nom:p.nom, pv:p.pv, pa:p.pa, qty:1}); renderPanier(false); }
  sauverPanierActuel(); sauverBrouillons();
}
function chgQte(i, delta){
  if(!CART[i]) return;
  var max = getStockMax(CART[i].key);
  var nv = CART[i].qty + delta;
  if(nv<=0){ CART.splice(i,1); }
  else if(nv>max){ toast('Stock insuffisant, il reste '+max,'err'); return; }
  else { CART[i].qty = nv; }
  renderPanier(false); sauverPanierActuel(); sauverBrouillons();
}
function setQte(i, val){
  if(!CART[i]) return;
  var nv = parseInt(String(val||'').replace(/[^0-9]/g,''),10) || 0;
  if(nv<=0){ CART[i].qty = 0; calc(); return; }
  var max = getStockMax(CART[i].key);
  if(nv>max){ toast('Stock insuffisant, il reste '+max,'err'); renderPanier(false); return; }
  CART[i].qty = nv; calc();
  var tot2 = document.getElementById('tot-'+i); if(tot2) tot2.innerText = fmtFC(CART[i].pv * CART[i].qty);
  document.getElementById('badgePanier').innerText = CART.reduce(function(a,b){ return a+b.qty; },0);
  sauverPanierActuel(); sauverBrouillons();
}
function setQteBlur(i, val){
  if(!CART[i]) return;
  var nv = parseInt(String(val||'').replace(/[^0-9]/g,''),10) || 0;
  if(nv<=0){ CART.splice(i,1); }
  renderPanier(false); sauverPanierActuel(); sauverBrouillons();
}
function renderPanier(avecAnimation){
  avecAnimation = !!avecAnimation;
  var totalQ = 0; for(var t=0;t<CART.length;t++){ totalQ += CART[t].qty; }
  document.getElementById('badgePanier').innerText=totalQ;
  if(!CART.length){ document.getElementById('panier').innerHTML='<div style="padding:20px;text-align:center;color:#475569">Panier vide</div>'; calc(); return; }
  var html='';
  for(var i=0;i<CART.length;i++){
    var it = CART[i];
    var isFirstFlash = avecAnimation && i===0;
    html += '<div class="panier-item '+(isFirstFlash ? 'flash-item' : '')+'" id="item-'+i+'">'
      + '<div><div class="panier-nom">'+it.nom+'</div><div class="panier-pu">'+fmtFC(it.pv)+' / unite</div></div>'
      + '<div class="panier-controls">'
      + '<div class="qte-box '+(isFirstFlash ? 'flash-qte' : '')+'" id="box-'+i+'"><button class="qte-btn" onclick="chgQte('+i+',-1)">-</button><input type="text" inputmode="numeric" value="'+it.qty+'" oninput="setQte('+i+', this.value)" onblur="setQteBlur('+i+', this.value)"><button class="qte-btn" onclick="chgQte('+i+',1)">+</button></div>'
      + '<div class="panier-total '+(isFirstFlash ? 'flash-prix' : '')+'" id="tot-'+i+'">'+fmtFC(it.pv*it.qty)+'</div>'
      + '<button class="trash" onclick="del('+i+')">X</button></div>'
      + '</div>';
  }
  document.getElementById('panier').innerHTML=html;
  calc();
  if(avecAnimation){
    setTimeout(function(){
      var el=document.getElementById('item-0'); if(el) el.classList.remove('flash-item');
      var b=document.getElementById('box-0'); if(b) b.classList.remove('flash-qte');
      var tt=document.getElementById('tot-0'); if(tt) tt.classList.remove('flash-prix');
    },1400);
  }
}
function del(i){ CART.splice(i,1); renderPanier(false); sauverPanierActuel(); sauverBrouillons(); }
function vider(){ CART=[]; renderPanier(false); sauverPanierActuel(); sauverBrouillons(); }
function calc(){
  var fc=0; var nb=0;
  for(var i=0;i<CART.length;i++){ fc += CART[i].pv*CART[i].qty; nb += CART[i].qty; }
  var fcEl=document.getElementById('fcBig'); if(fcEl) fcEl.innerText=fmtFC(fc);
  var taux = 0; try{ taux = getTauxComptoir(); }catch(e){}
  var usd = taux>0 ? (fc / taux) : 0;
  var usdEl = document.getElementById('usdSmall');
  if(usdEl) usdEl.innerText = taux>0 ? '≈ ' + usd.toLocaleString('fr-FR',{minimumFractionDigits:2, maximumFractionDigits:2}) + ' $' : '≈ 0,00 $';
  var nbEl = document.getElementById('nbProdSmall');
  if(nbEl) nbEl.innerText = nb + ' produit(s)';
  var tauxEl = document.getElementById('tauxPanier');
  if(tauxEl) tauxEl.innerText = taux>0 ? 'Taux : 1 $ = ' + taux.toLocaleString('fr-FR') + ' FC' : 'Chargement...';
  var recuEl=document.getElementById('recu');
  var recu= recuEl ? parseFloat(recuEl.value||0) : 0;
  var renduEl=document.getElementById('rendu'); if(renduEl) renduEl.innerText=recu>fc?fmtFC(recu-fc):'0,00 FC';
}
function afficherBoutonAnnuler(){
  var d = null;
  try{ d = JSON.parse(localStorage.getItem('dub_derniere_vente')||'null'); }catch(e){ d=null; }
  var box = document.getElementById('boxAnnuler');
  if(!box) return;
  if(d && d.items && d.items.length){
    box.style.display = 'block';
    var txt=document.getElementById('txtDerniereVente'); if(txt) txt.innerText = (d.client||'Client') + ' - ' + fmtFC(d.total) + ' - ' + d.items.length + ' produit(s)';
  } else { box.style.display = 'none'; }
}
function annulerDerniereVente(){
  var d = null;
  try{ d = JSON.parse(localStorage.getItem('dub_derniere_vente')||'null'); }catch(e){ d=null; }
  if(!d || !d.items || !d.items.length){ toast('Aucune vente a annuler','err'); return; }
  var sp = getSP();
  var vraieCle = d.siteId || SITE_ID;
  for(var k in sp){ if(k.toLowerCase()===String(vraieCle).toLowerCase()){ vraieCle=k; break; } }
  var list = sp[vraieCle] || [];
  for(var i=0;i<d.items.length;i++){
    var it = d.items[i];
    var reste = it.qte;
    for(var j=list.length-1;j>=0 && reste>0;j--){
      if((list[j].nom||'').toLowerCase().trim()===String(it.key||it.nom||'').toLowerCase().trim()){
        setStock(list[j], getStock(list[j]) + reste);
        reste = 0;
      }
    }
    if(reste>0){ list.push({nom: it.nom, stock: reste, stock_site: reste, quantite: reste, qte: reste, pv: it.pv, pa: it.pa}); }
  }
  sp[vraieCle] = list;
  localStorage.setItem('dub_sites_produits', JSON.stringify(sp));
  var v = [];
  try{ v = JSON.parse(localStorage.getItem('dub_ventes')||'[]'); }catch(e){ v=[]; }
  var v2 = [];
  for(var a=0;a<v.length;a++){ if(String(v[a].transactionId) !== String(d.transactionId)){ v2.push(v[a]); } }
  localStorage.setItem('dub_ventes', JSON.stringify(v2));
  localStorage.removeItem('dub_derniere_vente');
  afficherBoutonAnnuler();
  render();
  toast('Vente annulee, stock remis');
}
var BROUILLONS = [];
try{ BROUILLONS = JSON.parse(localStorage.getItem('dub_brouillons')||'[]'); }catch(e){ BROUILLONS = []; }
var PANIER_ACTIF_ID = localStorage.getItem('dub_panier_actif') || null;
function sauverBrouillons(){
  localStorage.setItem('dub_brouillons', JSON.stringify(BROUILLONS));
  if(PANIER_ACTIF_ID){ localStorage.setItem('dub_panier_actif', PANIER_ACTIF_ID); }
  afficherOnglets();
}
function trouverBrouillon(id){ for(var i=0;i<BROUILLONS.length;i++){ if(BROUILLONS[i].id===id){ return BROUILLONS[i]; } } return null; }
function sauverPanierActuel(){
  if(!PANIER_ACTIF_ID) return;
  var b = trouverBrouillon(PANIER_ACTIF_ID);
  if(!b) return;
  var clientEl = document.getElementById('client');
  var phoneEl = document.getElementById('phone');
  var recuEl = document.getElementById('recu');
  if(clientEl) b.client = clientEl.value || '';
  if(phoneEl) b.phone = phoneEl.value || '';
  if(recuEl) b.recu = recuEl.value || '';
  b.articles = JSON.parse(JSON.stringify(CART));
  var tot = 0;
  for(var i=0;i<CART.length;i++){ tot += CART[i].pv * CART[i].qty; }
  b.total = tot;
}
function nouvelleVente(){
  sauverPanierActuel();
  var id = 'V' + Date.now();
  var nb = BROUILLONS.length + 1;
  BROUILLONS.push({id:id, client:'', phone:'', recu:'', articles:[], total:0, date:new Date().toISOString(), label:'Client ' + nb});
  PANIER_ACTIF_ID = id;
  CART = [];
  var c = document.getElementById('client'); if(c) c.value='';
  var p = document.getElementById('phone'); if(p) p.value='';
  var r = document.getElementById('recu'); if(r) r.value='';
  sauverBrouillons();
  renderPanier(false);
  var s = document.getElementById('search'); if(s) s.focus();
}
function ouvrirVente(id){
  sauverPanierActuel();
  PANIER_ACTIF_ID = id;
  var b = trouverBrouillon(id);
  if(!b) return;
  CART = JSON.parse(JSON.stringify(b.articles || b.items || []));
  var c = document.getElementById('client'); if(c) c.value = b.client || '';
  var p = document.getElementById('phone'); if(p) p.value = b.phone || '';
  var r = document.getElementById('recu'); if(r) r.value = b.recu || '';
  sauverBrouillons();
  renderPanier(false);
}
function fermerOnglet(id, event){
  if(event) event.stopPropagation();
  var idx = -1;
  for(var i=0;i<BROUILLONS.length;i++){ if(BROUILLONS[i].id===id){ idx=i; break; } }
  if(idx>=0) BROUILLONS.splice(idx,1);
  if(PANIER_ACTIF_ID===id){
    if(BROUILLONS.length>0){ PANIER_ACTIF_ID = BROUILLONS[0].id; var nb2 = trouverBrouillon(PANIER_ACTIF_ID); CART = JSON.parse(JSON.stringify(nb2.articles||[])); var c2=document.getElementById('client'); if(c2) c2.value=nb2.client||''; var p2=document.getElementById('phone'); if(p2) p2.value=nb2.phone||''; var r2=document.getElementById('recu'); if(r2) r2.value=nb2.recu||''; }
    else { PANIER_ACTIF_ID = null; CART=[]; var c3=document.getElementById('client'); if(c3) c3.value=''; var p3=document.getElementById('phone'); if(p3) p3.value=''; var r3=document.getElementById('recu'); if(r3) r3.value=''; }
  }
  sauverBrouillons();
  renderPanier(false);
  if(!BROUILLONS.length) nouvelleVente();
  else toast('Onglet fermé');
}
function fermerTousOnglets(){
  if(!BROUILLONS.length) return;
  BROUILLONS = [];
  PANIER_ACTIF_ID = null;
  CART = [];
  localStorage.removeItem('dub_brouillons');
  localStorage.removeItem('dub_panier_actif');
  var c=document.getElementById('client'); if(c) c.value='';
  var p=document.getElementById('phone'); if(p) p.value='';
  var r=document.getElementById('recu'); if(r) r.value='';
  nouvelleVente();
  toast('Tous les onglets fermés');
}
function afficherOnglets(){
  var div = document.getElementById('ongletsVente');
  if(!div) return;
  var html = '';
  for(var i=0;i<BROUILLONS.length;i++){
    var b = BROUILLONS[i];
    var actif = (b.id===PANIER_ACTIF_ID);
    var nom = b.client ? b.client : ('Client ' + (i+1));
    var nbArt = 0;
    for(var a=0;a<(b.articles||b.items||[]).length;a++){ nbArt += (b.articles||b.items||[])[a].qty||(b.articles||b.items||[])[a].qte||0; }
    var cls = actif ? 'onglet actif' : 'onglet inactif';
    html += '<div class="' + cls + '" onclick="ouvrirVente(\'' + b.id + '\')"><span class="close" onclick="fermerOnglet(\'' + b.id + '\', event)">x</span><b>' + nom + '</b><small>' + nbArt + ' art - ' + fmtFC(b.total||0) + '</small></div>';
  }
  div.innerHTML = html;
}
function apresEncaissement(){
  var idx = -1;
  for(var i=0;i<BROUILLONS.length;i++){ if(BROUILLONS[i].id===PANIER_ACTIF_ID){ idx=i; break; } }
  if(idx>=0) BROUILLONS.splice(idx,1);
  if(BROUILLONS.length>0){
    PANIER_ACTIF_ID = BROUILLONS[0].id;
    var nb = trouverBrouillon(PANIER_ACTIF_ID);
    CART = JSON.parse(JSON.stringify(nb.articles||[]));
    var c=document.getElementById('client'); if(c) c.value=nb.client||'';
    var p=document.getElementById('phone'); if(p) p.value=nb.phone||'';
    var r=document.getElementById('recu'); if(r) r.value=nb.recu||'';
  } else { PANIER_ACTIF_ID = null; CART=[]; }
  sauverBrouillons();
  if(!BROUILLONS.length) nouvelleVente();
  else renderPanier(false);
}
function encaisser(){
  if(!CART.length){ toast('Panier vide','err'); return; }
  CART = CART.filter(function(x){ return x.qty>0; });
  if(!CART.length){ toast('Panier vide','err'); return; }
  var fc=0; for(var i=0;i<CART.length;i++){ fc += CART[i].pv*CART[i].qty; }
  var recu=parseFloat(document.getElementById('recu').value||0);
  if(recu>0 && recu<fc){ toast('Recu insuffisant. Total : '+fmtFC(fc),'err'); return; }
  var client=document.getElementById('client').value.trim()||'Client';
  var phone=document.getElementById('phone').value.trim()||'';
  var sp=getSP();
  var vraieCle=SITE_ID;
  for(var k in sp){ if(k.toLowerCase()===String(SITE_ID).toLowerCase()){ vraieCle=k; break; } }
  var list=sp[vraieCle]||[];
  var v=[]; try{ v=JSON.parse(localStorage.getItem('dub_ventes')||'[]') }catch(e){}
  var transactionId = 'TX' + Date.now();
  var venteNum = 'V-' + Date.now().toString().slice(-6);
  var itemsPourAnnulation = [];
  var vendeurNom = document.getElementById('vendeurName') ? document.getElementById('vendeurName').innerText : 'GERANT';
  var tauxComptoirVente = 0; try{ tauxComptoirVente = getTauxComptoir(); }catch(e){}
  for(var ii=0;ii<CART.length;ii++){
    var item = CART[ii];
    var items=[];
    for(var a=0;a<list.length;a++){ if((list[a].nom||'').toLowerCase().trim()===item.key){ items.push(list[a]); } }
    if(!items.length){ toast('Produit introuvable : '+item.nom,'err'); return; }
    var totalStock = 0; for(var ts=0;ts<items.length;ts++){ totalStock += getStock(items[ts]); }
    if(item.qty>totalStock){ toast('Stock insuffisant : '+totalStock+' pour '+item.nom,'err'); return; }
    var pv = +items[0].pv || +items[0].prix || 0;
    var pa = +items[0].pa || 0;
    items.sort(function(a,b){ return new Date(a.peremption||'9999') - new Date(b.peremption||'9999'); });
    var reste=item.qty;
    for(var pp=0;pp<items.length;pp++){ if(reste<=0) break; var s = getStock(items[pp]); var take=Math.min(s, reste); setStock(items[pp], s - take); reste-=take; }
    v.unshift({id:Date.now()+Math.random(), transactionId: transactionId, venteNum: venteNum, siteId:vraieCle, produit:item.nom, nom:item.nom, qte:item.qty, qty:item.qty, pa:pa, pv:pv, valeur:item.qty*pa, valeurPV:item.qty*pv, total:item.qty*pv, date:new Date().toISOString(), client:client, phone:phone, via:'VENTE GERANT', vendeurNom: vendeurNom, vendeur: vendeurNom, tauxComptoir: tauxComptoirVente, taux: tauxComptoirVente});
    itemsPourAnnulation.push({key:item.key, nom:item.nom, qte:item.qty, qty:item.qty, pv:pv, pa:pa});
  }
  sp[vraieCle]=list;
  localStorage.setItem('dub_sites_produits',JSON.stringify(sp));
  localStorage.setItem('dub_ventes',JSON.stringify(v));
  localStorage.setItem('dub_derniere_vente', JSON.stringify({transactionId: transactionId, venteNum: venteNum, siteId: vraieCle, client: client, phone: phone, total: fc, date: new Date().toISOString(), items: itemsPourAnnulation, tauxComptoir: tauxComptoirVente, taux: tauxComptoirVente, recu: recu, rendu: recu>fc ? recu-fc : 0}));
  var numPF = localStorage.getItem('dub_proforma_a_convertir');
  if(numPF){
    var lpf = []; try{ lpf = JSON.parse(localStorage.getItem('dub_proformas')||'[]'); }catch(e){}
    for(var pf=0;pf<lpf.length;pf++){ if(lpf[pf].num===numPF){ lpf[pf].statut='VENTE'; lpf[pf].venteNum=venteNum; lpf[pf].dateVente=new Date().toISOString(); } }
    localStorage.setItem('dub_proformas', JSON.stringify(lpf));
    localStorage.removeItem('dub_proforma_a_convertir');
    if(typeof renderProformas==='function') renderProformas();
  }
  afficherBoutonAnnuler();
  toast('Vente OK - '+client+' - '+fmtFC(fc));
  CART=[];
  document.getElementById('recu').value='';
  document.getElementById('client').value='';
  document.getElementById('phone').value='';
  apresEncaissement();
  renderPanier(false); render();
  if(typeof genererFacture==='function') genererFacture();
}
function init(){
  var u={}; try{ u=JSON.parse(localStorage.getItem('user')||'{}') }catch(e){}
  var vn=document.getElementById('vendeurName'); if(vn) vn.innerText=u.nom||u.name||u.username||'GÉRANT';
  var sn=document.getElementById('siteName'); if(sn) sn.innerText=String(u.siteName||u.site||SITE_ID||'VICTOIRE').toUpperCase();
  var se=document.getElementById('search'); if(se) se.addEventListener('input', onSearchInput);
  var re=document.getElementById('recu'); if(re) re.addEventListener('input', function(){ calc(); sauverPanierActuel(); sauverBrouillons(); });
  var ce=document.getElementById('client'); if(ce) ce.addEventListener('input', function(){ sauverPanierActuel(); sauverBrouillons(); });
  var pe=document.getElementById('phone'); if(pe) pe.addEventListener('input', function(){ sauverPanierActuel(); sauverBrouillons(); });
  if(BROUILLONS.length===0){ nouvelleVente(); }
  else {
    if(PANIER_ACTIF_ID && trouverBrouillon(PANIER_ACTIF_ID)){ ouvrirVente(PANIER_ACTIF_ID); }
    else { PANIER_ACTIF_ID = BROUILLONS[0].id; ouvrirVente(PANIER_ACTIF_ID); }
  }
  afficherBoutonAnnuler();
  if(typeof afficherTauxVente==='function') afficherTauxVente();
  if(typeof renderProformas==='function') renderProformas();
  render();
  calc();
  setInterval(function(){ var h=document.getElementById('heure'); if(h) h.innerText=new Date().toLocaleTimeString(); },1000);
}
init();