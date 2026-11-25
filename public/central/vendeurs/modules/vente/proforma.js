// ===== PROFORMA.JS - COTE VENTE - CREATION, CONVERSION, REIMPRESSION =====

var FILTRE_PROFORMA = 'TOUT';
var DERNIERE_PROFORMA = null;

function getProformas(){
  try{ return JSON.parse(localStorage.getItem('dub_proformas')||'[]'); }catch(e){ return []; }
}
function sauverProformas(list){
  localStorage.setItem('dub_proformas', JSON.stringify(list));
}

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

  // Filtre par site : le vendeur ne voit que son site
  var siteActuel = '';
  try{ siteActuel = String(SITE_ID||'').toLowerCase(); }catch(e){}
  if(siteActuel){
    all = all.filter(function(p){ var s=String(p.site||'').toLowerCase(); return !s || s===siteActuel; });
  }

  var att = all.filter(function(p){ return (p.statut||'PROFORMA')==='PROFORMA'; });
  var ven = all.filter(function(p){ return p.statut==='VENTE'; });
  var ann = all.filter(function(p){ return p.statut==='ANNULEE'; });

  var stat = document.getElementById('statProformas');
  if(stat) stat.innerText = att.length+' en attente • '+ven.length+' vendues • '+ann.length+' annulees';

  var q = '';
  var inp = document.getElementById('searchProforma');
  if(inp) q = (inp.value||'').toLowerCase();

  var list = all.filter(function(p){
    if(FILTRE_PROFORMA!=='TOUT' && (p.statut||'PROFORMA')!==FILTRE_PROFORMA) return false;
    if(q){
      var txt = ((p.client||'')+' '+(p.num||'')+' '+(p.phone||'')+' '+(p.vendeur||'')+' '+(p.items||[]).map(function(it){return it.nom}).join(' ')).toLowerCase();
      if(txt.indexOf(q)===-1) return false;
    }
    return true;
  });

  if(!list.length){
    el.innerHTML = '<div style="color:#94a3b8;font-size:12px;text-align:center;padding:12px">Aucune proforma</div>';
    return;
  }

  el.innerHTML = list.slice(0,100).map(function(p){
    var st = p.statut||'PROFORMA';
    var label = st==='VENTE' ? '<span style="color:#22c55e;font-weight:800;font-size:11px">✅ VENDUE</span>' : st==='ANNULEE' ? '<span style="color:#ef4444;font-weight:800;font-size:11px">❌ ANNULEE</span>' : '<span style="color:#facc15;font-weight:800;font-size:11px">⏳ EN ATTENTE</span>';
    var arts = (p.items||[]).map(function(it){ return it.nom+' x'+(it.qty||it.qte||0); }).join(', ');
    var btns = '';

    // ✅ TOUJOURS : VOIR + REIMPRIMER
    btns += '<button onclick="voirProforma(\''+p.num+'\')" style="padding:7px 10px;border-radius:8px;background:#fff;color:#000;border:none;font-weight:800;cursor:pointer;font-size:11px">👁 VOIR</button> ';
    btns += '<button onclick="reimprimerProforma(\''+p.num+'\')" style="padding:7px 10px;border-radius:8px;background:#2563eb;color:#fff;border:none;font-weight:800;cursor:pointer;font-size:11px">🖨️ RÉIMPRIMER</button> ';

    if(st==='PROFORMA'){
      btns += '<button onclick="convertirProformaParNum(\''+p.num+'\')" style="padding:7px 10px;border-radius:8px;background:#22c55e;color:#000;border:none;font-weight:800;cursor:pointer;font-size:11px">✅ VENDRE</button> ';
      btns += '<button onclick="annulerProforma(\''+p.num+'\')" style="padding:7px 10px;border-radius:8px;background:#ef4444;color:#fff;border:none;font-weight:800;cursor:pointer;font-size:11px">ANNULER</button>';
    }
    if(st==='VENTE'){
      btns += '<span style="color:#22c55e;font-size:11px">→ '+(p.venteNum||'')+'</span>';
    }

    // ✅ On affiche le taux figé de la proforma
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

// ===== CREER UNE PROFORMA DEPUIS LE PANIER ACTUEL =====
function proforma(){
  var brouillon = null;
  try{ brouillon = trouverBrouillon(PANIER_ACTIF_ID); }catch(e){}
  // ✅ Le brouillon utilise "articles", pas "items" - on prend les 2 pour être sûr
  var items = brouillon ? (brouillon.articles || brouillon.items || []) : [];
  if(!items.length && typeof CART !== 'undefined' && CART.length) items = CART;
  if(!items.length){ toast('Panier vide','err'); return; }

  var client = (document.getElementById('client').value||'').trim() || 'Client';
  var phone = (document.getElementById('phone').value||'').trim();
  var total = 0; var totalQte = 0;
  items.forEach(function(it){ total += Number(it.pv||0) * Number(it.qty||it.qte||0); totalQte += Number(it.qty||it.qte||0); });

  var list = getProformas();
  var num = 'PF-' + String(list.length+1).padStart(4,'0') + '-' + new Date().getFullYear();
  // Evite doublon de numero
  if(list.some(function(x){ return x.num===num; })) num = 'PF-' + Date.now().toString().slice(-6);

  var vendeur = '';
  try{ var u=JSON.parse(localStorage.getItem('user')||'{}'); vendeur = u.nom||u.name||u.username||''; }catch(e){}

  // ✅ On fige le taux comptoir du jour de la proforma
  var tauxComptoirProforma = 0;
  try{ tauxComptoirProforma = Number(getTauxComptoir() || getTaux() || 0); }catch(e){ tauxComptoirProforma = 0; }

  var p = {
    num: num,
    date: new Date().toISOString(),
    client: client,
    phone: phone,
    site: SITE_ID||'',
    vendeur: vendeur,
    statut: 'PROFORMA',
    total: Math.round(total),
    totalQte: totalQte,
    taux: tauxComptoirProforma,
    tauxComptoir: tauxComptoirProforma,
    items: items.map(function(it){ return { nom: it.nom, pv: it.pv, qty: it.qty||it.qte||0, qte: it.qty||it.qte||0 }; })
  };

  list.unshift(p);
  sauverProformas(list);
  DERNIERE_PROFORMA = p;
  afficherProformaThermal(p);
  renderProformas();
  toast('Proforma '+num+' creee - stock NON deduit');
}

// ===== VOIR UNE PROFORMA =====
function voirProforma(num){
  var list = getProformas();
  var p = null; for(var i=0;i<list.length;i++){ if(list[i].num===num){ p=list[i]; break; } }
  if(!p){ toast('Proforma introuvable','err'); return; }
  DERNIERE_PROFORMA = p;
  afficherProformaThermal(p);
}

// ===== ✅ REIMPRIMER UNE FACTURE DEJA LANCEE - COTE VENTE =====
function reimprimerProforma(num){
  var list = getProformas();
  var p = null; for(var i=0;i<list.length;i++){ if(list[i].num===num){ p=list[i]; break; } }
  if(!p){ toast('Proforma introuvable','err'); return; }

  // Si deja vendue -> on reimprime la FACTURE DE VENTE
  if(p.statut==='VENTE'){
    var dataVente = {
      num: p.venteNum || p.num,
      proformaNum: p.num,
      dateStr: new Date(p.dateVente||p.date).toLocaleString('fr-FR'),
      site: String(p.site||SITE_ID||'').toUpperCase(),
      vendeur: p.vendeur||'',
      client: p.client||'',
      phone: p.phone||'',
      items: (p.items||[]).map(function(it){ return { nom: it.nom, qte: it.qty||it.qte||0, pv: it.pv }; }),
      totalQte: p.totalQte||0,
      total: p.total||0,
      recu: p.total||0,
      rendu: 0,
      taux: p.tauxComptoir || p.taux || getTaux(),
      tauxComptoir: p.tauxComptoir || p.taux || getTaux()
    };
    afficherFactureVente(dataVente);
    return;
  }

  // Sinon -> on reimprime la PROFORMA
  DERNIERE_PROFORMA = p;
  afficherProformaThermal(p);
  toast('Reimpression '+p.num);
}

// ===== CONVERTIR PROFORMA EN VENTE (bouton dans la facture) =====
function convertirProforma(){
  var p = DERNIERE_PROFORMA;
  if(!p){ toast('Aucune proforma','err'); return; }
  if(p.statut==='VENTE'){ toast('Deja vendue : '+(p.venteNum||''),'err'); return; }
  if(p.statut==='ANNULEE'){ toast('Proforma annulee','err'); return; }
  convertirProformaParNum(p.num);
}

// ===== CONVERTIR PAR NUMERO (utilise aussi par le gerant) =====
function convertirProformaParNum(num){
  var list = getProformas();
  var p = null; var idx = -1;
  for(var i=0;i<list.length;i++){ if(list[i].num===num){ p=list[i]; idx=i; break; } }
  if(!p){ toast('Proforma introuvable','err'); return; }
  if(p.statut==='VENTE'){ toast('Deja vendue','err'); return; }
  if(p.statut==='ANNULEE'){ toast('Proforma annulee','err'); return; }

  // 1. Verifier le stock
  var produits = [];
  try{ produits = getProduitsSite ? getProduitsSite() : []; }catch(e){}
  for(var j=0;j<(p.items||[]).length;j++){
    var it = p.items[j];
    var prod = null;
    for(var k=0;k<produits.length;k++){ if(String(produits[k].nom||'').toLowerCase()===String(it.nom||'').toLowerCase()){ prod=produits[k]; break; } }
    if(!prod){ toast('Produit introuvable : '+it.nom,'err'); return; }
    if(Number(prod.stock||0) < Number(it.qty||it.qte||0)){ toast('Stock insuffisant : '+it.nom+' (reste '+prod.stock+')','err'); return; }
  }

  // 2. Deduire le stock
  for(var j2=0;j2<(p.items||[]).length;j2++){
    var it2 = p.items[j2];
    for(var k2=0;k2<produits.length;k2++){
      if(String(produits[k2].nom||'').toLowerCase()===String(it2.nom||'').toLowerCase()){
        produits[k2].stock = Number(produits[k2].stock||0) - Number(it2.qty||it2.qte||0);
        break;
      }
    }
  }
  try{ if(typeof sauverProduitsSite==='function') sauverProduitsSite(produits); }catch(e){}

  // 3. Creer la vente - on garde le taux figé de la proforma
  var venteNum = 'V-' + Date.now().toString().slice(-6);
  var dateStr = new Date().toLocaleString('fr-FR');
  var tauxVenteFinal = Number(p.tauxComptoir || p.taux || 0);

  var lignesVente = (p.items||[]).map(function(it){
    return { produit: it.nom, nom: it.nom, qte: it.qty||it.qte||0, pv: it.pv, prix: it.pv, valeurPV: Number(it.pv||0)*Number(it.qty||it.qte||0), total: Number(it.pv||0)*Number(it.qty||it.qte||0), client: p.client, vendeur: p.vendeur, vendeurNom: p.vendeur, siteId: p.site, site: p.site, date: new Date().toISOString(), transactionId: venteNum, idVente: venteNum, taux: tauxVenteFinal, tauxComptoir: tauxVenteFinal };
  });

  var ventes = [];
  try{ ventes = JSON.parse(localStorage.getItem('dub_ventes')||'[]'); }catch(e){}
  ventes = ventes.concat(lignesVente);
  localStorage.setItem('dub_ventes', JSON.stringify(ventes));

  // 4. Marquer la proforma comme VENDUE
  p.statut = 'VENTE';
  p.venteNum = venteNum;
  p.dateVente = new Date().toISOString();
  list[idx] = p;
  sauverProformas(list);
  DERNIERE_PROFORMA = p;

  // 5. Afficher la FACTURE DE VENTE - avec le taux figé de la proforma
  afficherFactureVente({
    num: venteNum,
    proformaNum: p.num,
    dateStr: dateStr,
    site: String(p.site||SITE_ID||'').toUpperCase(),
    vendeur: p.vendeur||'',
    client: p.client||'',
    phone: p.phone||'',
    items: (p.items||[]).map(function(it){ return { nom: it.nom, qte: it.qty||it.qte||0, pv: it.pv }; }),
    totalQte: p.totalQte||0,
    total: p.total||0,
    recu: p.total||0,
    rendu: 0,
    taux: tauxVenteFinal,
    tauxComptoir: tauxVenteFinal
  });

  renderProformas();
  try{ render(); }catch(e){}
  toast('Proforma '+p.num+' convertie en VENTE '+venteNum);
}

// ===== ANNULER / SUPPRIMER =====
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

// ===== EXPORT CSV =====
function exporterProformas(){
  var list = getProformas();
  if(!list.length){ toast('Aucune proforma','err'); return; }
  var csv='Numero;Date;Client;Tel;Site;Vendeur;Statut;Total;TauxComptoir;TotalUSD;VenteNum;Articles\n';
  list.forEach(function(p){
    var t = Number(p.tauxComptoir || p.taux || 0);
    var usd = t>0 ? (p.total/t).toFixed(2) : '0';
    csv+=p.num+';'+p.date+';'+p.client+';'+(p.phone||'')+';'+p.site+';'+(p.vendeur||'')+';'+(p.statut||'PROFORMA')+';'+p.total+';'+t+';'+usd+';'+(p.venteNum||'')+';'+(p.items||[]).map(function(it){ return it.nom+' x'+(it.qty||it.qte); }).join(' | ')+'\n';
  });
  var a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob(['\ufeff'+csv],{type:'text/csv'}));
  a.download='proformas.csv';
  a.click();
}