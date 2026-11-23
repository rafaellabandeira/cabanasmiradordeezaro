// ================= CONFIG.JS - CABAÑAS MIRADOR DE ÉZARO =================
// Aquí se cambian el teléfono, el bin de JSONBin y los datos de las cabañas.
// Los PRECIOS, descuentos, packs y bonos están en precios.js.

// ---------- CONFIGURACIÓN ----------
// ID del bin de JSONBin (jsonbin.io). Cópialo de la ficha del bin.
const JSONBIN_ID = "6aff6d97ac6210605a95e5f6";
const BACKEND_URL = "https://api.jsonbin.io/v3/b/" + JSONBIN_ID + "/latest";
const TELEFONO_WA = "34620419157";   // teléfono para los enlaces de WhatsApp
const TELEFONO_TXT = "620 419 157";  // cómo se muestra en la web

// max = personas máximas
const CABANAS = [
  { id: "monica",  nombre: "Cabaña Mónica",  max: 2, jacuzzi: true,  desc: "Cabaña accesible · jacuzzi 180×90 cm · terraza cubierta · desayuno incluido", cap: "2 personas", tags: ["🛁 Jacuzzi", "♿ Accesible", "🌳 Entre árboles", "⛱️ Terraza cubierta", "📶 Wifi", "☕ Desayuno", "💑 Parejas"] },
  { id: "ainhoa",  nombre: "Cabaña Ainhoa",  max: 3, jacuzzi: true,  desc: "Jacuzzi 180×130 cm · terraza cubierta entre robles · desayuno incluido", cap: "2 adultos + 1 niño", tags: ["🛁 Jacuzzi", "🌳 Entre robles", "⛱️ Terraza cubierta", "🤫 Muy íntima", "📶 Wifi", "☕ Desayuno", "💑 Parejas", "👨‍👩‍👧 Familias"] },
  { id: "raquel",  nombre: "Cabaña Raquel",  max: 3, jacuzzi: true,  desc: "Jacuzzi 180×130 cm · terraza cubierta entre robles · desayuno incluido", cap: "2 adultos + 1 niño", tags: ["🛁 Jacuzzi", "🌳 Entre robles", "⛱️ Terraza cubierta", "🤫 Privacidad", "📶 Wifi", "☕ Desayuno", "💑 Parejas", "👨‍👩‍👧 Familias"] },
  { id: "hugo",    nombre: "Cabaña Hugo",    max: 3, jacuzzi: true,  desc: "Jacuzzi 180×130 cm · terraza soleada con vistas al pantano · desayuno incluido", cap: "2 adultos + 1 niño", tags: ["🛁 Jacuzzi", "🌄 Vistas", "☀️ Terraza soleada", "🌳 En alto", "📶 Wifi", "☕ Desayuno", "💑 Parejas", "👨‍👩‍👧 Familias"] },
  { id: "noa",     nombre: "Cabaña Noa",     max: 4, jacuzzi: true,  desc: "Jacuzzi 180×130 cm · terraza soleada con vistas al Monte Pindo · desayuno incluido", cap: "2 adultos + 2 niños", tags: ["🛁 Jacuzzi", "🌄 Vistas", "☀️ Terraza soleada", "🌳 En alto", "📶 Wifi", "☕ Desayuno", "💑 Parejas", "👨‍👩‍👧 Familias"] },
  { id: "andrea",  nombre: "Cabaña Andrea",  max: 4, jacuzzi: true,  desc: "Jacuzzi 180×130 cm · terraza soleada con vistas al Monte da Ruña · desayuno incluido", cap: "2 adultos + 2 niños", tags: ["🛁 Jacuzzi", "🌄 Vistas", "☀️ Terraza soleada", "🌳 En alto", "📶 Wifi", "☕ Desayuno", "💑 Parejas", "👨‍👩‍👧 Familias"] },
  { id: "paula",   nombre: "Cabaña Paula",   max: 4, jacuzzi: true,  desc: "Jacuzzi 180×130 cm · terraza soleada con vistas al pantano · desayuno incluido", cap: "2 adultos + 2 niños", tags: ["🛁 Jacuzzi", "🌄 Vistas", "☀️ Terraza soleada", "🌳 En alto", "📶 Wifi", "☕ Desayuno", "💑 Parejas", "👨‍👩‍👧 Familias"] },
  { id: "albores", nombre: "Cabaña Alborés", max: 4, jacuzzi: true,  desc: "Jacuzzi 180×130 cm en cabaña anexa · jardín · desayuno incluido", cap: "2 adultos + 2 niños", tags: ["🛁 Jacuzzi en cabaña anexa", "🌷 Jardín", "📶 Wifi", "☕ Desayuno", "💑 Parejas", "👨‍👩‍👧 Familias"] },
  { id: "amoa",    nombre: "Cabaña A Moa",   max: 6, jacuzzi: false, desc: "Sin jacuzzi · 2 habitaciones y sofá cama · terraza cubierta entre robles", cap: "6 personas", tags: ["👥 6 personas", "🛏️ 2 habitaciones", "⛱️ Terraza cubierta", "🌳 Entre robles", "📶 Wifi", "👪 Familias y grupos"] },
  { id: "opindo",  nombre: "Cabaña O Pindo", max: 6, jacuzzi: false, desc: "Sin jacuzzi · 2 habitaciones y sofá cama · terraza cubierta entre robles", cap: "6 personas", tags: ["👥 6 personas", "🛏️ 2 habitaciones", "⛱️ Terraza cubierta", "🌳 Entre robles", "📶 Wifi", "👪 Familias y grupos"] },
  { id: "xallas",  nombre: "Cabaña Xallas",  max: 6, jacuzzi: false, desc: "Sin jacuzzi · 2 habitaciones y sofá cama · terraza cubierta entre robles", cap: "6 personas", tags: ["👥 6 personas", "🛏️ 2 habitaciones", "⛱️ Terraza cubierta", "🌳 Entre robles", "📶 Wifi", "👪 Familias y grupos"] },
  { id: "aruna",   nombre: "Cabaña A Ruña",  max: 6, jacuzzi: false, desc: "Sin jacuzzi · 2 habitaciones y sofá cama · terraza cubierta entre robles", cap: "6 personas", tags: ["👥 6 personas", "🛏️ 2 habitaciones", "⛱️ Terraza cubierta", "🌳 Entre robles", "📶 Wifi", "👪 Familias y grupos"] }
];
