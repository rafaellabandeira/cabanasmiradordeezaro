// Rellena precio, teléfono y enlaces de WhatsApp en las páginas de cada cabaña (usa config.js)
document.addEventListener("DOMContentLoaded", () => {
  const c = CABANAS.find(x => x.id === document.body.dataset.cabana);
  document.querySelectorAll("[data-precio]").forEach(el => {
    if (c) el.innerHTML = `Desde ${Math.min(PRECIOS[c.id].habitual, PRECIOS[c.id].semana)} € <small>por noche</small>`;
  });
  document.querySelectorAll("[data-telefono]").forEach(el => { el.textContent = TELEFONO_TXT; });
  const msg = c ? `Hola, quiero información sobre la ${c.nombre}.` : "Hola, quiero información sobre las cabañas.";
  document.querySelectorAll(".js-wa").forEach(a => {
    a.href = "https://wa.me/" + TELEFONO_WA + "?text=" + encodeURIComponent(msg);
  });
});
