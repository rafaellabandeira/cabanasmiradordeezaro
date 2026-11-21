
// Rellena los precios de las ofertas (medalla y páginas de ofertas) desde precios.js
document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll("[data-oferta-precio]").forEach(el => {
    el.textContent = OFERTAS[el.dataset.ofertaPrecio].precio + " €";
  });
});
