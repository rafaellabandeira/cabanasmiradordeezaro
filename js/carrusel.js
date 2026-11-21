
// Carrusel de fotos: funciona sin JavaScript (desliza con el dedo); esto solo añade flechas y puntos.
document.addEventListener("DOMContentLoaded", () => {
  const sinAnimacion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  document.querySelectorAll(".carrusel").forEach(c => {
    const pista = c.querySelector(".car-pista");
    const fotos = Array.from(pista.children);
    if (fotos.length < 2) return;
    c.classList.add("js");
    const puntos = c.querySelector(".car-dots");
    const actual = () => Math.round(pista.scrollLeft / pista.clientWidth);
    const ir = i => {
      const n = (i + fotos.length) % fotos.length;
      pista.scrollTo({ left: n * pista.clientWidth, behavior: sinAnimacion ? "auto" : "smooth" });
    };
    fotos.forEach((_, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.setAttribute("aria-label", "Ver foto " + (i + 1) + " de " + fotos.length);
      b.addEventListener("click", () => ir(i));
      puntos.appendChild(b);
    });
    const marcar = () => {
      const a = actual();
      Array.from(puntos.children).forEach((b, i) => b.setAttribute("aria-current", i === a ? "true" : "false"));
    };
    let t;
    pista.addEventListener("scroll", () => { clearTimeout(t); t = setTimeout(marcar, 60); });
    c.querySelector(".car-prev").addEventListener("click", () => ir(actual() - 1));
    c.querySelector(".car-next").addEventListener("click", () => ir(actual() + 1));
    pista.addEventListener("keydown", e => {
      if (e.key === "ArrowRight") { e.preventDefault(); ir(actual() + 1); }
      if (e.key === "ArrowLeft") { e.preventDefault(); ir(actual() - 1); }
    });
    marcar();
  });
});
