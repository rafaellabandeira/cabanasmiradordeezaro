// Panel de administración: lee y guarda las noches ocupadas en JSONBin (usa config.js)
const $ = id => document.getElementById(id);
const URL_BIN = "https://api.jsonbin.io/v3/b/" + JSONBIN_ID;
let datos = null;

function cabeceras() {
  const h = { "Content-Type": "application/json" };
  h[$("tipo").value === "master" ? "X-Master-Key" : "X-Access-Key"] = $("clave").value.trim();
  return h;
}
function msg(t, ok) { $("msg").textContent = t; $("msg").className = ok ? "ok" : "err"; }
const aFecha = iso => { const p = iso.split("-"); return new Date(+p[0], +p[1] - 1, +p[2]); };
const aIso = d => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
const mas = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const fmt = iso => aFecha(iso).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });

function noches(e, s) {
  const r = [];
  for (let d = aFecha(e); d < aFecha(s); d = mas(d, 1)) r.push(aIso(d));
  return r;
}

async function cargar() {
  if (!$("clave").value.trim()) { msg("Pega tu clave de JSONBin.", false); return; }
  try {
    const res = await fetch(URL_BIN + "/latest", { headers: cabeceras() });
    if (res.status === 401 || res.status === 403) { msg("Clave no válida o sin permisos.", false); return; }
    if (!res.ok) throw new Error(res.status);
    const j = await res.json();
    datos = j.record || j;
    for (const c of CABANAS) if (!Array.isArray(datos[c.id])) datos[c.id] = [];
    try { localStorage.setItem("ezaro_bin_key", $("clave").value.trim()); localStorage.setItem("ezaro_bin_tipo", $("tipo").value); } catch (e) {}
    $("editor").style.display = "block";
    msg("Reservas cargadas.", true);
    pintar();
  } catch (e) { console.error(e); msg("No se pudieron cargar las reservas. Revisa el ID del bin en config.js.", false); }
}

async function guardar(texto) {
  try {
    const res = await fetch(URL_BIN, { method: "PUT", headers: cabeceras(), body: JSON.stringify(datos) });
    if (!res.ok) throw new Error(res.status);
    try { sessionStorage.removeItem("ezaro_reservas"); } catch (e) {}
    msg(texto, true);
  } catch (e) { console.error(e); msg("No se pudo guardar. Inténtalo de nuevo.", false); }
  pintar();
}

function pintar() {
  const id = $("cab").value;
  const f = Array.from(new Set(datos[id])).sort();
  const rangos = [];
  for (const d of f) {
    const u = rangos[rangos.length - 1];
    if (u && aIso(mas(aFecha(u.fin), 1)) === d) u.fin = d; else rangos.push({ ini: d, fin: d });
  }
  $("lista").innerHTML = rangos.length ? rangos.map((r, i) => {
    const n = noches(r.ini, aIso(mas(aFecha(r.fin), 1))).length;
    return `<div class="rango"><span>${fmt(r.ini)} → ${fmt(aIso(mas(aFecha(r.fin), 1)))} · ${n} ${n === 1 ? "noche" : "noches"}</span><button type="button" data-i="${i}">Liberar</button></div>`;
  }).join("") : "<p>No hay noches bloqueadas.</p>";
  $("lista").dataset.r = JSON.stringify(rangos);
}

function cambiar(accion) {
  const e = $("ent").value, s = $("sal").value;
  if (!e || !s || aFecha(s) <= aFecha(e)) { msg("Elige una entrada y una salida posterior.", false); return; }
  const id = $("cab").value, n = noches(e, s), set = new Set(datos[id]);
  n.forEach(x => accion === "bloq" ? set.add(x) : set.delete(x));
  datos[id] = Array.from(set).sort();
  guardar(accion === "bloq" ? "Noches bloqueadas." : "Noches liberadas.");
}

document.addEventListener("DOMContentLoaded", () => {
  CABANAS.forEach(c => $("cab").insertAdjacentHTML("beforeend", `<option value="${c.id}">${c.nombre}</option>`));
  try { $("clave").value = localStorage.getItem("ezaro_bin_key") || ""; $("tipo").value = localStorage.getItem("ezaro_bin_tipo") || "master"; } catch (e) {}
  $("btnCargar").addEventListener("click", cargar);
  $("cab").addEventListener("change", pintar);
  $("btnBloq").addEventListener("click", () => cambiar("bloq"));
  $("btnDesb").addEventListener("click", () => cambiar("desb"));
  $("lista").addEventListener("click", e => {
    const b = e.target.closest("[data-i]"); if (!b) return;
    const r = JSON.parse($("lista").dataset.r)[+b.dataset.i];
    const quitar = new Set(noches(r.ini, aIso(mas(aFecha(r.fin), 1))));
    const id = $("cab").value;
    datos[id] = datos[id].filter(x => !quitar.has(x));
    guardar("Noches liberadas.");
  });
  $("btnLimpiar").addEventListener("click", () => {
    const hoy = aIso(new Date());
    for (const c of CABANAS) datos[c.id] = datos[c.id].filter(x => x >= hoy);
    guardar("Fechas pasadas borradas.");
  });
  $("ent").addEventListener("change", () => { if ($("ent").value && !$("sal").value) $("sal").value = aIso(mas(aFecha($("ent").value), 1)); });
  if ($("clave").value) cargar();
});

