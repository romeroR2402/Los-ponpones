// Mostrador · utilidades de la plataforma (sesión, negocio, capacidades, escáner, sin conexión).
(function () {
  var C = window.MOSTRADOR || {};
  var sb = window.supabase.createClient(C.url, C.key, { auth: { persistSession: true, storageKey: "mostrador-auth" } });
  var M = window.M = { sb: sb, negocio: null, rol: null, giro: null, user: null, productos: [] };
  // Cuenta pública de la tienda de ejemplo (sólo ve su propio negocio demo).
  M.DEMO = { email: "demo@usuarios.mostrador.app", pass: "demo2026" };

  // ---------- DOM y formato ----------
  M.$ = function (s, el) { return (el || document).querySelector(s) };
  M.$$ = function (s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)) };
  M.esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] }) };
  M.r2 = function (n) { return Math.round((Number(n) || 0) * 100) / 100 };
  M.r3 = function (n) { return Math.round((Number(n) || 0) * 1000) / 1000 };
  M.money = function (n) { n = M.r2(n); return "$" + n.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) };
  M.num = function (s) { s = String(s == null ? "" : s).replace(/[$,\s]/g, ""); var n = parseFloat(s); return isFinite(n) ? n : 0 };
  M.unidad = function (u) { return GIROS.unidades[u] || { t: u, c: u, dec: false } };
  M.cant = function (n, u) {
    var d = M.unidad(u); n = M.r3(n);
    return n.toLocaleString("es-MX", { maximumFractionDigits: d.dec ? 3 : 0 }) + " " + (u === "pza" ? (Math.abs(n) === 1 ? "pza" : "pzas") : d.c);
  };
  M.digits = function (s) { return String(s || "").replace(/\D/g, "") };
  M.wa = function (num, text) { var d = M.digits(num); if (d.length === 10) d = "52" + d; return "https://wa.me/" + d + "?text=" + encodeURIComponent(text) };
  M.uuid = function () {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) { var r = Math.random() * 16 | 0; return (c === "x" ? r : (r & 3 | 8)).toString(16) });
  };

  // ---------- Fechas (zona horaria del negocio) ----------
  M.tz = function () { return (M.negocio && M.negocio.zona_horaria) || "America/Mexico_City" };
  M.hoyISO = function (d) { // AAAA-MM-DD en la zona del negocio
    return new Intl.DateTimeFormat("en-CA", { timeZone: M.tz(), year: "numeric", month: "2-digit", day: "2-digit" }).format(d || new Date());
  };
  M.inicioDia = function () { // instante en que empezó "hoy" en la zona del negocio
    var hoy = M.hoyISO(), now = new Date();
    var off = new Date(now.toLocaleString("en-US", { timeZone: M.tz() })) - new Date(now.toLocaleString("en-US", { timeZone: "UTC" }));
    return new Date(Date.parse(hoy + "T00:00:00Z") - off);
  };
  M.diasHasta = function (iso) { if (!iso) return null; return Math.round((Date.parse(iso + "T00:00:00Z") - Date.parse(M.hoyISO() + "T00:00:00Z")) / 864e5) };
  M.fecha = function (iso) { if (!iso) return ""; var d = new Date(iso.length === 10 ? iso + "T12:00:00Z" : iso); return d.toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric", timeZone: iso.length === 10 ? "UTC" : M.tz() }) };
  M.hora = function (iso) { return new Date(iso).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", timeZone: M.tz() }) };
  M.fechaHora = function (iso) { return new Date(iso).toLocaleString("es-MX", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: M.tz() }) };
  M.vence = function (dias) {
    if (dias == null) return "";
    if (dias < 0) return "Venció hace " + (-dias) + (dias === -1 ? " día" : " días");
    if (dias === 0) return "Vence hoy";
    if (dias === 1) return "Vence mañana";
    return "Vence en " + dias + " días";
  };

  // ---------- Capacidades y permisos ----------
  M.tiene = function (cap) { return !!(M.negocio && M.negocio.capacidades && M.negocio.capacidades[cap]) };
  M.puede = function (mod) { return !mod.roles || mod.roles.indexOf(M.rol) >= 0 };
  M.modulosActivos = function () { return GIROS.modulos.filter(function (m) { return M.puede(m) && (!m.capacidad || M.tiene(m.capacidad)) && !(m.sinDemo && M.negocio && M.negocio.es_demo) }) };
  M.diasAviso = function () { var c = M.negocio && M.negocio.capacidades; return (c && c.diasAviso) || (M.giro && M.giro.alertas.caducidadDias) || 7 };
  M.unidadesNegocio = function () {
    var u = (M.giro ? M.giro.unidades : ["pza"]).slice();
    if (M.tiene("granel")) ["kg", "g", "l", "ml"].forEach(function (x) { if (u.indexOf(x) < 0) u.push(x) });
    if (M.tiene("medidas")) ["m", "cm"].forEach(function (x) { if (u.indexOf(x) < 0) u.push(x) });
    return u;
  };

  // ---------- Avisos y hojas ----------
  M.toast = function (msg, kind) {
    M.$$(".toast").forEach(function (x) { x.parentNode.removeChild(x) }); // un aviso a la vez, sin encimarse
    var t = document.createElement("div"); t.className = "toast " + (kind || ""); t.setAttribute("role", "status");
    t.textContent = msg; document.body.appendChild(t);
    requestAnimationFrame(function () { t.classList.add("on") });
    setTimeout(function () { t.classList.remove("on"); setTimeout(function () { t.remove() }, 400) }, 3200);
  };
  M.hoja = function (html, opts) { // hoja inferior (móvil) / ventana (escritorio)
    M.cerrarHoja();
    var w = document.createElement("div"); w.className = "sheet-bg"; w.id = "sheet";
    w.innerHTML = '<div class="sheet' + (opts && opts.ancha ? " wide" : "") + '" role="dialog" aria-modal="true"><button class="sheet-x" aria-label="Cerrar" data-cerrar>✕</button>' + html + "</div>";
    w.addEventListener("click", function (e) { if (e.target === w || e.target.hasAttribute("data-cerrar")) { M.cerrarHoja(); if (opts && opts.alCerrar) opts.alCerrar() } });
    document.body.appendChild(w); document.body.classList.add("noscroll");
    var f = M.$("[autofocus]", w); if (f) setTimeout(function () { f.focus() }, 60);
    return M.$(".sheet", w);
  };
  M.cerrarHoja = function () { var s = M.$("#sheet"); if (s) s.remove(); document.body.classList.remove("noscroll"); M.detenerCamara() };
  M.confirmar = function (titulo, texto, si, peligro) {
    return new Promise(function (ok) {
      var h = M.hoja('<h2>' + M.esc(titulo) + '</h2><p class="muted">' + M.esc(texto) + '</p><div class="acts"><button class="btn ghost" data-cerrar>Cancelar</button><button class="btn ' + (peligro ? "danger" : "") + '" id="cf-si">' + M.esc(si || "Sí") + "</button></div>", { alCerrar: function () { ok(false) } });
      M.$("#cf-si", h).onclick = function () { M.cerrarHoja(); ok(true) };
    });
  };
  M.error = function (e) {
    var m = (e && (e.message || e.error_description)) || String(e);
    if (/Failed to fetch|NetworkError|network/i.test(m)) m = "Sin conexión. Revisa tu internet.";
    if (/Invalid login/i.test(m)) m = "Correo o contraseña incorrectos.";
    if (/duplicate key.*codigo/i.test(m)) m = "Ya tienes otro producto con ese código.";
    if (/duplicate key.*cfdi/i.test(m)) m = "Esa factura ya se había registrado.";
    if (/Email not confirmed/i.test(m)) m = "Activa tu cuenta con el código que te mandamos al correo.";
    if (/Signups not allowed|signup.*disabled/i.test(m)) m = "Por ahora el registro está cerrado. Pide tu acceso al administrador.";
    if (/already registered/i.test(m)) m = "Ese correo ya tiene cuenta. Toca “Entrar”.";
    M.toast(m, "bad"); console.error(e);
  };
  M.sonar = function (ok) {
    try { var a = new (window.AudioContext || window.webkitAudioContext)(), o = a.createOscillator(), g = a.createGain();
      o.frequency.value = ok === false ? 220 : 880; g.gain.value = 0.08; o.connect(g); g.connect(a.destination); o.start(); o.stop(a.currentTime + 0.09);
    } catch (e) {}
    if (navigator.vibrate) navigator.vibrate(ok === false ? [60, 40, 60] : 40);
  };

  // ---------- Escáner de código de barras con cámara ----------
  // Usa el lector nativo del celular (Android/Chrome) y, si no existe, ZXing.
  // Los lectores USB/Bluetooth funcionan solos: escriben el código y "Enter" en el buscador.
  var cam = null;
  M.detenerCamara = function () {
    if (!cam) return; cam.on = false;
    try { if (cam.zx) cam.zx.reset() } catch (e) {}
    if (cam.stream) cam.stream.getTracks().forEach(function (t) { t.stop() });
    cam = null;
  };
  function cargarZXing() {
    if (window.ZXing) return Promise.resolve();
    return new Promise(function (ok, no) {
      var s = document.createElement("script"); s.src = "https://cdn.jsdelivr.net/npm/@zxing/library@0.21.3/umd/index.min.js";
      s.onload = ok; s.onerror = function () { no(new Error("No se pudo cargar el lector")) }; document.head.appendChild(s);
    });
  }
  // continuo=true: sigue escaneando (entradas de mercancía); false: se cierra al primer código.
  M.escanear = function (alLeer, opts) {
    opts = opts || {};
    var h = M.hoja('<h2>' + M.esc(opts.titulo || "Escanear código") + '</h2><div class="scan"><video playsinline muted></video><div class="scan-line"></div></div>' +
      '<p class="muted center" id="scan-msg">Apunta la cámara al código de barras</p>' +
      '<form class="row" id="scan-man"><input class="inp" inputmode="numeric" placeholder="O escribe el código" aria-label="Código"><button class="btn alt">OK</button></form>', { alCerrar: opts.alCerrar });
    var video = M.$("video", h), msg = M.$("#scan-msg", h), ultimo = "", ultimoT = 0;
    M.$("#scan-man", h).onsubmit = function (e) { e.preventDefault(); var v = M.$("input", h).value.trim(); if (v) leido(v); M.$("input", h).value = "" };
    function leido(code) {
      var t = Date.now(); if (code === ultimo && t - ultimoT < 2500) return; ultimo = code; ultimoT = t;
      M.sonar(true);
      if (!opts.continuo) { M.cerrarHoja(); alLeer(code); return }
      msg.textContent = "✓ " + code; alLeer(code);
    }
    cam = { on: true };
    var yo = cam;
    if ("BarcodeDetector" in window) {
      navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } }).then(function (st) {
        if (!yo.on) { st.getTracks().forEach(function (t) { t.stop() }); return }
        yo.stream = st; video.srcObject = st; video.play();
        var det = new window.BarcodeDetector({ formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "qr_code", "itf"] });
        (function loop() {
          if (!yo.on) return;
          det.detect(video).then(function (r) { if (r.length) leido(r[0].rawValue) }).catch(function () {}).then(function () { setTimeout(loop, 180) });
        })();
      }).catch(function () { msg.textContent = "No pudimos abrir la cámara. Escribe el código abajo." });
    } else {
      cargarZXing().then(function () {
        if (!yo.on) return;
        yo.zx = new ZXing.BrowserMultiFormatReader();
        yo.zx.decodeFromVideoDevice(undefined, video, function (res) { if (res && yo.on) leido(res.getText()) });
      }).catch(function () { msg.textContent = "No pudimos abrir la cámara. Escribe el código abajo." });
    }
  };

  // ---------- Catálogo de productos ya registrados ----------
  // 1) Catálogo compartido en Supabase (≈25 mil productos de México de Open Food Facts + los que dan de alta las tiendas).
  // 2) Si no está, se pregunta en línea a Open Food Facts y se guarda en el catálogo para la próxima vez.
  M.buscarCodigo = function (code) {
    code = String(code || "").trim();
    if (!/^\d{8,14}$/.test(code) || !navigator.onLine) return Promise.resolve(null);
    var c13 = code.length === 14 && code.charAt(0) === "0" ? code.slice(1) : code;
    return sb.from("mos_catalogo").select("codigo,nombre,marca,presentacion,categoria,imagen").in("codigo", [code, c13]).limit(1).then(function (r) {
      if (r.data && r.data[0]) return r.data[0];
      return buscarOFF(code).then(function (p) { if (p) M.aportarCatalogo(Object.assign({ fuente: "off" }, p)); return p });
    }).catch(function () { return buscarOFF(code) });
  };
  M.aportarCatalogo = function (p) {
    if (!p || !/^\d{8,14}$/.test(p.codigo || "")) return;
    sb.rpc("mos_catalogo_aportar", { p: p }).then(function () {}, function () {});
  };
  function buscarOFF(code) {
    var ctl = window.AbortController ? new AbortController() : null;
    var to = setTimeout(function () { if (ctl) ctl.abort() }, 4000);
    return fetch("https://world.openfoodfacts.org/api/v2/product/" + code + ".json?fields=product_name,product_name_es,brands,quantity,image_front_small_url",
      ctl ? { signal: ctl.signal } : {}).then(function (r) { return r.json() }).then(function (j) {
      clearTimeout(to);
      if (!j || j.status !== 1 || !j.product) return null;
      var p = j.product, n = (p.product_name_es || p.product_name || "").trim();
      if (!n) return null;
      var marca = (p.brands || "").split(",")[0].trim();
      return { codigo: code, nombre: [n, marca && n.toLowerCase().indexOf(marca.toLowerCase()) < 0 ? marca : "", p.quantity || ""].filter(Boolean).join(" ").slice(0, 120),
        marca: marca, presentacion: p.quantity || "", categoria: "", imagen: p.image_front_small_url || "" };
    }).catch(function () { clearTimeout(to); return null });
  }

  // ---------- Factura electrónica (XML CFDI 3.3 / 4.0) ----------
  M.leerCFDI = function (texto) {
    var doc = new DOMParser().parseFromString(texto, "application/xml");
    if (doc.getElementsByTagName("parsererror").length) throw new Error("El archivo no es un XML válido");
    function uno(tag) { var l = doc.getElementsByTagNameNS("*", tag); return l.length ? l[0] : null }
    var comp = uno("Comprobante"); if (!comp) throw new Error("No parece una factura electrónica (CFDI)");
    var emi = uno("Emisor"), tim = uno("TimbreFiscalDigital");
    var conceptos = Array.prototype.map.call(doc.getElementsByTagNameNS("*", "Concepto"), function (c) {
      var cant = M.num(c.getAttribute("Cantidad")), imp = M.num(c.getAttribute("Importe")), desc = M.num(c.getAttribute("Descuento"));
      // costo unitario con IVA/IEPS trasladado (lo que realmente pagó la tienda)
      var tras = 0; Array.prototype.forEach.call(c.getElementsByTagNameNS("*", "Traslado"), function (t) { tras += M.num(t.getAttribute("Importe")) });
      return {
        codigo: (c.getAttribute("NoIdentificacion") || "").trim(), descripcion: (c.getAttribute("Descripcion") || "").trim(),
        cantidad: cant, unidad: (c.getAttribute("Unidad") || c.getAttribute("ClaveUnidad") || "").trim(),
        costo: cant ? M.r2((imp - desc + tras) / cant) : 0
      };
    });
    return {
      uuid: tim ? (tim.getAttribute("UUID") || "").toUpperCase() : "",
      emisor: emi ? (emi.getAttribute("Nombre") || "") : "", rfc: emi ? (emi.getAttribute("Rfc") || "") : "",
      fecha: comp.getAttribute("Fecha") || "", total: M.num(comp.getAttribute("Total")), conceptos: conceptos
    };
  };

  // ---------- Sesión y negocio ----------
  M.cargarNegocio = function () {
    return sb.auth.getSession().then(function (r) {
      M.user = r.data.session ? r.data.session.user : null;
      if (!M.user) return null;
      return sb.from("mos_miembros").select("rol, activo, negocio:mos_negocios(*)").eq("user_id", M.user.id).order("creado").then(function (q) {
        if (q.error) throw q.error;
        var preferido = localStorage.getItem("mostrador-negocio"), fila = null;
        (q.data || []).forEach(function (f) { if (!fila || (f.negocio && f.negocio.id === preferido)) fila = f });
        M.usuarioActivo = !fila || fila.activo !== false;
        if (fila && fila.negocio) usarNegocio(fila.negocio, fila.rol);
        else if (!fila) { M.negocio = null; M.rol = null }
        return M.negocio;
      });
    }).catch(function (e) {
      // Sin internet: usa la copia guardada del negocio
      var c = leer("mostrador-negocio-copia");
      if (c && M.user) { usarNegocio(c.negocio, c.rol); return M.negocio }
      throw e;
    });
  };
  function usarNegocio(n, rol) {
    M.negocio = n; M.rol = rol; M.giro = GIROS.get(n.giro);
    localStorage.setItem("mostrador-negocio", n.id);
    guardar("mostrador-negocio-copia", { negocio: n, rol: rol });
  }
  M.usarNegocio = usarNegocio;

  // Estado del plan de la tienda (lo decide el servidor; aquí sólo se muestra): demo, bloqueada, activa, prueba o vencida.
  M.plan = function (n) {
    n = n || M.negocio || {};
    var hoy = M.hoyISO(), vence = n.pagado_hasta && n.pagado_hasta >= hoy ? n.pagado_hasta : n.prueba_hasta;
    var k = n.es_demo ? "demo" : n.bloqueado ? "bloqueada" : n.pagado_hasta && n.pagado_hasta >= hoy ? "activa" : n.prueba_hasta && n.prueba_hasta >= hoy ? "prueba" : "vencida";
    return { k: k, vence: vence, dias: M.diasHasta(vence), conAcceso: k === "demo" || k === "activa" || k === "prueba" };
  };

  // ---------- Copia local y ventas sin internet ----------
  function leer(k) { try { return JSON.parse(localStorage.getItem(k) || "null") } catch (e) { return null } }
  function guardar(k, v) { try { localStorage.setItem(k, JSON.stringify(v)) } catch (e) {} }
  M.leer = leer; M.guardar = guardar;
  function kProd() { return "mostrador-productos-" + (M.negocio && M.negocio.id) }
  function kCola() { return "mostrador-cola-" + (M.negocio && M.negocio.id) }

  M.cargarProductos = function () {
    return sb.from("mos_productos").select("*").eq("negocio_id", M.negocio.id).eq("activo", true).order("nombre").limit(5000).then(function (r) {
      if (r.error) throw r.error;
      M.productos = r.data || []; guardar(kProd(), M.productos); aplicarColaLocal(); return M.productos;
    }).catch(function (e) {
      M.productos = leer(kProd()) || []; aplicarColaLocal(); if (!M.productos.length) throw e; return M.productos;
    });
  };
  // Resta de la copia local lo vendido sin internet que todavía no sube.
  function aplicarColaLocal() {
    (leer(kCola()) || []).forEach(function (v) { v.items.forEach(function (it) {
      var p = M.porId(it.producto_id); if (p) p.existencia = M.r3(p.existencia - it.cantidad);
    }) });
  }
  M.porId = function (id) { for (var i = 0; i < M.productos.length; i++) if (M.productos[i].id === id) return M.productos[i]; return null };
  M.porCodigo = function (c) { c = String(c || "").trim(); if (!c) return null; for (var i = 0; i < M.productos.length; i++) if (M.productos[i].codigo === c) return M.productos[i]; return null };

  M.cola = function () { return leer(kCola()) || [] };
  M.vender = function (venta) {
    // La venta se guarda primero en el celular y luego se sube: nunca se pierde por falta de internet.
    var cola = M.cola(); cola.push(venta); guardar(kCola(), cola);
    venta.items.forEach(function (it) { var p = M.porId(it.producto_id); if (p) p.existencia = M.r3(p.existencia - it.cantidad) });
    guardar(kProd(), M.productos);
    return M.sincronizar().then(function () { return venta });
  };
  M.folios = {};
  var sincronizando = null;
  M.sincronizar = function () {
    if (!M.negocio) return Promise.resolve();
    if (sincronizando) return sincronizando;
    sincronizando = (function siguiente() {
      var cola = M.cola(); if (!cola.length) return Promise.resolve();
      return sb.rpc("mos_vender", { p: cola[0] }).then(function (r) {
        if (r.error) {
          if (/fetch|network/i.test(r.error.message || "")) throw r.error;
          // Error de datos (p. ej. producto borrado): se aparta para revisarla y no bloquear la cola
          var mal = leer("mostrador-cola-error") || []; mal.push({ venta: cola[0], error: r.error.message }); guardar("mostrador-cola-error", mal);
        } else if (r.data) { M.folios[cola[0].id] = r.data.folio }
        var resto = M.cola(); resto.shift(); guardar(kCola(), resto);
        return siguiente();
      });
    })().catch(function () {}).then(function () { sincronizando = null; document.dispatchEvent(new Event("mostrador:cola")) });
    return sincronizando;
  };
  window.addEventListener("online", function () { M.sincronizar() });

  // =====================================================================
  // Pistola lectora de códigos de barras (Bluetooth / USB)
  // =====================================================================
  // A) Modo teclado (HID): la pistola se vincula en el Bluetooth del celular y "teclea" el código + Enter muy rápido.
  //    Detectamos esa ráfaga en cualquier pantalla (aunque no haya un campo seleccionado) y la mandamos a M.alEscanear.
  // B) Modo BLE: conexión directa desde la app con Web Bluetooth (Chrome en Android/PC; iPhone no lo permite).
  var L = M.lector = { activo: false, ultimo: null, ble: null, oyentes: [], vel: 45 };
  var buf = "", t0 = 0, tPrev = 0, objetivo = null, finTimer = null;
  function esCampo(el) { return el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable) }
  function emitir(code, origen) {
    code = String(code || "").replace(/[\r\n\t]/g, "").trim();
    if (code.length < 4) return;
    L.activo = true; L.ultimo = { code: code, origen: origen, t: Date.now() };
    L.oyentes.forEach(function (f) { try { f(code, origen) } catch (e) { console.error(e) } });
    if (M.alEscanear) M.alEscanear(code, origen);
  }
  L.emitir = emitir;
  L.escuchar = function (f) { L.oyentes.push(f); return function () { L.oyentes = L.oyentes.filter(function (x) { return x !== f }) } };
  function rafaga() { return buf.length >= 4 && (tPrev - t0) / Math.max(buf.length - 1, 1) < L.vel }
  function terminar(e) {
    var code = buf, el = objetivo; buf = ""; clearTimeout(finTimer);
    if (e) { e.preventDefault(); e.stopPropagation() }
    // Si los números cayeron en un campo que no es de código (p. ej. el precio), los quitamos de ahí.
    if (el && esCampo(el) && typeof el.value === "string" && el.value.slice(-code.length) === code) {
      el.value = el.value.slice(0, -code.length); el.dispatchEvent(new Event("input", { bubbles: true }));
    }
    emitir(code, "pistola");
  }
  document.addEventListener("keydown", function (e) {
    var el = e.target, now = Date.now();
    // Campos donde se escribe un código a mano (formulario de producto, escáner manual) se dejan trabajar normal.
    if (esCampo(el) && (el.name === "codigo" || el.closest("#scan-man"))) { buf = ""; return }
    if (e.key === "Enter" || e.key === "Tab") { if (rafaga()) terminar(e); else buf = ""; return }
    if (e.key.length !== 1 || e.ctrlKey || e.metaKey || e.altKey) return;
    if (now - tPrev > 80) { buf = ""; t0 = now }
    buf += e.key; tPrev = now; objetivo = el;
    // Pistolas configuradas sin Enter al final: si la ráfaga se detiene, la tomamos igual.
    clearTimeout(finTimer);
    finTimer = setTimeout(function () { if (buf.length >= 8 && /^\d+$/.test(buf) && rafaga()) terminar(null); else buf = "" }, 120);
  }, true);

  // ---------- Modo BLE (Web Bluetooth) ----------
  // Servicios "serie" que usan las pistolas BLE más comunes (Nordic UART, HM-10/FFE0, FFF0, Zebra/Honeywell genéricos).
  var SERVICIOS = ["6e400001-b5a3-f393-e0a9-e50e24dcca9e", 0xffe0, 0xfff0, 0xfee7, 0x1812, "49535343-fe7d-4ae5-8fa9-9fafd205e455", "0000feea-0000-1000-8000-00805f9b34fb"];
  L.bleDisponible = function () { return !!(navigator.bluetooth && navigator.bluetooth.requestDevice) };
  L.estadoBLE = function () { return L.ble ? (L.ble.device.gatt.connected ? "conectado" : "desconectado") : "sin" };
  function avisar() { document.dispatchEvent(new Event("mostrador:lector")) }
  function usarDispositivo(device) {
    var dec = new TextDecoder(), linea = "";
    function alDato(ev) {
      linea += dec.decode(ev.target.value);
      var partes = linea.split(/[\r\n]+/); linea = partes.pop();
      partes.forEach(function (c) { if (c.trim()) emitir(c, "bluetooth") });
      clearTimeout(alDato.t); alDato.t = setTimeout(function () { if (linea.trim().length >= 8) { emitir(linea, "bluetooth"); linea = "" } }, 150);
    }
    device.addEventListener("gattserverdisconnected", function () { avisar(); setTimeout(function () { if (L.ble && L.ble.device === device) reconectar(device, 1) }, 1500) });
    return device.gatt.connect().then(function (srv) { return srv.getPrimaryServices() }).then(function (svcs) {
      return Promise.all(svcs.map(function (s) { return s.getCharacteristics().catch(function () { return [] }) }));
    }).then(function (grupos) {
      var chs = [].concat.apply([], grupos).filter(function (c) { return c.properties.notify || c.properties.indicate });
      if (!chs.length) throw new Error("Este lector no manda códigos por Bluetooth directo. Úsalo en modo teclado (HID).");
      return Promise.all(chs.map(function (c) { return c.startNotifications().then(function () { c.addEventListener("characteristicvaluechanged", alDato) }).catch(function () {}) }));
    }).then(function () {
      L.ble = { device: device, nombre: device.name || "Lector Bluetooth" };
      try { localStorage.setItem("mostrador-lector-ble", device.id) } catch (e) {}
      avisar(); return L.ble;
    });
  }
  function reconectar(device, intento) {
    if (intento > 3) return avisar();
    usarDispositivo(device).catch(function () { setTimeout(function () { reconectar(device, intento + 1) }, 2000 * intento) });
  }
  L.conectarBLE = function () {
    if (!L.bleDisponible()) return Promise.reject(new Error("Este navegador no permite Bluetooth directo. Usa Chrome en Android o PC, o el modo teclado."));
    return navigator.bluetooth.requestDevice({ acceptAllDevices: true, optionalServices: SERVICIOS }).then(usarDispositivo);
  };
  L.desconectarBLE = function () {
    var b = L.ble; L.ble = null; try { localStorage.removeItem("mostrador-lector-ble") } catch (e) {}
    if (b && b.device.gatt.connected) b.device.gatt.disconnect(); avisar();
  };
  // Al abrir la app, reconecta solo el lector BLE que ya se había autorizado (Chrome con getDevices).
  L.reconectarGuardado = function () {
    var id = null; try { id = localStorage.getItem("mostrador-lector-ble") } catch (e) {}
    if (!id || !navigator.bluetooth || !navigator.bluetooth.getDevices) return;
    navigator.bluetooth.getDevices().then(function (ds) { var d = ds.filter(function (x) { return x.id === id })[0]; if (d) reconectar(d, 1) }).catch(function () {});
  };

  // ---------- Instalar como app ----------
  M.instalar = null;
  window.addEventListener("beforeinstallprompt", function (e) { e.preventDefault(); M.instalar = e; document.documentElement.classList.add("can-install") });
  M.pedirInstalar = function () {
    if (M.instalar) { M.instalar.prompt(); M.instalar = null; document.documentElement.classList.remove("can-install"); return }
    var ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    alert(ios ? "En iPhone: toca Compartir (cuadro con flecha) y elige “Agregar a pantalla de inicio”."
              : "Abre el menú del navegador (⋮) y elige “Instalar app” o “Agregar a pantalla principal”.");
  };
  if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost"))
    navigator.serviceWorker.register("sw.js", { updateViaCache: "none" }).then(function (reg) { return reg.update() }).catch(function () {});
  // Cuando llega una versión nueva de la app, recarga una vez para usarla (sólo si ya había una versión anterior).
  if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
    var recargado = false;
    navigator.serviceWorker.addEventListener("controllerchange", function () { if (recargado) return; recargado = true; location.reload() });
  }
})();
