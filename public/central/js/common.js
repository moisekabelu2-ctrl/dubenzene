// common.js - COURT - Produit + Site
// On met COMMON_ devant pour ne pas avoir "already declared" avec sites.js
var COMMON_KEY_PRODUITS = 'dubenzen_produits';
var COMMON_KEY_SP = 'dub_sites_produits';
var COMMON_KEY_SITES = 'dub_sites';
var COMMON_KEY_USERS = 'dub_users';
var COMMON_KEY_CURRENT = 'dub_current_user_id';
var COMMON_KEY_VENTES = 'dub_ventes';
function COMMON_norm(s){ return (s||'').toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim(); }
function COMMON_calcPV(pa,marge){ return Math.round(pa*(1+marge/100)); }
function COMMON_calcMarge(pa,pv){ if(!pa||pa<=0) return 0; return ((pv-pa)/pa*100); }
function COMMON_paOf(p){ return +p.pa||+p.prixAchat||0; }
function COMMON_pvOf(p){ var v=+p.pv||+p.prix||0; return v>0?v:COMMON_paOf(p); }
function COMMON_normalizeRole(r){ return String(r||'').toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g,''); }
function COMMON_paginate(list,page){ var total=list.length, totalPages=Math.max(1,Math.ceil(total/20)); if(page>totalPages) page=totalPages; if(page<1) page=1; var debut=(page-1)*20; return { items:list.slice(debut,debut+20), total:total, totalPages:totalPages, page:page }; }