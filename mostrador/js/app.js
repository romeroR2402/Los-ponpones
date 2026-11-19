// Mostrador · pantallas. Cada módulo es una función registrada en VISTAS; el menú sale de GIROS.modulos.
(function () {
  "use strict";
  var $ = M.$, $$ = M.$$, esc = M.esc, money = M.money;
  var app = document.getElementById("app");
  var VISTAS = {};
  var lotes = [];          // lotes con existencia y fecha de caducidad
  var carrito = [];        // venta en curso
  var entrada = null;      // entrada de mercancía en curso
  var filtroProd = { q: "", f: "todos" };

  // =====================================================================
  // Arranque
  // =====================================================================
  function cargando(el) { (el || app).innerHTML = '<div class="spin" aria-label="Cargando"></div>' }
  function arrancar() {
    cargando();
    M.cargarNegocio().then(function (n) {
      if (!M.user) return pantallaAcceso();
      if (!n) return onboarding();
      return entrarApp();
    }).catch(function (e) {
      app.innerHTML = '<div class="auth"><div class="box center"><div class="empty"><div class="ic">' + ic("triangle-alert", 40, 1.5) + '</div><b>No pudimos conectar</b>Revisa tu internet e inténtalo otra vez.</div><button class="btn" onclick="location.reload()">Reintentar</button></div></div>';
      console.error(e);
    });
  }
  function entrarApp() {
    pintarShell(); cargando($("#view"));
    return Promise.all([M.cargarProductos(), cargarLotes()]).catch(function (e) { M.error(e) }).then(function () {
      render(); M.sincronizar(); avisarAlertas(); M.lector.reconectarGuardado();
    });
  }
  M.sb.auth.onAuthStateChange(function (ev) {
    if (ev === "PASSWORD_RECOVERY") nuevaContrasena();
  });
  window.addEventListener("hashchange", function () { if (M.negocio) render() });
  window.addEventListener("online", estadoRed); window.addEventListener("offline", estadoRed);
  document.addEventListener("mostrador:cola", function () { estadoRed(); var r = ruta(); if (r === "inicio" || r === "ventas") render() });

  function cargarLotes() {
    return M.sb.from("mos_lotes").select("*").eq("negocio_id", M.negocio.id).or("cantidad.gt.0,cambio_proveedor.eq.pendiente")
      .order("caducidad", { ascending: true }).limit(3000).then(function (r) {
        if (r.error) throw r.error; lotes = r.data || []; M.guardar("mostrador-lotes-" + M.negocio.id, lotes);
      }).catch(function () { lotes = M.leer("mostrador-lotes-" + M.negocio.id) || [] });
  }

  // =====================================================================
  // Alertas (se calculan con los datos ya cargados)
  // =====================================================================
  function alertas() {
    var dias = M.diasAviso(), a = { vencidos: [], pronto: [], cambios: [], bajo: [], agotados: [] };
    if (M.tiene("caducidad")) lotes.forEach(function (l) {
      var p = M.porId(l.producto_id); if (!p || !l.caducidad) return;
      var d = M.diasHasta(l.caducidad), it = { l: l, p: p, d: d };
      if (l.cantidad > 0 && l.cambio_proveedor === "pendiente" && M.tiene("reclamoProveedor") && d <= dias) a.cambios.push(it);
      else if (l.cantidad > 0 && d < 0) a.vencidos.push(it);
      else if (l.cantidad > 0 && d <= dias) a.pronto.push(it);
    });
    M.productos.forEach(function (p) {
      if (p.existencia <= 0) a.agotados.push(p);
      else if (p.minimo > 0 && p.existencia <= p.minimo) a.bajo.push(p);
    });
    a.total = a.vencidos.length + a.pronto.length + a.cambios.length + a.bajo.length + a.agotados.length;
    a.urgentes = a.vencidos.length + a.cambios.length;
    return a;
  }
  function avisarAlertas() {
    pintarContadores();
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    var a = alertas(), k = "mostrador-aviso-" + M.negocio.id;
    if (!a.total || localStorage.getItem(k) === M.hoyISO()) return;
    localStorage.setItem(k, M.hoyISO());
    var partes = [];
    if (a.vencidos.length) partes.push(a.vencidos.length + " vencidos");
    if (a.cambios.length) partes.push(a.cambios.length + " por cambiar con proveedor");
    if (a.pronto.length) partes.push(a.pronto.length + " vencen pronto");
    if (a.bajo.length + a.agotados.length) partes.push((a.bajo.length + a.agotados.length) + " se acaban o agotaron");
    navigator.serviceWorker && navigator.serviceWorker.ready.then(function (reg) {
      reg.showNotification(M.negocio.nombre, { body: partes.join(" · "), icon: "icons/icon-192.png", tag: "alertas", data: { url: "index.html#/alertas" } });
    }).catch(function () {});
  }

  // =====================================================================
  // Acceso (entrar / crear cuenta)
  // =====================================================================
  function pantallaAcceso(modo) {
    modo = modo || "entrar";
    app.innerHTML = '<div class="auth"><div class="box">' +
      '<div class="brand"><span class="logo">' + ic("store", 20, 2) + '</span><span>Mostrador</span></div>' +
      '<h1 class="hero-t">Tu negocio, en orden y sin complicaciones.</h1>' +
      '<p class="body">Vende, escanea tu mercancía y entérate de lo que se acaba o se va a vencer.</p>' +
      '<div class="card mt"><div class="tabs" role="tablist"><button type="button" data-m="entrar" class="' + (modo === "entrar" ? "on" : "") + '">Entrar</button><button type="button" data-m="crear" class="' + (modo === "crear" ? "on" : "") + '">Crear cuenta</button></div>' +
      '<form id="fa" novalidate>' +
      (modo === "crear" ? '<label class="f"><span>Tu nombre</span><input class="inp" name="nombre" autocomplete="name" required></label>' : "") +
      '<label class="f"><span>Correo</span><input class="inp" name="email" type="email" autocomplete="email" inputmode="email" required></label>' +
      '<label class="f"><span>Contraseña</span><input class="inp" name="pass" type="password" autocomplete="' + (modo === "crear" ? "new-password" : "current-password") + '" minlength="6" required>' +
      (modo === "crear" ? "<small>Mínimo 6 caracteres.</small>" : "") + '</label>' +
      '<div id="fa-msg"></div><button class="btn block lg">' + (modo === "crear" ? "Crear mi cuenta" : "Entrar") + "</button>" +
      (modo === "entrar" ? '<p class="center mt small"><a href="#" id="olvide">Olvidé mi contraseña</a></p>' : "") +
      "</form></div></div></div>";
    $$(".tabs button").forEach(function (b) { b.onclick = function () { pantallaAcceso(b.dataset.m) } });
    var f = $("#fa"), msg = $("#fa-msg");
    if ($("#olvide")) $("#olvide").onclick = function (e) {
      e.preventDefault(); var em = f.email.value.trim();
      if (!/\S+@\S+\.\S+/.test(em)) { mensaje(msg, "warn", "Escribe tu correo arriba y vuelve a tocar “Olvidé mi contraseña”."); return }
      M.sb.auth.resetPasswordForEmail(em, { redirectTo: location.href.split("#")[0] }).then(function (r) {
        if (r.error) return M.error(r.error); mensaje(msg, "info", "Te mandamos un correo para crear una contraseña nueva.");
      });
    };
    f.onsubmit = function (e) {
      e.preventDefault();
      var em = f.email.value.trim().toLowerCase(), pw = f.pass.value;
      if (modo === "crear" && !f.nombre.value.trim()) return mensaje(msg, "warn", "Escribe tu nombre.");
      if (!/\S+@\S+\.\S+/.test(em)) return mensaje(msg, "warn", "Revisa tu correo.");
      if (pw.length < 6) return mensaje(msg, "warn", "La contraseña debe tener al menos 6 caracteres.");
      var btn = $("button.btn", f); btn.disabled = true;
      var p = modo === "crear"
        ? M.sb.auth.signUp({ email: em, password: pw, options: { data: { nombre: f.nombre.value.trim() }, emailRedirectTo: location.href.split("#")[0] } })
        : M.sb.auth.signInWithPassword({ email: em, password: pw });
      p.then(function (r) {
        btn.disabled = false;
        if (r.error) return M.error(r.error);
        if (!r.data.session) return mensaje(msg, "info", "¡Listo! Te mandamos un correo a " + em + ". Ábrelo para confirmar tu cuenta y después entra aquí.");
        arrancar();
      }).catch(function (er) { btn.disabled = false; M.error(er) });
    };
  }
  function mensaje(el, tipo, t) { el.innerHTML = '<div class="note ' + tipo + '">' + esc(t) + "</div>" }
  function nuevaContrasena() {
    var h = M.hoja('<h2>Crea tu contraseña nueva</h2><form id="fp"><label class="f"><span>Contraseña nueva</span><input class="inp" type="password" minlength="6" autofocus required></label><button class="btn block">Guardar</button></form>');
    $("#fp", h).onsubmit = function (e) {
      e.preventDefault(); var v = $("input", h).value; if (v.length < 6) return M.toast("Mínimo 6 caracteres", "bad");
      M.sb.auth.updateUser({ password: v }).then(function (r) { if (r.error) return M.error(r.error); M.cerrarHoja(); M.toast("Contraseña actualizada ✓", "ok"); arrancar() });
    };
  }

  // =====================================================================
  // Registro del negocio (onboarding en 3 pasos)
  // =====================================================================
  var onb = null;
  function onboarding(paso) {
    if (!onb) onb = { giro: null, nombre: "", persona: (M.user.user_metadata && M.user.user_metadata.nombre) || "", estado: "Ciudad de México", municipio: "", telefono: "", caps: {} };
    paso = paso || 1;
    var html = '<div class="onb"><div class="row between"><div class="brand"><span class="logo">' + ic("store", 20, 2) + '</span><span>Mostrador</span></div><button class="btn ghost sm" id="salir">Salir</button></div>' +
      '<div class="steps" aria-label="Paso ' + paso + ' de 3"><i class="on"></i><i class="' + (paso > 1 ? "on" : "") + '"></i><i class="' + (paso > 2 ? "on" : "") + '"></i></div>';
    if (paso === 1) {
      html += '<h1>¿Qué tipo de negocio tienes?</h1><p class="body">Así preparamos el sistema con lo que tú usas. Lo puedes ajustar después.</p><div class="giros mt">' +
        GIROS.lista.map(function (g) {
          return '<button class="giro' + (onb.giro === g.id ? " on" : "") + '" data-g="' + g.id + '"><span class="ic">' + ic(g.ic, 26) + "</span><b>" + esc(g.nombre) + "</b><small>" + esc(g.ejemplo) + "</small></button>";
        }).join("") + "</div>";
    } else if (paso === 2) {
      var g = GIROS.get(onb.giro);
      html += '<h1>Cuéntanos de tu ' + esc(g.nombre.toLowerCase()) + '</h1><p class="body">Sólo lo básico.</p><form id="f2" class="card mt" novalidate>' +
        '<label class="f"><span>Nombre del negocio</span><input class="inp" name="nombre" value="' + esc(onb.nombre) + '" placeholder="Ej. Abarrotes Doña Lupe" required autofocus></label>' +
        '<label class="f"><span>Tu nombre</span><input class="inp" name="persona" value="' + esc(onb.persona) + '" autocomplete="name"></label>' +
        '<div class="grid2"><label class="f"><span>Estado</span><select class="inp" name="estado">' + GIROS.estados.map(function (e) { return "<option" + (e === onb.estado ? " selected" : "") + ">" + e + "</option>" }).join("") + "</select></label>" +
        '<label class="f"><span>Alcaldía o municipio</span><input class="inp" name="municipio" value="' + esc(onb.municipio) + '" placeholder="Ej. Iztapalapa"></label></div>' +
        '<label class="f"><span>WhatsApp del negocio <span class="muted">(opcional)</span></span><input class="inp" name="telefono" inputmode="tel" value="' + esc(onb.telefono) + '" placeholder="10 dígitos"></label>' +
        '<div id="f2m"></div><div class="acts"><button type="button" class="btn ghost" id="atras">Atrás</button><button class="btn">Continuar</button></div></form>';
    } else {
      html += '<h1>¿Cómo trabajas?</h1><p class="body">Activamos sólo lo que te sirve. Lo demás no te estorba.</p><div class="qcard mt" id="caps">' + preguntasCaps() + "</div>" +
        '<div class="acts"><button class="btn ghost" id="atras">Atrás</button><button class="btn" id="crear">Crear mi negocio</button></div>';
    }
    app.innerHTML = html + "</div>";
    $("#salir").onclick = salir;
    if (paso === 1) $$(".giro").forEach(function (b) {
      b.onclick = function () {
        if (onb.giro !== b.dataset.g) onb.caps = JSON.parse(JSON.stringify(GIROS.get(b.dataset.g).capacidades));
        onb.giro = b.dataset.g; onboarding(2);
      };
    });
    if (paso === 2) {
      $("#atras").onclick = function () { leer2(); onboarding(1) };
      $("#f2").onsubmit = function (e) { e.preventDefault(); leer2(); if (!onb.nombre) return mensaje($("#f2m"), "warn", "Escribe el nombre de tu negocio."); onboarding(3) };
    }
    if (paso === 3) {
      $("#atras").onclick = function () { onboarding(2) };
      $("#caps").onchange = function (e) { onb.caps[e.target.name] = e.target.checked; $("#caps").innerHTML = preguntasCaps() };
      $("#crear").onclick = crearNegocio;
    }
    function leer2() { var f = $("#f2"); ["nombre", "persona", "estado", "municipio", "telefono"].forEach(function (k) { onb[k] = f[k].value.trim() }) }
  }
  function preguntasCaps() {
    return Object.keys(GIROS.capacidades).filter(function (k) { var c = GIROS.capacidades[k]; return !c.requiere || onb.caps[c.requiere] }).map(function (k) {
      var c = GIROS.capacidades[k];
      return '<label class="check"><input type="checkbox" name="' + k + '"' + (onb.caps[k] ? " checked" : "") + '><span><b>' + esc(c.pregunta) + '</b><br><span class="muted small">' + esc(c.ayuda) + "</span></span></label>";
    }).join("");
  }
  function crearNegocio() {
    var b = $("#crear"); b.disabled = true; b.textContent = "Creando…";
    var caps = {}; Object.keys(onb.caps).forEach(function (k) { if (onb.caps[k]) caps[k] = true });
    if (!caps.caducidad) delete caps.reclamoProveedor;
    M.sb.rpc("mos_crear_negocio", { p: { nombre: onb.nombre, giro: onb.giro, capacidades: caps, modulos: GIROS.modulos.map(function (m) { return m.id }),
      persona: onb.persona, estado: onb.estado, municipio: onb.municipio, telefono: onb.telefono } }).then(function (r) {
      if (r.error) throw r.error;
      localStorage.setItem("mostrador-negocio", r.data); onb = null;
      return M.cargarNegocio();
    }).then(function () {
      location.hash = "#/inicio";
      return entrarApp();
    }).then(function () {
      var h = M.hoja('<div class="done"><div class="ok">' + ic("circle-check", 40, 2) + '</div><h2>¡Tu negocio está listo!</h2><p class="body">Empieza dando de alta tus productos. Lo más rápido es escanear su código de barras.</p></div>' +
        '<div class="acts"><button class="btn ghost" data-cerrar>Después</button><button class="btn" id="w-esc">' + ic("scan-barcode", 18) + ' Escanear productos</button></div>');
      $("#w-esc", h).onclick = function () { M.cerrarHoja(); location.hash = "#/productos"; setTimeout(escanearAlta, 50) };
    }).catch(function (e) { b.disabled = false; b.textContent = "Crear mi negocio"; M.error(e) });
  }

  // =====================================================================
  // Estructura (barra superior, menú lateral, barra inferior)
  // =====================================================================
  function ruta() { return (location.hash.replace(/^#\/?/, "").split("?")[0] || "inicio").split("/")[0] }
  function persona() { return ((M.user && M.user.user_metadata && M.user.user_metadata.nombre) || (M.user && M.user.email) || "").trim() }
  function iniciales(n) { var p = n.split(/[\s@.]+/).filter(Boolean); return ((p[0] || "?").charAt(0) + (p[1] ? p[1].charAt(0) : "")).toUpperCase() }
  function pintarShell() {
    var mods = M.modulosActivos(), movil = mods.filter(function (m) { return m.movil }), nom = persona();
    var marca = '<a class="brand" href="#/inicio"><span class="logo">' + ic(M.giro.ic || "store", 20, 2) + '</span><span class="ellipsis">' + esc(M.negocio.nombre) + "</span></a>";
    app.innerHTML = '<div class="shell"><nav class="side" aria-label="Menú">' + marca + mods.map(function (m) {
        return '<a href="#/' + m.id + '" data-r="' + m.id + '">' + ic(m.ic, 20) + esc(m.t) + (m.id === "alertas" ? '<span class="n hide" data-n></span>' : "") + "</a>";
      }).join("") + '<div class="grow"></div><a href="#" class="install" onclick="M.pedirInstalar();return false">' + ic("download", 20) + 'Instalar app</a><a href="#" id="side-salir">' + ic("log-out", 20) + "Cerrar sesión</a></nav>" +
      '<div style="min-width:0"><header class="top"><div class="in">' + marca.replace('class="brand"', 'class="brand grow"') +
      '<div class="tsearch search"><span class="lupa">' + ic("search", 18) + '</span><input class="inp" id="top-q" placeholder="Buscar un producto…" autocomplete="off" aria-label="Buscar un producto"></div><div class="grow only-desk"></div>' +
      '<span id="net"></span><a class="ibtn" id="lec" href="#/lector" title="Lector de códigos" aria-label="Lector de códigos" style="text-decoration:none;position:relative">' + ic("scan-barcode", 21) + '<i id="lec-dot" class="hide" style="position:absolute;top:8px;right:8px;width:9px;height:9px;border-radius:50%;background:var(--primary);box-shadow:0 0 0 2px var(--surface)"></i></a>' +
      '<a class="ibtn" href="#/alertas" title="Alertas" aria-label="Alertas" style="position:relative;text-decoration:none">' + ic("bell", 21) + '<span class="n hide" data-n></span></a>' +
      '<span class="row" style="gap:10px;margin-left:4px"><span class="hola">Hola,<b>' + esc(nom.split(/[\s@]/)[0]) + '</b></span><span class="avatar" title="' + esc(nom) + '">' + esc(iniciales(nom)) + "</span></span></div></header>" +
      '<main id="view" tabindex="-1"></main></div></div>' +
      '<nav class="tabbar" aria-label="Menú">' + movil.map(function (m) {
        return '<a href="#/' + m.id + '" data-r="' + m.id + '">' + ic(m.ic, 22) + esc(m.corto || m.t) + (m.id === "alertas" ? '<span class="n hide" data-n></span>' : "") + "</a>";
      }).join("") + '<a href="#" id="mas">' + ic("menu", 22) + "Más</a></nav>";
    $("#side-salir").onclick = function (e) { e.preventDefault(); salir() };
    $("#mas").onclick = function (e) { e.preventDefault(); menuMas() };
    $("#top-q").onkeydown = function (e) {
      if (e.key !== "Enter") return; var v = this.value.trim(); if (!v) return;
      var p = M.porCodigo(v); this.value = "";
      if (p) return detalleProducto(p);
      filtroProd.q = v; filtroProd.f = "todos"; if (ruta() === "productos") render(); else location.hash = "#/productos";
    };
    estadoRed();
  }
  function menuMas() {
    var extra = M.modulosActivos().filter(function (m) { return !m.movil });
    var h = M.hoja('<h2>' + esc(M.negocio.nombre) + '</h2><div class="list">' + extra.map(function (m) {
      return '<a class="li" href="#/' + m.id + '" data-cerrar><span class="thumb">' + ic(m.ic, 20) + '</span><span class="t"><b>' + esc(m.t) + "</b></span>" + ic("chevron-right", 18) + "</a>";
    }).join("") + '<button class="li install" id="mm-inst"><span class="thumb">' + ic("download", 20) + '</span><span class="t"><b>Instalar como app</b></span></button>' +
      '<button class="li" id="mm-salir"><span class="thumb">' + ic("log-out", 20) + '</span><span class="t"><b>Cerrar sesión</b><small>' + esc(M.user.email) + "</small></span></button></div>");
    $$("a.li", h).forEach(function (a) { a.addEventListener("click", function () { setTimeout(M.cerrarHoja, 0) }) });
    $("#mm-inst", h).onclick = function () { M.cerrarHoja(); M.pedirInstalar() };
    $("#mm-salir", h).onclick = function () { M.cerrarHoja(); salir() };
  }
  function estadoRed() {
    var el = $("#net"); if (!el) return;
    var n = M.cola().length;
    el.innerHTML = !navigator.onLine ? '<span class="net off">Sin internet' + (n ? " · " + n + " por subir" : "") + "</span>"
      : n ? '<span class="net sync">Subiendo ' + n + "…</span>" : "";
  }
  function pintarContadores() {
    var a = alertas(), n = a.vencidos.length + a.pronto.length + a.cambios.length + a.bajo.length;
    $$("[data-n]").forEach(function (el) { el.textContent = n > 99 ? "99+" : n; el.classList.toggle("hide", !n) });
  }
  function render() {
    if (!M.negocio || !$("#view")) return;
    var r = ruta(), mod = null;
    M.modulosActivos().forEach(function (m) { if (m.id === r) mod = m });
    if (!mod || !VISTAS[r]) { location.hash = "#/inicio"; return }
    $$("[data-r]").forEach(function (a) { a.classList.toggle("on", a.dataset.r === r) });
    var v = $("#view"); v.innerHTML = ""; window.scrollTo(0, 0); document.body.setAttribute("data-r", r);
    document.title = mod.t + " · " + M.negocio.nombre;
    VISTAS[r](v);
    pintarContadores();
  }
  function salir() {
    var n = M.cola().length;
    (n ? M.confirmar("Tienes " + n + " ventas sin subir", "Si sales ahora sin internet, esas ventas se quedan guardadas en este celular hasta que vuelvas a entrar.", "Salir de todos modos", true) : Promise.resolve(true)).then(function (ok) {
      if (!ok) return;
      M.sb.auth.signOut().finally(function () {
        // No dejamos datos del negocio en este dispositivo (salvo ventas pendientes de subir)
        Object.keys(localStorage).forEach(function (k) { if (/^mostrador-(productos|lotes|negocio)/.test(k)) localStorage.removeItem(k) });
        M.negocio = null; M.user = null; M.productos = []; lotes = []; carrito = []; entrada = null;
        location.hash = ""; pantallaAcceso();
      });
    });
  }

  // =====================================================================
  // Componentes compartidos
  // =====================================================================
  var ICONO_CATEGORIA = { "Todos": "layout-grid", "Bebidas": "cup-soda", "Lácteos": "milk", "Salchichonería": "ham", "Carnes frías": "ham", "Botanas": "popcorn",
    "Dulces": "candy", "Galletas": "cookie", "Pan": "croissant", "Abarrotes": "shopping-basket", "Despensa": "shopping-basket", "Cereales": "wheat", "Granel": "package-open",
    "Congelados": "snowflake", "Vinos y licores": "wine", "Bebés": "baby", "Frutas y verduras": "apple", "Higiene": "bath", "Cuidado personal": "sparkles", "Limpieza": "spray-can",
    "Mascotas": "bone", "Cigarros": "box", "Herramientas": "hammer", "Tornillería": "wrench", "Eléctrico": "zap", "Plomería": "droplet", "Pinturas": "paint-bucket",
    "Pegamentos": "droplet", "Jardinería": "apple", "Cerrajería": "wrench", "Construcción": "hammer", "Analgésicos": "pill", "Antigripales": "pill", "Antibióticos": "pill",
    "Gastrointestinal": "pill", "Vitaminas": "heart-pulse", "Curación": "bandage", "Dermatológicos": "sparkles", "Cuadernos": "notebook", "Escritura": "pencil",
    "Arte y manualidades": "scissors", "Oficina": "sticky-note", "Papel": "book-open", "Mochilas": "backpack", "Copias e impresiones": "receipt", "Regalos": "gift", "Temporada escolar": "backpack" };
  function icCat(c, s) { return ic(ICONO_CATEGORIA[c] || "tag", s || 20) }
  M.icCat = icCat;
  function imgOIcono(p, s) {
    return p.imagen ? '<img src="' + esc(p.imagen) + '" alt="" loading="lazy" onerror="this.outerHTML=M.icCat(' + esc(JSON.stringify(p.categoria || "")) + "," + s + ')">' : icCat(p.categoria, s);
  }
  function thumb(p) { return '<span class="thumb" aria-hidden="true">' + imgOIcono(p, 22) + "</span>" }
  function estadoStock(p) {
    if (p.existencia <= 0) return '<span class="badge bad">Agotado</span>';
    if (p.minimo > 0 && p.existencia <= p.minimo) return '<span class="badge warn">Se acaba · ' + M.cant(p.existencia, p.unidad) + "</span>";
    return '<span class="badge ok">' + M.cant(p.existencia, p.unidad) + "</span>";
  }
  function lotesDe(p) { return lotes.filter(function (l) { return l.producto_id === p.id && l.cantidad > 0 }) }
  function proximaCaducidad(p) { var l = lotesDe(p).filter(function (x) { return x.caducidad })[0]; return l ? M.diasHasta(l.caducidad) : null }
  function badgeCad(d) { if (d == null) return ""; return '<span class="badge ' + (d < 0 ? "bad" : d <= M.diasAviso() ? "warn" : "") + '">' + M.vence(d) + "</span>" }
  function buscar(lista, q) {
    q = (q || "").trim().toLowerCase(); if (!q) return lista;
    var ws = q.normalize("NFD").replace(/[̀-ͯ]/g, "").split(/\s+/);
    return lista.filter(function (p) {
      var s = (p.nombre + " " + (p.codigo || "") + " " + (p.categoria || "") + " " + JSON.stringify(p.atributos || {})).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
      return ws.every(function (w) { return s.indexOf(w) >= 0 });
    });
  }
  function categorias() {
    var s = {}; (M.giro.categorias || []).forEach(function (c) { s[c] = 1 }); M.productos.forEach(function (p) { if (p.categoria) s[p.categoria] = 1 });
    return Object.keys(s);
  }
  function esDueno() { return M.rol === "dueno" }
  function puedeInventario() { return M.rol === "dueno" || M.rol === "encargado" }

  // =====================================================================
  // INICIO
  // =====================================================================
  VISTAS.inicio = function (v) {
    var a = alertas(), persona = (M.user.user_metadata && M.user.user_metadata.nombre || "").split(" ")[0];
    var cad = M.tiene("caducidad");
    v.innerHTML = '<div class="pagehead"><div><p class="muted small" style="margin:0">' + esc(M.fecha(M.hoyISO())) + '</p><h1>Hola' + (persona ? ", " + esc(persona) : "") + '</h1></div>' +
      '<div class="row"><a class="btn lg" href="#/vender">' + ic("receipt", 20) + ' Vender</a></div></div>' +
      '<div class="kpis"><div class="kpi dark"><span class="muted small">Vendiste hoy</span><b id="k-hoy">…</b><span class="muted xs" id="k-n"></span></div>' +
      '<a class="kpi" href="#/ventas"><span class="muted small">Ganancia de hoy</span><b id="k-gan">…</b><span class="muted xs">estimada</span></a>' +
      '<a class="kpi ' + (a.bajo.length + a.agotados.length ? "warn" : "") + '" href="#/alertas"><span class="muted small">Se acaban o agotaron</span><b>' + (a.bajo.length + a.agotados.length) + '</b><span class="muted xs">productos</span></a>' +
      (cad ? '<a class="kpi ' + (a.vencidos.length || a.cambios.length ? "bad" : a.pronto.length ? "warn" : "") + '" href="#/alertas"><span class="muted small">Caducidades</span><b>' + (a.vencidos.length + a.pronto.length + a.cambios.length) + '</b><span class="muted xs">' + (a.vencidos.length ? a.vencidos.length + " ya vencidos" : "vencen en " + M.diasAviso() + " días o menos") + "</span></a>"
        : '<a class="kpi" href="#/productos"><span class="muted small">Productos</span><b>' + M.productos.length + '</b><span class="muted xs">en tu catálogo</span></a>') + "</div>" +
      (M.cola().length ? '<div class="note warn mt">' + ic("triangle-alert", 18) + ' Tienes ' + M.cola().length + " ventas guardadas en este celular. Se suben solas cuando vuelva el internet.</div>" : "") +
      (!M.productos.length ? '<div class="card mt"><h2>Empieza por tus productos</h2><p class="body">Escanea el código de barras y nosotros buscamos el nombre. Si no aparece, lo escribes una sola vez.</p><div class="acts"><button class="btn" id="i-esc">' + ic("scan-barcode", 18) + ' Escanear productos</button><a class="btn ghost" href="#/productos">Agregar a mano</a></div></div>' : "") +
      '<div class="sec"><h2>Atención</h2><a href="#/alertas" class="small">Ver todo →</a></div><div id="i-al"></div>' +
      '<div class="sec"><h2>Últimas ventas</h2><a href="#/ventas" class="small">Ver todas →</a></div><div id="i-ven"><div class="spin"></div></div>' +
      (puedeInventario() ? '<div class="sec"><h2>Accesos rápidos</h2></div><div class="row wrap"><a class="btn alt" href="#/entradas">' + ic("truck", 18) + ' Dar entrada a mercancía</a><button class="btn alt" id="i-nuevo">＋ Nuevo producto</button></div>' : "");
    if ($("#i-esc", v)) $("#i-esc", v).onclick = escanearAlta;
    if ($("#i-nuevo", v)) $("#i-nuevo", v).onclick = function () { formProducto() };
    pintarListaAlertas($("#i-al", v), a, 5);
    M.sb.from("mos_ventas").select("id,folio,total,pago,items,creado,cancelada").eq("negocio_id", M.negocio.id).gte("creado", M.inicioDia().toISOString())
      .order("creado", { ascending: false }).limit(1000).then(function (r) {
        if (!$("#k-hoy", v)) return; // ya se cambió de pantalla
        var vs = (r.data || []).filter(function (x) { return !x.cancelada }), pend = M.cola();
        var tot = 0, gan = 0;
        vs.concat(pend).forEach(function (x) { (x.items || []).forEach(function (it) { tot += it.cantidad * it.precio; gan += it.cantidad * (it.precio - (it.costo || 0)) }) });
        $("#k-hoy", v).textContent = money(tot); $("#k-n", v).textContent = (vs.length + pend.length) + " ventas";
        $("#k-gan", v).textContent = esDueno() ? money(gan) : "—";
        var lista = pend.map(function (x) { x._pend = true; return x }).concat(r.data || []).slice(0, 6);
        $("#i-ven", v).innerHTML = lista.length ? '<div class="list">' + lista.map(filaVenta).join("") + "</div>" : '<div class="card empty"><b>Aún no hay ventas hoy</b>Cuando cobres, aparecerán aquí.</div>';
        $$("#i-ven [data-v]", v).forEach(function (b) { b.onclick = function () { verVenta(lista.filter(function (x) { return x.id === b.dataset.v })[0]) } });
      }).catch(function () { var el = $("#i-ven", v); if (el) el.innerHTML = '<div class="card empty">Sin conexión</div>' });
  };
  function filaVenta(x) {
    var n = (x.items || []).reduce(function (s, it) { return s + 1 }, 0);
    return '<button class="li" data-v="' + x.id + '"><span class="thumb">' + ic({ efectivo: "wallet", tarjeta: "credit-card", transferencia: "landmark", fiado: "book-open" }[x.pago] || "receipt", 20) + '</span><span class="t"><b>' +
      (x._pend ? "Por subir" : "Venta #" + x.folio) + "</b><small>" + M.fechaHora(x.creado) + " · " + n + (n === 1 ? " producto" : " productos") + (x.cliente ? " · " + esc(x.cliente) : "") + "</small></span>" +
      (x.cancelada ? '<span class="badge bad">Cancelada</span>' : x._pend ? '<span class="badge warn">Sin subir</span>' : "") + "<b>" + money(x.total != null ? x.total : totalItems(x.items)) + "</b></button>";
  }
  function totalItems(items) { return M.r2((items || []).reduce(function (s, it) { return s + M.r2(it.cantidad * it.precio) }, 0)) }

  // =====================================================================
  // VENDER (punto de venta)
  // =====================================================================
  var catVenta = "";
  VISTAS.vender = function (v) {
    var cats = categorias().filter(function (c) { return M.productos.some(function (p) { return p.categoria === c }) });
    v.innerHTML = '<div class="pos"><div><div class="search"><span class="lupa">' + ic("search", 18) + '</span><input class="inp" id="v-q" placeholder="Busca o escanea un producto" autocomplete="off" autofocus aria-label="Buscar producto"><button class="ibtn" id="v-esc" title="Escanear con la cámara" aria-label="Escanear con la cámara">' + ic("camera", 20) + "</button></div>" +
      (cats.length ? '<div class="sec" style="margin-top:20px"><h2>Categorías</h2></div><div class="tiles" id="v-cats">' + [""].concat(cats).map(function (c) {
        return '<button class="tile' + (catVenta === c ? " on" : "") + '" data-c="' + esc(c) + '">' + icCat(c || "Todos", 28) + "<span>" + esc(c || "Todos") + "</span></button>";
      }).join("") + "</div>" : "") +
      '<div class="sec"><h2>' + (M.productos.length ? "Tus productos" : "Productos") + '</h2></div><div class="pgrid" id="v-grid"></div></div><div class="card cart only-pos" id="v-cart"></div></div>' +
      '<div class="cartbar hidden-pos" id="v-bar"></div>';
    var q = $("#v-q", v);
    q.oninput = pintarGrid;
    q.onkeydown = function (e) {
      if (e.key !== "Enter") return; e.preventDefault();
      var val = q.value.trim(); if (!val) return;
      var p = M.porCodigo(val);
      if (!p) { var r = buscar(M.productos, val); if (r.length === 1) p = r[0] }
      if (p) { agregar(p); q.value = ""; pintarGrid() } else codigoDesconocido(val);
    };
    $("#v-esc", v).onclick = function () { M.escanear(function (c) { var p = M.porCodigo(c); if (p) agregar(p); else codigoDesconocido(c) }, { titulo: "Escanear para vender" }) };
    if ($("#v-cats", v)) $("#v-cats", v).onclick = function (e) { var b = e.target.closest(".tile"); if (!b) return; catVenta = b.dataset.c; $$(".tile", v).forEach(function (x) { x.classList.toggle("on", x === b) }); pintarGrid() };
    pintarGrid(); pintarCarrito();
    function pintarGrid() {
      var lista = buscar(M.productos, q.value); if (catVenta && !q.value) lista = lista.filter(function (p) { return p.categoria === catVenta });
      var g = $("#v-grid", v);
      if (!M.productos.length) { g.innerHTML = '<div class="card empty" style="grid-column:1/-1"><div class="ic">' + ic("package", 40, 1.5) + '</div><b>No tienes productos todavía</b>Agrégalos en Productos para poder venderlos.<div class="mt"><a class="btn" href="#/productos">Ir a Productos</a></div></div>'; return }
      if (!lista.length) { g.innerHTML = '<div class="empty" style="grid-column:1/-1"><b>Sin resultados</b>Prueba con otra palabra o escanea el código.</div>'; return }
      g.innerHTML = lista.slice(0, 80).map(function (p) {
        var st = p.existencia <= 0 ? '<span class="badge bad">Agotado</span>' : p.minimo > 0 && p.existencia <= p.minimo ? '<span class="badge warn">Quedan ' + M.cant(p.existencia, p.unidad) + "</span>" : "";
        return '<button class="pcard" data-p="' + p.id + '"><span class="pimg">' + imgOIcono(p, 44) + "</span>" + (st ? '<span class="st">' + st + "</span>" : "") + '<span class="nm">' + esc(p.nombre) + '</span><span class="pr">' + money(p.precio) +
          (p.unidad !== "pza" ? " <small>/ " + M.unidad(p.unidad).c + "</small>" : "") + '</span><span class="pbtn">' + ic("plus", 16, 2.2) + "Agregar</span></button>";
      }).join("");
      $$(".pcard", g).forEach(function (b) { b.onclick = function () { agregar(M.porId(b.dataset.p)) } });
    }
  };
  function codigoDesconocido(code) {
    // Dueño/encargado: se busca en el catálogo, se pone precio y se agrega a la venta en el mismo paso.
    if (puedeInventario()) return altaPorCodigo(code, function (p) { if (ruta() === "vender") { agregar(p); render() } });
    M.sonar(false);
    var h = M.hoja('<h2>No tienes ese producto</h2><p class="body">El código <b>' + esc(code) + "</b> no está en tu catálogo.</p>" +
      (puedeInventario() ? '<div class="acts"><button class="btn ghost" data-cerrar>Cancelar</button><button class="btn" id="cd-alta">Darlo de alta y vender</button></div>' : '<p class="muted">Pídele al dueño o encargado que lo dé de alta.</p>'));
    if ($("#cd-alta", h)) $("#cd-alta", h).onclick = function () { formProducto(null, { codigo: code, alGuardar: function (p) { if (ruta() === "vender") { agregar(p); render() } } }) };
  }
  function agregar(p, cant) {
    if (!p) return;
    var dec = M.unidad(p.unidad).dec;
    if (dec && cant == null) return pedirCantidad(p);
    var l = carrito.filter(function (x) { return x.id === p.id })[0];
    if (l) l.cantidad = M.r3(l.cantidad + (cant || 1)); else carrito.push({ id: p.id, cantidad: cant || 1 });
    M.sonar(true); pintarCarrito();
    if (p.existencia - (l ? l.cantidad : cant || 1) < 0) M.toast("Ojo: según el sistema ya no hay " + p.nombre + ". Se venderá igual.");
  }
  function pedirCantidad(p, linea) {
    var u = M.unidad(p.unidad);
    var h = M.hoja('<h2>' + esc(p.nombre) + '</h2><p class="muted">' + money(p.precio) + " por " + u.t + '</p><div class="tabs"><button class="on" data-m="c">Por ' + u.c + '</button><button data-m="d">Por dinero ($)</button></div>' +
      '<form id="pc"><input class="inp big" id="pc-v" inputmode="decimal" autofocus aria-label="Cantidad" value="' + (linea ? linea.cantidad : "") + '" placeholder="0">' +
      '<div class="chips mt" id="pc-r">' + (p.unidad === "kg" ? ["0.25", "0.5", "0.75", "1", "2"] : ["0.5", "1", "2", "5", "10"]).map(function (x) { return '<button type="button" class="chip" data-x="' + x + '">' + x + " " + u.c + "</button>" }).join("") + "</div>" +
      '<p class="total"><span class="muted">Importe</span><b id="pc-t">$0.00</b></p><button class="btn block lg">' + (linea ? "Cambiar" : "Agregar") + "</button></form>");
    var modo = "c", inp = $("#pc-v", h);
    function calc() { var n = M.num(inp.value), c = modo === "c" ? n : n / (p.precio || 1); $("#pc-t", h).textContent = modo === "c" ? money(n * p.precio) : M.cant(c, p.unidad); return M.r3(c) }
    inp.oninput = calc;
    $$(".tabs button", h).forEach(function (b) { b.onclick = function () { modo = b.dataset.m; $$(".tabs button", h).forEach(function (x) { x.classList.toggle("on", x === b) }); $("#pc-r", h).classList.toggle("hide", modo === "d"); inp.value = ""; calc(); inp.focus() } });
    $("#pc-r", h).onclick = function (e) { var b = e.target.closest("[data-x]"); if (b) { inp.value = b.dataset.x; calc() } };
    calc();
    $("#pc", h).onsubmit = function (e) {
      e.preventDefault(); var c = calc(); if (!(c > 0)) return M.toast("Escribe una cantidad", "bad");
      M.cerrarHoja();
      if (linea) { linea.cantidad = c; pintarCarrito() } else agregar(p, c);
    };
  }
  function lineasCarrito() {
    return carrito.map(function (l) { var p = M.porId(l.id); return p ? { l: l, p: p, imp: M.r2(l.cantidad * p.precio) } : null }).filter(Boolean);
  }
  function htmlCarrito() {
    var ls = lineasCarrito(), tot = ls.reduce(function (s, x) { return s + x.imp }, 0);
    var head = '<div class="carthead"><div><small>Venta actual</small><b>' + (ls.length ? ls.length + (ls.length === 1 ? " producto" : " productos") : "Nueva venta") + '</b></div><span class="avatar" style="width:40px;height:40px">' + ic("shopping-cart", 20) + "</span></div>";
    if (!ls.length) return head + '<div class="empty"><div class="ic">' + ic("scan-barcode", 40, 1.5) + '</div><b>Sin productos</b>Escanea o toca un producto para agregarlo.</div>';
    var piezas = ls.reduce(function (s, x) { return s + (M.unidad(x.p.unidad).dec ? 1 : x.l.cantidad) }, 0);
    return head + '<div class="lines">' + ls.map(function (x, i) {
      var dec = M.unidad(x.p.unidad).dec;
      return '<div class="line"><span class="no">' + (i + 1) + '</span><div class="t"><b>' + esc(x.p.nombre) + "</b><small>" + money(x.p.precio) + (dec ? " / " + M.unidad(x.p.unidad).c : "") + '</small></div><div class="qty"><button data-menos="' + x.p.id + '" aria-label="Quitar uno">' + ic("minus", 15, 2.2) + '</button><span data-cant="' + x.p.id + '" title="Cambiar cantidad">' +
        M.cant(x.l.cantidad, x.p.unidad).replace(/ pzas?$/, "") + '</span><button data-mas="' + x.p.id + '" aria-label="Agregar uno">' + ic("plus", 15, 2.2) + '</button></div><span class="imp">' + money(x.imp) + '</span><button class="del" data-quitar="' + x.p.id + '" aria-label="Quitar ' + esc(x.p.nombre) + '">' + ic("trash-2", 17) + "</button></div>";
    }).join("") + '</div><div class="resumen"><div class="r"><span>Artículos</span><span>' + M.r3(piezas) + '</span></div><div class="r"><span>Subtotal</span><span>' + money(tot) + "</span></div></div>" +
      '<div class="total"><span>Total</span><b>' + money(tot) + '</b></div><div class="row"><button class="btn alt lg" data-vaciar style="flex:0 0 auto">Vaciar</button><button class="btn ok lg grow" data-cobrar>Cobrar ' + money(tot) + "</button></div>";
  }
  function pintarCarrito() {
    var c = $("#v-cart"); if (c) { c.innerHTML = htmlCarrito(); eventosCarrito(c) }
    var s = $("#sheet .sheet[data-carrito]"); if (s) { s.innerHTML = '<button class="sheet-x" aria-label="Cerrar" data-cerrar>✕</button>' + htmlCarrito(); eventosCarrito(s) }
    var bar = $("#v-bar"); if (bar) {
      var ls = lineasCarrito(), tot = ls.reduce(function (s, x) { return s + x.imp }, 0), n = ls.length;
      bar.innerHTML = n ? '<button class="btn ok block lg" id="v-ver">' + ic("shopping-cart", 20) + n + (n === 1 ? " producto" : " productos") + " · Cobrar " + money(tot) + "</button>" : "";
      if (n) $("#v-ver").onclick = function () { var h = M.hoja(""); h.setAttribute("data-carrito", "1"); pintarCarrito() };
    }
  }
  function eventosCarrito(el) {
    el.onclick = function (e) {
      var t = e.target.closest("button,[data-cant]"); if (!t) return;
      var id = t.dataset.menos || t.dataset.mas || t.dataset.cant, l = carrito.filter(function (x) { return x.id === id })[0], p = M.porId(id);
      if (t.dataset.quitar) { carrito = carrito.filter(function (x) { return x.id !== t.dataset.quitar }); pintarCarrito(); return }
      if (t.hasAttribute("data-vaciar")) { M.confirmar("¿Vaciar la venta?", "Se quitan todos los productos.", "Vaciar", true).then(function (ok) { if (ok) { carrito = []; pintarCarrito() } }); return }
      if (t.hasAttribute("data-cobrar")) return cobrar();
      if (!l || !p) return;
      var dec = M.unidad(p.unidad).dec;
      if (t.dataset.cant) return pedirCantidad(p, l);
      if (t.dataset.mas) l.cantidad = M.r3(l.cantidad + (dec ? 0.5 : 1));
      if (t.dataset.menos) { l.cantidad = M.r3(l.cantidad - (dec ? 0.5 : 1)); if (l.cantidad <= 0) carrito.splice(carrito.indexOf(l), 1) }
      pintarCarrito();
    };
  }
  function cobrar() {
    var ls = lineasCarrito(); if (!ls.length) return;
    var tot = M.r2(ls.reduce(function (s, x) { return s + x.imp }, 0));
    var receta = M.tiene("receta") && ls.some(function (x) { return x.p.atributos && x.p.atributos.requiereReceta });
    var pagos = [["efectivo", ic("wallet", 18) + " Efectivo"], ["tarjeta", ic("credit-card", 18) + " Tarjeta"], ["transferencia", ic("landmark", 18) + " Transferencia"]];
    if (M.tiene("fiado")) pagos.push(["fiado", ic("book-open", 18) + " Fiado"]);
    var h = M.hoja('<h2>Cobrar</h2><div class="total" style="margin-top:0"><span class="muted">Total</span><b>' + money(tot) + "</b></div>" +
      '<div class="pays">' + pagos.map(function (p, i) { return '<button type="button" class="pay' + (i ? "" : " on") + '" data-p="' + p[0] + '">' + p[1] + "</button>" }).join("") + "</div>" +
      '<div id="c-ef"><label class="f"><span>¿Con cuánto paga?</span><input class="inp big" id="c-rec" inputmode="decimal" placeholder="' + M.r2(tot) + '" autofocus></label>' +
      '<div class="chips" id="c-bill"><button type="button" class="chip" data-b="' + tot + '">Exacto</button>' + [20, 50, 100, 200, 500].filter(function (b) { return b >= tot }).slice(0, 4).map(function (b) { return '<button type="button" class="chip" data-b="' + b + '">$' + b + "</button>" }).join("") + '</div><div class="cambio mt hide" id="c-cam"></div></div>' +
      '<div id="c-fi" class="hide"><label class="f"><span>¿Quién se lo lleva fiado?</span><input class="inp" id="c-cli" placeholder="Nombre del cliente"></label></div>' +
      (receta ? '<label class="check note warn"><input type="checkbox" id="c-receta"><span><b>Revisé la receta médica</b><br>Esta venta incluye medicamento que requiere receta.</span></label>' : "") +
      '<button class="btn ok block lg mt" id="c-ok">Confirmar venta</button>');
    var pago = "efectivo", rec = $("#c-rec", h);
    function cambio() {
      var r = M.num(rec.value), c = $("#c-cam", h);
      c.classList.toggle("hide", !(r > 0));
      c.innerHTML = r >= tot ? "<span>Cambio</span><span>" + money(r - tot) + "</span>" : '<span>Faltan</span><span>' + money(tot - r) + "</span>";
      c.style.background = r >= tot ? "" : "var(--bad-soft)"; c.style.color = r >= tot ? "" : "var(--bad)";
    }
    rec.oninput = cambio;
    $("#c-bill", h).onclick = function (e) { var b = e.target.closest("[data-b]"); if (b) { rec.value = b.dataset.b; cambio() } };
    $(".pays", h).onclick = function (e) {
      var b = e.target.closest(".pay"); if (!b) return; pago = b.dataset.p;
      $$(".pay", h).forEach(function (x) { x.classList.toggle("on", x === b) });
      $("#c-ef", h).classList.toggle("hide", pago !== "efectivo"); $("#c-fi", h).classList.toggle("hide", pago !== "fiado");
      if (pago === "fiado") $("#c-cli", h).focus();
    };
    $("#c-ok", h).onclick = function () {
      var r = M.num(rec.value);
      if (pago === "efectivo" && r > 0 && r < tot) return M.toast("Falta dinero: " + money(tot - r), "bad");
      if (pago === "fiado" && !$("#c-cli", h).value.trim()) return M.toast("Escribe el nombre del cliente", "bad");
      if (receta && !$("#c-receta", h).checked) return M.toast("Confirma que revisaste la receta", "bad");
      var venta = {
        id: M.uuid(), negocio_id: M.negocio.id, pago: pago, recibido: pago === "efectivo" ? (r || tot) : tot, creado: new Date().toISOString(),
        cliente: pago === "fiado" ? $("#c-cli", h).value.trim() : "",
        items: ls.map(function (x) { return { producto_id: x.p.id, nombre: x.p.nombre, cantidad: x.l.cantidad, unidad: x.p.unidad, precio: Number(x.p.precio), costo: Number(x.p.costo || 0), importe: x.imp } })
      };
      $("#c-ok", h).disabled = true;
      M.vender(venta).then(function () {
        carrito = []; M.cerrarHoja(); if (ruta() === "vender") render(); pintarContadores();
        ventaLista(venta, tot);
      });
    };
  }
  function ventaLista(venta, tot) {
    var folio = M.folios[venta.id], cambio = venta.pago === "efectivo" ? M.r2(venta.recibido - tot) : 0;
    var txt = M.negocio.nombre + "\n" + (folio ? "Venta #" + folio + "\n" : "") + M.fechaHora(venta.creado) + "\n\n" +
      venta.items.map(function (it) { return M.cant(it.cantidad, it.unidad) + " " + it.nombre + "  " + money(it.importe) }).join("\n") + "\n\nTOTAL " + money(tot) + "\n¡Gracias por su compra!";
    var h = M.hoja('<div class="done"><div class="ok">' + ic("circle-check", 40, 2) + '</div><h2>Venta registrada</h2>' + (cambio > 0 ? '<div class="cambio"><span>Cambio</span><span>' + money(cambio) + "</span></div>" : "") +
      (!folio ? '<p class="muted small mt">Sin internet: se guardó en este celular y se sube sola.</p>' : "") + "</div>" + ticketHtml(venta, tot, folio) +
      '<div class="acts"><a class="btn ghost" target="_blank" rel="noopener" href="https://wa.me/?text=' + encodeURIComponent(txt) + '">' + ic("smartphone", 18) + ' Ticket por WhatsApp</a><button class="btn" data-cerrar autofocus>Nueva venta</button></div>',
      { alCerrar: function () { var q = $("#v-q"); if (q) q.focus() } });
    $("[data-cerrar].btn", h).onclick = function () { M.cerrarHoja(); var q = $("#v-q"); if (q) q.focus() };
  }
  function ticketHtml(venta, tot, folio) {
    return '<div class="ticket mt"><div class="center"><b>' + esc(M.negocio.nombre) + '</b><br><span class="muted">' + (folio ? "Venta #" + folio + " · " : "") + M.fechaHora(venta.creado) + "</span></div><hr style='border:0;border-top:1px dashed var(--line);margin:10px 0'>" +
      venta.items.map(function (it) { return '<div class="tl"><span>' + M.cant(it.cantidad, it.unidad) + " " + esc(it.nombre) + "</span><span>" + money(it.importe) + "</span></div>" }).join("") +
      "<hr style='border:0;border-top:1px dashed var(--line);margin:10px 0'><div class='tl'><b>Total</b><b>" + money(tot) + "</b></div>" +
      '<div class="tl muted"><span>Pago</span><span>' + esc(venta.pago) + (venta.cliente ? " · " + esc(venta.cliente) : "") + "</span></div></div>";
  }

  // =====================================================================
  // PRODUCTOS
  // =====================================================================
  VISTAS.productos = function (v) {
    var cats = categorias().filter(function (c) { return M.productos.some(function (p) { return p.categoria === c }) });
    v.innerHTML = '<div class="pagehead"><h1>Productos <span class="muted" style="font-weight:400">' + M.productos.length + "</span></h1>" +
      (puedeInventario() ? '<div class="row"><button class="btn alt" id="p-esc">' + ic("scan-barcode", 18) + ' Escanear</button><button class="btn" id="p-nuevo">' + ic("plus", 18, 2.2) + ' Nuevo</button></div>' : "") + "</div>" +
      '<div class="search"><span class="lupa">' + ic("search", 18) + '</span><input class="inp" id="p-q" placeholder="Buscar por nombre, código o categoría" value="' + esc(filtroProd.q) + '" aria-label="Buscar"><button class="ibtn" id="p-esc2" aria-label="Buscar escaneando">' + ic("camera", 20) + '</button></div>' +
      '<div class="chips mt" id="p-f">' + [["todos", "Todos"], ["bajo", "Se acaban"], ["agotados", "Agotados"]].concat(M.tiene("caducidad") ? [["cad", "Con caducidad"]] : []).concat(cats.map(function (c) { return ["c:" + c, c] }))
        .map(function (f) { return '<button class="chip' + (filtroProd.f === f[0] ? " on" : "") + '" data-f="' + esc(f[0]) + '">' + esc(f[1]) + "</button>" }).join("") + "</div>" +
      '<div id="p-lista" class="mt"></div>';
    if ($("#p-nuevo", v)) { $("#p-nuevo", v).onclick = function () { formProducto() }; $("#p-esc", v).onclick = escanearAlta }
    $("#p-esc2", v).onclick = function () { M.escanear(function (c) { var p = M.porCodigo(c); if (p) detalleProducto(p); else if (puedeInventario()) altaPorCodigo(c); else codigoDesconocido(c) }) };
    $("#p-q", v).oninput = function () { filtroProd.q = this.value; pintar() };
    $("#p-q", v).onkeydown = function (e) { if (e.key === "Enter") { var p = M.porCodigo(this.value.trim()); if (p) { detalleProducto(p); this.value = ""; filtroProd.q = ""; pintar() } } };
    $("#p-f", v).onclick = function (e) { var b = e.target.closest(".chip"); if (!b) return; filtroProd.f = b.dataset.f; $$("#p-f .chip", v).forEach(function (x) { x.classList.toggle("on", x === b) }); pintar() };
    pintar();
    function pintar() {
      var f = filtroProd.f, l = buscar(M.productos, filtroProd.q).filter(function (p) {
        if (f === "bajo") return p.existencia > 0 && p.minimo > 0 && p.existencia <= p.minimo;
        if (f === "agotados") return p.existencia <= 0;
        if (f === "cad") return p.maneja_caducidad;
        if (f.indexOf("c:") === 0) return p.categoria === f.slice(2);
        return true;
      });
      var el = $("#p-lista", v);
      if (!M.productos.length) { el.innerHTML = '<div class="card empty"><div class="ic">' + ic("package", 40, 1.5) + '</div><b>Agrega tu primer producto</b>Escanea su código de barras: si es conocido, llenamos el nombre por ti.' + (puedeInventario() ? '<div class="acts" style="justify-content:center"><button class="btn" id="pe-esc">' + ic("scan-barcode", 18) + ' Escanear</button><button class="btn ghost" id="pe-man">Escribir a mano</button></div>' : "") + "</div>";
        if ($("#pe-esc", el)) { $("#pe-esc", el).onclick = escanearAlta; $("#pe-man", el).onclick = function () { formProducto() } } return }
      if (!l.length) { el.innerHTML = '<div class="card empty"><b>Sin resultados</b>Prueba con otra búsqueda o filtro.</div>'; return }
      var cad = M.tiene("caducidad"), lim = l.slice(0, 300);
      el.innerHTML = '<div class="list hidden-desk">' + lim.map(function (p) {
        return '<button class="li" data-p="' + p.id + '">' + thumb(p) + '<span class="t"><b class="ellipsis">' + esc(p.nombre) + "</b><small>" + esc(p.categoria || "") + (p.codigo ? " · " + esc(p.codigo) : "") + "</small>" +
          '<span class="row wrap" style="gap:4px;margin-top:4px">' + estadoStock(p) + (cad && p.maneja_caducidad ? badgeCad(proximaCaducidad(p)) : "") + '</span></span><b>' + money(p.precio) + "</b></button>";
      }).join("") + "</div>" +
        '<div class="card only-desk" style="padding:0;overflow:auto"><table class="tbl"><thead><tr><th>Producto</th><th>Categoría</th><th>Existencia</th>' + (cad ? "<th>Caducidad</th>" : "") + '<th class="right">Precio</th>' + (esDueno() ? '<th class="right">Costo</th><th class="right">Ganas</th>' : "") + "</tr></thead><tbody>" +
        lim.map(function (p) {
          var g = p.precio - p.costo;
          return '<tr data-p="' + p.id + '"><td><div class="row">' + thumb(p) + '<div style="min-width:0"><b>' + esc(p.nombre) + '</b><div class="muted xs">' + esc(p.codigo || "Sin código") + "</div></div></div></td><td>" + esc(p.categoria || "") + "</td><td>" + estadoStock(p) + "</td>" +
            (cad ? "<td>" + (p.maneja_caducidad ? badgeCad(proximaCaducidad(p)) || '<span class="muted">—</span>' : '<span class="muted">—</span>') + "</td>" : "") + '<td class="right"><b>' + money(p.precio) + "</b></td>" +
            (esDueno() ? '<td class="right muted">' + money(p.costo) + '</td><td class="right">' + (p.costo > 0 ? money(g) + ' <span class="muted xs">' + Math.round(g / (p.precio || 1) * 100) + "%</span>" : '<span class="muted">—</span>') + "</td>" : "") + "</tr>";
        }).join("") + "</tbody></table></div>" + (l.length > lim.length ? '<p class="muted center small mt">Mostrando 300 de ' + l.length + ". Usa el buscador para encontrar el resto.</p>" : "");
      $$("[data-p]", el).forEach(function (b) { b.onclick = function () { detalleProducto(M.porId(b.dataset.p)) } });
    }
  };
  // Escanear para dar de alta (o abrir si ya existe)
  function escanearAlta() {
    M.escanear(function (c) {
      var p = M.porCodigo(c);
      if (p) { M.toast("Ya lo tienes: " + p.nombre); detalleProducto(p) }
      else altaPorCodigo(c, function () { setTimeout(function () { M.toast("Listo ✓ Escanea el siguiente", "ok"); escanearAlta() }, 300) });
    }, { titulo: "Escanear producto nuevo" });
  }

  // ---------- Alta por código: busca en el catálogo de productos ya registrados ----------
  var PERECEDEROS = ["Lácteos", "Salchichonería", "Pan", "Frutas y verduras", "Congelados", "Bebés"];
  function altaPorCodigo(code, alGuardar) {
    var ya = M.porCodigo(code); if (ya) { M.cerrarHoja(); if (alGuardar) alGuardar(ya); return }
    M.hoja('<h2>Buscando el producto…</h2><p class="muted">Código ' + esc(code) + '</p><div class="spin" style="margin:24px auto"></div>');
    M.buscarCodigo(code).then(function (r) {
      if (!$("#sheet")) return; // la cerró
      if (r) altaRapida(Object.assign({}, r, { codigo: code }), alGuardar);
      else formProducto(null, { codigo: code, yaBuscado: true, alGuardar: alGuardar });
    });
  }
  // Tarjeta rápida: el producto ya viene (nombre, marca, foto, categoría); sólo pones el precio.
  function altaRapida(c, alGuardar) {
    var cad = M.tiene("caducidad"), perece = cad && PERECEDEROS.indexOf(c.categoria) >= 0;
    var h = M.hoja('<div class="row" style="align-items:flex-start;gap:14px;padding-right:40px">' +
      '<span class="thumb" style="width:76px;height:76px;flex:none;background:#fff;border:1px solid var(--line)">' + imgOIcono(c, 36) + "</span>" +
      '<div class="grow"><span class="badge info">✓ Producto encontrado</span><h2 style="margin:6px 0 2px;font-size:18px">' + esc(c.nombre) + '</h2><span class="muted small">' +
      esc([c.marca, c.presentacion].filter(Boolean).join(" · ")) + (c.categoria ? ' · <span class="badge">' + esc(c.categoria) + "</span>" : "") + "</span></div></div>" +
      '<form id="ar" class="mt" novalidate><label class="f"><span>¿A cuánto lo vendes?</span><input class="inp big" name="precio" inputmode="decimal" placeholder="$0.00" autofocus></label>' +
      '<div class="grid2"><label class="f"><span>Te cuesta <span class="muted">(opcional)</span></span><input class="inp" name="costo" inputmode="decimal" placeholder="$0.00"></label>' +
      '<label class="f"><span>¿Cuántos tienes? <span class="muted">(opcional)</span></span><input class="inp" name="existencia" inputmode="decimal" placeholder="0"></label></div>' +
      (cad ? '<label class="check" style="padding-top:0"><input type="checkbox" name="caduca"' + (perece ? " checked" : "") + '><span><b>Caduca</b> <span class="muted small">— te avisamos antes de que se venza</span></span></label>' +
        '<label class="f' + (perece ? "" : " hide") + '" id="ar-cadw"><span>Fecha de caducidad de lo que tienes</span><input class="inp" type="date" name="caducidad"></label>' : "") +
      '<div class="acts"><button type="button" class="btn ghost" id="ar-mas">Cambiar nombre u otros datos</button><button class="btn" id="ar-ok">Guardar</button></div>' +
      '<p class="muted xs center" style="margin-top:10px">Datos del producto: Open Food Facts y tiendas Mostrador</p></form>');
    var f = $("#ar", h);
    if (f.caduca) f.caduca.onchange = function () { $("#ar-cadw", h).classList.toggle("hide", !this.checked) };
    $("#ar-mas", h).onclick = function () {
      formProducto(null, { codigo: c.codigo, nombre: c.nombre, categoria: c.categoria, imagen: c.imagen, precio: f.precio.value, costo: f.costo.value, caducidad: f.caduca && f.caduca.checked, yaBuscado: true, alGuardar: alGuardar });
    };
    f.onsubmit = function (e) {
      e.preventDefault();
      var precio = M.r2(M.num(f.precio.value)); if (!(precio > 0)) { f.precio.focus(); return M.toast("Escribe el precio de venta", "bad") }
      var caduca = !!(f.caduca && f.caduca.checked), exi = M.r3(M.num(f.existencia.value)), fecha = caduca ? f.caducidad.value : "";
      if (caduca && exi > 0 && !fecha) return M.toast("Pon la fecha de caducidad de lo que tienes", "bad");
      $("#ar-ok", h).disabled = true;
      crearProducto({ nombre: c.nombre, codigo: c.codigo, categoria: c.categoria || "General", unidad: M.unidadesNegocio()[0], precio: precio, costo: M.r2(M.num(f.costo.value)),
        minimo: M.giro.alertas.minimo, maneja_caducidad: caduca, atributos: c.marca ? { marca: c.marca } : {}, imagen: c.imagen || "" }, exi, fecha).then(function (prod) {
        M.cerrarHoja(); M.toast(prod.nombre + " agregado ✓", "ok");
        if (alGuardar) alGuardar(prod); else render();
      }).catch(function (er) { if ($("#ar-ok", h)) $("#ar-ok", h).disabled = false; M.error(er) });
    };
  }
  // Guarda un producto nuevo, su existencia inicial y lo comparte (sin precio) con el catálogo de otras tiendas.
  function crearProducto(d, exi, cad) {
    return M.sb.from("mos_productos").insert(Object.assign({ negocio_id: M.negocio.id }, d)).select().single().then(function (r) {
      if (r.error) throw r.error;
      var prod = r.data;
      M.productos.push(prod); M.productos.sort(function (a, b) { return a.nombre.localeCompare(b.nombre) });
      if (d.codigo) M.aportarCatalogo({ codigo: d.codigo, nombre: d.nombre, marca: (d.atributos && d.atributos.marca) || "", categoria: d.categoria, imagen: d.imagen || "" });
      if (!(exi > 0)) return prod;
      return M.sb.rpc("mos_entrada", { p: { negocio_id: M.negocio.id, origen: "manual", items: [{ producto_id: prod.id, cantidad: exi, costo: d.costo, caducidad: d.maneja_caducidad ? cad : "" }] } }).then(function (r2) {
        if (r2.error) throw r2.error; prod.existencia = exi; return cargarLotes().then(function () { return prod });
      });
    });
  }

  function formProducto(p, opts) {
    opts = opts || {}; var nuevo = !p; p = p || { nombre: opts.nombre || "", codigo: opts.codigo || "", categoria: opts.categoria || "", unidad: opts.unidad || M.unidadesNegocio()[0], precio: opts.precio || "", costo: opts.costo || "", minimo: M.giro.alertas.minimo, maneja_caducidad: M.tiene("caducidad") && !!opts.caducidad, atributos: {} };
    var attrs = (M.giro.atributos || []).filter(function (a) { return !a.capacidad || M.tiene(a.capacidad) });
    var h = M.hoja('<h2>' + (nuevo ? "Nuevo producto" : "Editar producto") + '</h2><form id="fp" novalidate>' +
      '<label class="f"><span>Código de barras</span><div class="row"><input class="inp" name="codigo" inputmode="numeric" value="' + esc(p.codigo || "") + '" placeholder="Escanéalo o escríbelo"><button type="button" class="btn alt" id="fp-esc" aria-label="Escanear">' + ic("camera", 20) + '</button></div><small id="fp-off"></small></label>' +
      '<label class="f"><span>Nombre *</span><input class="inp" name="nombre" value="' + esc(p.nombre) + '" placeholder="Ej. Leche entera 1 L" required' + (p.codigo ? "" : " autofocus") + "></label>" +
      '<div class="grid2"><label class="f"><span>Categoría</span><input class="inp" name="categoria" list="fp-cats" value="' + esc(p.categoria || "") + '" placeholder="Elige o escribe"><datalist id="fp-cats">' + categorias().map(function (c) { return '<option value="' + esc(c) + '">' }).join("") + "</datalist></label>" +
      '<label class="f"><span>Se vende por</span><select class="inp" name="unidad">' + M.unidadesNegocio().concat(M.unidadesNegocio().indexOf(p.unidad) < 0 ? [p.unidad] : []).map(function (u) { return '<option value="' + u + '"' + (u === p.unidad ? " selected" : "") + ">" + M.unidad(u).t + "</option>" }).join("") + "</select></label></div>" +
      '<div class="grid2"><label class="f"><span>Precio de venta *</span><input class="inp" name="precio" inputmode="decimal" value="' + esc(p.precio) + '" placeholder="$0.00"></label>' +
      '<label class="f"><span>Te cuesta</span><input class="inp" name="costo" inputmode="decimal" value="' + esc(p.costo || "") + '" placeholder="$0.00"><small id="fp-gan"></small></label></div>' +
      '<div class="grid2"><label class="f"><span>Avísame cuando queden</span><input class="inp" name="minimo" inputmode="decimal" value="' + esc(p.minimo) + '"><small>Se marca “Se acaba”.</small></label>' +
      (nuevo ? '<label class="f"><span>¿Cuántos tienes hoy?</span><input class="inp" name="existencia" inputmode="decimal" placeholder="0"></label>' : "<span></span>") + "</div>" +
      (M.tiene("caducidad") ? '<label class="check"><input type="checkbox" name="maneja_caducidad"' + (p.maneja_caducidad ? " checked" : "") + '><span><b>Este producto caduca</b><br><span class="muted small">Te pediremos la fecha al recibirlo y te avisamos antes de que se venza.</span></span></label>' +
        (nuevo ? '<label class="f' + (p.maneja_caducidad ? "" : " hide") + '" id="fp-cadw"><span>Fecha de caducidad de lo que tienes</span><input class="inp" type="date" name="caducidad" min="' + M.hoyISO(new Date(Date.now() - 864e5 * 365)) + '"></label>' : "") : "") +
      attrs.map(function (a) {
        var val = (p.atributos || {})[a.k];
        return a.tipo === "si-no" ? '<label class="check"><input type="checkbox" name="at_' + a.k + '"' + (val ? " checked" : "") + "><span><b>" + esc(a.t) + "</b></span></label>"
          : '<label class="f"><span>' + esc(a.t) + '</span><input class="inp" name="at_' + a.k + '" value="' + esc(val || "") + '" placeholder="' + esc(a.ej || "") + '"></label>';
      }).join("") +
      '<div class="acts">' + (nuevo ? '<button type="button" class="btn ghost" data-cerrar>Cancelar</button>' : '<button type="button" class="btn ghost" id="fp-del">Quitar del catálogo</button>') + '<button class="btn" id="fp-ok">Guardar</button></div></form>', {});
    var f = $("#fp", h);
    function gan() { var pr = M.num(f.precio.value), co = M.num(f.costo.value); $("#fp-gan", h).textContent = pr > 0 && co > 0 ? "Ganas " + money(pr - co) + " (" + Math.round((pr - co) / pr * 100) + "%)" : "" }
    f.precio.oninput = f.costo.oninput = gan; gan();
    if (f.maneja_caducidad && $("#fp-cadw", h)) f.maneja_caducidad.onchange = function () { $("#fp-cadw", h).classList.toggle("hide", !this.checked) };
    function buscarOFF() {
      var c = f.codigo.value.trim(); if (!c || f.nombre.value.trim()) return;
      $("#fp-off", h).textContent = "Buscando el producto…";
      M.buscarCodigo(c).then(function (r) {
        if (!$("#fp-off", h)) return;
        if (r && !f.nombre.value.trim()) {
          f.nombre.value = r.nombre; f.dataset.imagen = r.imagen || ""; if (r.categoria && !f.categoria.value) f.categoria.value = r.categoria;
          $("#fp-off", h).textContent = "✓ Lo encontramos. Revisa el nombre."; f.precio.focus();
        } else if (!r) { $("#fp-off", h).textContent = "No está en el catálogo; escribe el nombre una sola vez."; if (!f.nombre.value.trim()) f.nombre.focus() }
        else $("#fp-off", h).textContent = "";
      });
    }
    if (opts.imagen) f.dataset.imagen = opts.imagen;
    f.codigo.onchange = buscarOFF;
    if (nuevo && p.codigo && !p.nombre && !opts.yaBuscado) buscarOFF();
    if (nuevo && p.codigo && !p.nombre && opts.yaBuscado) { $("#fp-off", h).textContent = "No está en el catálogo; escríbelo una sola vez y se guarda para la próxima."; f.nombre.focus() }
    $("#fp-esc", h).onclick = function () {
      var guardado = leerForm();
      function reabrir(extra) { if (nuevo) formProducto(null, Object.assign({}, opts, guardado, extra)); else formProducto(Object.assign({}, p, guardado, extra), opts) }
      M.escanear(function (c) { reabrir({ codigo: c }) }, { alCerrar: function () { reabrir({}) } });
    };
    function leerForm() { return { nombre: f.nombre.value, categoria: f.categoria.value, unidad: f.unidad.value, precio: f.precio.value, costo: f.costo.value } }
    if ($("#fp-del", h)) $("#fp-del", h).onclick = function () {
      M.confirmar("¿Quitar " + p.nombre + "?", "Ya no aparecerá para vender. Su historial se conserva.", "Quitar", true).then(function (ok) {
        if (!ok) return;
        M.sb.from("mos_productos").update({ activo: false }).eq("id", p.id).then(function (r) {
          if (r.error) return M.error(r.error);
          M.productos = M.productos.filter(function (x) { return x.id !== p.id }); M.toast("Producto quitado"); render();
        });
      });
    };
    f.onsubmit = function (e) {
      e.preventDefault();
      var d = { nombre: f.nombre.value.trim(), codigo: f.codigo.value.trim() || null, categoria: f.categoria.value.trim() || "General", unidad: f.unidad.value,
        precio: M.r2(M.num(f.precio.value)), costo: M.r2(M.num(f.costo.value)), minimo: M.r3(M.num(f.minimo.value)),
        maneja_caducidad: !!(f.maneja_caducidad && f.maneja_caducidad.checked), atributos: Object.assign({}, p.atributos || {}) };
      attrs.forEach(function (a) { var el = f["at_" + a.k]; d.atributos[a.k] = a.tipo === "si-no" ? el.checked : el.value.trim() });
      if (!d.nombre) return M.toast("Escribe el nombre", "bad");
      if (!(d.precio > 0)) return M.toast("Escribe el precio de venta", "bad");
      if (d.codigo) { var otro = M.porCodigo(d.codigo); if (otro && otro.id !== p.id) return M.toast("Ese código ya es de: " + otro.nombre, "bad") }
      var exi = nuevo ? M.r3(M.num(f.existencia.value)) : 0, cad = nuevo && f.caducidad ? f.caducidad.value : "";
      if (nuevo && d.maneja_caducidad && exi > 0 && !cad) return M.toast("Pon la fecha de caducidad de lo que tienes", "bad");
      if (nuevo && f.dataset.imagen) d.imagen = f.dataset.imagen;
      $("#fp-ok", h).disabled = true;
      var q = nuevo ? crearProducto(d, exi, cad) : M.sb.from("mos_productos").update(d).eq("id", p.id).select().single().then(function (r) {
        if (r.error) throw r.error;
        M.productos = M.productos.map(function (x) { return x.id === r.data.id ? r.data : x }); return r.data;
      });
      q.then(function (prod) {
        M.cerrarHoja(); M.toast(nuevo ? "Producto agregado ✓" : "Cambios guardados ✓", "ok");
        if (opts.alGuardar) opts.alGuardar(prod); else render();
      }).catch(function (er) { $("#fp-ok", h) && ($("#fp-ok", h).disabled = false); M.error(er) });
    };
  }

  function detalleProducto(p) {
    if (!p) return;
    var ls = lotesDe(p), attrs = (M.giro.atributos || []).filter(function (a) { var v = (p.atributos || {})[a.k]; return v && (!a.capacidad || M.tiene(a.capacidad)) });
    var h = M.hoja('<div class="row">' + thumb(p) + '<div class="grow"><h2 style="margin:0">' + esc(p.nombre) + '</h2><span class="muted small">' + esc(p.categoria || "") + (p.codigo ? " · " + esc(p.codigo) : "") + "</span></div></div>" +
      '<div class="kpis mt"><div class="kpi"><span class="muted small">Precio</span><b>' + money(p.precio) + '</b><span class="muted xs">por ' + M.unidad(p.unidad).t + "</span></div>" +
      '<div class="kpi ' + (p.existencia <= 0 ? "bad" : p.minimo > 0 && p.existencia <= p.minimo ? "warn" : "") + '"><span class="muted small">Tienes</span><b>' + M.cant(p.existencia, p.unidad) + '</b><span class="muted xs">aviso al llegar a ' + M.cant(p.minimo, p.unidad) + "</span></div></div>" +
      (attrs.length ? '<div class="card mt small">' + attrs.map(function (a) { var v = p.atributos[a.k]; return '<div class="row between"><span class="muted">' + esc(a.t) + "</span><b>" + (v === true ? "Sí" : esc(v)) + "</b></div>" }).join("") + "</div>" : "") +
      (p.maneja_caducidad ? '<div class="sec" style="margin-top:18px"><h3 style="margin:0">Caducidades</h3></div>' + (ls.length ? '<div class="list">' + ls.map(function (l) {
        var d = M.diasHasta(l.caducidad);
        return '<div class="li"><span class="t"><b>' + M.cant(l.cantidad, p.unidad) + "</b><small>" + (l.caducidad ? "Caduca el " + M.fecha(l.caducidad) : "Sin fecha") + (l.lote ? " · Lote " + esc(l.lote) : "") + (l.cambio_proveedor === "pendiente" ? " · el proveedor lo cambia" : "") + "</small></span>" + badgeCad(d) + "</div>";
      }).join("") + "</div>" : '<p class="muted small">Sin fechas registradas. Se agregan al dar entrada a mercancía.</p>') : "") +
      '<div class="sec" style="margin-top:18px"><h3 style="margin:0">Movimientos recientes</h3></div><div id="dp-mov"><div class="spin" style="margin:16px auto"></div></div>' +
      (puedeInventario() ? '<div class="acts"><button class="btn ghost" id="dp-aj">Corregir existencia</button><button class="btn alt" id="dp-ent">' + ic("truck", 18) + ' Dar entrada</button><button class="btn" id="dp-ed">Editar</button></div>' : ""));
    if ($("#dp-ed", h)) {
      $("#dp-ed", h).onclick = function () { formProducto(p) };
      $("#dp-aj", h).onclick = function () { ajustar(p) };
      $("#dp-ent", h).onclick = function () { M.cerrarHoja(); nuevaEntrada(); agregarLinea(p); location.hash = "#/entradas" };
    }
    var TIPOS = { entrada: "Entrada", venta: "Venta", ajuste: "Corrección", merma: "Merma / salida", devolucion: "Devolución", cancelacion: "Venta cancelada" };
    M.sb.from("mos_movimientos").select("tipo,cantidad,creado,nota").eq("producto_id", p.id).order("creado", { ascending: false }).limit(15).then(function (r) {
      var el = $("#dp-mov", h); if (!el) return;
      var m = r.data || [];
      el.innerHTML = m.length ? '<div class="list">' + m.map(function (x) {
        return '<div class="li"><span class="t"><b>' + (TIPOS[x.tipo] || x.tipo) + "</b><small>" + M.fechaHora(x.creado) + (x.nota ? " · " + esc(x.nota) : "") + '</small></span><b style="color:' + (x.cantidad < 0 ? "var(--bad)" : "var(--ok)") + '">' + (x.cantidad > 0 ? "+" : "") + M.cant(x.cantidad, p.unidad) + "</b></div>";
      }).join("") + "</div>" : '<p class="muted small">Sin movimientos todavía.</p>';
    });
  }
  function ajustar(p) {
    var h = M.hoja('<h2>Corregir existencia</h2><p class="body">' + esc(p.nombre) + '. El sistema dice que tienes <b>' + M.cant(p.existencia, p.unidad) + '</b>.</p><form id="fa"><label class="f"><span>¿Cuántos tienes realmente?</span><input class="inp big" name="real" inputmode="decimal" autofocus></label>' +
      '<label class="f"><span>Motivo</span><select class="inp" name="tipo"><option value="ajuste">Conteo de inventario</option><option value="merma">Se echó a perder / se rompió</option><option value="merma">Robo o faltante</option><option value="ajuste">Otro</option></select></label><button class="btn block lg">Guardar</button></form>');
    $("#fa", h).onsubmit = function (e) {
      e.preventDefault(); var f = this, real = M.num(f.real.value);
      if (f.real.value.trim() === "" || real < 0) return M.toast("Escribe cuántos tienes", "bad");
      var dif = M.r3(real - p.existencia); if (!dif) { M.cerrarHoja(); return }
      M.sb.from("mos_movimientos").insert({ negocio_id: M.negocio.id, producto_id: p.id, tipo: f.tipo.value, cantidad: dif, nota: f.tipo.options[f.tipo.selectedIndex].text }).then(function (r) {
        if (r.error) return M.error(r.error);
        p.existencia = real; M.guardar("mostrador-productos-" + M.negocio.id, M.productos); M.cerrarHoja(); M.toast("Existencia corregida ✓", "ok"); render();
      });
    };
  }

  // =====================================================================
  // ENTRADA DE MERCANCÍA (escáner, factura XML o a mano)
  // =====================================================================
  var proveedores = null;
  function cargarProveedores() {
    if (proveedores) return Promise.resolve(proveedores);
    return M.sb.from("mos_proveedores").select("*").eq("negocio_id", M.negocio.id).order("nombre").then(function (r) { proveedores = r.data || []; return proveedores });
  }
  function nuevaEntrada() { entrada = entrada || { proveedor_id: "", lineas: [], origen: "manual", uuid_cfdi: "", pendientes: [] } }
  function agregarLinea(p, cant, costo) {
    nuevaEntrada();
    var l = entrada.lineas.filter(function (x) { return x.id === p.id && !x.caducidad })[0];
    if (l && !p.maneja_caducidad) l.cantidad = M.r3(l.cantidad + (cant || 1));
    else entrada.lineas.push({ id: p.id, cantidad: cant || 1, costo: costo != null ? costo : Number(p.costo || 0), caducidad: "", cambio: false });
  }
  VISTAS.entradas = function (v) {
    nuevaEntrada();
    cargando(v);
    cargarProveedores().then(function () {
      if (ruta() !== "entradas") return;
      var e = entrada, tot = e.lineas.reduce(function (s, l) { return s + l.cantidad * l.costo }, 0);
      v.innerHTML = '<div class="pagehead"><h1>Entrada de mercancía</h1>' + (e.lineas.length ? '<button class="btn ghost sm" id="e-borrar">Empezar de nuevo</button>' : "") + "</div>" +
        '<div class="kpis" style="grid-template-columns:repeat(auto-fit,minmax(160px,1fr))"><button class="kpi" id="e-esc" style="border:0;text-align:left;cursor:pointer;font:inherit"><b>' + ic("scan-barcode", 26) + '</b><span>Escanear productos</span><br><span class="muted xs">Uno tras otro, como en caja</span></button>' +
        '<label class="kpi" style="cursor:pointer"><b>' + ic("receipt", 26) + '</b><span>Subir factura XML</span><br><span class="muted xs">La del proveedor (CFDI). Se llena sola</span><input type="file" id="e-xml" accept=".xml,text/xml,application/xml" class="hide"></label>' +
        '<button class="kpi" id="e-man" style="border:0;text-align:left;cursor:pointer;font:inherit"><b>' + ic("search", 26) + '</b><span>Buscar producto</span><br><span class="muted xs">Agregar a mano</span></button></div>' +
        '<div class="card mt"><label class="f" style="margin:0"><span>Proveedor</span><div class="row"><select class="inp" id="e-prov"><option value="">Sin proveedor</option>' + proveedores.map(function (p) { return '<option value="' + p.id + '"' + (p.id === e.proveedor_id ? " selected" : "") + ">" + esc(p.nombre) + "</option>" }).join("") + '</select><button class="btn alt" id="e-nprov">＋</button></div></label></div>' +
        (e.pendientes.length ? '<div class="note warn mt"><div class="grow"><b>' + e.pendientes.length + ' productos de la factura no están en tu catálogo.</b><br>Los damos de alta con el costo de la factura y un precio sugerido (+30 %). Luego puedes cambiar el precio.</div></div><div class="list">' + e.pendientes.map(function (c, i) {
          return '<div class="li"><span class="t"><b>' + esc(c.descripcion) + "</b><small>" + (c.codigo ? esc(c.codigo) + " · " : "") + M.cant(c.cantidad, "pza") + " · costo " + money(c.costo) + '</small></span><button class="btn sm alt" data-crear="' + i + '">Revisar</button></div>';
        }).join("") + '</div><button class="btn block mt" id="e-crear-todos">Dar de alta los ' + e.pendientes.length + "</button>" : "") +
        '<div class="sec"><h2>Productos que recibes</h2><span class="muted small">' + e.lineas.length + '</span></div><div id="e-lineas"></div>' +
        (e.lineas.length ? '<div class="card mt"><div class="total" style="margin:0 0 12px"><span class="muted">Total de la compra</span><b>' + money(tot) + '</b></div><button class="btn ok block lg" id="e-guardar">Guardar entrada</button></div>' : "");
      pintarLineas($("#e-lineas", v));
      $("#e-prov", v).onchange = function () { e.proveedor_id = this.value };
      $("#e-nprov", v).onclick = function () { formProveedor(null, function (p) { e.proveedor_id = p.id; render() }) };
      $("#e-esc", v).onclick = escanearEntrada;
      $("#e-man", v).onclick = elegirProducto;
      $("#e-xml", v).onchange = function () { if (this.files[0]) leerXML(this.files[0]) };
      if ($("#e-borrar", v)) $("#e-borrar", v).onclick = function () { M.confirmar("¿Empezar de nuevo?", "Se borra lo que llevas capturado (no lo guardado).", "Sí, borrar", true).then(function (ok) { if (ok) { entrada = null; render() } }) };
      if ($("#e-guardar", v)) $("#e-guardar", v).onclick = guardarEntrada;
      $$("[data-crear]", v).forEach(function (b) { b.onclick = function () { var i = +b.dataset.crear, c = e.pendientes[i]; formProducto(null, { codigo: c.codigo, nombre: c.descripcion, costo: c.costo, precio: precioSugerido(c.costo), unidad: unidadCFDI(c.unidad), alGuardar: function (p) { e.pendientes.splice(i, 1); agregarLinea(p, c.cantidad, c.costo); render() } }) } });
      if ($("#e-crear-todos", v)) $("#e-crear-todos", v).onclick = crearPendientes;
    });
  };
  function pintarLineas(el) {
    var e = entrada;
    if (!e.lineas.length) { el.innerHTML = '<div class="card empty"><div class="ic">' + ic("truck", 40, 1.5) + '</div><b>Aún no agregas productos</b>Escanea, sube la factura o búscalos.</div>'; return }
    var cad = M.tiene("caducidad"), rec = M.tiene("reclamoProveedor");
    el.innerHTML = '<div class="list">' + e.lineas.map(function (l, i) {
      var p = M.porId(l.id); if (!p) return "";
      return '<div class="li" style="flex-wrap:wrap;align-items:flex-end" data-i="' + i + '"><div class="t" style="flex-basis:100%"><div class="row between"><b>' + esc(p.nombre) + '</b><button class="ibtn" data-quitar="' + i + '" aria-label="Quitar">✕</button></div><small>Tienes ' + M.cant(p.existencia, p.unidad) + "</small></div>" +
        '<label class="f grow" style="margin:0"><span>Cantidad (' + M.unidad(p.unidad).c + ')</span><input class="inp" inputmode="decimal" data-k="cantidad" value="' + l.cantidad + '"></label>' +
        '<label class="f grow" style="margin:0"><span>Costo c/u</span><input class="inp" inputmode="decimal" data-k="costo" value="' + (l.costo || "") + '" placeholder="$0.00"></label>' +
        (cad && p.maneja_caducidad ? '<label class="f" style="margin:0;flex:1 1 100%"><span>Fecha de caducidad</span><input class="inp" type="date" data-k="caducidad" value="' + esc(l.caducidad) + '"></label>' +
          (rec ? '<label class="check" style="flex-basis:100%;padding:4px 0 0"><input type="checkbox" data-k="cambio"' + (l.cambio ? " checked" : "") + '><span class="small">El proveedor me lo cambia si se vence</span></label>' : "") : "") + "</div>";
    }).join("") + "</div>";
    el.oninput = el.onchange = function (ev) {
      var k = ev.target.dataset.k; if (!k) return; var i = +ev.target.closest("[data-i]").dataset.i, l = e.lineas[i];
      l[k] = k === "cambio" ? ev.target.checked : k === "caducidad" ? ev.target.value : M.num(ev.target.value);
      if (ev.type === "change" && (k === "cantidad" || k === "costo")) {
        var tot = e.lineas.reduce(function (s, x) { return s + x.cantidad * x.costo }, 0), b = $(".card .total b"); if (b) b.textContent = money(tot);
      }
    };
    el.onclick = function (ev) { var b = ev.target.closest("[data-quitar]"); if (b) { e.lineas.splice(+b.dataset.quitar, 1); render() } };
  }
  function escanearEntrada() {
    M.escanear(function (c) {
      var p = M.porCodigo(c);
      if (p) { agregarLinea(p); M.toast("+1 " + p.nombre) }
      else { M.cerrarHoja(); altaPorCodigo(c, function (np) { agregarLinea(np); render(); setTimeout(escanearEntrada, 300) }) }
    }, { continuo: true, titulo: "Escanea lo que recibes", alCerrar: function () { render() } });
  }
  function elegirProducto() {
    var h = M.hoja('<h2>Agregar producto</h2><div class="search"><span class="lupa">' + ic("search", 18) + '</span><input class="inp" id="ep-q" placeholder="Busca por nombre o código" autofocus></div><div class="list mt" id="ep-l"></div><button class="btn ghost block mt" id="ep-n">＋ Producto nuevo</button>');
    function pintar() {
      var l = buscar(M.productos, $("#ep-q", h).value).slice(0, 30);
      $("#ep-l", h).innerHTML = l.map(function (p) { return '<button class="li" data-p="' + p.id + '">' + thumb(p) + '<span class="t"><b>' + esc(p.nombre) + "</b><small>Tienes " + M.cant(p.existencia, p.unidad) + "</small></span>＋</button>" }).join("") || '<div class="empty">Sin resultados</div>';
    }
    $("#ep-q", h).oninput = pintar; pintar();
    $("#ep-l", h).onclick = function (e) { var b = e.target.closest("[data-p]"); if (b) { agregarLinea(M.porId(b.dataset.p)); M.cerrarHoja(); render() } };
    $("#ep-n", h).onclick = function () { formProducto(null, { alGuardar: function (p) { agregarLinea(p); render() } }) };
  }
  function precioSugerido(costo) { var p = costo * 1.3; return p < 20 ? Math.ceil(p * 2) / 2 : Math.ceil(p) }
  function unidadCFDI(u) {
    u = (u || "").toUpperCase();
    var m = { H87: "pza", PZA: "pza", PIEZA: "pza", EA: "pza", KGM: "kg", KG: "kg", KILO: "kg", LTR: "l", LITRO: "l", MTR: "m", METRO: "m", XBX: "caja", CAJA: "caja", XPK: "paquete", PAQUETE: "paquete" };
    var r = m[u] || m[u.split(" ")[0]] || "pza"; return M.unidadesNegocio().indexOf(r) >= 0 ? r : M.unidadesNegocio()[0];
  }
  function leerXML(file) {
    var rd = new FileReader();
    rd.onload = function () {
      var f;
      try { f = M.leerCFDI(rd.result) } catch (er) { return M.error(er) }
      if (!f.conceptos.length) return M.toast("La factura no trae productos", "bad");
      var yaEsta = f.uuid ? M.sb.from("mos_compras").select("creado").eq("negocio_id", M.negocio.id).eq("uuid_cfdi", f.uuid).maybeSingle() : Promise.resolve({});
      yaEsta.then(function (q) {
        if (q && q.data) return M.toast("Esa factura ya la registraste el " + M.fecha(q.data.creado) + ".", "bad");
        usarFactura(f);
      });
    };
    rd.readAsText(file);
  }
  function usarFactura(f) {
    (function () {
      nuevaEntrada(); var e = entrada; e.origen = "xml"; e.uuid_cfdi = f.uuid;
      // proveedor por RFC o nombre; si no existe se crea
      var prov = proveedores.filter(function (p) { return (f.rfc && p.rfc && p.rfc.toUpperCase() === f.rfc.toUpperCase()) || p.nombre.toLowerCase() === f.emisor.toLowerCase() })[0];
      var listo = prov ? Promise.resolve(prov) : M.sb.from("mos_proveedores").insert({ negocio_id: M.negocio.id, nombre: f.emisor || "Proveedor", rfc: f.rfc }).select().single().then(function (r) { if (r.error) throw r.error; proveedores.push(r.data); return r.data });
      listo.then(function (p) {
        e.proveedor_id = p.id; var ok = 0;
        f.conceptos.forEach(function (c) {
          var prod = (c.codigo && M.porCodigo(c.codigo)) || M.productos.filter(function (x) { return x.nombre.toLowerCase() === c.descripcion.toLowerCase() })[0];
          if (prod) { e.lineas.push({ id: prod.id, cantidad: c.cantidad, costo: c.costo, caducidad: "", cambio: false }); ok++ } else e.pendientes.push(c);
        });
        M.toast("Factura de " + p.nombre + ": " + f.conceptos.length + " productos (" + ok + " ya los tenías)", "ok");
        render();
      }).catch(M.error);
    })();
  }
  function crearPendientes() {
    var e = entrada, filas = e.pendientes.map(function (c) {
      return { negocio_id: M.negocio.id, nombre: c.descripcion, codigo: c.codigo && !M.porCodigo(c.codigo) ? c.codigo : null, costo: c.costo, precio: precioSugerido(c.costo), unidad: unidadCFDI(c.unidad), categoria: "General", minimo: M.giro.alertas.minimo };
    });
    var b = $("#e-crear-todos"); b.disabled = true;
    M.sb.from("mos_productos").insert(filas).select().then(function (r) {
      if (r.error) { b.disabled = false; return M.error(r.error) }
      r.data.forEach(function (p, i) { M.productos.push(p); agregarLinea(p, e.pendientes[i].cantidad, e.pendientes[i].costo) });
      M.productos.sort(function (a, b) { return a.nombre.localeCompare(b.nombre) });
      e.pendientes = []; M.toast(r.data.length + " productos dados de alta ✓", "ok"); render();
    });
  }
  function guardarEntrada() {
    var e = entrada;
    var faltaCad = e.lineas.filter(function (l) { var p = M.porId(l.id); return M.tiene("caducidad") && p && p.maneja_caducidad && !l.caducidad });
    if (e.lineas.some(function (l) { return !(l.cantidad > 0) })) return M.toast("Revisa las cantidades", "bad");
    (faltaCad.length ? M.confirmar("Faltan fechas de caducidad", (faltaCad.length === 1 ? "1 producto que caduca no tiene fecha." : faltaCad.length + " productos que caducan no tienen fecha.") + " Sin fecha no te podremos avisar. ¿Guardar así?", "Guardar así") : Promise.resolve(true)).then(function (ok) {
      if (!ok) return;
      var b = $("#e-guardar"); b.disabled = true;
      M.sb.rpc("mos_entrada", { p: { negocio_id: M.negocio.id, proveedor_id: e.proveedor_id, origen: e.origen, uuid_cfdi: e.uuid_cfdi,
        items: e.lineas.map(function (l) { return { producto_id: l.id, cantidad: l.cantidad, costo: l.costo, caducidad: l.caducidad, cambio: l.cambio } }) } }).then(function (r) {
        if (r.error) { b.disabled = false; return M.error(r.error) }
        var n = e.lineas.length; entrada = null;
        return Promise.all([M.cargarProductos(), cargarLotes()]).then(function () { M.toast("Entrada guardada: " + n + " productos ✓", "ok"); location.hash = "#/inicio" });
      });
    });
  }

  // =====================================================================
  // ALERTAS
  // =====================================================================
  VISTAS.alertas = function (v) {
    var a = alertas();
    v.innerHTML = '<div class="pagehead"><h1>Alertas</h1><div class="row">' + ("Notification" in window && Notification.permission !== "granted" ? '<button class="btn alt sm" id="a-not">' + ic("bell", 18) + ' Avisarme en el celular</button>' : "") +
      (a.bajo.length + a.agotados.length ? '<button class="btn sm" id="a-ped">' + ic("sticky-note", 18) + ' Armar pedido</button>' : "") + "</div></div><div id='a-l'></div>";
    pintarListaAlertas($("#a-l", v), a);
    if ($("#a-not", v)) $("#a-not", v).onclick = function () { Notification.requestPermission().then(function (p) { if (p === "granted") { localStorage.removeItem("mostrador-aviso-" + M.negocio.id); avisarAlertas(); M.toast("Listo, te avisaremos ✓", "ok"); render() } }) };
    if ($("#a-ped", v)) $("#a-ped", v).onclick = function () { armarPedido(a.agotados.concat(a.bajo)) };
  };
  function pintarListaAlertas(el, a, max) {
    var secs = [];
    function sec(titulo, ayuda, items, fila) { if (items.length) secs.push({ t: titulo, a: ayuda, items: items, fila: fila }) }
    sec("Pídele el cambio a tu proveedor", "Productos que el proveedor te cambia: están por vencer o ya vencieron.", a.cambios, filaLote);
    sec("Ya vencieron", "Sácalos del anaquel para no venderlos.", a.vencidos, filaLote);
    sec("Vencen pronto", "Véndelos primero o ponlos en oferta.", a.pronto, filaLote);
    sec("Agotados", "Ya no tienes en existencia.", a.agotados, filaProd);
    sec("Se están acabando", "Llegaron a tu mínimo.", a.bajo, filaProd);
    if (!secs.length) { el.innerHTML = '<div class="card empty"><div class="ic">' + ic("circle-check", 40, 1.5) + '</div><b>Todo en orden</b>No hay productos por acabarse ni por vencer.</div>'; return }
    var n = 0;
    el.innerHTML = secs.map(function (s) {
      if (max && n >= max) return "";
      var it = max ? s.items.slice(0, max - n) : s.items; n += it.length;
      return (max ? "" : '<div class="sec"><div><h2>' + esc(s.t) + ' <span class="muted" style="font-weight:400">' + s.items.length + '</span></h2><p class="muted small" style="margin:0">' + esc(s.a) + "</p></div></div>") +
        '<div class="list' + (max ? "" : "") + '" style="' + (max ? "margin-bottom:8px" : "") + '">' + it.map(function (x) { return s.fila(x, s.t) }).join("") + "</div>";
    }).join("");
    el.onclick = function (e) {
      var b = e.target.closest("[data-acc]"); if (!b) { var r = e.target.closest("[data-pid]"); if (r) detalleProducto(M.porId(r.dataset.pid)); return }
      e.stopPropagation();
      var acc = b.dataset.acc, l = lotes.filter(function (x) { return x.id === b.dataset.l })[0];
      if (acc === "wa") return pedirCambio(l);
      var p = M.porId(l.producto_id);
      var txt = acc === "cambiado" ? ["¿El proveedor ya te lo cambió?", "Sacamos " + M.cant(l.cantidad, p.unidad) + " vencidos de " + p.nombre + ". Lo nuevo dalo de entrada normalmente.", "Sí, ya me lo cambió"]
        : ["¿Ya lo sacaste?", "Se descuentan " + M.cant(l.cantidad, p.unidad) + " de " + p.nombre + " como merma.", "Sí, ya lo saqué"];
      M.confirmar(txt[0], txt[1], txt[2]).then(function (ok) {
        if (!ok) return;
        M.sb.rpc("mos_resolver_lote", { p_lote: l.id, p_accion: acc }).then(function (r) {
          if (r.error) return M.error(r.error);
          Promise.all([M.cargarProductos(), cargarLotes()]).then(function () { M.toast("Listo ✓", "ok"); render() });
        });
      });
    };
  }
  function filaLote(x, sec) {
    var acciones = puedeInventario() ? (x.l.cambio_proveedor === "pendiente"
      ? '<button class="btn sm alt" data-acc="wa" data-l="' + x.l.id + '">' + ic("smartphone", 16) + ' Pedir cambio</button><button class="btn sm" data-acc="cambiado" data-l="' + x.l.id + '">Ya me lo cambió</button>'
      : x.d < 0 ? '<button class="btn sm" data-acc="merma" data-l="' + x.l.id + '">Ya lo saqué</button>' : "") : "";
    return '<div class="li" data-pid="' + x.p.id + '" style="cursor:pointer;flex-wrap:wrap">' + thumb(x.p) + '<span class="t"><b>' + esc(x.p.nombre) + "</b><small>" + M.cant(x.l.cantidad, x.p.unidad) + " · caduca el " + M.fecha(x.l.caducidad) + '</small><span style="display:block;margin-top:4px">' + badgeCad(x.d) + "</span></span>" +
      (acciones ? '<span class="row" style="flex-basis:100%;justify-content:flex-end;gap:6px">' + acciones + "</span>" : "") + "</div>";
  }
  function filaProd(p) {
    return '<div class="li" data-pid="' + p.id + '" style="cursor:pointer">' + thumb(p) + '<span class="t"><b>' + esc(p.nombre) + "</b><small>Mínimo " + M.cant(p.minimo, p.unidad) + "</small></span>" + estadoStock(p) + "</div>";
  }
  function pedirCambio(l) {
    var p = M.porId(l.producto_id);
    cargarProveedores().then(function () {
      var prov = proveedores.filter(function (x) { return x.id === l.proveedor_id })[0];
      var txt = "Hola" + (prov ? " " + prov.nombre : "") + ", soy de " + M.negocio.nombre + ". Tengo " + M.cant(l.cantidad, p.unidad) + " de " + p.nombre + " que " + (M.diasHasta(l.caducidad) < 0 ? "ya venció" : "vence") + " el " + M.fecha(l.caducidad) + ". ¿Me lo pueden cambiar en su próxima visita? Gracias.";
      if (prov && prov.telefono) window.open(M.wa(prov.telefono, txt), "_blank");
      else window.open("https://wa.me/?text=" + encodeURIComponent(txt), "_blank");
    });
  }
  function armarPedido(lista) {
    cargarProveedores().then(function () {
      var h = M.hoja('<h2>Armar pedido</h2><p class="muted small">Te sugerimos pedir lo suficiente para llegar al doble de tu mínimo. Ajusta lo que quieras.</p><div class="list" id="ap-l">' + lista.map(function (p) {
        var sug = Math.max(1, Math.ceil(Math.max(p.minimo * 2, 1) - Math.max(p.existencia, 0)));
        return '<label class="li"><input type="checkbox" checked data-id="' + p.id + '" style="width:22px;height:22px;accent-color:var(--primary)"><span class="t"><b>' + esc(p.nombre) + "</b><small>Tienes " + M.cant(p.existencia, p.unidad) + '</small></span><input class="inp" style="width:90px" inputmode="decimal" value="' + sug + '" data-q="' + p.id + '"></label>';
      }).join("") + '</div><label class="f mt"><span>Mandar a</span><select class="inp" id="ap-p"><option value="">Elegir en WhatsApp</option>' + proveedores.map(function (p) { return '<option value="' + p.id + '">' + esc(p.nombre) + (p.telefono ? "" : " (sin teléfono)") + "</option>" }).join("") + '</select></label><button class="btn block lg" id="ap-ok">' + ic("smartphone", 18) + ' Enviar pedido por WhatsApp</button>', { ancha: true });
      $("#ap-ok", h).onclick = function () {
        var items = $$("[data-id]", h).filter(function (c) { return c.checked }).map(function (c) { var p = M.porId(c.dataset.id); return "• " + M.cant(M.num($('[data-q="' + p.id + '"]', h).value), p.unidad) + " de " + p.nombre });
        if (!items.length) return M.toast("Elige al menos un producto", "bad");
        var prov = proveedores.filter(function (x) { return x.id === $("#ap-p", h).value })[0];
        var txt = "Hola" + (prov ? " " + prov.nombre : "") + ", soy de " + M.negocio.nombre + ". Quiero hacer un pedido:\n" + items.join("\n") + "\n\nGracias.";
        window.open(prov && prov.telefono ? M.wa(prov.telefono, txt) : "https://wa.me/?text=" + encodeURIComponent(txt), "_blank");
      };
    });
  }

  // =====================================================================
  // VENTAS (historial)
  // =====================================================================
  var periodo = "hoy";
  VISTAS.ventas = function (v) {
    v.innerHTML = '<div class="pagehead"><h1>Ventas</h1><div class="chips" id="vs-p">' + [["hoy", "Hoy"], ["7", "7 días"], ["30", "30 días"]].map(function (p) { return '<button class="chip' + (periodo === p[0] ? " on" : "") + '" data-p="' + p[0] + '">' + p[1] + "</button>" }).join("") + '</div></div><div id="vs-c"><div class="spin"></div></div>';
    $("#vs-p", v).onclick = function (e) { var b = e.target.closest(".chip"); if (b) { periodo = b.dataset.p; render() } };
    var desde = periodo === "hoy" ? M.inicioDia() : new Date(M.inicioDia().getTime() - (+periodo - 1) * 864e5);
    M.sb.from("mos_ventas").select("*").eq("negocio_id", M.negocio.id).gte("creado", desde.toISOString()).order("creado", { ascending: false }).limit(2000).then(function (r) {
      if (r.error) throw r.error;
      if (!$("#vs-c", v)) return;
      var vs = r.data || [], val = vs.filter(function (x) { return !x.cancelada }), pend = M.cola().map(function (x) { x._pend = true; return x });
      var tot = 0, gan = 0, top = {};
      val.concat(pend).forEach(function (x) { x.items.forEach(function (it) {
        tot += it.cantidad * it.precio; gan += it.cantidad * (it.precio - (it.costo || 0));
        top[it.producto_id] = top[it.producto_id] || { n: it.nombre, c: 0, i: 0, u: it.unidad }; top[it.producto_id].c += it.cantidad; top[it.producto_id].i += it.cantidad * it.precio;
      }) });
      var nv = val.length + pend.length, tops = Object.keys(top).map(function (k) { return top[k] }).sort(function (a, b) { return b.i - a.i }).slice(0, 5);
      var pagos = {}; val.forEach(function (x) { pagos[x.pago] = (pagos[x.pago] || 0) + Number(x.total) });
      $("#vs-c", v).innerHTML = '<div class="kpis"><div class="kpi dark"><span class="muted small">Vendiste</span><b>' + money(tot) + '</b></div><div class="kpi"><span class="muted small">Ventas</span><b>' + nv + '</b></div><div class="kpi"><span class="muted small">Ticket promedio</span><b>' + money(nv ? tot / nv : 0) + "</b></div>" +
        '<div class="kpi"><span class="muted small">Ganancia estimada</span><b>' + (esDueno() ? money(gan) : "—") + "</b></div></div>" +
        (Object.keys(pagos).length > 1 ? '<p class="muted small mt">' + Object.keys(pagos).map(function (k) { return esc(k) + ": " + money(pagos[k]) }).join(" · ") + "</p>" : "") +
        (tops.length ? '<div class="sec"><h2>Lo que más vendiste</h2></div><div class="list">' + tops.map(function (t, i) { return '<div class="li"><span class="thumb">' + (i + 1) + '</span><span class="t"><b>' + esc(t.n) + "</b><small>" + M.cant(t.c, t.u) + "</small></span><b>" + money(t.i) + "</b></div>" }).join("") + "</div>" : "") +
        '<div class="sec"><h2>Detalle</h2></div>' + (pend.length + vs.length ? '<div class="list">' + pend.concat(vs).map(filaVenta).join("") + "</div>" : '<div class="card empty"><b>Sin ventas en este periodo</b></div>');
      var todas = pend.concat(vs);
      $$("#vs-c [data-v]", v).forEach(function (b) { b.onclick = function () { verVenta(todas.filter(function (x) { return x.id === b.dataset.v })[0]) } });
    }).catch(function (e) { if ($("#vs-c", v)) $("#vs-c", v).innerHTML = '<div class="card empty"><b>Sin conexión</b>Las ventas se ven cuando vuelva el internet.</div>'; console.error(e) });
  };
  function verVenta(x) {
    if (!x) return;
    var tot = x.total != null ? Number(x.total) : totalItems(x.items);
    var h = M.hoja('<h2>' + (x._pend ? "Venta por subir" : "Venta #" + x.folio) + "</h2>" + (x.cancelada ? '<div class="note bad">Esta venta está cancelada.</div>' : "") + ticketHtml(x, tot, x.folio) +
      (!x._pend && !x.cancelada && puedeInventario() ? '<div class="acts"><button class="btn danger" id="vv-c">Cancelar venta</button></div>' : ""));
    if ($("#vv-c", h)) $("#vv-c", h).onclick = function () {
      M.confirmar("¿Cancelar la venta #" + x.folio + "?", "Los productos regresan a tu inventario.", "Sí, cancelar", true).then(function (ok) {
        if (!ok) return;
        M.sb.rpc("mos_cancelar_venta", { p_id: x.id }).then(function (r) {
          if (r.error) return M.error(r.error);
          M.cargarProductos().then(function () { M.toast("Venta cancelada", "ok"); render() });
        });
      });
    };
  }

  // =====================================================================
  // PROVEEDORES
  // =====================================================================
  VISTAS.proveedores = function (v) {
    proveedores = null; cargando(v);
    cargarProveedores().then(function (ps) {
      v.innerHTML = '<div class="pagehead"><h1>Proveedores</h1><button class="btn" id="pv-n">＋ Nuevo</button></div>' +
        (ps.length ? '<div class="list">' + ps.map(function (p) {
          return '<div class="li"><span class="thumb">' + ic("handshake", 20) + '</span><button class="t" style="background:none;border:0;text-align:left;font:inherit;cursor:pointer;padding:0" data-e="' + p.id + '"><b>' + esc(p.nombre) + "</b><small>" + [p.telefono, p.rfc, p.dia_visita && "Visita: " + p.dia_visita].filter(Boolean).map(esc).join(" · ") + "</small></button>" +
            (p.telefono ? '<a class="btn alt sm" target="_blank" rel="noopener" href="' + M.wa(p.telefono, "Hola, soy de " + M.negocio.nombre + ".") + '">' + ic("smartphone", 18) + '</a>' : "") + "</div>";
        }).join("") + "</div>" : '<div class="card empty"><div class="ic">' + ic("handshake", 40, 1.5) + '</div><b>Sin proveedores</b>Agrégalos para pedirles mercancía y cambios por WhatsApp. Al subir una factura XML se agregan solos.</div>');
      $("#pv-n", v).onclick = function () { formProveedor(null, render) };
      $$("[data-e]", v).forEach(function (b) { b.onclick = function () { formProveedor(ps.filter(function (p) { return p.id === b.dataset.e })[0], render) } });
    });
  };
  function formProveedor(p, alGuardar) {
    var n = !p; p = p || {};
    var h = M.hoja('<h2>' + (n ? "Nuevo proveedor" : "Editar proveedor") + '</h2><form id="fv"><label class="f"><span>Nombre *</span><input class="inp" name="nombre" value="' + esc(p.nombre || "") + '" autofocus placeholder="Ej. Bimbo, Lala, Distribuidora…"></label>' +
      '<label class="f"><span>WhatsApp</span><input class="inp" name="telefono" inputmode="tel" value="' + esc(p.telefono || "") + '" placeholder="10 dígitos"></label>' +
      '<div class="grid2"><label class="f"><span>RFC</span><input class="inp" name="rfc" value="' + esc(p.rfc || "") + '"></label><label class="f"><span>Día que pasa</span><input class="inp" name="dia_visita" value="' + esc(p.dia_visita || "") + '" placeholder="Ej. martes"></label></div>' +
      '<button class="btn block lg">Guardar</button></form>');
    $("#fv", h).onsubmit = function (e) {
      e.preventDefault(); var f = this, d = { nombre: f.nombre.value.trim(), telefono: f.telefono.value.trim(), rfc: f.rfc.value.trim().toUpperCase(), dia_visita: f.dia_visita.value.trim() };
      if (!d.nombre) return M.toast("Escribe el nombre", "bad");
      (n ? M.sb.from("mos_proveedores").insert(Object.assign({ negocio_id: M.negocio.id }, d)) : M.sb.from("mos_proveedores").update(d).eq("id", p.id)).select().single().then(function (r) {
        if (r.error) return M.error(r.error);
        proveedores = null; M.cerrarHoja(); M.toast("Proveedor guardado ✓", "ok"); cargarProveedores().then(function () { alGuardar && alGuardar(r.data) });
      });
    };
  }

  // =====================================================================
  // MI NEGOCIO (ajustes)
  // =====================================================================
  VISTAS.ajustes = function (v) {
    var n = M.negocio, caps = n.capacidades || {};
    v.innerHTML = '<div class="pagehead"><h1>Mi negocio</h1></div><form id="aj"><div class="card"><h2>Datos</h2>' +
      '<label class="f"><span>Nombre del negocio</span><input class="inp" name="nombre" value="' + esc(n.nombre) + '"></label>' +
      '<div class="grid2"><label class="f"><span>Estado</span><select class="inp" name="estado">' + GIROS.estados.map(function (e) { return "<option" + (e === n.estado ? " selected" : "") + ">" + e + "</option>" }).join("") + '</select></label><label class="f"><span>Alcaldía o municipio</span><input class="inp" name="municipio" value="' + esc(n.municipio || "") + '"></label></div>' +
      '<label class="f"><span>WhatsApp del negocio</span><input class="inp" name="telefono" inputmode="tel" value="' + esc(n.telefono || "") + '"></label>' +
      '<p class="muted small" style="margin:0">Tipo de negocio: <b>' + M.giro.icono + " " + esc(M.giro.nombre) + "</b></p></div>" +
      '<div class="card"><h2>Funciones</h2><p class="muted small">Prende sólo lo que usas.</p>' + Object.keys(GIROS.capacidades).map(function (k) {
        var c = GIROS.capacidades[k];
        return '<label class="check"><input type="checkbox" name="cap_' + k + '"' + (caps[k] ? " checked" : "") + '><span><b>' + esc(c.pregunta.replace(/^¿|\?$/g, "")) + '</b><br><span class="muted small">' + esc(c.ayuda) + "</span></span></label>";
      }).join("") +
      '<label class="f mt"><span>Avisarme de caducidades con cuántos días de anticipación</span><input class="inp" name="diasAviso" inputmode="numeric" value="' + M.diasAviso() + '" style="max-width:120px"></label></div>' +
      '<div class="card"><h2>Personas que usan el sistema</h2><p class="muted small" style="margin:0">Pronto podrás dar acceso a tus cajeros con permisos limitados (no verán costos ni ganancias).</p></div>' +
      '<div class="acts"><button class="btn lg">Guardar cambios</button></div></form>' +
      '<div class="card mt"><div class="row wrap"><button class="btn alt install" onclick="M.pedirInstalar()">' + ic("download", 18) + ' Instalar como app</button><button class="btn ghost" id="aj-salir">Cerrar sesión</button></div></div>';
    $("#aj-salir", v).onclick = salir;
    $("#aj", v).onsubmit = function (e) {
      e.preventDefault(); var f = this, c = {};
      Object.keys(GIROS.capacidades).forEach(function (k) { if (f["cap_" + k].checked) c[k] = true });
      if (!c.caducidad) delete c.reclamoProveedor;
      var d = Math.max(1, Math.min(365, parseInt(f.diasAviso.value, 10) || 7)); c.diasAviso = d;
      var upd = { nombre: f.nombre.value.trim() || n.nombre, estado: f.estado.value, municipio: f.municipio.value.trim(), telefono: f.telefono.value.trim(), capacidades: c };
      M.sb.from("mos_negocios").update(upd).eq("id", n.id).select().single().then(function (r) {
        if (r.error) return M.error(r.error);
        M.usarNegocio(r.data, M.rol); pintarShell(); render(); M.toast("Cambios guardados ✓", "ok");
      });
    };
  };

  M.iconoLector = '<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true"><path d="M3 5h2v14H3zM7 5h1v14H7zM10 5h2v14h-2zM14 5h1v14h-1zM17 5h1v14h-1zM20 5h1v14h-1z"/><rect x="1" y="11.3" width="22" height="1.4" fill="#e32d14"/></svg>';
  // =====================================================================
  // PISTOLA LECTORA: qué hacer con cada código según la pantalla
  // =====================================================================
  function puntoLector() { var d = $("#lec-dot"); if (d) d.classList.toggle("hide", !(M.lector.activo || M.lector.estadoBLE() === "conectado")) }
  document.addEventListener("mostrador:lector", puntoLector);
  M.alEscanear = function (code) {
    puntoLector();
    if (!M.negocio || !$("#view")) return;
    var r = ruta(), hoja = $("#sheet");
    if (r === "lector") return; // la pantalla de prueba lo muestra ella misma
    if (hoja) {
      var man = $("#scan-man", hoja);
      if (man) { $("input", man).value = code; man.dispatchEvent(new Event("submit", { cancelable: true })); return } // cámara abierta
      if (!$(".sheet[data-carrito]")) { M.sonar(false); return M.toast("Termina o cierra esta ventana antes de escanear otro producto", "bad") }
    }
    var p = M.porCodigo(code);
    if (r === "vender") { if (p) agregar(p); else codigoDesconocido(code); return }
    if (r === "entradas" && puedeInventario()) {
      if (p) { agregarLinea(p); M.sonar(true); M.toast("+1 " + p.nombre); render() }
      else altaPorCodigo(code, function (np) { agregarLinea(np); render() });
      return;
    }
    if (p) { M.sonar(true); detalleProducto(p) }
    else if (puedeInventario()) altaPorCodigo(code);
    else codigoDesconocido(code);
  };

  VISTAS.lector = function (v) {
    var L = M.lector, ble = L.bleDisponible(), est = L.estadoBLE();
    var ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    v.innerHTML = '<div class="pagehead"><h1>Lector de códigos</h1></div>' +
      '<div class="card" id="lp-prueba" style="text-align:center;padding:28px 16px"><div style="transform:scale(2.4);height:56px;padding-top:16px">' + M.iconoLector + '</div><h2 id="lp-t">Escanea cualquier producto para probar</h2>' +
      '<p class="muted" id="lp-s" style="margin:0">No necesitas tocar nada: apunta la pistola y dispara.</p><div id="lp-r"></div></div>' +
      '<div class="card"><div class="row between"><h2 style="margin:0">Pistola Bluetooth (modo teclado)</h2><span class="badge ' + (L.activo ? "ok" : "") + '" id="lp-hid">' + (L.activo ? "✓ Funcionando" : "Esperando lectura") + "</span></div>" +
      '<p class="body small mt">Es el modo que traen casi todas las pistolas. Funciona en <b>Android, iPhone y PC</b>.</p><ol class="small body" style="padding-left:20px;margin:0">' +
      "<li>Enciende la pistola y ponla en <b>modo Bluetooth HID / teclado</b> (lo indica su manual; casi siempre es escanear un código de configuración).</li>" +
      "<li>En tu " + (ios ? "iPhone: <b>Ajustes → Bluetooth</b>" : "celular: <b>Ajustes → Bluetooth → Vincular dispositivo</b>") + " y elige la pistola.</li>" +
      "<li>Regresa aquí y escanea un producto. Si aparece arriba, ¡listo! Ya funciona en Vender, Productos y Entradas.</li></ol>" +
      '<div class="note info mt small"><span>Al conectar la pistola, ' + (ios ? "el iPhone oculta el teclado de la pantalla. Para escribir, apaga la pistola o toca dos veces su botón (depende del modelo)." : "Android puede ocultar el teclado de la pantalla. Para que siga apareciendo: Ajustes → Idioma y teclado → Teclado físico → activa “Mostrar teclado en pantalla”.") + "</span></div>" +
      '<div class="note warn small" style="margin:0"><span>Si la pistola escribe letras raras o le faltan números: configúrala en idioma de teclado <b>US / Inglés</b> y con <b>Enter (CR)</b> al final, desde su manual.</span></div></div>' +
      '<div class="card"><div class="row between"><h2 style="margin:0">Conexión directa (BLE)</h2><span class="badge ' + (est === "conectado" ? "ok" : est === "desconectado" ? "warn" : "") + '">' + (est === "conectado" ? "✓ " + esc(L.ble.nombre) : est === "desconectado" ? "Reconectando…" : "Sin conectar") + "</span></div>" +
      '<p class="body small mt">Para pistolas que se conectan directo con la app (sin vincularlas en Ajustes). ' + (ble ? "Disponible en este navegador." : "<b>No disponible aquí:</b> sólo funciona en Chrome de Android o computadora (no en iPhone). Usa el modo teclado.") + "</p>" +
      (ble ? '<div class="row wrap">' + (est === "sin" ? '<button class="btn" id="lp-ble">' + ic("bluetooth", 18) + ' Conectar lector Bluetooth</button>' : '<button class="btn ghost" id="lp-desc">Desconectar</button>') + "</div>" : "") + "</div>" +
      '<div class="card"><h2>Lector USB</h2><p class="body small" style="margin:0">Conéctalo a la computadora (o al celular con un adaptador OTG). Funciona igual que el modo teclado, sin configurar nada.</p></div>';
    if ($("#lp-ble", v)) $("#lp-ble", v).onclick = function () {
      var b = this; b.disabled = true; b.textContent = "Buscando lectores…";
      M.lector.conectarBLE().then(function (x) { M.toast("Conectado a " + x.nombre + " ✓", "ok"); render() }).catch(function (e) {
        b.disabled = false; b.innerHTML = ic("bluetooth", 18) + " Conectar lector Bluetooth";
        if (e && e.name === "NotFoundError") return; // canceló la ventana
        M.error(e);
      });
    };
    if ($("#lp-desc", v)) $("#lp-desc", v).onclick = function () { M.lector.desconectarBLE(); render() };
    var quitar = M.lector.escuchar(function (code, origen) {
      if (!$("#lp-prueba")) return quitar();
      var p = M.porCodigo(code);
      $("#lp-hid").textContent = "✓ Funcionando"; $("#lp-hid").className = "badge ok";
      $("#lp-t").textContent = "✓ Leído: " + code; $("#lp-s").textContent = origen === "bluetooth" ? "Por conexión directa (BLE)" : "Por pistola (modo teclado)";
      var r = $("#lp-r");
      if (p) { M.sonar(true); r.innerHTML = '<div class="list mt" style="text-align:left"><button class="li" id="lp-p">' + thumb(p) + '<span class="t"><b>' + esc(p.nombre) + "</b><small>" + money(p.precio) + " · tienes " + M.cant(p.existencia, p.unidad) + "</small></span>›</button></div>"; $("#lp-p").onclick = function () { detalleProducto(p) } }
      else {
        r.innerHTML = '<p class="muted mt">Buscando en el catálogo…</p>';
        M.buscarCodigo(code).then(function (c) {
          if (!$("#lp-r")) return; M.sonar(!!c);
          r.innerHTML = '<div class="note ' + (c ? "info" : "warn") + ' mt" style="text-align:left"><div class="grow">' + (c ? "<b>" + esc(c.nombre) + "</b><br>Está en el catálogo, pero aún no en tu tienda." : "Este código no está en tu tienda ni en el catálogo.") + "</div>" +
            (puedeInventario() ? '<button class="btn sm" id="lp-alta">Darlo de alta</button>' : "") + "</div>";
          if ($("#lp-alta")) $("#lp-alta").onclick = function () { if (c) altaRapida(Object.assign({}, c, { codigo: code })); else formProducto(null, { codigo: code, yaBuscado: true }) };
        });
      }
    });
  };

  arrancar();
})();
