// ================= MAIN.JS - CABAÑAS MIRADOR DE ÉZARO =================
// Motor de reservas: disponibilidad, precios, ofertas y reserva.
// Requiere js/config.js y js/precios.js (cargados antes). Aquí no hay precios.

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
const mmdd = d => String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
const plural = (n, a, b) => n + " " + (n === 1 ? a : b);
const euros = n => Math.round(n) + " €";

// ---------- CARGA DE RESERVAS (JSONBin) ----------
let bloqueadas = null;     // { id: Set de noches ocupadas o bloqueadas }
let cargaFallida = true;
let reintentos = 0;

async function cargarReservasBackend() {
  try {
    let d = null;
    try {   // caché de 5 minutos: menos peticiones a JSONBin
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
      d = data.record || data;
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
    if (reintentos++ < 8) setTimeout(prepararDisponibilidad, 15000);
    return;
  }
  bloqueadas = r;
  cargaFallida = false;
  reintentos = 0;
  $("avisoCarga").style.display = "none";
}

// Una cabaña está libre si ninguna de sus noches [entrada, salida) está ocupada.
function estaLibre(cab, inicio, fin) {
  const set = bloqueadas[cab.id];
  for (let d = new Date(inicio); d < fin; d = sumarDias(d, 1)) {
    if (set.has(fechaLocal(d))) return false;
  }
  return true;
}

// ---------- FECHAS ESPECIALES ----------
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
const mismoDia = (a, b) => a.getDate() === b.getDate() && a.getMonth() === b.getMonth();

function esFestivo(fecha) {
  if (FESTIVOS_FIJOS.includes(mmdd(fecha))) return true;
  const ayer = sumarDias(fecha, -1);
  if (ayer.getDay() === 0 && FESTIVOS_FIJOS.includes(mmdd(ayer))) return true;   // festivo en domingo: cuenta el lunes
  const p = pascua(fecha.getFullYear());
  return [-3, -2].some(k => mismoDia(sumarDias(p, k), fecha));                    // Jueves y Viernes Santo
}
// Precio habitual: viernes, sábado, festivo o víspera de festivo
function esNocheFinde(dia) {
  const dow = dia.getDay();
  return dow === 5 || dow === 6 || esFestivo(dia) || esFestivo(sumarDias(dia, 1));
}
function enTemporadaAlta(d) { const md = mmdd(d); return md >= TEMPORADA_ALTA.desde && md <= TEMPORADA_ALTA.hasta; }
const esNochevieja = d => d.getMonth() === 11 && d.getDate() === 31;
function esSemanaSanta(d) {   // jueves, viernes y sábado santo
  const p = pascua(d.getFullYear());
  return [-3, -2, -1].some(k => mismoDia(sumarDias(p, k), d));
}

// ---------- OCUPACIÓN ----------
// Adultos = 14 años o más. Niños = de 2 a 13 años. Los menores de 2 años no cuentan.
function cabeOcupacion(cab, adultos, ninos) {
  if (adultos < 1) return false;
  if (cab.jacuzzi) return adultos <= 2 && ninos <= cab.max - 2;   // 3.er y 4.º ocupante: niños
  return adultos + ninos <= cab.max;
}

// Suplemento (o descuento) por noche según los ocupantes
function extrasOcupacion(cab, adultos, ninos) {
  const p = PRECIOS[cab.id];
  if (cab.jacuzzi) {
    let e = 0;
    if (ninos >= 1) e += p.nino1;
    if (ninos >= 2) e += p.nino2;
    return e;
  }
  const personas = Math.max(adultos + ninos, 1);
  if (personas <= 3) return SIN_JACUZZI.menos;
  if (personas === 4) return 0;
  if (personas === 5) return SIN_JACUZZI.quinta;
  return SIN_JACUZZI.quinta + SIN_JACUZZI.sexta;
}

// ---------- PRECIOS ----------
function precioDesde(cab) { const p = PRECIOS[cab.id]; return Math.min(p.habitual, p.semana); }

function costeNoche(cab, dia, extras) {
  const p = PRECIOS[cab.id];
  let base;
  if (esNochevieja(dia)) base = p.nochevieja;
  else if (enTemporadaAlta(dia)) base = p.habitual + (cab.jacuzzi ? ALTA_RECARGO_JACUZZI : ALTA_RECARGO_SIN_JACUZZI);
  else base = esNocheFinde(dia) ? p.habitual : p.semana;
  return base + extras;
}

// Lista de noches de la estancia con su coste y sus características
function nochesDe(cab, inicio, fin, adultos, ninos) {
  const extras = extrasOcupacion(cab, adultos, ninos);
  const r = [];
  for (let d = new Date(inicio); d < fin; d = sumarDias(d, 1)) {
    r.push({ fecha: new Date(d), coste: costeNoche(cab, d, extras), extras,
      finde: esNocheFinde(d), dia: d.getDay(), alta: enTemporadaAlta(d), nv: esNochevieja(d), ss: esSemanaSanta(d) });
  }
  return r;
}

const excluida = n => n.ss || n.nv;                       // fuera de todo descuento
const libreDto = n => !n.alta && !n.ss && !n.nv;          // sin temporada alta ni fechas excluidas
const entreSemana = n => libreDto(n) && n.dia <= 4;       // domingo a jueves
const suma = arr => arr.reduce((s, n) => s + n.coste, 0);

// Estancia sin oferta: aplica como mucho UN descuento, el más favorable al cliente
function calcularNormal(cab, noches) {
  const N = noches.length, subtotal = suma(noches);
  const cands = [];
  const baseDto = suma(noches.filter(n => !excluida(n)));
  const entrada = noches[0];

  // 50 % de la noche más barata (2 noches) o una noche gratis (3 o más): solo domingo a jueves
  // (si la estancia empieza en viernes o sábado, se considera de fin de semana y no lleva este descuento)
  if (N >= 2 && !entrada.alta && entrada.dia <= 4 && entreSemana(noches[1]) && (N < 3 || entreSemana(noches[2]))) {
    const min = Math.min(...noches.filter(entreSemana).map(n => n.coste));
    cands.push(N === 2
      ? { nombre: "2.ª noche al 50 %", importe: min * DESCUENTOS.dosNoches / 100 }
      : { nombre: "3x2: una noche gratis", importe: min * DESCUENTOS.nocheGratis / 100 });
  }
  // 25 %: estancia exacta jueves-domingo, o 2 noches de fin de semana (una noche)
  if (!entrada.alta) {
    const libres = noches.filter(libreDto);
    if (N === 3 && entrada.dia === 4 && libres.length)
      cands.push({ nombre: "25 % de descuento jueves a domingo", importe: suma(libres) * DESCUENTOS.juevesADomingo / 100 });
    if (N === 2 && (entrada.dia === 5 || entrada.dia === 6) && libres.length)
      cands.push({ nombre: "25 % de una noche", importe: Math.min(...libres.map(n => n.coste)) * DESCUENTOS.findeUnaNoche / 100 });
  }
  // 10 % (4 noches o más) y 15 % (7 noches o más) sobre el total
  let pct = 0;
  for (const d of DESCUENTOS.porDuracion) if (N >= d.noches) pct = Math.max(pct, d.porcentaje);
  if (pct) cands.push({ nombre: `${pct} % por ${N} noches`, importe: baseDto * pct / 100 });

  const mejor = cands.reduce((a, c) => (!a || c.importe > a.importe ? c : a), null);
  const descuento = mejor ? mejor.importe : 0;
  return { tipo: "normal", noches: N, subtotal: Math.round(subtotal), descuento: Math.round(descuento),
    total: Math.round(subtotal - descuento), detalle: mejor ? [mejor] : [] };
}

// Estancia con una oferta (2 noches con cena). Las noches extra llevan descuento. null si no se puede.
function precioOferta(cab, noches, id, ninos) {
  const o = OFERTAS[id];
  if (!o.cabanas.includes(cab.id) || noches.length < 2) return null;
  if (id === "familiar" && ninos < 1) return null;
  let mejor = null;
  for (let i = 0; i + 1 < noches.length; i++) {
    const a = noches[i], b = noches[i + 1];
    if (!libreDto(a) || !libreDto(b)) continue;                  // sin temporada alta, Nochevieja ni Semana Santa
    let valido;
    if (id === "romantica") valido = a.finde || b.finde;         // alguna noche de fin de semana o festivo
    else if (id === "semana") valido = !a.finde && !b.finde;     // domingo a jueves, sin festivos ni vísperas
    else valido = a.dia === 5 && b.dia === 6;                    // familiar: viernes y sábado
    if (!valido) continue;
    let resto = 0;
    noches.forEach((n, j) => {
      if (j === i || j === i + 1) return;
      resto += libreDto(n) ? n.coste * (100 - DESCUENTOS.nocheExtraOferta) / 100 : n.coste;
    });
    const packNoches = o.precio + (id === "familiar" ? 0 : a.extras + b.extras);   // el familiar ya incluye a los niños
    const total = Math.round(packNoches + resto);
    if (!mejor || total < mejor.total) mejor = { total };
  }
  if (!mejor) return null;
  return { tipo: id, nombre: o.nombre, corto: o.corto, incluye: o.incluye, noches: noches.length,
    subtotal: Math.round(suma(noches)), descuento: 0, total: mejor.total, detalle: [] };
}

const suplementoMascota = noches => (noches >= 5 ? MASCOTA.desde5Noches : MASCOTA.hasta4Noches);
const senal = noches => (noches <= 2 ? ANTICIPO_CORTO : ANTICIPO_LARGO);

// Mínimo de noches: 2 en temporada alta, salvo un día libre entre dos reservas o bloqueos
function minimoOk(cab, inicio, noches) {
  const min = enTemporadaAlta(inicio) ? MIN_NOCHES_ALTA : MIN_NOCHES;
  if (noches >= min) return true;
  if (noches === 1 && enTemporadaAlta(inicio)) {
    const set = bloqueadas[cab.id];
    return set.has(fechaLocal(sumarDias(inicio, -1))) && set.has(fechaLocal(sumarDias(inicio, 1)));
  }
  return false;
}

// ---------- BÚSQUEDA ----------
let busqueda = null, seleccion = null;

function mostrarMensaje(html) { $("resultados").innerHTML = `<p class="vacio">${html}</p>`; }

function filaOferta(id, k, mas) {
  return `<div class="opcion oferta"><div><strong>${euros(k.total + mas)}</strong> <small>⭐ ${k.corto}</small><br><small>${k.incluye}</small></div>
    <button class="btn" type="button" data-oferta="${id}">Reservar</button></div>`;
}

function bloqueUnaNoche() {
  const filas = Object.keys(OFERTAS).map(id => {
    const o = OFERTAS[id];
    return `<li><a href="${o.url}"><strong>${o.nombre}</strong></a> · ${o.precio} € · ${o.incluye}</li>`;
  }).join("");
  const packs = PACKS.map(p => `<li><strong>${p.nombre}</strong> · ${p.precio} € <small>(se paga en destino)</small></li>`).join("");
  return `<section class="upsell"><h3>Con 2 noches te llevas más</h3>
    <p>Reserva 2 noches y aprovecha nuestras ofertas con cena incluida:</p><ul>${filas}</ul>
    <button class="btn" type="button" id="btnDosNoches">Ver con 2 noches</button>
    <p style="margin-top:1rem">Y a cualquier reserva puedes añadir estos packs de decoración y cena:</p><ul>${packs}</ul></section>`;
}

function buscar() {
  $("pasoDatos").style.display = "none";
  seleccion = null;
  if (cargaFallida) { mostrarMensaje("⏳ Todavía estamos cargando la disponibilidad. Espera unos segundos e inténtalo de nuevo."); return; }
  const e = $("ent").value, s = $("sal").value;
  if (!e || !s) { mostrarMensaje("Elige la fecha de entrada y la de salida."); return; }
  const inicio = aFecha(e), fin = aFecha(s);
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  if (inicio < hoy) { mostrarMensaje("La fecha de entrada ya ha pasado."); return; }
  const noches = Math.round((fin - inicio) / 86400000);
  if (noches < 1) { mostrarMensaje("La salida debe ser posterior a la entrada."); return; }

  const adultos = +$("adu").value, ninos = +$("nin").value, mascota = $("mascota").checked;
  const soloJac = $("soloJacuzzi").checked;
  if (mascota && soloJac) { mostrarMensaje("Las mascotas solo se admiten en las cabañas sin jacuzzi. Quita una de las dos opciones."); return; }

  let porMinimo = 0, porOcupacion = 0;
  const libres = CABANAS.filter(c => {
    if (soloJac && !c.jacuzzi) return false;
    if (mascota && c.jacuzzi) return false;
    if (!cabeOcupacion(c, adultos, ninos)) { porOcupacion++; return false; }
    if (!estaLibre(c, inicio, fin)) return false;
    if (!minimoOk(c, inicio, noches)) { porMinimo++; return false; }
    return true;
  });

  const ocup = plural(adultos, "adulto", "adultos") + (ninos ? " + " + plural(ninos, "niño", "niños") : "");
  const cabecera = `<p class="resumen-busqueda">${formato(inicio)} → ${formato(fin)} · ${plural(noches, "noche", "noches")} · ${ocup}${mascota ? " · mascota" : ""}</p>`;
  busqueda = { inicio, fin, adultos, ninos, mascota };

  if (!libres.length) {
    let motivo = "No quedan cabañas libres con esos datos. Prueba otras fechas" + (soloJac ? " o quita el filtro de jacuzzi" : "") + ".";
    if (porMinimo) motivo = "En temporada alta (20 de julio a 31 de agosto) el mínimo es de 2 noches.";
    else if (porOcupacion === CABANAS.length) motivo = "Ninguna cabaña admite esa ocupación. Las cabañas con jacuzzi admiten 2 adultos y hasta 2 niños (de 2 a 13 años); las de 6 personas, hasta 6 en total.";
    $("resultados").innerHTML = cabecera + `<p class="vacio">${motivo} También puedes <a href="https://wa.me/${TELEFONO_WA}" target="_blank" rel="noopener">escribirnos por WhatsApp</a>.</p>` + (noches === 1 ? bloqueUnaNoche() : "");
    return;
  }

  const mas = mascota ? suplementoMascota(noches) : 0;
  const datos = libres.map(c => {
    const noch = nochesDe(c, inicio, fin, adultos, ninos);
    return { c, normal: calcularNormal(c, noch),
      ofertas: Object.keys(OFERTAS).map(id => [id, precioOferta(c, noch, id, ninos)]).filter(x => x[1]) };
  }).sort((a, b) => a.normal.total - b.normal.total);

  $("resultados").innerHTML = cabecera + `<div class="grid">` + datos.map(({ c, normal, ofertas }) => {
    const desc = normal.descuento > 0 ? `<br><small>Incluye −${normal.descuento} € de descuento (${normal.detalle[0].nombre})</small>` : "";
    return `<article class="cabin"><div class="body"><h3>${c.nombre}</h3>
      <div class="tags">${c.tags.map(t => `<span class="tag">${t}</span>`).join("")}</div>
      <p>👥 ${c.cap}</p><p><a class="more" href="cabana-${c.id}.html">Ver cabaña</a></p>
      <div class="opciones"><div class="opcion"><div><strong>${euros(normal.total + mas)}</strong> <small>precio normal</small>${desc}${mas ? `<br><small>Incluye mascota (${mas} €)</small>` : ""}</div>
      <button class="btn" type="button" data-reservar="${c.id}" data-oferta="">Reservar</button></div>
      ${ofertas.map(([id, k]) => filaOferta(id, k, mas).replace('data-oferta=', `data-reservar="${c.id}" data-oferta=`)).join("")}</div></div></article>`;
  }).join("") + `</div>` + (noches === 1 ? bloqueUnaNoche() : "");
  $("resultados").dataset.ent = e;
  $("resultados").dataset.sal = s;
  $("resultados").scrollIntoView({ behavior: "smooth", block: "start" });
}

// ---------- RESERVA ----------
function packElegido() {
  const r = document.querySelector('input[name="pack"]:checked');
  return r && r.value !== "sin" ? PACKS.find(p => p.id === r.value) : null;
}

function pintarResumen() {
  if (!seleccion) return;
  const s = seleccion, pack = packElegido(), extra = pack ? pack.precio : 0;
  s.pack = pack;
  const total = s.calc.total + s.mascota;
  s.totalFinal = total; s.senal = senal(s.calc.noches);
  const ocup = plural(s.adultos, "adulto", "adultos") + (s.ninos ? " + " + plural(s.ninos, "niño", "niños") : "");
  let lineas = `<p><strong>${s.cab.nombre}</strong></p><p>${formato(s.inicio)} → ${formato(s.fin)} · ${plural(s.calc.noches, "noche", "noches")}</p><p>${ocup}</p>`;
  if (s.oferta) lineas += `<p><strong>${s.calc.nombre}</strong><br><small>${s.calc.incluye}</small></p>`;
  else if (s.calc.descuento > 0) lineas += `<p>Estancia: ${s.calc.subtotal} €</p>` + s.calc.detalle.map(d => `<p>${d.nombre}: −${s.calc.descuento} €</p>`).join("");
  if (s.mascota) lineas += `<p>Mascota: ${s.mascota} €</p>`;
  lineas += `<p><strong>Total estancia:</strong> ${total} €</p>`;
  if (pack) lineas += `<p><strong>Pack:</strong> ${pack.nombre} · ${pack.precio} € (se paga en destino)</p>`;
  lineas += `<p><strong>Reserva ahora (señal):</strong> ${s.senal} €</p><p><strong>Resto a pagar en destino:</strong> ${total - s.senal + extra} €</p>`;
  $("resumenReserva").innerHTML = lineas;
  $("btnPagar").textContent = `Pagar ${s.senal} € y reservar`;
}

function pintarPacks() {
  $("packsOpciones").innerHTML =
    `<label class="radio"><input type="radio" name="pack" value="sin" checked> <span>Sin pack</span></label>` +
    PACKS.map(p => `<label class="radio"><input type="radio" name="pack" value="${p.id}"> <span><strong>${p.nombre}</strong> · ${p.precio} €<br><small>${p.incluye.join(" · ")}</small></span></label>`).join("");
  $("packsOpciones").addEventListener("change", pintarResumen);
}

function elegirCabana(id, oferta) {
  const b = busqueda, cab = POR_ID[id];
  const noch = nochesDe(cab, b.inicio, b.fin, b.adultos, b.ninos);
  const calc = oferta ? precioOferta(cab, noch, oferta, b.ninos) : calcularNormal(cab, noch);
  seleccion = { cab, inicio: b.inicio, fin: b.fin, adultos: b.adultos, ninos: b.ninos, calc, oferta: oferta || null,
    mascota: b.mascota ? suplementoMascota(noch.length) : 0, pack: null };
  pintarResumen();
  $("pasoDatos").style.display = "block";
  $("pasoDatos").scrollIntoView({ behavior: "smooth", block: "start" });
}

function reservar() {
  const nombre = $("nombre").value.trim();
  const telefono = $("telefono").value.trim();
  const email = $("email").value.trim();
  if (!seleccion) { alert("Elige primero una cabaña."); return; }
  if (!nombre || !telefono) { alert("Completa tu nombre y teléfono para confirmar la reserva."); return; }
  if (!/\S+@\S+\.\S+/.test(email)) { alert("Introduce un email válido."); return; }
  if (!$("aceptoPrivacidad").checked) { alert("Debes aceptar la política de privacidad y el aviso legal."); return; }
  const s = seleccion;
  const ocup = plural(s.adultos, "adulto", "adultos") + (s.ninos ? " y " + plural(s.ninos, "niño", "niños") : "");
  const of = s.oferta ? ` Oferta: ${s.calc.nombre}.` : "";
  const ma = s.mascota ? ` Con mascota (${s.mascota} €).` : "";
  const pk = s.pack ? ` Pack elegido: ${s.pack.nombre} (${s.pack.precio} €, a pagar en destino).` : "";
  const msg = `Hola, soy ${nombre} (${telefono}). Quiero reservar la ${s.cab.nombre} del ${formato(s.inicio)} al ${formato(s.fin)} para ${ocup}.${of}${ma} Total estancia: ${s.totalFinal} €. Señal: ${s.senal} €.${pk}`;
  alert("El pago online todavía no está activo.\n\nTe abrimos WhatsApp para confirmar la reserva.");
  window.open("https://wa.me/" + TELEFONO_WA + "?text=" + encodeURIComponent(msg), "_blank");
}

// ---------- PÁGINA ----------
function pintarTextos() {
  document.querySelectorAll("[data-precio]").forEach(el => {
    const c = POR_ID[el.getAttribute("data-precio")];
    if (c) el.innerHTML = `Desde ${precioDesde(c)} € <small>por noche</small>`;
  });
  document.querySelectorAll("[data-anticipo-corto]").forEach(el => { el.textContent = `${ANTICIPO_CORTO} €`; });
  document.querySelectorAll("[data-anticipo-largo]").forEach(el => { el.textContent = `${ANTICIPO_LARGO} €`; });
  document.querySelectorAll("[data-telefono]").forEach(el => { el.textContent = TELEFONO_TXT; });
}

function prepararOcupacion() {
  for (let n = 1; n <= 6; n++) $("adu").insertAdjacentHTML("beforeend", `<option value="${n}">${n}</option>`);
  for (let n = 0; n <= 4; n++) $("nin").insertAdjacentHTML("beforeend", `<option value="${n}">${n}</option>`);
  $("adu").value = "2"; $("nin").value = "0";
}

// ---------- CANDADO DE ADMINISTRADOR ----------
// Visible solo en tu móvil: toca 5 veces seguidas el © del pie de página, o abre la web con ?admin al final.
function iniciarCandado() {
  const boton = $("adminButton"), texto = $("secretoAdmin");
  if (!boton) return;
  const mostrar = () => {
    boton.classList.add("visible");
    try { localStorage.setItem("ezaro_admin_visible", "1"); } catch (e) {}
  };
  try {
    if (localStorage.getItem("ezaro_admin_visible") || new URLSearchParams(location.search).has("admin")) mostrar();
  } catch (e) {}
  let toques = 0, t;
  if (texto) texto.addEventListener("click", () => {
    toques++; clearTimeout(t); t = setTimeout(() => { toques = 0; }, 2000);
    if (toques >= 5) { mostrar(); toques = 0; }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  iniciarCandado();
  prepararOcupacion();
  pintarPacks();
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
    if (b) { elegirCabana(b.getAttribute("data-reservar"), b.getAttribute("data-oferta") || ""); return; }
    if (e.target.closest("#btnDosNoches") && busqueda) {
      $("sal").value = fechaLocal(sumarDias(busqueda.inicio, 2));
      buscar();
    }
  });
  $("btnPagar").addEventListener("click", reservar);
  pintarTextos();
  document.querySelectorAll(".js-wa").forEach(a => {
    a.href = "https://wa.me/" + TELEFONO_WA + "?text=" + encodeURIComponent("Hola, quiero información sobre las cabañas.");
  });
  prepararDisponibilidad();
});
