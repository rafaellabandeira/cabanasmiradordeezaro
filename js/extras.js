// Rellena precios, enlaces de Stripe y WhatsApp en las páginas de bono regalo y packs (usa config.js)
document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll("[data-bono]").forEach(a => { a.href = BONOS[a.dataset.bono].url; });
  document.querySelectorAll("[data-bono-precio]").forEach(el => { el.textContent = BONOS[el.dataset.bonoPrecio].precio + " €"; });
  document.querySelectorAll("[data-pack-precio]").forEach(el => {
    const p = PACKS.find(x => x.id === el.dataset.packPrecio);
    if (p) el.textContent = p.precio + " €";
  });
  document.querySelectorAll("[data-anticipo-corto]").forEach(el => { el.textContent = ANTICIPO_CORTO + " €"; });
  document.querySelectorAll("[data-anticipo-largo]").forEach(el => { el.textContent = ANTICIPO_LARGO + " €"; });
  document.querySelectorAll("[data-extra-dto]").forEach(el => { el.textContent = DESCUENTOS.nocheExtraOferta; });
  document.querySelectorAll("[data-telefono]").forEach(el => { el.textContent = TELEFONO_TXT; });
  document.querySelectorAll(".js-wa").forEach(a => {
    a.href = "https://wa.me/" + TELEFONO_WA + "?text=" + encodeURIComponent("Hola, quiero información sobre los packs y bonos regalo.");
  });
});
