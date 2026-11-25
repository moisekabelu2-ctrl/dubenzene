function fermerFacture(){
  var m = document.getElementById('factureModal');
  if(m) m.style.display = 'none';
}
function imprimerThermal(id){
  var el = document.getElementById(id);
  if(!el) return;
  var w = window.open('', '', 'width=320,height=600');
  w.document.write('<html><head><title>Impression</title><style>body{font-family:Arial;font-size:13px} .no-print{display:none}</style></head><body>'+el.innerHTML+'</body></html>');
  w.document.close();
  setTimeout(function(){ w.print(); w.close(); }, 400);
}
function afficherFactureVente(data){
  var modal = document.getElementById('factureModal');
  var content = document.getElementById('factureContent');
  if(!modal || !content){ alert('Vente '+(data.num||'')+' - Total : '+fmtFC(data.total||0)); return; }
  var taux = Number(data.tauxComptoir || data.taux || 0);
  try{ if(!taux && typeof getTauxComptoir==='function') taux = getTauxComptoir(); }catch(e){}
  var items = data.items || data.articles || [];
  var html = '<div style="background:#fff;color:#000;padding:16px;font-family:Arial;font-size:13px">';
  html += '<div style="text-align:center"><b style="font-size:18px">DUBENZENE</b><br><span>FACTURE VENTE</span><br><span>N° '+(data.num||'')+'</span>';
  if(data.proformaNum) html += '<br><span>Proforma : '+data.proformaNum+'</span>';
  html += '</div>';
  html += '<hr><div>Client : <b>'+(data.client||'Client')+'</b><br>Tél : '+(data.phone||'-')+'<br>Date : '+(data.dateStr||new Date().toLocaleString('fr-FR'))+'<br>Site : '+String(data.site||'').toUpperCase()+'<br>Vendeur : '+(data.vendeur||data.vendeurNom||'GERANT')+'</div><hr>';
  html += '<div>Taux comptoir : 1 $ = '+taux.toLocaleString('fr-FR')+' FC</div><hr>';
  html += '<table style="width:100%;border-collapse:collapse;font-size:12px"><tr><th align="left">Produit</th><th>Qte</th><th>PU</th><th>Total</th></tr>';
  for(var i=0;i<items.length;i++){
    var it = items[i];
    var q = Number(it.qte||it.qty||0);
    var pv = Number(it.pv||it.prix||0);
    html += '<tr><td>'+it.nom+'</td><td align="center">'+q+'</td><td align="right">'+pv.toLocaleString()+'</td><td align="right">'+(pv*q).toLocaleString()+'</td></tr>';
  }
  html += '</table><hr>';
  html += '<div style="text-align:right"><b>Total FC : '+Number(data.total||0).toLocaleString()+' FC</b><br><b>Total $ : '+(taux>0 ? (Number(data.total||0)/taux).toFixed(2) : '-')+' $</b><br>Reçu : '+Number(data.recu||data.total||0).toLocaleString()+' FC<br>Rendu : '+Number(data.rendu||0).toLocaleString()+' FC</div>';
  html += '<div style="text-align:center;margin-top:12px">Merci de votre confiance !</div></div>';
  content.innerHTML = html;
  var btnConv = document.getElementById('btnConvertir');
  if(btnConv) btnConv.style.display = 'none';
  modal.style.display = 'block';
}
function genererFacture(){
  var d = null;
  try{ d = JSON.parse(localStorage.getItem('dub_derniere_vente')||'null'); }catch(e){ d=null; }
  if(!d || !d.items || !d.items.length){
    if(typeof CART!=='undefined' && CART.length){
      var tot = 0; for(var i=0;i<CART.length;i++){ tot += CART[i].pv*CART[i].qty; }
      afficherFactureVente({
        num: 'BROUILLON',
        dateStr: new Date().toLocaleString('fr-FR'),
        site: String(typeof SITE_ID!=='undefined' ? SITE_ID : '').toUpperCase(),
        vendeur: document.getElementById('vendeurName') ? document.getElementById('vendeurName').innerText : 'GERANT',
        client: document.getElementById('client') ? document.getElementById('client').value||'Client' : 'Client',
        phone: document.getElementById('phone') ? document.getElementById('phone').value||'' : '',
        items: CART.map(function(it){ return {nom: it.nom, qte: it.qty, pv: it.pv}; }),
        total: tot,
        recu: parseFloat(document.getElementById('recu') ? document.getElementById('recu').value||0 : 0),
        rendu: 0,
        taux: 0,
        tauxComptoir: 0
      });
      return;
    }
    alert('Aucune vente à facturer'); return;
  }
  var tauxVente = d.tauxComptoir || d.taux || 0;
  try{
    var ventes = JSON.parse(localStorage.getItem('dub_ventes')||'[]');
    for(var i=0;i<ventes.length;i++){
      if(String(ventes[i].transactionId)===String(d.transactionId) && Number(ventes[i].tauxComptoir||ventes[i].taux||0)>0){ tauxVente = Number(ventes[i].tauxComptoir||ventes[i].taux); break; }
    }
  }catch(e){}
  afficherFactureVente({
    num: d.venteNum || d.transactionId,
    dateStr: new Date(d.date).toLocaleString('fr-FR'),
    site: String(d.siteId||'').toUpperCase(),
    vendeur: document.getElementById('vendeurName') ? document.getElementById('vendeurName').innerText : 'GERANT',
    client: d.client||'Client',
    phone: d.phone||'',
    items: d.items.map(function(it){ return {nom: it.nom, qte: it.qte||it.qty, pv: it.pv}; }),
    total: d.total,
    recu: d.recu||d.total,
    rendu: d.rendu||0,
    taux: tauxVente,
    tauxComptoir: tauxVente
  });
}
function reimprimerDerniere(){ genererFacture(); }