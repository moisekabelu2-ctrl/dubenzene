// ===== FACTURE.JS - THERMIQUE 80mm, IMPRESSION, CONVERSION APRES IMPRESSION =====

function fermerFacture(){
  document.getElementById('factureModal').style.display='none';
  document.getElementById('factureModal').classList.remove('active');
  document.getElementById('btnConvertir').style.display='none';
}

function imprimerThermal(id){
  document.querySelectorAll('.thermal-print').forEach(function(el){ el.classList.remove('active'); });
  var m = document.getElementById(id);
  m.classList.add('active');
  setTimeout(function(){
    window.print();
    setTimeout(function(){
      m.classList.remove('active');
      // ✅ APRES IMPRESSION : si c'est une proforma, on garde le bouton CONVERTIR visible
      if(DERNIERE_PROFORMA && (DERNIERE_PROFORMA.statut||'PROFORMA')==='PROFORMA'){
        document.getElementById('btnConvertir').style.display = 'inline-block';
        toast('Proforma imprimee - en attente. Quand le client valide, clique CONVERTIR EN VENTE');
      }
    }, 500);
  }, 100);
}

function lignesThermal(items, cleQte){
  var rows = '';
  for(var i=0;i<items.length;i++){
    var it = items[i];
    var q = it[cleQte||'qty'] || it.qte || 0;
    var lt = Math.round(it.pv * q);
    rows += '<tr><td colspan="3" style="padding-top:4px"><b>'+esc(it.nom)+'</b></td></tr>'
            + '<tr><td>'+q+' x '+fmtFC(it.pv)+'</td><td></td><td style="text-align:right"><b>'+fmtFC(lt)+'</b></td></tr>';
  }
  return rows;
}

function afficherProformaThermal(p){
  // ✅ TAUX COMPTOIR - figé à la création de la proforma, sinon taux actuel du site
  var tauxProforma = Number(p.tauxComptoir || p.taux || 0);
  if(!tauxProforma){
    try{ tauxProforma = Number(getTauxComptoir() || getTaux() || 0); }catch(e){ tauxProforma = 0; }
  }
  var soitProforma = tauxProforma > 0 ? (p.total / tauxProforma) : 0;
  var html = ''
    + '<div class="center"><div class="big">DUBENZENE</div><div>Site : '+esc(String(p.site||SITE_ID).toUpperCase())+'</div><div>Vendeur : '+esc(p.vendeur||'')+'</div></div>'
    + '<div class="line"></div>'
    + '<div class="center bold">*** FACTURE PROFORMA ***</div>'
    + '<div class="center">N° '+esc(p.num)+'</div><div class="center">'+new Date(p.date).toLocaleString('fr-FR')+'</div>'
    + '<div class="center">Statut : '+(p.statut||'PROFORMA')+'</div>'
    + '<div class="line"></div>'
    + '<div>Client : <b>'+esc(p.client)+'</b></div><div>Tel : '+esc(p.phone||'-')+'</div><div>Validite : 48 Heures</div><div>Document non fiscal</div>'
    + '<div class="line"></div>'
    + '<table><tr><th>DESIGNATION</th><th></th><th style="text-align:right">MONTANT</th></tr>'+lignesThermal(p.items||[],'qty')+'</table>'
    + '<div class="line"></div>'
    + '<div class="row"><span>Articles :</span><b>'+(p.totalQte||0)+'</b></div>'
    + '<div class="row big"><span>TOTAL :</span><span>'+fmtFC(p.total)+'</span></div>'
    + (tauxProforma>0 ? '<div class="row"><span>Taux comptoir :</span><span>1 $ = '+tauxProforma.toLocaleString('fr-FR')+' FC</span></div>' : '')
    + '<div class="row"><span>Soit :</span><span>'+soitProforma.toFixed(2)+' $</span></div>'
    + '<div class="line"></div><div class="center">Merci de votre confiance !</div><div class="center">*** FIN ***</div><br><br><br>';
  document.getElementById('factureContent').innerHTML = html;
  document.getElementById('factureModal').style.display = 'block';
  // ✅ Bouton CONVERTIR visible seulement si encore PROFORMA
  document.getElementById('btnConvertir').style.display = ((p.statut||'PROFORMA')==='PROFORMA') ? 'inline-block' : 'none';
}

function afficherFactureVente(data){
  DERNIERE_FACTURE = data;
  // ✅ TAUX COMPTOIR - figé au moment de la vente, sinon ancien taux
  var tauxVente = Number(data.tauxComptoir || data.taux || 0);
  if(!tauxVente){
    try{ tauxVente = Number(getTauxComptoir() || 0); }catch(e){ tauxVente = 0; }
  }
  var soitVente = tauxVente > 0 ? (data.total / tauxVente) : 0;
  var html = ''
    + '<div class="center"><div class="big">DUBENZENE</div><div>Site : '+esc(data.site)+'</div><div>Vendeur : '+esc(data.vendeur)+'</div></div>'
    + '<div class="line"></div>'
    + '<div class="center bold">*** FACTURE DE VENTE ***</div>'
    + '<div class="center">N° '+esc(data.num)+'</div><div class="center">'+esc(data.dateStr)+'</div>'
    + (data.proformaNum ? '<div class="center">Proforma : '+esc(data.proformaNum)+' -> VENTE</div>' : '')
    + '<div class="line"></div>'
    + '<div>Client : <b>'+esc(data.client)+'</b></div><div>Tel : '+esc(data.phone)+'</div>'
    + '<div class="line"></div>'
    + '<table><tr><th>DESIGNATION</th><th></th><th style="text-align:right">MONTANT</th></tr>'+lignesThermal(data.items,'qte')+'</table>'
    + '<div class="line"></div>'
    + '<div class="row"><span>Articles :</span><b>'+data.totalQte+'</b></div>'
    + '<div class="row big"><span>TOTAL :</span><span>'+fmtFC(data.total)+'</span></div>'
    + '<div class="row"><span>Recu :</span><span>'+fmtFC(data.recu)+'</span></div>'
    + '<div class="row"><span>Rendu :</span><span>'+fmtFC(data.rendu)+'</span></div>'
    + (tauxVente>0 ? '<div class="row"><span>Taux comptoir :</span><span>1 $ = '+tauxVente.toLocaleString('fr-FR')+' FC</span></div>' : '')
    + '<div class="row"><span>Soit :</span><span>'+soitVente.toFixed(2)+' $</span></div>'
    + '<div class="line"></div><div class="center">Merci de votre confiance !</div><div class="center">*** FIN ***</div><br><br><br>';
  document.getElementById('factureContent').innerHTML = html;
  document.getElementById('factureModal').style.display = 'block';
  // ✅ Sur une facture de vente, on ne montre plus CONVERTIR
  document.getElementById('btnConvertir').style.display = 'none';
  try{ localStorage.setItem('dub_derniere_facture', JSON.stringify(data)); }catch(e){}
}

function reimprimerDerniere(){
  var d = DERNIERE_FACTURE;
  if(!d){ try{ d = JSON.parse(localStorage.getItem('dub_derniere_facture')||'null'); }catch(e){ d=null; } }
  if(!d){ toast('Aucune facture a reimprimer', 'err'); return; }
  afficherFactureVente(d);
}

// Fermer si on clique en dehors de la facture
document.getElementById('factureModal').addEventListener('click', function(e){
  if(e.target.id==='factureModal') fermerFacture();
});