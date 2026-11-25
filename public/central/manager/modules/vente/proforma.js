var FILTRE_PROFORMA = 'TOUT';
var DERNIERE_PROFORMA = null;
function toast(msg, type){
  var t = document.getElementById('toast');
  if(t){
    t.innerText = msg; t.style.display = 'block';
    t.style.background = type==='err' ? '#ef4444' : '#22c55e';
    t.style.color = '#fff'; t.style.padding = '10px'; t.style.borderRadius = '10px';
    t.style.position = 'fixed'; t.style.top = '10px'; t.style.right = '10px'; t.style.zIndex = '99999';
    setTimeout(function(){ t.style.display='none'; }, 2500);
  } else { alert(msg); }
}
function getProformas(){ try{ return JSON.parse(localStorage.getItem('dub_proformas')||'[]'); }catch(e){ return []; } }
function sauverProformas(list){ localStorage.setItem('dub_proformas', JSON.stringify(list)); }
function setFiltreProforma(f){
  FILTRE_PROFORMA = f;
  ['TOUT','PROFORMA','VENTE','ANNULEE'].forEach(function(x){
    var el = document.getElementById('filtre'+x);
    if(el) el.className = 'filtre' + (x===f ? ' actif' : '');
  });
  renderProformas();
}
function renderProformas(){
  var el = document.getElementById('listProformas');
  if(!el) return;
  var all = getProformas();
  var siteActuel = ''; try{ siteActuel = String(SITE_ID||'').toLowerCase(); }catch(e){}
  if(siteActuel){ all = all.filter(function(p){ var s=String(p.site||p.siteId||'').toLowerCase(); return !s || s===siteActuel; }); }
  var att = all.filter(function(p){ return (p.statut||'PROFORMA')==='PROFORMA'; });
  var ven = all.filter(function(p){ return p.statut==='VENTE'; });
  var ann = all.filter(function(p){ return p.statut==='ANNULEE'; });
  var stat = document.getElementById('statProformas');
  if(stat) stat.innerText = att.length+' en attente • '+ven.length+' vendues • '+ann.length+' annulees';
  var q = ''; var inp = document.getElementById('searchProforma'); if(inp) q = (inp.value||'').toLowerCase();
  var list = all.filter(function(p){
    if(FILTRE_PROFORMA!=='TOUT' && (p.statut||'PROFORMA')!==FILTRE_PROFORMA) return false;
    if(q){ var txt = ((p.client||'')+' '+(p.num||'')+' '+(p.phone||'')+' '+(p.vendeur||'')+' '+((p.items||p.articles||[]).map(function(it){return it.nom}).join(' '))).toLowerCase(); if(txt.indexOf(q)===-1) return false; }
    return true;
  });
  if(!list.length){ el.innerHTML = '<div style="color:#94a3b8;font-size:12px;text-align:center;padding:12px">Aucune proforma</div>'; return; }
  el.innerHTML = list.slice(0,100).map(function(p){
    var st = p.statut||'PROFORMA';
    var label = st==='VENTE' ? '<span style="color:#22c55e;font-weight:800;font-size:11px">✅ VENDUE</span>' : st==='ANNULEE' ? '<span style="color:#ef4444;font-weight:800;font-size:11px">❌ ANNULEE</span>' : '<span style="color:#facc15;font-weight:800;font-size:11px">⏳ EN ATTENTE</span>';
    var arts = ((p.items||p.articles||[]).map(function(it){ return it.nom+' x'+(it.qty||it.qte||0); }).join(', '));
    var btns = '';
    btns += '<button onclick="voirProforma(\''+p.num+'\')" style="padding:7px 10px;border-radius:8px;background:#fff;color:#000;border:none;font-weight:800;cursor:pointer;font-size:11px">👁 VOIR</button> ';
    btns += '<button onclick="reimprimerProforma(\''+p.num+'\')" style="padding:7px 10px;border-radius:8px;background:#2563eb;color:#fff;border:none;font-weight:800;cursor:pointer;font-size:11px">🖨️ RÉIMPRIMER</button> ';
    if(st==='PROFORMA'){
      btns += '<button onclick="convertirProformaParNum(\''+p.num+'\')" style="padding:7px 10px;border-radius:8px;background:#22c55e;color:#000;border:none;font-weight:800;cursor:pointer;font-size:11px">✅ VENDRE</button> ';
      btns += '<button onclick="annulerProforma(\''+p.num+'\')" style="padding:7px 10px;border-radius:8px;background:#ef4444;color:#fff;border:none;font-weight:800;cursor:pointer;font-size:11px">ANNULER</button>';
    }
    if(st==='VENTE'){ btns += '<span style="color:#22c55e;font-size:11px">→ '+(p.venteNum||'')+'</span>'; }
    var tauxTxt = Number(p.tauxComptoir || p.taux || 0);
    var tauxLigne = tauxTxt>0 ? '<div style="font-size:11px;color:#f59e0b;font-weight:700;margin:4px 0">Taux comptoir : 1 $ = '+tauxTxt.toLocaleString('fr-FR')+' FC • Soit '+(p.total/tauxTxt).toFixed(2)+' $</div>' : '';
    return '<div style="background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:10px;margin-bottom:8px">'
            + '<div style="display:flex;justify-content:space-between;gap:8px"><span><b style="font-size:13px">'+p.num+'</b> - <b>'+(p.client||'')+'</b><br><span style="color:#94a3b8;font-size:11px">'+new Date(p.date).toLocaleString('fr-FR')+' • '+(p.vendeur||'')+' • '+(p.phone||'-')+'</span><br>'+label+'</span>'
            + '<b style="color:#facc15;font-size:14px;white-space:nowrap">'+fmtFC(p.total)+'</b></div>'
            + '<div style="font-size:11px;color:#94a3b8;margin:6px 0">'+arts+'</div>'
            + tauxLigne
            + '<div style="display:flex;gap:6px;flex-wrap:wrap">'+btns+'</div>'
            + '</div>';
  }).join('');
}
function proforma(){
  var brouillon = null;
  try{ brouillon = trouverBrouillon(PANIER_ACTIF_ID); }catch(e){}
  var items = brouillon ? (brouillon.articles || brouillon.items || []) : [];
  if(!items.length && typeof CART !== 'undefined' && CART.length) items = CART;
  if(!items.length){ toast('Panier vide','err'); return; }
  var client = (document.getElementById('client').value||'').trim() || 'Client';
  var phone = (document.getElementById('phone').value||'').trim();
  var total = 0; var totalQte = 0;
  items.forEach(function(it){ total += Number(it.pv||0) * Number(it.qty||it.qte||0); totalQte += Number(it.qty||it.qte||0); });
  var list = getProformas();
  var num = 'PF-' + String(list.length+1).padStart(4,'0') + '-' + new Date().getFullYear();
  if(list.some(function(x){ return x.num===num; })) num = 'PF-' + Date.now().toString().slice(-6);
  var vendeur = '';
  try{ var u=JSON.parse(localStorage.getItem('user')||'{}'); vendeur = u.nom||u.name||u.username||''; }catch(e){}
  var tauxComptoirProforma = 0;
  try{ tauxComptoirProforma = Number(getTauxComptoir() || 0); }catch(e){ tauxComptoirProforma = 0; }
  var p = {
    num: num, date: new Date().toISOString(), client: client, phone: phone,
    site: SITE_ID||'', siteId: SITE_ID||'', vendeur: vendeur, statut: 'PROFORMA',
    total: Math.round(total), totalQte: totalQte,
    taux: tauxComptoirProforma, tauxComptoir: tauxComptoirProforma,
    items: items.map(function(it){ return { nom: it.nom, key: it.key||String(it.nom||'').toLowerCase().trim(), pv: it.pv, pa: it.pa||0, qty: it.qty||it.qte||0, qte: it.qty||it.qte||0 }; })
  };
  list.unshift(p);
  sauverProformas(list);
  DERNIERE_PROFORMA = p;
  afficherProformaThermal(p);
  renderProformas();
  toast('Proforma '+num+' creee - stock NON deduit');
}
function genererProforma(){ proforma(); }
function afficherProformaThermal(p){
  var modal = document.getElementById('factureModal');
  var content = document.getElementById('factureContent');
  if(!modal || !content){ alert('Proforma '+p.num+' créée - Total : '+fmtFC(p.total)); return; }
  var taux = Number(p.tauxComptoir || p.taux || 0);
  var html = '<div style="background:#fff;color:#000;padding:16px;font-family:Arial;font-size:13px">';
  html += '<div style="text-align:center"><b style="font-size:18px">DUBENZENE</b><br><span>PROFORMA</span><br><span>N° '+p.num+'</span></div>';
  html += '<hr><div>Client : <b>'+p.client+'</b><br>Tél : '+(p.phone||'-')+'<br>Date : '+new Date(p.date).toLocaleString('fr-FR')+'<br>Site : '+String(p.site||p.siteId||'').toUpperCase()+'</div>';
  html += '<hr><div>Taux comptoir : 1 $ = '+taux.toLocaleString('fr-FR')+' FC</div><hr>';
  html += '<table style="width:100%;border-collapse:collapse;font-size:12px"><tr><th align="left">Produit</th><th>Qte</th><th>PU</th><th>Total</th></tr>';
  var arr = p.items||p.articles||[];
  for(var i=0;i<arr.length;i++){ var it = arr[i]; var q = it.qty||it.qte||0; html += '<tr><td>'+it.nom+'</td><td align="center">'+q+'</td><td align="right">'+Number(it.pv).toLocaleString()+'</td><td align="right">'+Number(it.pv*q).toLocaleString()+'</td></tr>'; }
  html += '</table><hr>';
  html += '<div style="text-align:right"><b>Total FC : '+Number(p.total).toLocaleString()+' FC</b><br><b>Total $ : '+(taux>0 ? (p.total/taux).toFixed(2) : '-')+' $</b></div>';
  html += '<div style="text-align:center;margin-top:10px;color:#888">Proforma - pas encore encaissé</div></div>';
  content.innerHTML = html;
  var btnConv = document.getElementById('btnConvertir');
  if(btnConv) btnConv.style.display = (p.statut==='PROFORMA' ? 'inline-block' : 'none');
  modal.style.display = 'block';
}
function voirProforma(num){
  var list = getProformas();
  for(var i=0;i<list.length;i++){ if(list[i].num===num){ DERNIERE_PROFORMA = list[i]; afficherProformaThermal(list[i]); return; } }
  toast('Proforma introuvable','err');
}
function reimprimerProforma(num){
  var list = getProformas();
  var p = null; for(var i=0;i<list.length;i++){ if(list[i].num===num){ p=list[i]; break; } }
  if(!p){ toast('Proforma introuvable','err'); return; }
  if(p.statut==='VENTE'){
    afficherFactureVente({
      num: p.venteNum || p.num, proformaNum: p.num,
      dateStr: new Date(p.dateVente||p.date).toLocaleString('fr-FR'),
      site: String(p.site||p.siteId||SITE_ID||'').toUpperCase(),
      vendeur: p.vendeur||'', client: p.client||'', phone: p.phone||'',
      items: ((p.items||p.articles||[]).map(function(it){ return { nom: it.nom, qte: it.qty||it.qte||0, pv: it.pv }; })),
      totalQte: p.totalQte||0, total: p.total||0, recu: p.total||0, rendu: 0,
      taux: p.tauxComptoir || p.taux || 0, tauxComptoir: p.tauxComptoir || p.taux || 0
    });
    return;
  }
  DERNIERE_PROFORMA = p;
  afficherProformaThermal(p);
  toast('Reimpression '+p.num);
}
function convertirProforma(){
  var p = DERNIERE_PROFORMA;
  if(!p){ toast('Aucune proforma','err'); return; }
  if(p.statut==='VENTE'){ toast('Deja vendue : '+(p.venteNum||''),'err'); return; }
  if(p.statut==='ANNULEE'){ toast('Proforma annulee','err'); return; }
  convertirProformaParNum(p.num);
}
function convertirProformaParNum(num){
  var list = getProformas();
  var p = null; var idx = -1;
  for(var i=0;i<list.length;i++){ if(list[i].num===num){ p=list[i]; idx=i; break; } }
  if(!p){ toast('Proforma introuvable','err'); return; }
  if(p.statut==='VENTE'){ toast('Deja vendue','err'); return; }
  if(p.statut==='ANNULEE'){ toast('Proforma annulee','err'); return; }
  var sp = getSP();
  var vraieCle = SITE_ID;
  for(var k in sp){ if(k.toLowerCase()===String(SITE_ID).toLowerCase()){ vraieCle=k; break; } }
  var produits = sp[vraieCle]||[];
  var arr = p.items||p.articles||[];
  for(var j=0;j<arr.length;j++){
    var it = arr[j];
    var totalStock = 0;
    for(var kk=0;kk<produits.length;kk++){ if(String(produits[kk].nom||'').toLowerCase().trim()===String(it.nom||'').toLowerCase().trim()){ totalStock += getStock(produits[kk]); } }
    if(totalStock < Number(it.qty||it.qte||0)){ toast('Stock insuffisant : '+it.nom+' (reste '+totalStock+')','err'); return; }
  }
  var lignesVente = [];
  var venteNum = 'V-' + Date.now().toString().slice(-6);
  var transactionId = 'TX' + Date.now();
  var tauxVenteFinal = Number(p.tauxComptoir || p.taux || 0);
  var vendeurNom = p.vendeur||'GERANT';
  try{ var uu=JSON.parse(localStorage.getItem('user')||'{}'); vendeurNom = uu.nom||uu.name||uu.username||vendeurNom; }catch(e){}
  for(var j2=0;j2<arr.length;j2++){
    var it2 = arr[j2];
    var qteVoulue = Number(it2.qty||it2.qte||0);
    var itemsProd = [];
    for(var a=0;a<produits.length;a++){ if(String(produits[a].nom||'').toLowerCase().trim()===String(it2.nom||'').toLowerCase().trim()){ itemsProd.push(produits[a]); } }
    if(!itemsProd.length){ toast('Produit introuvable : '+it2.nom,'err'); return; }
    itemsProd.sort(function(a,b){ return new Date(a.peremption||'9999') - new Date(b.peremption||'9999'); });
    var reste = qteVoulue;
    for(var pp=0;pp<itemsProd.length && reste>0;pp++){ var s = getStock(itemsProd[pp]); var take = Math.min(s, reste); setStock(itemsProd[pp], s - take); reste -= take; }
    var pv = Number(it2.pv||itemsProd[0].pv||0);
    var pa = Number(it2.pa||itemsProd[0].pa||0);
    lignesVente.push({id: Date.now()+Math.random(), transactionId: transactionId, venteNum: venteNum, siteId: vraieCle, produit: it2.nom, nom: it2.nom, qte: qteVoulue, qty: qteVoulue, pa: pa, pv: pv, valeur: qteVoulue*pa, valeurPV: qteVoulue*pv, total: qteVoulue*pv, date: new Date().toISOString(), client: p.client, phone: p.phone||'', via: 'VENTE GERANT - PROFORMA '+p.num, vendeurNom: vendeurNom, vendeur: vendeurNom, tauxComptoir: tauxVenteFinal, taux: tauxVenteFinal});
  }
  sp[vraieCle] = produits;
  localStorage.setItem('dub_sites_produits', JSON.stringify(sp));
  var ventes = [];
  try{ ventes = JSON.parse(localStorage.getItem('dub_ventes')||'[]'); }catch(e){}
  ventes = lignesVente.concat(ventes);
  localStorage.setItem('dub_ventes', JSON.stringify(ventes));
  localStorage.setItem('dub_derniere_vente', JSON.stringify({transactionId: transactionId, venteNum: venteNum, siteId: vraieCle, client: p.client, phone: p.phone||'', total: p.total, date: new Date().toISOString(), items: arr.map(function(it){ return {key: it.key||String(it.nom||'').toLowerCase().trim(), nom: it.nom, qte: it.qty||it.qte||0, qty: it.qty||it.qte||0, pv: it.pv, pa: it.pa||0}; }), tauxComptoir: tauxVenteFinal, taux: tauxVenteFinal, recu: p.total, rendu: 0}));
  p.statut = 'VENTE';
  p.venteNum = venteNum;
  p.dateVente = new Date().toISOString();
  list[idx] = p;
  sauverProformas(list);
  DERNIERE_PROFORMA = p;
  afficherFactureVente({
    num: venteNum, proformaNum: p.num, dateStr: new Date().toLocaleString('fr-FR'),
    site: String(p.site||p.siteId||SITE_ID||'').toUpperCase(),
    vendeur: p.vendeur||vendeurNom||'', client: p.client||'', phone: p.phone||'',
    items: (arr.map(function(it){ return { nom: it.nom, qte: it.qty||it.qte||0, pv: it.pv }; })),
    totalQte: p.totalQte||0, total: p.total||0, recu: p.total||0, rendu: 0,
    taux: tauxVenteFinal, tauxComptoir: tauxVenteFinal
  });
  renderProformas();
  try{ render(); }catch(e){}
  try{ if(typeof afficherBoutonAnnuler==='function') afficherBoutonAnnuler(); }catch(e){}
  toast('Proforma '+p.num+' convertie en VENTE '+venteNum);
}
function annulerProforma(num){
  if(!confirm('Annuler proforma '+num+' ?')) return;
  var list = getProformas();
  var p = null; for(var i=0;i<list.length;i++){ if(list[i].num===num){ p=list[i]; break; } }
  if(!p) return;
  if(p.statut==='VENTE'){ toast('Deja vendue','err'); return; }
  p.statut='ANNULEE';
  sauverProformas(list);
  renderProformas();
  toast('Proforma annulee');
}
function supprimerProforma(num){
  if(!confirm('Supprimer definitivement '+num+' ?')) return;
  var list = getProformas().filter(function(x){ return x.num!==num; });
  sauverProformas(list);
  renderProformas();
}
function exporterProformas(){
  var list = getProformas();
  if(!list.length){ toast('Aucune proforma','err'); return; }
  var csv='Numero;Date;Client;Tel;Site;Vendeur;Statut;Total;TauxComptoir;TotalUSD;VenteNum;Articles\n';
  list.forEach(function(p){
    var t = Number(p.tauxComptoir || p.taux || 0);
    var usd = t>0 ? (p.total/t).toFixed(2) : '0';
    csv+=p.num+';'+p.date+';'+p.client+';'+(p.phone||'')+';'+(p.site||p.siteId||'')+';'+(p.vendeur||'')+';'+(p.statut||'PROFORMA')+';'+p.total+';'+t+';'+usd+';'+(p.venteNum||'')+';'+((p.items||p.articles||[]).map(function(it){ return it.nom+' x'+(it.qty||it.qte); }).join(' | '))+'\n';
  });
  var a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob(['\ufeff'+csv],{type:'text/csv'}));
  a.download='proformas.csv';
  a.click();
}