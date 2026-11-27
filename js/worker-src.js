
// ======================================================================
//  SERVIDOR DE RESERVAS · Cabañas Mirador de Ézaro (Cloudflare Worker)
//  Cobra la señal con Stripe, bloquea las noches en JSONBin, devuelve la
//  señal al cancelar y envía los correos con Resend.
//  Usa los mismos precios y reglas que la web (config.js + precios.js).
// ======================================================================

const DIAS_CANCELACION_GRATIS = 15;   // devolución automática hasta 15 días antes de la entrada
const NOMBRE_NEGOCIO = "Cabañas Mirador de Ézaro";
const DIRECCION_NEGOCIO = "O Fieiro, 15256 Mazaricos (A Coruña)";

// ---------- utilidades del servidor ----------
const respuesta = (datos, estado, cab) => new Response(JSON.stringify(datos), {
  status: estado || 200, headers: Object.assign({ "Content-Type": "application/json; charset=utf-8" }, cab || {}) });
const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const hoyMadrid = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" });
const fechaLarga = iso => aFecha(iso).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
const dinero = n => (Math.round(n * 100) / 100).toString().replace(".", ",") + " €";

function aleatorio(n, alfabeto) {
  const a = new Uint8Array(n); crypto.getRandomValues(a);
  return Array.from(a, x => alfabeto[x % alfabeto.length]).join("");
}
const nuevoCodigo = () => "EZ-" + aleatorio(5, "ABCDEFGHJKMNPQRSTUVWXYZ23456789");
const nuevoToken = () => aleatorio(24, "abcdefghjkmnpqrstuvwxyz23456789");
function iguales(a, b) {   // comparación en tiempo constante
  a = String(a || ""); b = String(b || "");
  if (a.length !== b.length) return false;
  let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
function cabeceras(request, env) {
  const origen = request.headers.get("Origin") || "";
  const ok = (env.ALLOWED_ORIGINS || "").split(",").map(s => s.trim()).filter(Boolean).includes(origen);
  return ok ? { "Access-Control-Allow-Origin": origen, "Vary": "Origin",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, X-Admin-Password" }
    : { "Vary": "Origin" };
}
function origenOk(request, env) {
  const origen = request.headers.get("Origin");
  if (!origen) return true;
  return (env.ALLOWED_ORIGINS || "").split(",").map(s => s.trim()).filter(Boolean).includes(origen);
}

// ---------- Stripe ----------
function formEnc(obj, pre) {
  const out = [];
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const clave = pre ? `${pre}[${k}]` : k;
    if (typeof v === "object") out.push(...formEnc(v, clave));
    else out.push(encodeURIComponent(clave) + "=" + encodeURIComponent(v));
  }
  return out;
}
async function stripe(env, metodo, ruta, params, idem) {
  const init = { method: metodo, headers: { "Authorization": "Bearer " + env.STRIPE_KEY } };
  if (idem) init.headers["Idempotency-Key"] = idem;
  if (metodo === "POST") { init.headers["Content-Type"] = "application/x-www-form-urlencoded"; init.body = formEnc(params || {}).join("&"); }
  const r = await fetch("https://api.stripe.com/v1/" + ruta, init);
  const d = await r.json();
  if (!r.ok) throw new Error("Stripe: " + ((d.error && d.error.message) || r.status));
  return d;
}
async function firmaValida(raw, cabecera, secreto) {
  if (!cabecera || !secreto) return false;
  const partes = cabecera.split(",").map(p => p.split("="));
  const t = (partes.find(p => p[0] === "t") || [])[1];
  const v1 = partes.filter(p => p[0] === "v1").map(p => p[1]);
  if (!t || !v1.length || Math.abs(Date.now() / 1000 - Number(t)) > 300) return false;
  const enc = new TextEncoder();
  const clave = await crypto.subtle.importKey("raw", enc.encode(secreto), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const firma = await crypto.subtle.sign("HMAC", clave, enc.encode(t + "." + raw));
  const hex = Array.from(new Uint8Array(firma), b => b.toString(16).padStart(2, "0")).join("");
  return v1.some(v => iguales(v, hex));
}
const enlaceStripe = (env, pi) => `https://dashboard.stripe.com/${String(env.STRIPE_KEY || "").includes("_test_") ? "test/" : ""}payments/${pi}`;

// ---------- JSONBin (noches ocupadas) ----------
const binId = env => env.JSONBIN_ID || JSONBIN_ID;
async function binLeer(env) {
  const r = await fetch(`https://api.jsonbin.io/v3/b/${binId(env)}/latest`, { headers: { "X-Master-Key": env.JSONBIN_KEY } });
  if (!r.ok) throw new Error("JSONBin " + r.status);
  const j = await r.json(); return j.record || j;
}
async function binGuardar(env, datos) {
  const r = await fetch(`https://api.jsonbin.io/v3/b/${binId(env)}`, { method: "PUT",
    headers: { "Content-Type": "application/json", "X-Master-Key": env.JSONBIN_KEY }, body: JSON.stringify(datos) });
  if (!r.ok) throw new Error("JSONBin guardar " + r.status);
}
async function binCambiar(env, cabId, noches, bloquear) {
  for (let i = 0; i < 3; i++) {
    const d = await binLeer(env);
    const set = new Set((d[cabId] || []).map(x => String(x).slice(0, 10)));
    noches.forEach(n => bloquear ? set.add(n) : set.delete(n));
    d[cabId] = Array.from(set).sort();
    await binGuardar(env, d);
    const v = await binLeer(env);
    if (noches.every(n => (v[cabId] || []).includes(n) === bloquear)) return;
  }
  throw new Error("No se pudo actualizar la disponibilidad");
}
const ocupadasDe = (d, cabId) => new Set((d[cabId] || []).map(x => String(x).slice(0, 10)).concat(d["bloqueados_" + cabId] || []));
function nochesISO(entrada, salida) {
  const r = [];
  for (let d = aFecha(entrada); d < aFecha(salida); d = sumarDias(d, 1)) r.push(fechaLocal(d));
  return r;
}

// ---------- KV: reservas y bloqueos provisionales ----------
const guardarReserva = (env, b, caduca) => env.RESERVAS.put("res:" + b.codigo, JSON.stringify(b), caduca ? { expirationTtl: 172800 } : undefined);
async function leerReserva(env, codigo) {
  if (!codigo) return null;
  const t = await env.RESERVAS.get("res:" + String(codigo).toUpperCase());
  return t ? JSON.parse(t) : null;
}
async function nochesProvisionales(env, b) {
  const libres = [];
  for (const n of nochesISO(b.entrada, b.salida)) {
    const v = await env.RESERVAS.get(`hold:${b.cabana}:${n}`);
    if (v && v !== b.codigo) return false;
  }
  return true;
}
async function tomarHolds(env, b) { for (const n of nochesISO(b.entrada, b.salida)) await env.RESERVAS.put(`hold:${b.cabana}:${n}`, b.codigo, { expirationTtl: 2100 }); }
async function liberarHolds(env, b) { for (const n of nochesISO(b.entrada, b.salida)) { const v = await env.RESERVAS.get(`hold:${b.cabana}:${n}`); if (v === b.codigo) await env.RESERVAS.delete(`hold:${b.cabana}:${n}`); } }

// ---------- cálculo de la reserva (mismas reglas que la web) ----------
function minimoOkServidor(cab, inicio, noches, ocupadas) {
  const min = enTemporadaAlta(inicio) ? MIN_NOCHES_ALTA : MIN_NOCHES;
  if (noches >= min) return true;
  return noches === 1 && enTemporadaAlta(inicio) &&
    ocupadas.has(fechaLocal(sumarDias(inicio, -1))) && ocupadas.has(fechaLocal(sumarDias(inicio, 1)));
}
function prepararReserva(inp, datosBin) {
  const cab = POR_ID_SERVIDOR[inp.cabana];
  if (!cab) return { error: "Cabaña no válida" };
  const iso = /^\d{4}-\d{2}-\d{2}$/;
  if (!iso.test(inp.entrada) || !iso.test(inp.salida)) return { error: "Fechas no válidas" };
  const inicio = aFecha(inp.entrada), fin = aFecha(inp.salida);
  const noches = Math.round((fin - inicio) / 86400000);
  if (!(noches >= 1 && noches <= 30)) return { error: "La estancia debe ser de 1 a 30 noches" };
  if (inp.entrada < hoyMadrid()) return { error: "La fecha de entrada ya ha pasado" };
  const adultos = Number(inp.adultos), ninos = Number(inp.ninos || 0);
  if (!Number.isInteger(adultos) || !Number.isInteger(ninos) || adultos < 1 || ninos < 0 || ninos > 4) return { error: "Ocupación no válida" };
  if (!cabeOcupacion(cab, adultos, ninos)) return { error: "Esa cabaña no admite esa ocupación" };
  const mascota = inp.mascota === true;
  if (mascota && cab.jacuzzi) return { error: "Las mascotas solo se admiten en las cabañas sin jacuzzi" };
  const ocupadas = ocupadasDe(datosBin, cab.id);
  if (nochesISO(inp.entrada, inp.salida).some(n => ocupadas.has(n))) return { error: "Esas fechas ya no están disponibles", agotada: true };
  if (!minimoOkServidor(cab, inicio, noches, ocupadas)) return { error: "En temporada alta el mínimo es de 2 noches" };
  const lista = nochesDe(cab, inicio, fin, adultos, ninos);
  let calc, ofertaId = "";
  if (inp.oferta) {
    if (!OFERTAS[inp.oferta]) return { error: "Oferta no válida" };
    calc = precioOferta(cab, lista, inp.oferta, ninos);
    if (!calc) return { error: "Esa oferta no está disponible para esas fechas o cabaña" };
    ofertaId = inp.oferta;
  } else calc = calcularNormal(cab, lista);
  let pack = null;
  if (inp.pack) { pack = PACKS.find(p => p.id === inp.pack); if (!pack) return { error: "Pack no válido" }; }
  const masc = mascota ? suplementoMascota(noches) : 0;
  const totalEstancia = calc.total + masc;
  const senalImp = senal(noches);
  const packImp = pack ? pack.precio : 0;
  const resto = totalEstancia + packImp - senalImp;
  return { b: {
    cabana: cab.id, cabanaNombre: cab.nombre, entrada: inp.entrada, salida: inp.salida, noches, adultos, ninos,
    mascota: masc, ofertaId, ofertaNombre: ofertaId ? calc.nombre : "", ofertaIncluye: ofertaId ? calc.incluye : "",
    packId: pack ? pack.id : "", packNombre: pack ? pack.nombre : "", packPrecio: packImp,
    subtotal: calc.subtotal, descuento: calc.descuento, descuentoNombre: calc.detalle && calc.detalle[0] ? calc.detalle[0].nombre : "",
    totalEstancia, senal: senalImp, resto,
    limiteCancelacion: fechaLocal(sumarDias(inicio, -DIAS_CANCELACION_GRATIS)) } };
}

// ---------- correos (Resend) ----------
async function enviarCorreo(env, para, asunto, html) {
  try {
    const r = await fetch("https://api.resend.com/emails", { method: "POST",
      headers: { "Authorization": "Bearer " + env.RESEND_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ from: `${NOMBRE_NEGOCIO} <${env.FROM_EMAIL}>`, to: [para], reply_to: env.OWNER_EMAIL, subject: asunto, html }) });
    return r.ok;
  } catch (e) { return false; }
}
function tabla(filas) {
  return `<table style="width:100%;border-collapse:collapse;margin:6px 0 14px">` + filas.filter(Boolean).map(f =>
    `<tr><td style="padding:6px 8px;border-bottom:1px solid #e6e6e6;color:#5d706a;width:42%;vertical-align:top">${f[0]}</td>` +
    `<td style="padding:6px 8px;border-bottom:1px solid #e6e6e6;${f[2] || ""}">${f[1]}</td></tr>`).join("") + `</table>`;
}
const titulillo = t => `<h3 style="font-family:Georgia,serif;color:#17404a;margin:16px 0 2px;font-size:16px;text-transform:uppercase;letter-spacing:.04em">${t}</h3>`;
function plantilla(titulo, cuerpo) {
  return `<div style="background:#f4f1ea;padding:18px 10px;font-family:Arial,Helvetica,sans-serif;color:#1a2e2b;font-size:15px;line-height:1.5">` +
    `<div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e2ddd0">` +
    `<div style="background:#17404a;color:#fff;padding:16px 20px;font-family:Georgia,serif;font-size:20px">${NOMBRE_NEGOCIO}</div>` +
    `<div style="padding:18px 20px"><h2 style="font-family:Georgia,serif;color:#17404a;margin:0 0 10px;font-size:22px">${titulo}</h2>${cuerpo}</div>` +
    `<div style="background:#f4f1ea;color:#5d706a;font-size:13px;padding:12px 20px">${NOMBRE_NEGOCIO} · ${DIRECCION_NEGOCIO} · ${TELEFONO_TXT}</div></div></div>`;
}
function bloqueReserva(b) {
  const ocup = plural(b.adultos, "adulto", "adultos") + (b.ninos ? " y " + plural(b.ninos, "niño", "niños") : "");
  return titulillo("Reserva") + tabla([
    ["Código", `<strong>${esc(b.codigo)}</strong>`], ["Cabaña", esc(b.cabanaNombre.replace(/^Cabaña /, "")) ],
    ["Entrada", `${fechaLarga(b.entrada)}, desde las 16:00`], ["Salida", `${fechaLarga(b.salida)}, antes de las 12:00 (${plural(b.noches, "noche", "noches")})`],
    ["Ocupación", ocup],
    b.ofertaNombre ? ["Oferta", `${esc(b.ofertaNombre)}<br><span style="color:#5d706a;font-size:13px">${esc(b.ofertaIncluye)}</span>`] : null,
    b.descuento > 0 && !b.ofertaNombre ? ["Descuento", `${esc(b.descuentoNombre)}: −${dinero(b.descuento)}`] : null,
    b.packNombre ? ["Pack", `${esc(b.packNombre)} (${dinero(b.packPrecio)}, se paga en destino)`] : null,
    b.mascota ? ["Mascota", dinero(b.mascota)] : null ]);
}
function bloquePago(b, pagado) {
  const filas = [["Total de la estancia", dinero(b.totalEstancia)]];
  if (b.packNombre) filas.push(["Pack (se paga en destino)", dinero(b.packPrecio)]);
  filas.push(["Señal pagada ahora", `<strong>${dinero(pagado == null ? b.senal : pagado)}</strong>`]);
  filas.push(["Pendiente de pagar en destino", `<strong style="color:#c62828;font-size:17px">${dinero(b.resto)}</strong>`]);
  return titulillo("Pago") + tabla(filas);
}
const bloqueCliente = b => titulillo("Datos del cliente") + tabla([["Nombre", esc(b.cliente.nombre)], ["Teléfono", esc(b.cliente.telefono)], ["Email", esc(b.cliente.email)]]);
function botonCancelar(b, base) {
  return `<p style="margin:10px 0"><a href="${esc(base)}/cancelar.html?c=${encodeURIComponent(b.codigo)}&t=${encodeURIComponent(b.token)}" style="display:inline-block;background:#e07b00;color:#2b1600;text-decoration:none;font-weight:bold;padding:12px 20px;border-radius:8px">Cancelar mi reserva</a></p>`;
}
const limiteTexto = b => fechaLarga(b.limiteCancelacion);
const textoCancelacion = b => `Puedes cancelar gratis hasta el <strong>${limiteTexto(b)}</strong> y te devolvemos la señal automáticamente. Después de esa fecha no hay devolución.`;

const correos = {
  reservaCliente: (b, base) => ({ asunto: `Reserva confirmada · ${b.cabanaNombre} · ${b.entrada} · Código ${b.codigo}`,
    html: plantilla("Reserva confirmada", `<p>Hola, ${esc(b.cliente.nombre)}:</p><p>Tu reserva en ${NOMBRE_NEGOCIO} está confirmada. Gracias por elegirnos.</p>` +
      bloqueReserva(b) + bloquePago(b) + bloqueCliente(b) + titulillo("Cancelación") + `<p>${textoCancelacion(b)}</p>` + botonCancelar(b, base) +
      titulillo("Cómo llegar") + `<p>${DIRECCION_NEGOCIO} · ${TELEFONO_TXT}</p>`) }),
  reservaPropietario: (b, env) => ({ asunto: `Nueva reserva · ${b.cabanaNombre} · ${b.entrada} · ${b.cliente.nombre}`,
    html: plantilla("Nueva reserva", `<p>Se ha confirmado una reserva y las noches se han bloqueado automáticamente.</p>` + bloqueCliente(b) + bloqueReserva(b) + bloquePago(b) +
      titulillo("Cobro en Stripe") + `<p><a href="${enlaceStripe(env, b.stripe.paymentIntent)}">Ver el cobro en Stripe</a></p>`) }),
  cancelacionCliente: (b, reembolso) => ({ asunto: `Reserva cancelada · Código ${b.codigo}`,
    html: plantilla("Reserva cancelada", `<p>Hola, ${esc(b.cliente.nombre)}:</p><p>Hemos cancelado tu reserva de la ${esc(b.cabanaNombre)} del ${fechaLarga(b.entrada)} al ${fechaLarga(b.salida)}.</p>` +
      titulillo("Devolución") + (reembolso > 0 ? `<p><strong>${dinero(reembolso)}</strong> a tu tarjeta. Llegará en unos días laborables, según tu banco.</p>`
        : `<p>Según las condiciones, no corresponde devolución de la señal.</p>`) + bloqueReserva(b) + `<p>Esperamos recibirte en otra ocasión.</p>`) }),
  cancelacionPropietario: (b, reembolso, quien) => ({ asunto: `Reserva cancelada · ${b.cabanaNombre} · ${b.entrada} · ${b.cliente.nombre}`,
    html: plantilla("Reserva cancelada", `<p>Cancelada ${quien}. Las noches han quedado libres.</p>` + bloqueCliente(b) + bloqueReserva(b) + bloquePago(b, b.senal) +
      titulillo("Devolución") + `<p>${reembolso > 0 ? "Importe devuelto: <strong>" + dinero(reembolso) + "</strong>" : "No corresponde devolución."}</p>` +
      titulillo("Noches liberadas") + `<p>${esc(b.cabanaNombre)}: ${nochesISO(b.entrada, b.salida).join(", ")}</p>`) }),
  conflictoCliente: b => ({ asunto: `No hemos podido confirmar tu reserva · ${b.codigo}`,
    html: plantilla("No hemos podido confirmar tu reserva", `<p>Hola, ${esc(b.cliente.nombre)}:</p><p>Lo sentimos: justo mientras pagabas, esas fechas fueron reservadas por otra persona. Te hemos devuelto automáticamente la señal de <strong>${dinero(b.senal)}</strong>.</p><p>Puedes elegir otras fechas en nuestra web o escribirnos al ${TELEFONO_TXT}.</p>`) }),
  conflictoPropietario: b => ({ asunto: `Conflicto de reserva devuelto · ${b.cabanaNombre} · ${b.entrada}`,
    html: plantilla("Conflicto de reserva", `<p>Dos clientes pagaron las mismas fechas. A este se le ha devuelto la señal automáticamente.</p>` + bloqueCliente(b) + bloqueReserva(b)) }),
};

// ---------- operaciones ----------
async function confirmarReserva(env, sesion) {
  const b = await leerReserva(env, sesion.metadata && sesion.metadata.codigo);
  if (!b || b.estado !== "pendiente") return;          // ya procesada o desconocida
  b.stripe = { sesion: sesion.id, paymentIntent: sesion.payment_intent, pagado: (sesion.amount_total || 0) / 100 };
  const datos = await binLeer(env);
  const noches = nochesISO(b.entrada, b.salida);
  const ocupadas = ocupadasDe(datos, b.cabana);
  if (noches.some(n => ocupadas.has(n))) {              // alguien se adelantó: devolvemos
    await stripe(env, "POST", "refunds", { payment_intent: b.stripe.paymentIntent, metadata: { codigo: b.codigo } }, "refund-" + b.codigo);
    b.estado = "conflicto"; b.cancelacion = { fecha: new Date().toISOString(), reembolso: b.senal, motivo: "conflicto" };
    await guardarReserva(env, b, false); await liberarHolds(env, b);
    const c1 = correos.conflictoCliente(b), c2 = correos.conflictoPropietario(b);
    await Promise.allSettled([enviarCorreo(env, b.cliente.email, c1.asunto, c1.html), enviarCorreo(env, env.OWNER_EMAIL, c2.asunto, c2.html)]);
    return;
  }
  await binCambiar(env, b.cabana, noches, true);
  b.estado = "confirmada"; b.confirmada = new Date().toISOString();
  await guardarReserva(env, b, false); await liberarHolds(env, b);
  const c1 = correos.reservaCliente(b, b.base), c2 = correos.reservaPropietario(b, env);
  const [r1, r2] = await Promise.all([enviarCorreo(env, b.cliente.email, c1.asunto, c1.html), enviarCorreo(env, env.OWNER_EMAIL, c2.asunto, c2.html)]);
  b.correos = { cliente: r1, propietario: r2 }; await guardarReserva(env, b, false);
}

function condicionesCancelacion(b) {
  const reembolsable = hoyMadrid() <= b.limiteCancelacion;
  return { reembolsable, importe: reembolsable ? b.senal : 0, limite: b.limiteCancelacion };
}
async function cancelarReserva(env, b, reembolsar, quien) {
  if (b.estado !== "confirmada") throw new Error("Esta reserva no se puede cancelar");
  let importe = 0;
  if (reembolsar && b.stripe && b.stripe.paymentIntent) {
    await stripe(env, "POST", "refunds", { payment_intent: b.stripe.paymentIntent, metadata: { codigo: b.codigo } }, "refund-" + b.codigo);
    importe = b.senal;
  }
  await binCambiar(env, b.cabana, nochesISO(b.entrada, b.salida), false);
  b.estado = "cancelada"; b.cancelacion = { fecha: new Date().toISOString(), reembolso: importe, quien };
  await guardarReserva(env, b, false);
  const c1 = correos.cancelacionCliente(b, importe), c2 = correos.cancelacionPropietario(b, importe, quien);
  await Promise.allSettled([enviarCorreo(env, b.cliente.email, c1.asunto, c1.html), enviarCorreo(env, env.OWNER_EMAIL, c2.asunto, c2.html)]);
  return importe;
}

const resumenPublico = b => ({ codigo: b.codigo, estado: b.estado, cabana: b.cabanaNombre, entrada: b.entrada, salida: b.salida, noches: b.noches,
  adultos: b.adultos, ninos: b.ninos, oferta: b.ofertaNombre, pack: b.packNombre, packPrecio: b.packPrecio, mascota: b.mascota,
  totalEstancia: b.totalEstancia, senal: b.senal, resto: b.resto, nombre: b.cliente.nombre, limiteCancelacion: b.limiteCancelacion,
  cancelacion: b.cancelacion || null, condiciones: condicionesCancelacion(b) });

// ---------- rutas ----------
async function crearReserva(request, env, cab) {
  const inp = await request.json();
  const email = String(inp.email || "").trim(), nombre = String(inp.nombre || "").trim(), telefono = String(inp.telefono || "").trim();
  if (nombre.length < 2 || nombre.length > 80 || telefono.length < 6 || telefono.length > 30 || !/^\S+@\S+\.\S+$/.test(email) || email.length > 120)
    return respuesta({ error: "Revisa tu nombre, teléfono y email" }, 400, cab);
  if (inp.acepto !== true) return respuesta({ error: "Debes aceptar las condiciones de reserva" }, 400, cab);
  const bases = (env.SITE_URLS || "").split(",").map(s => s.trim().replace(/\/+$/, "")).filter(Boolean);
  const base = String(inp.base || "").replace(/\/+$/, "");
  if (!bases.some(x => base === x)) return respuesta({ error: "Origen no permitido" }, 403, cab);

  const datos = await binLeer(env);
  const r = prepararReserva(inp, datos);
  if (r.error) return respuesta({ error: r.error }, r.agotada ? 409 : 400, cab);
  const b = r.b;
  if (Number(inp.totalEsperado) !== b.totalEstancia + (b.packPrecio ? 0 : 0))
    return respuesta({ error: `El precio ha cambiado: el total es ${dinero(b.totalEstancia)}. Vuelve a buscar.`, total: b.totalEstancia }, 409, cab);
  b.codigo = nuevoCodigo(); b.token = nuevoToken(); b.estado = "pendiente"; b.creada = new Date().toISOString(); b.base = base;
  b.cliente = { nombre, telefono, email };
  if (!(await nochesProvisionales(env, b))) return respuesta({ error: "Esas fechas se están reservando ahora mismo. Prueba en unos minutos.", agotada: true }, 409, cab);
  await tomarHolds(env, b);

  const sesion = await stripe(env, "POST", "checkout/sessions", {
    mode: "payment", locale: "es", customer_email: email, client_reference_id: b.codigo,
    success_url: `${base}/reserva-ok.html?c=${b.codigo}&t=${b.token}`, cancel_url: `${base}/index.html?pago=cancelado`,
    expires_at: Math.floor(Date.now() / 1000) + 31 * 60,
    line_items: { 0: { quantity: 1, price_data: { currency: "eur", unit_amount: Math.round(b.senal * 100),
      product_data: { name: `Señal de reserva · ${b.cabanaNombre} · ${b.entrada} al ${b.salida}`,
        description: `Código ${b.codigo}. Resto a pagar en destino: ${dinero(b.resto)}` } } } },
    metadata: { codigo: b.codigo }, payment_intent_data: { description: `Reserva ${b.codigo} · ${b.cabanaNombre} · ${b.entrada}`, metadata: { codigo: b.codigo } } });
  b.stripe = { sesion: sesion.id };
  await guardarReserva(env, b, true);
  return respuesta({ url: sesion.url, codigo: b.codigo }, 200, cab);
}

async function webhook(request, env) {
  const raw = await request.text();
  if (!(await firmaValida(raw, request.headers.get("Stripe-Signature"), env.STRIPE_WEBHOOK_SECRET))) return new Response("firma no válida", { status: 400 });
  const ev = JSON.parse(raw), obj = ev.data && ev.data.object;
  try {
    if (ev.type === "checkout.session.completed" && obj.payment_status === "paid") await confirmarReserva(env, obj);
    else if (ev.type === "checkout.session.expired") {
      const b = await leerReserva(env, obj.metadata && obj.metadata.codigo);
      if (b && b.estado === "pendiente") { b.estado = "expirada"; await guardarReserva(env, b, true); await liberarHolds(env, b); }
    }
  } catch (e) { console.error("webhook", e.message); return new Response("error", { status: 500 }); }
  return new Response("ok", { status: 200 });
}

async function adminOk(request, env) { return iguales(request.headers.get("X-Admin-Password"), env.ADMIN_PASSWORD) && !!env.ADMIN_PASSWORD; }

const POR_ID_SERVIDOR = Object.fromEntries(CABANAS.map(c => [c.id, c]));

export default {
  async fetch(request, env) {
    const url = new URL(request.url), cab = cabeceras(request, env);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cab });
    const ruta = url.pathname.replace(/\/+$/, "") || "/";
    try {
      if (ruta === "/") return respuesta({ ok: true, servicio: NOMBRE_NEGOCIO }, 200, cab);
      if (ruta === "/api/stripe-webhook" && request.method === "POST") return await webhook(request, env);
      if (!origenOk(request, env)) return respuesta({ error: "Origen no permitido" }, 403, cab);

      if (ruta === "/api/crear" && request.method === "POST") return await crearReserva(request, env, cab);

      if (ruta === "/api/reserva" && request.method === "GET") {
        const b = await leerReserva(env, url.searchParams.get("c"));
        if (!b || !iguales(b.token, url.searchParams.get("t"))) return respuesta({ error: "Reserva no encontrada" }, 404, cab);
        return respuesta(resumenPublico(b), 200, cab);
      }
      if (ruta === "/api/cancelar" && request.method === "POST") {
        const d = await request.json();
        const b = await leerReserva(env, d.c);
        if (!b || !iguales(b.token, d.t)) return respuesta({ error: "Reserva no encontrada" }, 404, cab);
        if (b.estado !== "confirmada") return respuesta({ error: "Esta reserva ya no se puede cancelar", estado: b.estado }, 409, cab);
        const cond = condicionesCancelacion(b);
        if (!d.confirmar) return respuesta({ vistaPrevia: true, ...cond, reserva: resumenPublico(b) }, 200, cab);
        const importe = await cancelarReserva(env, b, cond.reembolsable, "por el cliente");
        return respuesta({ cancelada: true, reembolso: importe }, 200, cab);
      }
      if (ruta === "/api/admin/reservas" && request.method === "GET") {
        if (!(await adminOk(request, env))) return respuesta({ error: "No autorizado" }, 401, cab);
        const lista = await env.RESERVAS.list({ prefix: "res:", limit: 1000 });
        const todas = (await Promise.all(lista.keys.map(k => env.RESERVAS.get(k.name)))).filter(Boolean).map(t => JSON.parse(t));
        todas.forEach(x => { delete x.token; });
        todas.sort((a, b) => String(b.creada).localeCompare(String(a.creada)));
        return respuesta({ reservas: todas }, 200, cab);
      }
      if (ruta === "/api/admin/cancelar" && request.method === "POST") {
        if (!(await adminOk(request, env))) return respuesta({ error: "No autorizado" }, 401, cab);
        const d = await request.json();
        const b = await leerReserva(env, d.c);
        if (!b) return respuesta({ error: "Reserva no encontrada" }, 404, cab);
        if (b.estado !== "confirmada") return respuesta({ error: "Esta reserva ya no se puede cancelar" }, 409, cab);
        const importe = await cancelarReserva(env, b, d.reembolsar === true, "por el propietario");
        return respuesta({ cancelada: true, reembolso: importe }, 200, cab);
      }
      return respuesta({ error: "No existe" }, 404, cab);
    } catch (e) {
      console.error(ruta, e.message);
      return respuesta({ error: "Error del servidor. Inténtalo de nuevo o escríbenos por WhatsApp." }, 500, cab);
    }
  },
};
