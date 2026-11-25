function getMenuCentral(current){
  const html = `
<div style="position:fixed;left:0;top:0;width:280px;height:100vh;background:#0a0e1a;border-right:1px solid #1e2435;display:flex;flex-direction:column;z-index:999999;overflow:hidden;font-family:Arial">
<div style="padding:28px 24px;border-bottom:1px solid #1e2435;flex-shrink:0">
<div style="display:flex;align-items:center;gap:12px">
<div style="width:36px;height:36px;background:#facc15;border-radius:10px;display:flex;align-items:center;justify-content:center;color:#000;font-weight:900">D</div>
<div><b style="color:#fff;font-size:14px">DUBENZENE</b><br><small style="color:#5a6080;font-size:10px">CENTRAL • BUKAVU</small></div>
</div>
</div>
<div style="flex:1;padding:16px;overflow-y:auto">
<a href="/central/index.html" style="display:flex;gap:12px;padding:12px 14px;border-radius:12px;text-decoration:none;margin-bottom:6px;${current=='dashboard'?'background:#facc15;color:#000;font-weight:700':'color:#8a8fa3'}">📊 Dashboard</a>
<a href="/central/produits.html" style="display:flex;gap:12px;padding:12px 14px;border-radius:12px;text-decoration:none;margin-bottom:6px;${current=='produits'?'background:#facc15;color:#000;font-weight:700':'color:#8a8fa3'}">📦 Produits</a>
<a href="/central/stock.html" style="display:flex;gap:12px;padding:12px 14px;border-radius:12px;text-decoration:none;margin-bottom:6px;${current=='stock'?'background:#facc15;color:#000;font-weight:700':'color:#8a8fa3'}">🛢️ Stock</a>
<a href="/central/sites.html" style="display:flex;gap:12px;padding:12px 14px;border-radius:12px;text-decoration:none;margin-bottom:6px;${current=='sites'?'background:#facc15;color:#000;font-weight:700':'color:#8a8fa3'}">📍 Sites</a>
<a href="/central/ventes.html" style="display:flex;gap:12px;padding:12px 14px;border-radius:12px;text-decoration:none;margin-bottom:6px;${current=='ventes'?'background:#facc15;color:#000;font-weight:700':'color:#8a8fa3'}">💰 Ventes</a>
<a href="/central/appros.html" style="display:flex;gap:12px;padding:12px 14px;border-radius:12px;text-decoration:none;margin-bottom:6px;${current=='appros'?'background:#facc15;color:#000;font-weight:700':'color:#8a8fa3'}">🚚 Appros</a>
<a href="/central/alertes.html" style="display:flex;gap:12px;padding:12px 14px;border-radius:12px;text-decoration:none;margin-bottom:6px;${current=='alertes'?'background:#facc15;color:#000;font-weight:700':'color:#8a8fa3'}">🚨 Alertes</a>
<a href="/central/utilisateurs.html" style="display:flex;gap:12px;padding:12px 14px;border-radius:12px;text-decoration:none;margin-bottom:6px;${current=='utilisateurs'?'background:#facc15;color:#000;font-weight:700':'color:#8a8fa3'}">👥 Utilisateurs</a>
</div>
<div style="padding:16px;border-top:1px solid #1e2435;flex-shrink:0">
<a href="/login.html" onclick="localStorage.clear()" style="display:flex;gap:12px;padding:12px 14px;border-radius:12px;text-decoration:none;background:#1a1010;color:#ef4444;border:1px solid #2a1a1a;font-weight:700">🚪 Déconnexion</a>
</div>
</div>`;
  return html;
}