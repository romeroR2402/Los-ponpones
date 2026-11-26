// Plantillas de giro: SON DATOS, no código. Agregar un giro nuevo = agregar un objeto aquí.
// El resto de la app NUNCA pregunta "¿es farmacia?"; pregunta por capacidades (M.tiene('caducidad')).
(function () {
  var UNIDADES = {
    pza: { t: "pieza", c: "pzas", dec: false }, caja: { t: "caja", c: "cajas", dec: false },
    paquete: { t: "paquete", c: "paq.", dec: false }, kg: { t: "kilo", c: "kg", dec: true },
    g: { t: "gramo", c: "g", dec: true }, l: { t: "litro", c: "l", dec: true }, ml: { t: "mililitro", c: "ml", dec: true },
    m: { t: "metro", c: "m", dec: true }, cm: { t: "centímetro", c: "cm", dec: true },
    frasco: { t: "frasco", c: "frascos", dec: false }, sobre: { t: "sobre", c: "sobres", dec: false },
    rollo: { t: "rollo", c: "rollos", dec: false }, juego: { t: "juego", c: "juegos", dec: false }
  };

  // Capacidades disponibles y cómo se le pregunta al dueño en el registro.
  var CAPACIDADES = {
    caducidad: { pregunta: "¿Vendes productos que caducan?", ayuda: "Leche, jamón, medicinas… te avisamos antes de que se venzan." },
    reclamoProveedor: { pregunta: "¿Tus proveedores te cambian producto vencido?", ayuda: "Te recordamos cobrarle el cambio al proveedor.", requiere: "caducidad" },
    granel: { pregunta: "¿Vendes a granel (por kilo o litro)?", ayuda: "Frijol, azúcar, croquetas, pintura…" },
    medidas: { pregunta: "¿Vendes por metro o centímetro?", ayuda: "Cable, manguera, cadena, tela…" },
    fiado: { pregunta: "¿Das fiado?", ayuda: "Anota quién te debe y cuánto." },
    receta: { pregunta: "¿Vendes medicamentos que piden receta?", ayuda: "Te pedimos confirmar la receta al cobrar." }
  };

  var GIROS = [
    {
      id: "abarrotes", ic: "shopping-basket", nombre: "Tienda de abarrotes", icono: "🛒", color: "#e6f4ec",
      capacidades: { caducidad: true, reclamoProveedor: true, granel: true, fiado: true },
      unidades: ["pza", "kg", "l", "caja", "paquete"],
      categorias: ["Bebidas", "Lácteos", "Salchichonería", "Botanas", "Dulces", "Abarrotes", "Limpieza", "Higiene", "Pan", "Cigarros", "Granel"],
      atributos: [],
      alertas: { caducidadDias: 7, minimo: 3 },
      ejemplo: "Leche, refrescos, jamón, pan"
    },
    {
      id: "minisuper", ic: "store", nombre: "Minisúper", icono: "🏪", color: "#e6f3fe",
      capacidades: { caducidad: true, reclamoProveedor: true, granel: true },
      unidades: ["pza", "kg", "l", "caja", "paquete"],
      categorias: ["Bebidas", "Lácteos", "Carnes frías", "Frutas y verduras", "Botanas", "Despensa", "Congelados", "Limpieza", "Higiene", "Mascotas", "Vinos y licores"],
      atributos: [{ k: "marca", t: "Marca", tipo: "texto" }],
      alertas: { caducidadDias: 10, minimo: 5 },
      ejemplo: "Despensa completa, frescos y congelados"
    },
    {
      id: "tlapaleria", ic: "hammer", nombre: "Tlapalería / Ferretería", icono: "🔧", color: "#fff4dc",
      capacidades: { medidas: true, granel: true, fiado: true },
      unidades: ["pza", "m", "cm", "kg", "l", "rollo", "caja", "juego"],
      categorias: ["Herramientas", "Tornillería", "Eléctrico", "Plomería", "Pinturas", "Pegamentos", "Jardinería", "Cerrajería", "Construcción"],
      atributos: [{ k: "marca", t: "Marca", tipo: "texto" }, { k: "medida", t: "Medida / calibre", tipo: "texto", ej: "1/2\", 12 AWG" }],
      alertas: { caducidadDias: 0, minimo: 2 },
      ejemplo: "Tornillos, cable por metro, pintura"
    },
    {
      id: "farmacia", ic: "pill", nombre: "Farmacia", icono: "💊", color: "#fdeae6",
      capacidades: { caducidad: true, reclamoProveedor: true, receta: true },
      unidades: ["pza", "caja", "frasco", "sobre"],
      categorias: ["Analgésicos", "Antigripales", "Antibióticos", "Gastrointestinal", "Vitaminas", "Curación", "Bebés", "Cuidado personal", "Dermatológicos"],
      atributos: [
        { k: "sustancia", t: "Sustancia activa", tipo: "texto", ej: "Paracetamol" },
        { k: "presentacion", t: "Presentación", tipo: "texto", ej: "500 mg, 20 tabletas" },
        { k: "laboratorio", t: "Laboratorio", tipo: "texto" },
        { k: "requiereReceta", t: "Requiere receta", tipo: "si-no", capacidad: "receta" }
      ],
      alertas: { caducidadDias: 60, minimo: 3 },
      ejemplo: "Medicamentos, curación, cuidado personal"
    },
    {
      id: "papeleria", ic: "pencil", nombre: "Papelería", icono: "✏️", color: "#f1ecff",
      capacidades: {},
      unidades: ["pza", "paquete", "caja", "m", "juego"],
      categorias: ["Cuadernos", "Escritura", "Arte y manualidades", "Oficina", "Papel", "Mochilas", "Copias e impresiones", "Regalos", "Temporada escolar"],
      atributos: [{ k: "marca", t: "Marca", tipo: "texto" }],
      alertas: { caducidadDias: 0, minimo: 5 },
      ejemplo: "Útiles escolares, copias, regalos"
    },
    {
      id: "otro", ic: "store", nombre: "Otro negocio", icono: "🏬", color: "#f6f5f4",
      capacidades: {},
      unidades: ["pza", "kg", "l", "m", "caja", "paquete"],
      categorias: ["General"],
      atributos: [{ k: "marca", t: "Marca", tipo: "texto" }],
      alertas: { caducidadDias: 7, minimo: 3 },
      ejemplo: "Configúralo a tu medida"
    }
  ];

  // Módulos de la plataforma: se muestran sólo si el negocio tiene la capacidad y el rol lo permite.
  var MODULOS = [
    { id: "inicio", ic: "house", t: "Inicio", icono: "🏠", movil: true },
    { id: "vender", ic: "receipt", t: "Vender", icono: "🧾", movil: true },
    { id: "productos", ic: "package", t: "Productos", icono: "📦", movil: true },
    { id: "entradas", ic: "truck", t: "Entrada de mercancía", corto: "Entradas", icono: "🚚", roles: ["dueno", "encargado"] },
    { id: "alertas", ic: "bell", t: "Alertas", icono: "🔔", movil: true },
    { id: "ventas", ic: "trending-up", t: "Ventas", icono: "📈" },
    { id: "proveedores", ic: "handshake", t: "Proveedores", icono: "🤝", roles: ["dueno", "encargado"] },
    { id: "lector", ic: "scan-barcode", t: "Lector de códigos", icono: "🏷️" },
    { id: "plan", ic: "credit-card", t: "Mi plan", icono: "💳", roles: ["dueno"], sinDemo: true },
    { id: "ajustes", ic: "settings", t: "Mi negocio", icono: "⚙️", roles: ["dueno"] }
  ];

  var ESTADOS_MX = ["Aguascalientes", "Baja California", "Baja California Sur", "Campeche", "Chiapas", "Chihuahua", "Ciudad de México",
    "Coahuila", "Colima", "Durango", "Estado de México", "Guanajuato", "Guerrero", "Hidalgo", "Jalisco", "Michoacán", "Morelos", "Nayarit",
    "Nuevo León", "Oaxaca", "Puebla", "Querétaro", "Quintana Roo", "San Luis Potosí", "Sinaloa", "Sonora", "Tabasco", "Tamaulipas",
    "Tlaxcala", "Veracruz", "Yucatán", "Zacatecas"];

  window.GIROS = { lista: GIROS, capacidades: CAPACIDADES, unidades: UNIDADES, modulos: MODULOS, estados: ESTADOS_MX,
    get: function (id) { for (var i = 0; i < GIROS.length; i++) if (GIROS[i].id === id) return GIROS[i]; return GIROS[GIROS.length - 1] } };
})();
