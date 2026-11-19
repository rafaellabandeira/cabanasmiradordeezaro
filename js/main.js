// ================= MAIN.JS - CABAÑAS MIRADOR DE ÉZARO =================
// Flujo: el cliente elige fechas y personas, y el sistema muestra las cabañas libres.

// Requiere js/config.js (CABANAS, BACKEND_URL, ANTICIPO, etc.), cargado antes.
const POR_ID = Object.fromEntries(CABANAS.map(c => [c.id, c]));

// ---------- UTILIDADES ----------
const $ = id => document.getElementById(id);
function fechaLocal(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
function aFecha(iso) { const p = iso.split("-"); return new Date(+p[0], +p[1] - 1, +p[2]); }
function sumarDias(date, n) { const d = new Date(date); d.setDate(d.getDate() + n); return d; }
function formato(date) { return date.toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" }); }

// ---------- CARGA DE RESERVAS ----------
// El bin de JSONBin guarda { monica: [...], bloqueados_monica: [...], ... } (noches ocupadas)
let bloqueadas = null;     // { id: Set de noches ocupadas o bloqueadas }
let cargaFallida = true;
let reintentos = 0;

async function cargarReservasBackend() {
  try {
    // Caché de 5 minutos en el navegador: menos peticiones a JSONBin
    let d = null;
    try {
      const g = JSON.parse(sessionStorage.getItem("ezaro_reservas") || "null");
      if (g && Date.now() - g.t < 300000) d = g.d;
    } catch (e) {}
    if (!d) {
      const control = new AbortController();
      const t = setTimeout(() => control.abort(), 15000);
      const res = await fetch(BACKEND_URL, { signal: control.signal });
      clearTimeout(t);
      if (!res.ok) throw new Error("Error " + res.status);
      const data = await res.json();
      d = data.record || data;     // JSONBin envuelve los datos en "record"
      try { sessionStorage.setItem("ezaro_reservas", JSON.stringify({ t: Date.now(), d })); } catch (e) {}
    }
    const r = {};
    for (const c of CABANAS) {
      const ocupadas = (d[c.id] || []).map(f => f.slice(0, 10));
      const bloqueos = d["bloqueados_" + c.id] || [];
      r[c.id] = new Set(ocupadas.concat(bloqueos));
    }
    return r;
  } catch (err) {
    console.error(err);
    return null;
  }
}

async function prepararDisponibilidad() {
  cargaFallida = true;
  $("avisoCarga").style.display = "block";
  const r = await cargarReservasBackend();
  if (!r) {
    // Un servidor gratuito puede tardar ~50 s en despertar: reintentamos
    if (reintentos++ < 8) setTimeout(prepararDisponibilidad, 15000);
    return;
  }
  bloqueadas = r;
  cargaFallida = false;
  reintentos = 0;
  $("avisoCarga").style.display = "none";
}

// Una cabaña está libre si ninguna de sus noches [entrada, salida) está ocupada.
// El día de salida puede ser el día de entrada de otro cliente.
function estaLibre(cab, inicio, fin) {
  const set = bloqueadas[cab.id];
  for (let d = new Date(inicio); d < fin; d = sumarDias(d, 1)) {
    if (set.has(fechaLocal(d))) return false;
  }
  return true;
}

// ---------- PRECIOS ----------
const FESTIVOS_FIJOS = ["01-01", "01-06", "05-01", "05-17", "07-25", "08-15", "10-12", "11-01", "12-06", "12-08", "12-25"];
// 05-17 Día das Letras Galegas y 07-25 Santiago Apóstol: festivos en Galicia

function pascua(anio) {
  const a = anio % 19, b = Math.floor(anio / 100), c = anio % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(anio, mes - 1, dia);
}

function esFestivo(fecha) {
  const mmdd = s => String(s.getMonth() + 1).padStart(2, "0") + "-" + String(s.getDate()).padStart(2, "0");
  if (FESTIVOS_FIJOS.includes(mmdd(fecha))) return true;
  const ayer = sumarDias(fecha, -1);
  if (ayer.getDay() === 0 && FESTIVOS_FIJOS.includes(mmdd(ayer))) return true; // festivo en domingo: cuenta el lunes
  const p = pascua(fecha.getFullYear());
  for (const dias of [-3, -2]) {   // Jueves y Viernes Santo
    const f = sumarDias(p, dias);
    if (f.getDate() === fecha.getDate() && f.getMonth() === fecha.getMonth()) return true;
  }
  return false;
}

// Noche con precio habitual: viernes, sábado, festivo o víspera de festivo
function esNocheFinde(dia) {
  const dow = dia.getDay();
  return dow === 5 || dow === 6 || esFestivo(dia) || esFestivo(sumarDias(dia, 1));
}

function esTemporadaAlta(fecha) {
  const md = (fecha.getMonth() + 1) * 100 + fecha.getDate();
  return md >= 715 && md <= 820;
}

function precioNoche(cab, dia) {
  let p = esNocheFinde(dia) ? cab.precio : cab.sem;
  if (esTemporadaAlta(dia)) p *= 1 + RECARGO_TEMP_ALTA;
  return p;
}

function totalEstancia(cab, inicio, fin) {
  let t = 0;
  for (let d = new Date(inicio); d < fin; d = sumarDias(d, 1)) t += precioNoche(cab, d);
  return Math.round(t);
}

// ---------- BÚSQUEDA ----------
let seleccion = null;

function mostrarMensaje(html) {
  $("resultados").innerHTML = `<p class="vacio">${html}</p>`;
}

function buscar() {
  $("pasoDatos").style.display = "none";
  seleccion = null;
  if (cargaFallida) {
    mostrarMensaje("⏳ Todavía estamos cargando la disponibilidad. Espera unos segundos e inténtalo de nuevo.");
    return;
  }
  const e = $("ent").value, s = $("sal").value;
  if (!e || !s) { mostrarMensaje("Elige la fecha de entrada y la de salida."); return; }
  const inicio = aFecha(e), fin = aFecha(s);
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  if (inicio < hoy) { mostrarMensaje("La fecha de entrada ya ha pasado."); return; }
  const noches = Math.round((fin - inicio) / 86400000);
  if (noches < 1) { mostrarMensaje("La salida debe ser posterior a la entrada."); return; }
  if (noches < MIN_NOCHES) { mostrarMensaje(`El mínimo es de ${MIN_NOCHES} noches.`); return; }

  const personas = +$("per").value;
  const soloJac = $("soloJacuzzi").checked;
  const libres = CABANAS.filter(c =>
    c.max >= personas && (!soloJac || c.jacuzzi) && estaLibre(c, inicio, fin));

  const cabecera = `<p class="resumen-busqueda">${formato(inicio)} → ${formato(fin)} · ${noches} ${noches === 1 ? "noche" : "noches"} · ${personas} ${personas === 1 ? "persona" : "personas"}</p>`;
  if (!libres.length) {
    $("resultados").innerHTML = cabecera +
      `<p class="vacio">No quedan cabañas libres con esos datos. Prueba otras fechas${soloJac ? " o quita el filtro de jacuzzi" : ""}, o <a href="https://wa.me/${TELEFONO_WA}" target="_blank" rel="noopener">escríbenos por WhatsApp</a>.</p>`;
    return;
  }
  libres.sort((a, b) => totalEstancia(a, inicio, fin) - totalEstancia(b, inicio, fin));
  $("resultados").innerHTML = cabecera + `<div class="grid">` + libres.map(c => {
    const total = totalEstancia(c, inicio, fin);
    return `<article class="cabin"><div class="body"><h3>${c.nombre}</h3>
      <div class="tags">${c.tags.map(t => `<span class="tag">${t}</span>`).join("")}</div><p>👥 ${c.cap}</p>
      <p><a class="more" href="cabana-${c.id}.html">Ver cabaña</a></p>
      <p class="price">${total} € <small>por ${noches} ${noches === 1 ? "noche" : "noches"}</small></p>
      <button class="btn" type="button" data-reservar="${c.id}">Reservar</button></div></article>`;
  }).join("") + `</div>`;
  $("resultados").dataset.ent = e;
  $("resultados").dataset.sal = s;
  $("resultados").scrollIntoView({ behavior: "smooth", block: "start" });
}

function elegirCabana(id) {
  const cab = POR_ID[id];
  const inicio = aFecha($("resultados").dataset.ent), fin = aFecha($("resultados").dataset.sal);
  const total = totalEstancia(cab, inicio, fin);
  seleccion = { cab, inicio, fin, total, personas: +$("per").value };
  $("resumenReserva").innerHTML =
    `<p><strong>${cab.nombre}</strong></p>
     <p>${formato(inicio)} → ${formato(fin)}</p>
     <p><strong>Total estancia:</strong> ${total} €</p>
     <p><strong>Reserva ahora:</strong> ${ANTICIPO} €</p>
     <p><strong>Resto a pagar en destino:</strong> ${total - ANTICIPO} €</p>`;
  $("pasoDatos").style.display = "block";
  $("pasoDatos").scrollIntoView({ behavior: "smooth", block: "start" });
}

// ---------- RESERVA (paso 2) ----------
function reservar() {
  const nombre = $("nombre").value.trim();
  const telefono = $("telefono").value.trim();
  const email = $("email").value.trim();
  if (!seleccion) { alert("Elige primero una cabaña."); return; }
  if (!nombre || !telefono) { alert("Completa tu nombre y teléfono para confirmar la reserva."); return; }
  if (!/\S+@\S+\.\S+/.test(email)) { alert("Introduce un email válido."); return; }
  if (!$("aceptoPrivacidad").checked) { alert("Debes aceptar la política de privacidad y el aviso legal."); return; }
  const s = seleccion;
  const msg = `Hola, soy ${nombre} (${telefono}). Quiero reservar la ${s.cab.nombre} del ${formato(s.inicio)} al ${formato(s.fin)} para ${s.personas} ${s.personas === 1 ? "persona" : "personas"}. Total: ${s.total} €.`;
  // Pago online todavía no activo: se confirma por WhatsApp
  alert("El pago online todavía no está activo.\n\nTe abrimos WhatsApp para confirmar la reserva.");
  window.open("https://wa.me/" + TELEFONO_WA + "?text=" + encodeURIComponent(msg), "_blank");
}

// ---------- PÁGINA ----------
function prepararPersonas() {
  for (let n = 1; n <= 6; n++) $("per").insertAdjacentHTML("beforeend", `<option value="${n}">${n} ${n === 1 ? "persona" : "personas"}</option>`);
  $("per").value = "2";
}

// Los precios y datos de contacto no están en el HTML: se rellenan desde config.js
function pintarTextos() {
  document.querySelectorAll("[data-precio]").forEach(el => {
    const c = POR_ID[el.getAttribute("data-precio")];
    if (c) el.innerHTML = `Desde ${Math.min(c.precio, c.sem)} € <small>por noche</small>`;
  });
  document.querySelectorAll("[data-anticipo]").forEach(el => { el.textContent = `${ANTICIPO} €`; });
  document.querySelectorAll("[data-telefono]").forEach(el => { el.textContent = TELEFONO_TXT; });
}

document.addEventListener("DOMContentLoaded", () => {
  prepararPersonas();
  const hoy = fechaLocal(new Date());
  $("ent").min = hoy; $("sal").min = hoy;
  $("ent").addEventListener("change", () => {
    if (!$("ent").value) return;
    const ent = aFecha($("ent").value);
    $("sal").min = fechaLocal(sumarDias(ent, 1));
    if (!$("sal").value || aFecha($("sal").value) <= ent) $("sal").value = fechaLocal(sumarDias(ent, 2));
  });
  $("btnBuscar").addEventListener("click", buscar);
  $("resultados").addEventListener("click", e => {
    const b = e.target.closest("[data-reservar]");
    if (b) elegirCabana(b.getAttribute("data-reservar"));
  });
  $("btnPagar").addEventListener("click", reservar);
  $("btnPagar").textContent = `Pagar ${ANTICIPO} € y reservar`;
  pintarTextos();
  document.querySelectorAll(".js-wa").forEach(a => {
    a.href = "https://wa.me/" + TELEFONO_WA + "?text=" + encodeURIComponent("Hola, quiero información sobre las cabañas.");
  });
  prepararDisponibilidad();
});
