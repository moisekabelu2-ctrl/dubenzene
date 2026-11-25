// ===== RETOUR.JS - GERANT + CODE ADMIN + RECHERCHE INTELLIGENTE =====

var RETOUR_EN_COURS = null;
var RETOUR_A_VALIDER = null;
var RETOUR_TOUTES_VENTES = []; // Toutes les ventes groupées, pour la recherche
var RETOUR_RECHERCHE = '';

function getCodeRetourAdmin(){
  return localStorage.getItem('dub_code_retour_admin') || '1234';
}

// --- Recherche intelligente : sans accent, avec faute, désordre ---
function normRetour(s){
  return String(s||'').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/[^a-z0-9 ]/g,' ')
    .replace(/\s+/g,' ').trim();
}
function distanceRetour(a,b){
  if(a===b) return 0;
  if(!a.length) return b.length;
  if(!b.length) return a.length;
  var m=[];
  for(var i=0;i<=b.length;i++) m[i]=[i];
  for(var j=0;j<=a.length;j++) m[0][j]=j;
  for(var i2=1;i2<=b.length;i2++){
    for(var j2=1;j2<=a.length;j2++){
      if(b[i2-1]===a[j2-1]) m[i2][j2]=m[i2-1][j2-1];
      else m[i2][j2]=Math.min(m[i2-1][j2-1]+1, m[i2][j2-1]+1, m[i2-1][j2]+1);
    }
  }
  return m[b.length][a.length];
}
function matchRetour(texte, recherche){
  var t = normRetour(texte);
  var r = normRetour(recherche);
  if(!r) return true;
  if(t.indexOf(r) >= 0) return true;
  var motsT = t.split(' ');
  var motsR = r.split(' ').filter(function(s){ return s.length>0; });
  return motsR.every(function(mr){
    return motsT.some(function(mt){
      if(mt.indexOf(mr)===0) return true;
      if(mt.indexOf(mr)>=0) return true;
      if(mr.length>=4 && distanceRetour(mt,mr)<=1) return true;
      if(mr.length>=6 && distanceRetour(mt,mr)<=2) return true;
      return false;
    });
  });
}

function ouvrirRetour(){
  var modal = document.getElementById('retourModal');
  var listEl = document.getElementById('listRetourVentes');
  if(!modal || !listEl) return;

  var ventes = [];
  try{ ventes = JSON.parse(localStorage.getItem('dub_ventes')||'[]'); }catch(e){}
  var siteActuel = String(SITE_ID||'').toLowerCase();
  ventes = ventes.filter(function(v){ return !v.siteId || String(v.siteId).toLowerCase()===siteActuel; });

  var map = {};
  ventes.forEach(function(v){
    if(!map[v.transactionId]) map[v.transactionId] = { transactionId: v.transactionId, venteNum: v.venteNum, client: v.client, phone: v.phone, date: v.date, total: 0, items: [] };
    map[v.transactionId].total += Number(v.total||0);
    map[v.transactionId].items.push(v);
  });
  var groupes = [];
  for(var k in map) groupes.push(map[k]);
  groupes.sort(function(a,b){ return new Date(b.date) - new Date(a.date); });
  RETOUR_TOUTES_VENTES = groupes;

  // On remet la recherche à zéro à chaque ouverture
  RETOUR_RECHERCHE = '';
  var inp = document.getElementById('searchRetour');
  if(inp) inp.value = '';

  afficherListeRetour();
  modal.style.display = 'block';
}

function onSearchRetour(val){
  RETOUR_RECHERCHE = val||'';
  afficherListeRetour();
}

function afficherListeRetour(){
  var listEl = document.getElementById('listRetourVentes');
  if(!listEl) return;

  var groupes = RETOUR_TOUTES_VENTES.slice(0, 50);

  if(RETOUR_RECHERCHE && RETOUR_RECHERCHE.trim().length >= 2){
    var q = RETOUR_RECHERCHE.trim();
    groupes = groupes.filter(function(g){
      var texteGlobal = (g.venteNum||'') + ' ' + (g.transactionId||'') + ' ' + (g.client||'') + ' ' + (g.phone||'');
      if(matchRetour(texteGlobal, q)) return true;
      // Recherche dans les produits de la vente
      for(var i=0;i<g.items.length;i++){
        if(matchRetour(g.items[i].nom||'', q)) return true;
      }
      return false;
    });
  } else {
    groupes = groupes.slice(0, 20);
  }

  if(!groupes.length){
    listEl.innerHTML = '<div style="color:#94a3b8;text-align:center;padding:12px">Aucune vente trouvée pour : <b style="color:white">'+RETOUR_RECHERCHE+'</b></div>';
    return;
  }

  listEl.innerHTML = groupes.map(function(g){
    var arts = g.items.map(function(it){ return it.nom+' x'+(it.qty||it.qte||0); }).join(', ');
    return '<div style="background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:10px;margin-bottom:8px">'
      + '<div style="display:flex;justify-content:space-between"><b style="color:white">'+(g.venteNum||g.transactionId)+'</b><b style="color:#facc15">'+fmtFC(g.total)+'</b></div>'
      + '<div style="font-size:11px;color:#94a3b8">'+(g.client||'')+' - '+(g.phone||'')+' - '+new Date(g.date).toLocaleString('fr-FR')+'</div>'
      + '<div style="font-size:11px;color:#cbd5e1;margin:6px 0">'+arts+'</div>'
      + '<button onclick="choisirVenteRetour(\''+g.transactionId+'\')" style="width:100%;padding:10px;border-radius:10px;background:#f59e0b;border:none;font-weight:800;cursor:pointer">↩ FAIRE UN RETOUR SUR CETTE VENTE</button>'
      + '</div>';
  }).join('');
}

function fermerRetour(){
  var m = document.getElementById('retourModal');
  if(m) m.style.display = 'none';
  var d = document.getElementById('detailRetour');
  if(d) d.innerHTML = '';
  RETOUR_EN_COURS = null;
  fermerCodeRetour();
}

function choisirVenteRetour(transactionId){
  var ventes = [];
  try{ ventes = JSON.parse(localStorage.getItem('dub_ventes')||'[]'); }catch(e){}
  var lignes = ventes.filter(function(v){ return String(v.transactionId)===String(transactionId); });
  if(!lignes.length){ toast('Vente introuvable','err'); return; }

  RETOUR_EN_COURS = { transactionId: transactionId, venteNum: lignes[0].venteNum, client: lignes[0].client, phone: lignes[0].phone, date: lignes[0].date, lignes: lignes, quantites: lignes.map(function(){ return 0; }) };

  var d = document.getElementById('detailRetour');
  var html = '<div style="border-top:1px solid rgba(255,255,255,0.1);margin-top:12px;padding-top:12px">';
  html += '<b style="color:white">Retour sur : '+(lignes[0].venteNum||transactionId)+' - '+(lignes[0].client||'')+'</b><br><span style="font-size:11px;color:#94a3b8">Coche ce que le client ramène, puis clique VALIDER</span>';
  html += '<div style="background:rgba(245,158,11,0.15);border:1px solid rgba(245,158,11,0.4);border-radius:10px;padding:8px;margin-top:8px;font-size:11px;color:#f59e0b;font-weight:700">⚠️ A partir de 5.000 FC, il faut le CODE RETOUR de l\'ADMIN. Appelle l\'Admin.</div>';
  html += '<input id="searchRetourProduit" class="input" placeholder="🔍 Filtrer produit dans cette vente..." oninput="filtrerProduitRetour(this.value)" style="margin-top:10px">';
  html += '<div id="listProduitRetour" style="margin-top:10px">';
  lignes.forEach(function(l, idx){
    var q = Number(l.qty||l.qte||0);
    html += '<div class="ligne-produit-retour" data-nom="'+normRetour(l.nom)+'" style="display:flex;justify-content:space-between;align-items:center;background:rgba(255,255,255,0.05);padding:10px;border-radius:10px;margin-bottom:6px">'
      + '<div><b style="font-size:13px;color:white">'+l.nom+'</b><br><span style="font-size:11px;color:#94a3b8">Vendu : '+q+' x '+Number(l.pv).toLocaleString()+' = '+fmtFC(q*Number(l.pv))+'</span></div>'
      + '<div style="display:flex;align-items:center;gap:6px"><button onclick="chgRetourQte('+idx+',-1)" style="width:30px;height:30px;border-radius:8px;background:#fff;border:none;font-weight:900;cursor:pointer">-</button><span id="retourQte-'+idx+'" style="color:white;font-weight:800;min-width:20px;text-align:center">0</span><button onclick="chgRetourQte('+idx+',1)" style="width:30px;height:30px;border-radius:8px;background:#f59e0b;border:none;font-weight:900;cursor:pointer">+</button></div>'
      + '</div>';
  });
  html += '</div>';
  html += '<input id="motifRetour" class="input" placeholder="Motif : cassé, périmé, mauvais produit..." style="margin-top:8px">';
  html += '<button onclick="validerRetour()" style="width:100%;margin-top:10px;padding:13px;border-radius:12px;background:#22c55e;border:none;font-weight:800;cursor:pointer">✅ DEMANDER VALIDATION RETOUR</button>';
  html += '</div>';
  d.innerHTML = html;
}

function filtrerProduitRetour(val){
  var lignes = document.querySelectorAll('.ligne-produit-retour');
  var q = normRetour(val||'');
  for(var i=0;i<lignes.length;i++){
    var nom = lignes[i].getAttribute('data-nom')||'';
    if(!q || nom.indexOf(q)>=0 || matchRetour(nom, val)) lignes[i].style.display='flex';
    else lignes[i].style.display='none';
  }
}

function chgRetourQte(idx, delta){
  if(!RETOUR_EN_COURS) return;
  var max = Number(RETOUR_EN_COURS.lignes[idx].qty || RETOUR_EN_COURS.lignes[idx].qte || 0);
  var nv = (RETOUR_EN_COURS.quantites[idx]||0) + delta;
  if(nv<0) nv=0;
  if(nv>max){ toast('Max retour : '+max,'err'); return; }
  RETOUR_EN_COURS.quantites[idx] = nv;
  var el = document.getElementById('retourQte-'+idx);
  if(el) el.innerText = nv;
}

function validerRetour(){
  if(!RETOUR_EN_COURS) return;
  var totalRemboursement = 0;
  var articlesRetour = [];
  for(var i=0;i<RETOUR_EN_COURS.lignes.length;i++){
    var q = RETOUR_EN_COURS.quantites[i]||0;
    if(q>0){
      var l = RETOUR_EN_COURS.lignes[i];
      totalRemboursement += q * Number(l.pv||0);
      articlesRetour.push({ nom: l.nom, qte: q, qty: q, pv: l.pv, pa: l.pa });
    }
  }
  if(!articlesRetour.length){ toast('Choisis au moins 1 produit à retourner','err'); return; }
  if(totalRemboursement >= 5000){
    RETOUR_A_VALIDER = { articles: articlesRetour, total: totalRemboursement };
    ouvrirCodeRetour(totalRemboursement);
    return;
  }
  executerRetour(articlesRetour, totalRemboursement, 'Petit retour < 5000 FC - sans code');
}

function ouvrirCodeRetour(total){
  var m = document.getElementById('codeRetourModal');
  if(!m) return;
  var t = document.getElementById('txtCodeRetourTotal');
  if(t) t.innerText = 'Montant à rembourser : ' + fmtFC(total) + ' - Appelle l\'ADMIN pour avoir le CODE RETOUR';
  var inp = document.getElementById('inputCodeRetour');
  if(inp){ inp.value=''; setTimeout(function(){ inp.focus(); }, 200); }
  m.style.display = 'block';
}
function fermerCodeRetour(){
  var m = document.getElementById('codeRetourModal');
  if(m) m.style.display = 'none';
  RETOUR_A_VALIDER = null;
}
function confirmerCodeRetour(){
  var inp = document.getElementById('inputCodeRetour');
  var codeSaisi = inp ? inp.value.trim() : '';
  if(!codeSaisi){ toast('Tape le code donné par l\'Admin','err'); return; }
  if(codeSaisi !== getCodeRetourAdmin()){
    toast('Code RETOUR incorrect - Appelle l\'Admin','err');
    if(inp) inp.value='';
    return;
  }
  if(!RETOUR_A_VALIDER) return;
  var articles = RETOUR_A_VALIDER.articles;
  var total = RETOUR_A_VALIDER.total;
  fermerCodeRetour();
  executerRetour(articles, total, 'Validé par ADMIN avec code');
}

function executerRetour(articlesRetour, totalRemboursement, validationInfo){
  var motif = document.getElementById('motifRetour') ? document.getElementById('motifRetour').value.trim() : '';
  var vendeurNom = document.getElementById('vendeurName') ? document.getElementById('vendeurName').innerText : 'GERANT';
  var sp = getSP();
  var vraieCle = SITE_ID;
  for(var k in sp){ if(k.toLowerCase()===String(SITE_ID).toLowerCase()){ vraieCle=k; break; } }
  var list = sp[vraieCle]||[];
  articlesRetour.forEach(function(it){
    var reste = it.qte;
    for(var j=list.length-1;j>=0 && reste>0;j--){
      if(String(list[j].nom||'').toLowerCase().trim()===String(it.nom||'').toLowerCase().trim()){
        setStock(list[j], getStock(list[j]) + reste);
        reste = 0;
      }
    }
    if(reste>0) list.push({ nom: it.nom, stock: reste, stock_site: reste, quantite: reste, qte: reste, pv: it.pv, pa: it.pa });
  });
  sp[vraieCle] = list;
  localStorage.setItem('dub_sites_produits', JSON.stringify(sp));
  var ventes = [];
  try{ ventes = JSON.parse(localStorage.getItem('dub_ventes')||'[]'); }catch(e){}
  ventes.forEach(function(v){
    if(String(v.transactionId)===String(RETOUR_EN_COURS.transactionId)){
      articlesRetour.forEach(function(ar){
        if(v.nom===ar.nom){
          var nvQ = Number(v.qty||v.qte||0) - ar.qte;
          if(nvQ<0) nvQ=0;
          v.qty = nvQ; v.qte = nvQ; v.total = nvQ * Number(v.pv||0); v.valeurPV = v.total;
        }
      });
    }
  });
  ventes = ventes.filter(function(v){ return Number(v.qty||v.qte||0) > 0; });
  localStorage.setItem('dub_ventes', JSON.stringify(ventes));
  var retours = [];
  try{ retours = JSON.parse(localStorage.getItem('dub_retours')||'[]'); }catch(e){}
  retours.unshift({
    id: 'RET'+Date.now(),
    transactionId: RETOUR_EN_COURS.transactionId,
    venteNum: RETOUR_EN_COURS.venteNum,
    client: RETOUR_EN_COURS.client,
    phone: RETOUR_EN_COURS.phone,
    siteId: vraieCle,
    motif: motif||'Retour client',
    articles: articlesRetour,
    totalRembourse: totalRemboursement,
    date: new Date().toISOString(),
    gerant: vendeurNom,
    validation: validationInfo
  });
  localStorage.setItem('dub_retours', JSON.stringify(retours));
  try{
    var der = JSON.parse(localStorage.getItem('dub_derniere_vente')||'null');
    if(der && String(der.transactionId)===String(RETOUR_EN_COURS.transactionId)){
      var totalRestant = 0;
      ventes.forEach(function(v){ if(String(v.transactionId)===String(der.transactionId)) totalRestant += Number(v.total||0); });
      if(totalRestant<=0) localStorage.removeItem('dub_derniere_vente');
      else { der.total = totalRestant; localStorage.setItem('dub_derniere_vente', JSON.stringify(der)); }
      if(typeof afficherBoutonAnnuler==='function') afficherBoutonAnnuler();
    }
  }catch(e){}
  toast('Retour validé - Remboursement : '+fmtFC(totalRemboursement));
  fermerRetour();
  render();
}