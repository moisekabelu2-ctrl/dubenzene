// RECHERCHE INTELLIGENTE
function normaliser(txt){
  return (txt||'').toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim();
}
const SYNONYMES = {
  'para':'paracetamol','parac':'paracetamol','doli':'doliprane','amox':'amoxicilline','amoxi':'amoxicilline',
  'vit':'vitamine','vitc':'vitamine c','shal':'shalina','pate':'pate dentifrice','dent':'dentifrice',
  'couche':'couche bebe','bb':'bebe','grippe':'grippe rhume','rhume':'rhume grippe','toux':'toux sirop','fievre':'fievre paracetamol',
  'sav':'savon','huil':'huile','lait':'lait','bebe':'bebe'
};
function enrichirRequete(q){
  let mots = normaliser(q).split(' ').filter(Boolean);
  let enrichis = [...mots];
  mots.forEach(m=>{ if(SYNONYMES[m]) enrichis.push(...normaliser(SYNONYMES[m]).split(' ')); });
  return [...new Set(enrichis)];
}
function distance(a,b){
  if(Math.abs(a.length-b.length)>2) return 99;
  let dp = Array(b.length+1).fill(0).map((_,i)=>i);
  for(let i=1;i<=a.length;i++){ let prev=dp[0]; dp[0]=i; for(let j=1;j<=b.length;j++){ let tmp=dp[j]; dp[j]=Math.min(dp[j]+1, dp[j-1]+1, prev + (a[i-1]===b[j-1]?0:1)); prev=tmp; } }
  return dp[b.length];
}
function scoreProduit(p, motsRecherche){
  let texteProduit = normaliser((p.nom||'')+' '+(p.fournisseur||'')+' '+(p.categorie||'')+' '+(p._siteNom||p.site_nom||'')+' '+(p.lot||''));
  let motsProduit = texteProduit.split(' ');
  let score = 0;
  motsRecherche.forEach(motQ=>{
    if(!motQ) return;
    if(normaliser(p.nom||'').startsWith(motQ)) score += 100;
    else if(normaliser(p.nom||'').includes(motQ)) score += 80;
    else if(texteProduit.includes(motQ)) score += 50;
    else {
      for(let mp of motsProduit){
        if(distance(motQ, mp) <= 1 && motQ.length>=4){ score += 60; break; }
        if(distance(motQ, mp) <= 2 && motQ.length>=7){ score += 40; break; }
        if(mp.startsWith(motQ) && motQ.length>=3){ score += 70; break; }
      }
    }
  });
  return score;
}
function rechercheIntelligente(liste, query){
  if(!query || !query.trim()) return liste;
  let mots = enrichirRequete(query);
  return liste.map(p=>({p, score: scoreProduit(p, mots)}))
    .filter(x=>x.score>0)
    .sort((a,b)=>b.score - a.score)
    .map(x=>x.p);
}
function filterSearch(){ load(); }
function clearSearch(){
  let s=document.getElementById('search'); if(s) s.value='';
  let ss=document.getElementById('searchSite'); if(ss) ss.value='';
  load();
}
function appliquerSuggestion(mot){
  let s=document.getElementById('search'); if(s) s.value=mot;
  load();
}
function afficherSuggestions(listeProduits, query){
  let el=document.getElementById('searchSuggestions'); if(!el) return;
  if(!query || query.trim().length<2){ el.innerHTML=''; return; }
  let mots = enrichirRequete(query);
  // Top 5 produits les plus pertinents comme suggestions cliquables
  let top = listeProduits.map(p=>({p, score: scoreProduit(p, mots)})).filter(x=>x.score>0).sort((a,b)=>b.score-a.score).slice(0,5);
  if(!top.length){ el.innerHTML='<span style="font-size:12px;color:#f87171">Aucun résultat pour "'+query+'"</span>'; return; }
  el.innerHTML = top.map(x=>`<button class="chip-sugg" onclick="appliquerSuggestion('${(x.p.nom||'').replace(/'/g,"\\'")}')">${x.p.nom} • ${x.p.stock||0}</button>`).join('');
}