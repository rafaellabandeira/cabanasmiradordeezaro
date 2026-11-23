// ================= PRECIOS.JS - CABAÑAS MIRADOR DE ÉZARO =================
// ÚNICO archivo para cambiar precios, descuentos, ofertas, packs y bonos.
// No hace falta tocar main.js ni config.js para esto. Importes en euros.

// ---------- SEÑAL ----------
const ANTICIPO_CORTO = 50;    // reservas de 1 o 2 noches
const ANTICIPO_LARGO = 100;   // reservas de 3 noches o más

// ---------- MÍNIMO DE NOCHES ----------
const MIN_NOCHES = 1;
const MIN_NOCHES_ALTA = 2;    // en temporada alta (salvo un día libre entre dos reservas)

// ---------- TEMPORADA ALTA (ambos días incluidos, formato "MM-DD") ----------
// Toda la temporada se cobra a precio de fin de semana, más el recargo de abajo.
const TEMPORADA_ALTA = { desde: "07-20", hasta: "08-31" };
const ALTA_RECARGO_JACUZZI = 30;       // cabañas con jacuzzi
const ALTA_RECARGO_SIN_JACUZZI = 20;   // cabañas sin jacuzzi

// ---------- PRECIO POR NOCHE ----------
// CABAÑAS CON JACUZZI: precio para 2 personas.
//   habitual = viernes, sábados, festivos y vísperas · semana = domingo a jueves
//   nino1 / nino2 = suplemento por noche del 1.er y 2.º niño (de 2 a 13 años)
//   nochevieja = precio de esa noche (incluye uvas, cava premium y dulces)
// CABAÑAS SIN JACUZZI: precio para 4 personas (ver SIN_JACUZZI más abajo).
const PRECIOS = {
  monica:  { habitual: 170, semana: 160, nochevieja: 250, nino1: 15, nino2: 10 },   // Cabaña Mónica
  ainhoa:  { habitual: 180, semana: 160, nochevieja: 270, nino1: 15, nino2: 10 },   // Cabaña Ainhoa
  raquel:  { habitual: 180, semana: 160, nochevieja: 270, nino1: 15, nino2: 10 },   // Cabaña Raquel
  hugo:    { habitual: 180, semana: 160, nochevieja: 270, nino1: 15, nino2: 10 },   // Cabaña Hugo
  noa:     { habitual: 190, semana: 160, nochevieja: 280, nino1: 15, nino2: 10 },   // Cabaña Noa
  andrea:  { habitual: 190, semana: 160, nochevieja: 280, nino1: 15, nino2: 10 },   // Cabaña Andrea
  paula:   { habitual: 190, semana: 160, nochevieja: 280, nino1: 15, nino2: 10 },   // Cabaña Paula
  albores: { habitual: 170, semana: 160, nochevieja: 250, nino1: 15, nino2: 0 },    // Cabaña Alborés (2.º niño gratis)
  amoa:    { habitual: 150, semana: 150, nochevieja: 190 },                          // Cabaña A Moa
  opindo:  { habitual: 150, semana: 150, nochevieja: 190 },                          // Cabaña O Pindo
  xallas:  { habitual: 150, semana: 150, nochevieja: 190 },                          // Cabaña Xallas
  aruna:   { habitual: 150, semana: 150, nochevieja: 190 },                          // Cabaña A Ruña
};

// Ajuste por número de personas en las cabañas sin jacuzzi (los niños desde 2 años cuentan):
// 1, 2 o 3 personas: "menos" por noche · 5.ª persona: "quinta" · 6.ª persona: "sexta"
const SIN_JACUZZI = { menos: -10, quinta: 10, sexta: 10 };

// ---------- MASCOTA (solo cabañas sin jacuzzi, 1 máximo) ----------
// Se suma al total de la reserva.
const MASCOTA = { hasta4Noches: 20, desde5Noches: 40 };

// ---------- FESTIVOS (cuentan como precio habitual, igual que su víspera) ----------
// Jueves y Viernes Santo se calculan solos. Si un festivo cae en domingo, el lunes también cuenta.
const FESTIVOS_FIJOS = ["01-01", "01-06", "05-01", "05-17", "07-25", "08-15", "10-12", "11-01", "12-06", "12-08", "12-25"];
// 05-17 Día das Letras Galegas y 07-25 Santiago Apóstol: festivos en Galicia

// ---------- DESCUENTOS ----------
// Nunca se acumulan: se aplica solo el más favorable al cliente.
// Quedan fuera de los descuentos las noches de Semana Santa (jueves, viernes y sábado santo)
// y la de Nochevieja, aunque sí cuentan para llegar al número de noches.
const DESCUENTOS = {
  dosNoches: 50,        // % de la noche más barata: estancia de 2 noches, de domingo a jueves, temporada normal
  nocheGratis: 100,     // % de la noche más barata: 3 noches o más (3x2), mismas condiciones
  juevesADomingo: 25,   // % del total: estancia exacta de jueves a domingo, sin pack, temporada normal
  findeUnaNoche: 25,    // % de una noche (la más barata): 2 noches viernes-sábado o sábado-domingo, sin pack
  porDuracion: [        // % del total (también en temporada alta)
    { noches: 4, porcentaje: 10 },
    { noches: 7, porcentaje: 15 },
  ],
  nocheExtraOferta: 40, // % de descuento en las noches extra cuando se reserva una oferta con cena
};

// ---------- OFERTAS (precio por 2 noches; no valen en temporada alta, Nochevieja ni Semana Santa) ----------
const JACUZZI_8 = ["monica", "ainhoa", "raquel", "hugo", "noa", "andrea", "paula", "albores"];
const OFERTAS = {
  romantica: { corto: "Escapada romántica", precio: 290, cabanas: JACUZZI_8, url: "escapada-romantica.html",
    nombre: "Escapada romántica con jacuzzi y cena",
    incluye: "2 noches, desayuno en recepción (para llevar a la cabaña) y cena de picoteo en la cabaña (jamón, queso y vino Ribeiro)" },
  semana: { corto: "Escapada entre semana", precio: 250, cabanas: JACUZZI_8, url: "escapada-entre-semana.html",
    nombre: "Escapada entre semana con jacuzzi y cena picoteo en la cabaña",
    incluye: "2 noches de domingo a jueves, desayuno en recepción (para llevar a la cabaña) y cena de picoteo en la cabaña" },
  familiar: { corto: "Pack familiar", precio: 340, cabanas: ["ainhoa", "raquel", "hugo", "noa", "andrea", "paula"], url: "pack-familiar.html",
    nombre: "Pack familiar: cabaña en los árboles con jacuzzi",
    incluye: "2 noches (viernes y sábado), niños incluidos y desayuno en recepción (para llevar a la cabaña)" },
};

// ---------- BONOS REGALO (enlaces de pago de Stripe) ----------
// Si cambias un importe aquí, cámbialo también en Stripe: allí es donde se cobra.
const BONOS = {
  uno: { noches: 1, precio: 195, url: "https://buy.stripe.com/00w5kCfJdffMfvFfs9aVa02" },
  dos: { noches: 2, precio: 330, url: "https://buy.stripe.com/8x200i40v8RoerB2FnaVa01" }
};

// ---------- PACKS (precio por pack, se paga en destino) ----------
const PACKS = [
  { id: "decoracion", nombre: "Decoración romántica", precio: 20,
    incluye: ["Decoración con pétalos de rosa y globos", "Caja de bombones"] },
  { id: "bienvenida", nombre: "Decoración romántica con detalles de bienvenida", precio: 40,
    incluye: ["Botella de cava premium", "Caja de bombones", "Cafés y detalles de bienvenida", "Decoración con pétalos de rosa"] },
  { id: "cena", nombre: "Cena romántica con picoteo", precio: 80,
    incluye: ["Gran bandeja de jamón ibérico, lomo ibérico y queso, con picos camperos", "Botella de Mencía tinto", "Botella de cava premium", "Caja de bombones", "Cafés y detalles de bienvenida"] },
  { id: "completo", nombre: "Decoración romántica y cena de picoteo", precio: 90,
    incluye: ["Gran bandeja de jamón ibérico, lomo ibérico y queso, con picos camperos", "Botella de Mencía tinto", "Botella de cava premium", "Caja de bombones", "Cafés y detalles de bienvenida", "Decoración con pétalos de rosa"] }
];
