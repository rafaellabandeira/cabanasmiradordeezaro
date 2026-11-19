
// ================= CONFIG.JS - CABAÑAS DO ÉZARO =================
// Aquí se cambian precios, anticipo, teléfono y datos de las cabañas.
// Se carga antes que main.js.

// ---------- CONFIGURACIÓN ----------
const BACKEND_URL = "https://TU-SERVIDOR.onrender.com/reservas"; // TODO: servidor de Ézaro
const TELEFONO_WA = "34620419157";   // TODO: teléfono real (para los enlaces de WhatsApp)
const TELEFONO_TXT = "620419157";  // cómo se muestra en la web
const ANTICIPO = 100;                // importe que se paga ahora
const MIN_NOCHES = 1;                // TODO: confirmar mínimo de noches
const RECARGO_TEMP_ALTA = 0.10;      // +10 % del 15 de julio al 20 de agosto

// precio = viernes, sábados y festivos · sem = domingo a jueves · max = personas
const CABANAS = [
  { id: "monica",  nombre: "Cabaña Mónica",  precio: 170, sem: 160, max: 2, jacuzzi: true,  desc: "Cabaña accesible · jacuzzi 180×90 cm · terraza cubierta · desayuno incluido", cap: "2 personas", tags: ["🛁 Jacuzzi", "♿ Accesible", "🌳 Entre árboles", "⛱️ Terraza cubierta", "📶 Wifi", "☕ Desayuno", "💑 Parejas"] },
  { id: "ainhoa",  nombre: "Cabaña Ainhoa",  precio: 180, sem: 160, max: 3, jacuzzi: true,  desc: "Jacuzzi 180×130 cm · terraza cubierta entre robles · desayuno incluido", cap: "2 adultos + 1 niño", tags: ["🛁 Jacuzzi", "🌳 Entre robles", "⛱️ Terraza cubierta", "🤫 Muy íntima", "📶 Wifi", "☕ Desayuno", "💑 Parejas", "👨‍👩‍👧 Familias"] },
  { id: "raquel",  nombre: "Cabaña Raquel",  precio: 180, sem: 160, max: 3, jacuzzi: true,  desc: "Jacuzzi 180×130 cm · terraza cubierta entre robles · desayuno incluido", cap: "2 adultos + 1 niño", tags: ["🛁 Jacuzzi", "🌳 Entre robles", "⛱️ Terraza cubierta", "🤫 Privacidad", "📶 Wifi", "☕ Desayuno", "💑 Parejas", "👨‍👩‍👧 Familias"] },
  { id: "hugo",    nombre: "Cabaña Hugo",    precio: 180, sem: 160, max: 3, jacuzzi: true,  desc: "Jacuzzi 180×130 cm · terraza soleada con vistas al pantano · desayuno incluido", cap: "2 adultos + 1 niño", tags: ["🛁 Jacuzzi", "🌄 Vistas", "☀️ Terraza soleada", "🌳 En alto", "📶 Wifi", "☕ Desayuno", "💑 Parejas", "👨‍👩‍👧 Familias"] },
  { id: "noa",     nombre: "Cabaña Noa",     precio: 190, sem: 160, max: 4, jacuzzi: true,  desc: "Jacuzzi 180×130 cm · terraza soleada con vistas al Monte Pindo · desayuno incluido", cap: "2 adultos + 2 niños", tags: ["🛁 Jacuzzi", "🌄 Vistas", "☀️ Terraza soleada", "🌳 En alto", "📶 Wifi", "☕ Desayuno", "💑 Parejas", "👨‍👩‍👧 Familias"] },
  { id: "andrea",  nombre: "Cabaña Andrea",  precio: 190, sem: 160, max: 4, jacuzzi: true,  desc: "Jacuzzi 180×130 cm · terraza soleada con vistas al Monte da Ruña · desayuno incluido", cap: "2 adultos + 2 niños", tags: ["🛁 Jacuzzi", "🌄 Vistas", "☀️ Terraza soleada", "🌳 En alto", "📶 Wifi", "☕ Desayuno", "💑 Parejas", "👨‍👩‍👧 Familias"] },
  { id: "paula",   nombre: "Cabaña Paula",   precio: 190, sem: 160, max: 4, jacuzzi: true,  desc: "Jacuzzi 180×130 cm · terraza soleada con vistas al pantano · desayuno incluido", cap: "2 adultos + 2 niños", tags: ["🛁 Jacuzzi", "🌄 Vistas", "☀️ Terraza soleada", "🌳 En alto", "📶 Wifi", "☕ Desayuno", "💑 Parejas", "👨‍👩‍👧 Familias"] },
  { id: "albores", nombre: "Cabaña Alborés", precio: 170, sem: 160, max: 4, jacuzzi: true,  desc: "Jacuzzi 180×130 cm en cabaña anexa · jardín · desayuno incluido", cap: "2 adultos + 2 niños", tags: ["🛁 Jacuzzi en cabaña anexa", "🌷 Jardín", "📶 Wifi", "☕ Desayuno", "💑 Parejas", "👨‍👩‍👧 Familias"] },
  { id: "amoa",    nombre: "Cabaña A Moa",   precio: 150, sem: 150, max: 6, jacuzzi: false, desc: "Sin jacuzzi · 2 habitaciones y sofá cama · terraza cubierta entre robles", cap: "6 personas", tags: ["👥 6 personas", "🛏️ 2 habitaciones", "⛱️ Terraza cubierta", "🌳 Entre robles", "📶 Wifi", "👪 Familias y grupos"] },
  { id: "opindo",  nombre: "Cabaña O Pindo", precio: 150, sem: 150, max: 6, jacuzzi: false, desc: "Sin jacuzzi · 2 habitaciones y sofá cama · terraza cubierta entre robles", cap: "6 personas", tags: ["👥 6 personas", "🛏️ 2 habitaciones", "⛱️ Terraza cubierta", "🌳 Entre robles", "📶 Wifi", "👪 Familias y grupos"] },
  { id: "xallas",  nombre: "Cabaña Xallas",  precio: 150, sem: 150, max: 6, jacuzzi: false, desc: "Sin jacuzzi · 2 habitaciones y sofá cama · terraza cubierta entre robles", cap: "6 personas", tags: ["👥 6 personas", "🛏️ 2 habitaciones", "⛱️ Terraza cubierta", "🌳 Entre robles", "📶 Wifi", "👪 Familias y grupos"] },
  { id: "aruna",   nombre: "Cabaña A Ruña",  precio: 150, sem: 150, max: 6, jacuzzi: false, desc: "Sin jacuzzi · 2 habitaciones y sofá cama · terraza cubierta entre robles", cap: "6 personas", tags: ["👥 6 personas", "🛏️ 2 habitaciones", "⛱️ Terraza cubierta", "🌳 Entre robles", "📶 Wifi", "👪 Familias y grupos"] }
];
