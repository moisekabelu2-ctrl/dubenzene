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
  var p = null;
  for(var i=0;i<STOCK_GROUPED.length;i++){ if(STOCK_GROUPED[i].key===key){ p=STOCK_GROUPED[i]; break; } }
  return p ? p.stock : 0;
}

// ✅ NOUVEAU : TAUX COMPTOIR - fixé en Paramètres, pour le site actuel
function getTauxComptoir(){
  var site = String(SITE_ID||'victoire').toLowerCase();
  var t = Number(localStorage.getItem('dub_taux_comptoir_'+site)||'0');
  return t > 0 ? t : 0;
}

function applyFilter(){
  var list = getGrouped();
  STOCK_GROUPED = list;
  document.getElementById('siteName').innerText = String(SITE_ID).toUpperCase();
  document.getElementById('countProd').innerText = list.length;
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
  document.getElementById('pageInfo').innerText = FILTERED_LIST.length ? 'Page '+CURRENT_PAGE+' / '+totalPages : '';
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
  if(p.stock<=0){ toast('Stock epuise : '+p.nom, 'err'); return; }
  var exIndex = -1;
  for(var i=0;i<CART.length;i++){ if(CART[i].key===p.key){ exIndex=i; break; } }
  var deja = exIndex>=0 ? CART[exIndex].qty : 0;
  if(deja+1 > p.stock){ toast('Stock insuffisant : '+p.stock+' pour '+p.nom, 'err'); return; }
  if(exIndex>=0){ CART[exIndex].qty++; var item=CART.splice(exIndex,1)[0]; CART.unshift(item); renderPanier(true); }
  else { CART.unshift({key:p.key, nom:p.nom, pv:p.pv, pa:p.pa, qty:1}); renderPanier(false); }
  sauverPanierActuel(); sauverBrouillons();
}
function chgQte(i, delta){
  if(!CART[i]) return;
  var max = getStockMax(CART[i].key);
  var nv = CART[i].qty + delta;
  if(nv<=0){ CART.splice(i,1); }
  else if(nv>max){ toast('Stock insuffisant, il reste '+max, 'err'); return; }
  else { CART[i].qty = nv; }
  renderPanier(false); sauverPanierActuel(); sauverBrouillons();
}
function setQte(i, val){
  if(!CART[i]) return;
  var nv = parseInt(String(val||'').replace(/[^0-9]/g,''),10) || 0;
  if(nv<=0){ CART[i].qty = 0; calc(); var tot = document.getElementById('tot-'+i); if(tot) tot.innerText = fmtFC2(0); document.getElementById('badgePanier').innerText = CART.reduce(function(a,b){ return a+b.qty; },0); return; }
  var max = getStockMax(CART[i].key);
  if(nv>max){ toast('Stock insuffisant, il reste '+max, 'err'); renderPanier(false); return; }
  CART[i].qty = nv; calc();
  var tot2 = document.getElementById('tot-'+i); if(tot2) tot2.innerText = fmtFC2(CART[i].pv * CART[i].qty);
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
            + '<div><div class="panier-nom">'+it.nom+'</div><div class="panier-pu">'+fmtFC2(it.pv)+' / unite</div></div>'
            + '<div class="panier-controls">'
            + '<div class="qte-box '+(isFirstFlash ? 'flash-qte' : '')+'" id="box-'+i+'"><button class="qte-btn" onclick="chgQte('+i+',-1)">-</button><input type="text" inputmode="numeric" value="'+it.qty+'" oninput="setQte('+i+', this.value)" onblur="setQteBlur('+i+', this.value)"><button class="qte-btn" onclick="chgQte('+i+',1)">+</button></div>'
            + '<div class="panier-total '+(isFirstFlash ? 'flash-prix' : '')+'" id="tot-'+i+'">'+fmtFC2(it.pv*it.qty)+'</div>'
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

// ✅ MODIFIÉ : calc() affiche maintenant le total en $ avec le taux comptoir
function calc(){
  var fc=0; var nb=0;
  for(var i=0;i<CART.length;i++){ fc += CART[i].pv*CART[i].qty; nb += CART[i].qty; }
  document.getElementById('fcBig').innerText=fmtFC2(fc);
  var taux = getTauxComptoir();
  var usd = taux>0 ? (fc / taux) : 0;
  var usdEl = document.getElementById('usdSmall');
  if(usdEl) usdEl.innerText = taux>0 ? '≈ ' + usd.toLocaleString('fr-FR',{minimumFractionDigits:2, maximumFractionDigits:2}) + ' $' : '≈ 0,00 $ - Taux non fixé';
  var nbEl = document.getElementById('nbProdSmall');
  if(nbEl) nbEl.innerText = nb + ' produit(s)';
  var tauxEl = document.getElementById('tauxPanier');
  if(tauxEl) tauxEl.innerText = taux>0 ? 'Taux : 1 $ = ' + taux.toLocaleString('fr-FR') + ' FC' : 'Taux : Non fixé';
  var recu=parseFloat(document.getElementById('recu').value||0);
  document.getElementById('rendu').innerText=recu>fc?fmtFC2(recu-fc):'0,00 FC';
}
function afficherBoutonAnnuler(){
  var d = null;
  try{ d = JSON.parse(localStorage.getItem('dub_derniere_vente')||'null'); }catch(e){ d=null; }
  var box = document.getElementById('boxAnnuler');
  if(!box) return;
  if(d && d.items && d.items.length){
    box.style.display = 'block';
    document.getElementById('txtDerniereVente').innerText = (d.client||'Client') + ' - ' + fmtFC(d.total) + ' - ' + d.items.length + ' produit(s)';
  } else { box.style.display = 'none'; }
}
function annulerDerniereVente(){
  var d = null;
  try{ d = JSON.parse(localStorage.getItem('dub_derniere_vente')||'null'); }catch(e){ d=null; }
  if(!d || !d.items || !d.items.length){ toast('Aucune vente a annuler', 'err'); return; }
  var sp = getSP();
  var vraieCle = d.siteId || SITE_ID;
  for(var k in sp){ if(k.toLowerCase()===String(vraieCle).toLowerCase()){ vraieCle=k; break; } }
  var list = sp[vraieCle] || [];
  for(var i=0;i<d.items.length;i++){
    var it = d.items[i];
    var reste = it.qte;
    for(var j=list.length-1;j>=0 && reste>0;j--){
      if((list[j].nom||'').toLowerCase().trim()===String(it.key||'').toLowerCase().trim()){
        var cur = getStock(list[j]);
        setStock(list[j], cur + reste);
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
  CART = JSON.parse(JSON.stringify(b.articles || []));
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
  toast('Vente fermee');
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
  toast('Toutes les ventes fermees');
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
    for(var a=0;a<(b.articles||[]).length;a++){ nbArt += b.articles[a].qty; }
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
  if(!CART.length){ toast('Panier vide', 'err'); return; }
  CART = CART.filter(function(x){ return x.qty>0; });
  if(!CART.length){ toast('Panier vide', 'err'); return; }
  var fc=0; for(var i=0;i<CART.length;i++){ fc += CART[i].pv*CART[i].qty; }
  var recu=parseFloat(document.getElementById('recu').value||0);
  if(recu>0 && recu<fc){ toast('Recu insuffisant. Total : '+fmtFC2(fc), 'err'); return; }
  var client=document.getElementById('client').value.trim()||'Client';
  var phone=document.getElementById('phone').value.trim()||'';
  var sp=getSP();
  var vraieCle=SITE_ID;
  for(var k in sp){ if(k.toLowerCase()===String(SITE_ID).toLowerCase()){ vraieCle=k; break; } }
  var list=sp[vraieCle]||[];
  var v=[]; try{ v=JSON.parse(localStorage.getItem('dub_ventes')||'[]') }catch(e){}
  var transactionId = 'TX' + Date.now();
  var numFacture = 'F-' + new Date().toISOString().slice(0,10).replace(/-/g,'') + '-' + String(Date.now()).slice(-4);
  var itemsPourAnnulation = [];
  var itemsFacture = [];
  // ✅ On fige le taux comptoir du jour de la vente
  var tauxComptoirVente = getTauxComptoir();
  for(var ii=0;ii<CART.length;ii++){
    var item = CART[ii];
    var items=[];
    for(var a=0;a<list.length;a++){ if((list[a].nom||'').toLowerCase().trim()===item.key){ items.push(list[a]); } }
    if(!items.length){ toast('Produit introuvable : '+item.nom, 'err'); return; }
    var desactive=false;
    for(var d=0;d<items.length;d++){ if(items[d].desactive || items[d].actif===false || items[d].statut==='desactive'){ desactive=true; } }
    if(desactive){ toast('Produit desactive : '+item.nom, 'err'); return; }
    var totalStock = 0; for(var ts=0;ts<items.length;ts++){ totalStock += getStock(items[ts]); }
    if(item.qty>totalStock){ toast('Stock insuffisant : '+totalStock+' pour '+item.nom, 'err'); return; }
    var pv = +items[0].pv || +items[0].prix || 0;
    var pa = +items[0].pa || 0;
    items.sort(function(a,b){ return new Date(a.peremption||'9999') - new Date(b.peremption||'9999'); });
    var reste=item.qty;
    for(var pp=0;pp<items.length;pp++){ if(reste<=0) break; var s = getStock(items[pp]); var take=Math.min(s, reste); setStock(items[pp], s - take); reste-=take; }
    // ✅ On sauvegarde le taux comptoir dans chaque ligne de vente
    v.unshift({id:Date.now()+Math.random(), transactionId: transactionId, siteId:vraieCle, produit:items[0].nom, qte:item.qty, pa:pa, pv:pv, valeur:item.qty*pa, valeurPV:item.qty*pv, date:new Date().toISOString(), client:client, phone:phone, via:'VENTE PANIER', tauxComptoir: tauxComptoirVente});
    itemsPourAnnulation.push({key:item.key, nom:items[0].nom, qte:item.qty, pv:pv, pa:pa});
    itemsFacture.push({nom:items[0].nom, qte:item.qty, pv:pv});
  }
  sp[vraieCle]=list;
  localStorage.setItem('dub_sites_produits',JSON.stringify(sp));
  localStorage.setItem('dub_ventes',JSON.stringify(v));
  localStorage.setItem('dub_derniere_vente', JSON.stringify({transactionId: transactionId, siteId: vraieCle, client: client, total: fc, date: new Date().toISOString(), items: itemsPourAnnulation, tauxComptoir: tauxComptoirVente}));
  afficherBoutonAnnuler();
  var totalQteFact = 0; for(var tq=0;tq<itemsFacture.length;tq++){ totalQteFact+=itemsFacture[tq].qte; }
  afficherFactureVente({num:numFacture, client:client, phone:phone||'-', site:String(vraieCle).toUpperCase(), vendeur:document.getElementById('vendeurName').innerText||'VENDEUR', dateStr:new Date().toLocaleString('fr-FR'), total:Math.round(fc), totalQte:totalQteFact, recu:recu||Math.round(fc), rendu:recu>fc?Math.round(recu-fc):0, taux:getTaux(), tauxComptoir: tauxComptoirVente, items:itemsFacture});
  CART=[];
  document.getElementById('recu').value='';
  document.getElementById('client').value='';
  document.getElementById('phone').value='';
  apresEncaissement();
  renderPanier(false); render();
}
window.addEventListener('scroll', function(){
  if((window.innerHeight + window.scrollY) < document.body.scrollHeight - 100) return;
  var totalPages = Math.max(1, Math.ceil(FILTERED_LIST.length / PAGE_SIZE));
  if(CURRENT_PAGE >= totalPages) return;
  CURRENT_PAGE++; render();
});