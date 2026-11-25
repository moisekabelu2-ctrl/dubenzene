// Pour le VENDEUR uniquement

// 1. Aide pendant la vente
function iaAideVente(symptome){
  // Tu utilises déjà iaLocale() que tu as collé
  return iaLocale(symptome);
}

// 2. Vérifie la caisse
function iaVerifieCaisse(caisseAttendue, caisseReelle, nbRetours){
  if(nbRetours > 3) return "⚠️ Trop de retours: " + nbRetours;
  if(caisseAttendue !== caisseReelle) return "⚠️ Ecart caisse: " + (caisseAttendue - caisseReelle) + " FC";
  return "✅ Caisse OK, tout est bon.";
}

// 3. Coach vendeur
function iaCoachVendeur(ventesAuj, ventesHier){
  return iaCoach(ventesAuj, ventesHier, 200000);
}