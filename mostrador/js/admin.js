// Mostrador · Administración de la plataforma (sólo el super administrador).
// Igual que el panel de psicoagenda: Resumen, Tiendas con su acceso, Pagos por confirmar, Crear acceso y Cobro.
// Todo pasa por funciones del servidor que revisan mos_es_superadmin() (supabase/plataforma.sql).
(function () {
  "use strict";
  var C = window.MOSTRADOR || {};
  var sb = window.supabase.createClient(C.url, C.key, { auth: { persistSession: true, storageKey: "mostrador-auth" } });  // misma sesión que la app
  var root = document.getElementById("adm");
  var S = { tab: (location.hash.replace("#", "") || "resumen"), tiendas: [], pagos: [], conf: null, q: "", f: "todas", user: null };
  var TZ = "America/Mexico_City";

  // ---------- utilidades ----------
  function $(s, el) { return (el || document).querySelector(s) }
  function $$(s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)) }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] }) }
  function money(n) { n = Math.round((+n || 0) * 100) / 100; return "$" + n.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }
  function money0(n) { return "$" + Math.round(+n || 0).toLocaleString("es-MX") }
  function hoyISO() { return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()) }
  function fecha(d) { if (!d) return "—"; var x = new Date(String(d).length === 10 ? d + "T12:00:00Z" : d); return x.toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric", timeZone: String(d).length === 10 ? "UTC" : TZ }) }
  function hace(d) {
    if (!d) return "Nunca"; var m = (Date.now() - new Date(d)) / 60000;
    if (m < 60) return "Hace " + Math.max(1, Math.round(m)) + " min"; if (m < 1440) return "Hace " + Math.round(m / 60) + " h";
    var dd = Math.round(m / 1440); return dd === 1 ? "Ayer" : "Hace " + dd + " días";
  }
  function dias(iso) { if (!iso) return null; return Math.round((Date.parse(iso + "T00:00:00Z") - Date.parse(hoyISO() + "T00:00:00Z")) / 864e5) }
  function sumarDias(n) { var d = new Date(Date.parse(hoyISO() + "T12:00:00Z") + n * 864e5); return d.toISOString().slice(0, 10) }
  function toast(msg, kind) {
    $$(".toast").forEach(function (x) { x.parentNode.removeChild(x) });
    var t = document.createElement("div"); t.className = "toast " + (kind || ""); t.textContent = msg; document.body.appendChild(t);
    requestAnimationFrame(function () { t.classList.add("on") }); setTimeout(function () { t.classList.remove("on"); setTimeout(function () { t.remove() }, 400) }, 3500);
  }
  function err(e) { toast((e && (e.message || e.error)) || String(e), "bad"); console.error(e) }
  function hoja(html) {
    cerrar(); var w = document.createElement("div"); w.className = "sheet-bg"; w.id = "sheet";
    w.innerHTML = '<div class="sheet wide" role="dialog" aria-modal="true"><button class="sheet-x" aria-label="Cerrar" data-cerrar>✕</button>' + html + "</div>";
    w.addEventListener("click", function (e) { if (e.target === w || e.target.hasAttribute("data-cerrar")) cerrar() });
    document.body.appendChild(w); document.body.classList.add("noscroll"); return $(".sheet", w);
  }
  function cerrar() { var s = $("#sheet"); if (s) s.remove(); document.body.classList.remove("noscroll") }
  function confirmar(t, d, si, peligro) {
    return new Promise(function (ok) {
      var h = hoja("<h2>" + esc(t) + '</h2><p class="body">' + esc(d) + '</p><div class="acts"><button class="btn ghost" data-cerrar>Cancelar</button><button class="btn ' + (peligro ? "danger" : "") + '" id="cf-si">' + esc(si) + "</button></div>");
      $("#cf-si", h).onclick = function () { cerrar(); ok(true) };
      $$("[data-cerrar]", h).forEach(function (b) { b.addEventListener("click", function () { ok(false) }) });
    });
  }
  function rpc(fn, args) { return sb.rpc(fn, args).then(function (r) { if (r.error) throw r.error; return r.data }) }
  function giroIc(g) { var x = (window.GIROS && GIROS.get(g)) || {}; return ic(x.ic || "store", 18) }

  // ---------- estado de acceso de una tienda ----------
  function acceso(t) {
    if (t.es_demo) return { k: "demo", txt: "Demo", cls: "p-calm" };
    if (t.bloqueado) return { k: "bloqueada", txt: "Sin acceso (bloqueada)", cls: "p-bad" };
    var d = dias(t.vence);
    if (t.plan === "activa") return { k: "activa", d: d, txt: "Pagada · " + (d <= 7 ? "vence en " + d + (d === 1 ? " día" : " días") : "hasta " + fecha(t.vence)), cls: d <= 7 ? "p-warn" : "p-ok" };
    if (t.plan === "prueba") return { k: "prueba", d: d, txt: "Prueba · " + (d <= 0 ? "vence hoy" : "quedan " + d + (d === 1 ? " día" : " días")), cls: "p-warn" };
    return { k: "vencida", d: d, txt: "Venció el " + fecha(t.vence), cls: "p-bad" };
  }
  function pill(t) { var a = acceso(t); return '<span class="pill ' + a.cls + '">' + esc(a.txt) + "</span>" }
  function precioDe(t) { return +(t.precio_mensual || (S.conf && S.conf.precio_mensual) || 299) }

  // ---------- arranque: sesión y permiso ----------
  function inicio() {
    root.innerHTML = '<div class="spin"></div>';
    sb.auth.getSession().then(function (r) {
      S.user = r.data.session && r.data.session.user;
      if (!S.user) return acceso_();
      return rpc("mos_es_superadmin").then(function (es) {
        if (!es) {
          root.innerHTML = '<div class="auth"><div class="box card" style="max-width:420px;text-align:center"><div class="empty"><div class="ic">' + ic("lock", 40, 1.5) + "</div><b>Sin permisos</b>" +
            "La cuenta " + esc(S.user.email) + ' no es de administrador.</div><div class="acts"><a class="btn ghost" href="index.html">Ir a la app</a><button class="btn" id="out">Entrar con otra cuenta</button></div></div></div>';
          $("#out").onclick = function () { sb.auth.signOut().then(acceso_) };
          return;
        }
        return cargar().then(pintar);
      });
    }).catch(err);
  }
  function acceso_() {
    root.innerHTML = '<div class="auth"><div class="box"><div class="brand"><span class="logo">' + ic("shield-check", 20, 2) + '</span><span>Mostrador · Administración</span></div>' +
      '<h1 class="hero-t">Panel de la plataforma</h1><p class="body">Entra con tu cuenta de administrador.</p>' +
      '<form class="card mt" id="fa"><label class="f"><span>Correo</span><input class="inp" name="email" type="email" autocomplete="email" required></label>' +
      '<label class="f"><span>Contraseña</span><input class="inp" name="pass" type="password" autocomplete="current-password" required></label><button class="btn block lg">Entrar</button></form></div></div>';
    $("#fa").onsubmit = function (e) {
      e.preventDefault(); var f = this, b = $("button", f); b.disabled = true;
      sb.auth.signInWithPassword({ email: f.email.value.trim().toLowerCase(), password: f.pass.value }).then(function (r) {
        b.disabled = false; if (r.error) return toast(/Invalid/i.test(r.error.message) ? "Correo o contraseña incorrectos" : r.error.message, "bad"); inicio();
      });
    };
  }
  function cargar() {
    return Promise.all([
      rpc("mos_admin_tiendas"),
      sb.from("mos_pagos").select("*").order("creado", { ascending: false }).limit(1000).then(function (r) { if (r.error) throw r.error; return r.data }),
      sb.from("mos_plataforma").select("*").eq("id", 1).maybeSingle().then(function (r) { return r.data })
    ]).then(function (x) { S.tiendas = x[0] || []; S.pagos = x[1] || []; S.conf = x[2] || {}; S.cargado = new Date() });
  }
  function tiendaDe(id) { return S.tiendas.filter(function (t) { return t.id === id })[0] }

  // ---------- estructura ----------
  function pintar() {
    var pend = S.pagos.filter(function (p) { return p.estado === "pendiente" }).length;
    var TABS = [["resumen", "trending-up", "Resumen"], ["tiendas", "store", "Tiendas"], ["pagos", "banknote", "Pagos", pend], ["crear", "user-plus", "Crear acceso"], ["cobro", "settings", "Cobro y prueba"]];
    root.innerHTML = '<header class="adm-head"><span class="brand grow"><span class="logo">' + ic("shield-check", 20, 2) + '</span><span>Administración · Mostrador</span></span>' +
      '<a class="btn ghost sm" href="index.html">' + ic("store", 16) + ' <span class="solo-desk">Ir a la app</span></a><button class="btn ghost sm" id="salir">' + ic("log-out", 16) + "</button></header>" +
      '<div class="adm-wrap"><nav class="adm-tabs" role="tablist">' + TABS.map(function (t) {
        return '<button data-tab="' + t[0] + '" class="' + (S.tab === t[0] ? "on" : "") + '">' + ic(t[1], 17) + t[2] + (t[3] ? '<span class="n">' + t[3] + "</span>" : "") + "</button>";
      }).join("") + '</nav><div id="vista"></div></div>';
    $$("[data-tab]").forEach(function (b) { b.onclick = function () { S.tab = b.dataset.tab; location.hash = S.tab; pintar() } });
    $("#salir").onclick = function () { sb.auth.signOut().then(inicio) };
    var v = $("#vista");
    ({ resumen: vResumen, tiendas: vTiendas, pagos: vPagos, crear: vCrear, cobro: vCobro }[S.tab] || vResumen)(v);
  }
  function recargar() { return cargar().then(pintar).catch(err) }

  // ---------- Resumen ----------
  function vResumen(v) {
    var T = S.tiendas.filter(function (t) { return !t.es_demo }), A = T.map(function (t) { return { t: t, a: acceso(t) } });
    var con = A.filter(function (x) { return x.a.k === "prueba" || x.a.k === "activa" }).length;
    var prueba = A.filter(function (x) { return x.a.k === "prueba" }).length, pagan = A.filter(function (x) { return x.a.k === "activa" }).length;
    var sin = A.filter(function (x) { return x.a.k === "vencida" || x.a.k === "bloqueada" }).length;
    var pronto = A.filter(function (x) { return (x.a.k === "prueba" || x.a.k === "activa") && x.a.d <= 7 }).sort(function (a, b) { return a.a.d - b.a.d });
    var conf = S.pagos.filter(function (p) { return p.estado === "confirmado" }), pend = S.pagos.filter(function (p) { return p.estado === "pendiente" });
    var mes = hoyISO().slice(0, 7), delMes = conf.filter(function (p) { return (p.revisado_en || p.creado).slice(0, 7) === mes });
    var total = conf.reduce(function (s, p) { return s + +p.monto }, 0), totMes = delMes.reduce(function (s, p) { return s + +p.monto }, 0);
    var mrr = A.filter(function (x) { return x.a.k === "activa" }).reduce(function (s, x) { return s + precioDe(x.t) }, 0);
    function kpi(n, t, d, cls, tab) { return '<button class="kpi ' + (cls || "") + '" ' + (tab ? 'data-ir="' + tab + '"' : "") + ' style="text-align:left;font:inherit;cursor:' + (tab ? "pointer" : "default") + '"><span class="muted small">' + t + "</span><b>" + n + '</b><span class="muted xs">' + d + "</span></button>" }
    v.innerHTML = '<div class="pagehead"><h1>Resumen</h1><span class="muted small">Actualizado ' + S.cargado.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" }) + ' · <a href="#" id="rec">Actualizar</a></span></div>' +
      '<div class="adm-kpis">' + kpi(T.length, "Tiendas registradas", "sin contar la demo", "dark", "tiendas") + kpi(con, "Con acceso", prueba + " en prueba · " + pagan + " pagando", "", "tiendas") +
      kpi(pronto.length, "Vencen en 7 días o menos", "para avisarles", pronto.length ? "warn" : "", "tiendas") + kpi(sin, "Sin acceso", "vencidas o bloqueadas", sin ? "bad" : "", "tiendas") + "</div>" +
      '<div class="sec"><h2>Ingresos</h2></div><div class="adm-kpis">' + kpi(money0(totMes), "Cobrado este mes", delMes.length + " pagos confirmados") + kpi(money0(mrr), "Ingreso mensual estimado", "lo que pagan al mes las tiendas activas") +
      kpi(money0(total), "Total cobrado", conf.length + " pagos") + kpi(pend.length, "Pagos por confirmar", pend.length ? "te avisaron que ya pagaron" : "nada pendiente", pend.length ? "warn" : "", "pagos") + "</div>" +
      '<div class="sec"><h2>Renovaciones próximas</h2></div><div class="card">' + (pronto.length ? pronto.map(function (x) {
        return '<button class="ren" data-t="' + x.t.id + '"><span><b>' + esc(x.t.nombre) + '</b><br><small class="muted">' + esc(x.t.dueno || "") + " · " + esc([x.t.municipio, x.t.estado].filter(Boolean).join(", ")) + "</small></span>" + pill(x.t) + "</button>";
      }).join("") : '<div class="empty" style="padding:20px">Nadie vence en los próximos 7 días.</div>') + "</div>" +
      '<div class="sec"><h2>Tiendas por estado</h2></div><div class="card">' + porEstado(T) + "</div>";
    $("#rec").onclick = function (e) { e.preventDefault(); recargar() };
    $$("[data-ir]", v).forEach(function (b) { b.onclick = function () { S.tab = b.dataset.ir; location.hash = S.tab; pintar() } });
    $$("[data-t]", v).forEach(function (b) { b.onclick = function () { ventanaAcceso(b.dataset.t) } });
  }
  function porEstado(T) {
    var m = {}; T.forEach(function (t) { var k = t.estado || "Sin estado"; m[k] = (m[k] || 0) + 1 });
    var ks = Object.keys(m).sort(function (a, b) { return m[b] - m[a] }), max = Math.max.apply(null, ks.map(function (k) { return m[k] }).concat([1]));
    if (!ks.length) return '<div class="empty" style="padding:20px">Aún no hay tiendas.</div>';
    return ks.map(function (k) { return '<div class="row" style="margin:6px 0"><span style="width:150px;flex:none" class="small">' + esc(k) + '</span><span class="grow" style="background:var(--surface-2);border-radius:6px;height:12px"><i style="display:block;height:12px;border-radius:6px;background:var(--primary);width:' + Math.round(m[k] / max * 100) + '%"></i></span><b class="small" style="width:30px;text-align:right">' + m[k] + "</b></div>" }).join("");
  }

  // ---------- Tiendas ----------
  function vTiendas(v) {
    var FILTROS = [["todas", "Todas"], ["prueba", "En prueba"], ["activa", "Pagando"], ["pronto", "Vencen pronto"], ["sin", "Sin acceso"], ["pagos", "Avisaron pago"], ["demo", "Demo"]];
    v.innerHTML = '<div class="pagehead"><h1>Tiendas <span class="muted" style="font-weight:400">' + S.tiendas.filter(function (t) { return !t.es_demo }).length + '</span></h1><button class="btn ghost sm" id="rec">' + ic("refresh-cw", 16) + " Actualizar</button></div>" +
      '<div class="search"><span class="lupa">' + ic("search", 18) + '</span><input class="inp" id="q" placeholder="Buscar por tienda, dueño, correo, alcaldía o estado" value="' + esc(S.q) + '"></div>' +
      '<div class="chips mt" id="fs">' + FILTROS.map(function (f) { return '<button class="chip' + (S.f === f[0] ? " on" : "") + '" data-f="' + f[0] + '">' + f[1] + "</button>" }).join("") + '</div><div id="lista" class="mt"></div>';
    $("#rec").onclick = recargar;
    $("#q").oninput = function () { S.q = this.value; lista() };
    $("#fs").onclick = function (e) { var b = e.target.closest(".chip"); if (!b) return; S.f = b.dataset.f; $$("#fs .chip").forEach(function (x) { x.classList.toggle("on", x === b) }); lista() };
    lista();
    function lista() {
      var q = S.q.trim().toLowerCase(), L = S.tiendas.filter(function (t) {
        var a = acceso(t);
        if (S.f === "demo") { if (!t.es_demo) return false } else if (t.es_demo && S.f !== "todas") return false;
        if (S.f === "prueba" && a.k !== "prueba") return false; if (S.f === "activa" && a.k !== "activa") return false;
        if (S.f === "pronto" && !((a.k === "prueba" || a.k === "activa") && a.d <= 7)) return false;
        if (S.f === "sin" && !(a.k === "vencida" || a.k === "bloqueada")) return false; if (S.f === "pagos" && !(t.pagos_pendientes > 0)) return false;
        return !q || [t.nombre, t.dueno, t.dueno_nombre, t.municipio, t.estado, t.giro].join(" ").toLowerCase().indexOf(q) >= 0;
      });
      var el = $("#lista");
      if (!L.length) { el.innerHTML = '<div class="card empty"><b>Sin resultados</b>Prueba con otro filtro o búsqueda.</div>'; return }
      el.innerHTML = '<div class="tbl-wrap"><table class="tbl" style="min-width:860px"><thead><tr><th>Tienda</th><th>Dueño</th><th>Ubicación</th><th>Acceso</th><th class="right">Productos</th><th class="right">Ventas 30 días</th><th>Último acceso</th><th></th></tr></thead><tbody>' +
        L.map(function (t) {
          return '<tr data-t="' + t.id + '"><td><div class="row"><span class="thumb">' + giroIc(t.giro) + '</span><div><b>' + esc(t.nombre) + '</b><small style="display:block">' + esc((GIROS.get(t.giro) || {}).nombre || t.giro) + " · desde " + fecha(t.creado) + "</small></div></div></td>" +
            "<td>" + esc(t.dueno_nombre || "") + '<small style="display:block">' + esc(t.dueno || "—") + "</small></td><td>" + esc(t.municipio || "—") + '<small style="display:block">' + esc(t.estado || "") + "</small></td>" +
            "<td>" + pill(t) + (t.pagos_pendientes ? '<br><span class="pill p-calm" style="margin-top:4px">' + ic("banknote", 12) + " Avisó que pagó</span>" : "") + "</td>" +
            '<td class="right">' + t.productos + '</td><td class="right"><b>' + money0(t.total_30) + '</b><small style="display:block">' + t.ventas_30 + " ventas</small></td><td>" + hace(t.ultimo_acceso) + "</td>" +
            '<td class="right"><button class="btn sm" data-acc="' + t.id + '">' + ic("key-round", 15) + " Acceso</button></td></tr>";
        }).join("") + "</tbody></table></div>";
      $$("[data-t]", el).forEach(function (tr) { tr.onclick = function () { ventanaAcceso(tr.dataset.t) } });
    }
  }

  // ---------- Ventana de acceso de una tienda (como en psicoagenda) ----------
  function ventanaAcceso(id) {
    var t = tiendaDe(id); if (!t) return;
    var h = hoja('<h2>' + esc(t.nombre) + '</h2><div class="spin" style="margin:30px auto"></div>');
    rpc("mos_admin_tienda", { n: id }).then(function (det) {
      var a = acceso(t), pagos = det.pagos || [], pend = pagos.filter(function (p) { return p.estado === "pendiente" }), us = det.usuarios || [];
      var pagado = pagos.filter(function (p) { return p.estado === "confirmado" }).reduce(function (s, p) { return s + +p.monto }, 0);
      var desde = a.k === "vencida" || a.k === "bloqueada" ? "hoy" : "su vencimiento actual (" + fecha(t.vence) + ")";
      h.innerHTML = '<button class="sheet-x" aria-label="Cerrar" data-cerrar>✕</button><h2 style="margin-bottom:4px">' + esc(t.nombre) + "</h2>" +
        '<p class="body small" style="margin:0 0 6px">' + esc(t.dueno_nombre || "") + " · " + esc(t.dueno || "") + " · " + esc([t.municipio, t.estado].filter(Boolean).join(", ")) + (t.telefono ? " · " + esc(t.telefono) : "") + "</p>" +
        '<p style="margin:0">' + pill(t) + ' <span class="small muted">· Precio ' + money0(precioDe(t)) + "/mes" + (pagado ? " · Total pagado <b>" + money0(pagado) + "</b>" : "") + "</span></p>" +
        (t.es_demo ? '<div class="note info mt"><span>Es la tienda de ejemplo: siempre tiene acceso.</span></div>' : "") +
        (pend.length ? '<div class="box" style="border-color:var(--primary-line);background:var(--primary-soft)"><h4>' + ic("banknote", 16) + " Te avisó que pagó</h4>" + pend.map(function (p) {
          return '<div class="row between wrap" style="padding:6px 0"><span><b>' + money(p.monto) + "</b> · " + p.meses + (p.meses === 1 ? " mes" : " meses") + " · " + esc(p.metodo) + (p.referencia ? " · Ref. " + esc(p.referencia) : "") +
            '<br><small class="muted">' + fecha(p.creado) + (p.nota ? " · " + esc(p.nota) : "") + '</small></span><span class="row"><button class="btn sm ghost" data-rech="' + p.id + '">Rechazar</button><button class="btn sm" data-conf="' + p.id + '">Confirmar y dar acceso</button></span></div>';
        }).join("") + "</div>" : "") +
        (t.es_demo ? "" :
        '<div class="box"><h4>Registrar un pago</h4><div class="grid2"><label class="f"><span>Monto (MXN)</span><input class="inp" id="ac-monto" inputmode="decimal" placeholder="Ej. ' + precioDe(t) + '"></label>' +
          '<label class="f"><span>Método</span><select class="inp" id="ac-met"><option>Transferencia</option><option>Efectivo</option><option>Depósito</option><option>Tarjeta</option><option>Otro</option></select></label></div>' +
          '<div class="grid2"><label class="f"><span>Periodo que cubre</span><select class="inp" id="ac-meses"><option value="1">1 mes</option><option value="3">3 meses</option><option value="6">6 meses</option><option value="12">1 año</option></select></label>' +
          '<label class="f"><span>Nota (opcional)</span><input class="inp" id="ac-nota" maxlength="200" placeholder="Ej. folio 1234"></label></div>' +
          '<p class="small muted" style="margin:0 0 10px">Se suma a partir de ' + esc(desde) + ".</p><button class=\"btn\" id=\"ac-pagar\">" + ic("badge-check", 17) + " Registrar pago y dar acceso</button></div>" +
        '<div class="box"><h4>Prueba gratis</h4><div class="row wrap" style="align-items:flex-end"><label class="f" style="margin:0;max-width:200px"><span>Días de prueba a partir de hoy</span><input class="inp" id="ac-dias" type="number" min="1" max="365" value="' + ((S.conf && S.conf.dias_prueba) || 30) + '"></label>' +
          '<button class="btn alt" id="ac-prueba">' + ic("calendar-plus", 17) + " Dar prueba</button></div></div>" +
        '<div class="box"><h4>' + (t.bloqueado ? "Devolver acceso" : "Quitar acceso") + "</h4>" + (t.bloqueado
          ? '<p class="small muted" style="margin:0 0 10px">Está bloqueada' + (t.motivo_bloqueo ? ": <b>" + esc(t.motivo_bloqueo) + "</b>" : "") + '. Si su prueba o su pago siguen vigentes, vuelve a entrar en cuanto la desbloquees.</p><button class="btn" id="ac-desb">' + ic("lock-open", 17) + " Devolver acceso</button>"
          : '<p class="small muted" style="margin:0 0 10px">Ya no podrán vender ni ver su inventario. Sus datos no se borran y pueden pagar para volver.</p><label class="f"><span>Motivo (lo verá la tienda)</span><input class="inp" id="ac-motivo" maxlength="120" placeholder="Ej. Falta de pago"></label><button class="btn danger" id="ac-bloq">' + ic("ban", 17) + " Quitar acceso ahora</button>") + "</div>" +
        '<div class="box"><h4>Precio especial</h4><div class="row wrap" style="align-items:flex-end"><label class="f" style="margin:0;max-width:200px"><span>Mensualidad para esta tienda</span><input class="inp" id="ac-precio" inputmode="decimal" placeholder="General: ' + money0((S.conf || {}).precio_mensual) + '" value="' + (t.precio_mensual || "") + '"></label><button class="btn ghost" id="ac-gprecio">Guardar</button></div></div>') +
        '<div class="box"><h4>' + ic("users", 16) + " Quién puede entrar</h4>" + (us.length ? us.map(function (u) {
          return '<div class="row between wrap" style="padding:8px 0;border-bottom:1px solid var(--line-2)"><span><b>' + esc(u.nombre || u.email) + '</b> <span class="pill ' + (u.activo ? "p-ok" : "p-bad") + '">' + (u.activo ? "Puede entrar" : "Desactivado") + "</span>" +
            '<br><small class="muted">' + esc(u.email) + " · " + ({ dueno: "Dueño", encargado: "Encargado", cajero: "Cajero" }[u.rol] || u.rol) + " · último acceso: " + hace(u.ultimo_acceso) + "</small></span>" +
            '<span class="row"><button class="btn sm ghost" data-pass="' + u.user_id + '" data-mail="' + esc(u.email) + '">' + ic("key-round", 15) + " Contraseña</button>" +
            '<button class="btn sm ' + (u.activo ? "danger" : "") + '" data-usr="' + u.user_id + '" data-act="' + (u.activo ? "0" : "1") + '">' + (u.activo ? "Desactivar" : "Activar") + "</button></span></div>";
        }).join("") : '<p class="muted small">Sin usuarios.</p>') + "</div>" +
        '<div class="box"><h4>Notas privadas</h4><textarea class="inp" id="ac-notas" rows="2" maxlength="500" placeholder="Sólo las ves tú">' + esc(t.notas_admin || "") + '</textarea><button class="btn ghost sm mt" id="ac-gnotas">Guardar nota</button></div>' +
        '<h4 style="margin:18px 0 8px">Historial de pagos</h4>' + (pagos.length ? '<div class="tbl-wrap"><table class="tbl" style="min-width:520px"><thead><tr><th>Fecha</th><th>Monto</th><th>Método</th><th>Cubre</th><th>Estado</th></tr></thead><tbody>' +
          pagos.map(function (p) {
            return "<tr><td>" + fecha(p.creado) + "</td><td>" + money(p.monto) + "</td><td>" + esc(p.metodo) + (p.referencia ? '<small style="display:block">' + esc(p.referencia) + "</small>" : "") + "</td><td>" + (p.desde ? fecha(p.desde) + " – " + fecha(p.hasta) : p.meses + (p.meses === 1 ? " mes" : " meses")) + "</td>" +
              '<td><span class="pill ' + ({ confirmado: "p-ok", pendiente: "p-warn", rechazado: "p-bad" }[p.estado]) + '">' + esc(p.estado) + "</span></td></tr>";
          }).join("") + "</tbody></table></div>" : '<div class="empty" style="padding:16px">Aún no hay pagos.</div>');
      function hecho(msg) { toast(msg, "ok"); return cargar().then(function () { pintar(); ventanaAcceso(id) }) }
      function boton(sel, fn) { var b = $(sel, h); if (b) b.onclick = function () { b.disabled = true; Promise.resolve(fn()).catch(function (e) { b.disabled = false; err(e) }) } }
      boton("#ac-pagar", function () {
        var m = parseFloat(($("#ac-monto", h).value || "").replace(/[$,\s]/g, "")); if (!(m > 0)) { $("#ac-pagar", h).disabled = false; return toast("Escribe el monto", "bad") }
        return rpc("mos_admin_pago", { p: { negocio_id: id, monto: m, meses: +$("#ac-meses", h).value, metodo: $("#ac-met", h).value, nota: $("#ac-nota", h).value.trim() || "Registrado por el administrador" } }).then(function () { return hecho("Pago registrado y acceso dado ✓") });
      });
      boton("#ac-prueba", function () { var d = Math.max(1, Math.min(365, parseInt($("#ac-dias", h).value, 10) || 30)); return rpc("mos_admin_actualizar", { n: id, p: { prueba_hasta: sumarDias(d), bloqueado: false } }).then(function () { return hecho("Prueba de " + d + " días dada ✓") }) });
      boton("#ac-bloq", function () {
        return confirmar("¿Quitar el acceso a " + t.nombre + "?", "No podrán vender ni ver su inventario hasta que les devuelvas el acceso o paguen.", "Quitar acceso", true).then(function (ok) {
          if (!ok) return ventanaAcceso(id);
          return rpc("mos_admin_actualizar", { n: id, p: { bloqueado: true, motivo_bloqueo: ($("#ac-motivo", h) || {}).value || "Falta de pago" } }).then(function () { return hecho("Acceso quitado") });
        });
      });
      boton("#ac-desb", function () { return rpc("mos_admin_actualizar", { n: id, p: { bloqueado: false, motivo_bloqueo: "" } }).then(function () { return hecho("Acceso devuelto ✓") }) });
      boton("#ac-gprecio", function () { var v = ($("#ac-precio", h).value || "").replace(/[$,\s]/g, ""); return rpc("mos_admin_actualizar", { n: id, p: { precio_mensual: v } }).then(function () { return hecho(v ? "Precio especial guardado ✓" : "Usa el precio general ✓") }) });
      boton("#ac-gnotas", function () { return rpc("mos_admin_actualizar", { n: id, p: { notas_admin: $("#ac-notas", h).value } }).then(function () { toast("Nota guardada ✓", "ok"); $("#ac-gnotas", h).disabled = false }) });
      $$("[data-conf]", h).forEach(function (b) { b.onclick = function () { b.disabled = true; rpc("mos_admin_pago", { p: { pago_id: b.dataset.conf } }).then(function () { return hecho("Pago confirmado: la tienda ya tiene acceso ✓") }).catch(function (e) { b.disabled = false; err(e) }) } });
      $$("[data-rech]", h).forEach(function (b) { b.onclick = function () { var mo = prompt("¿Por qué lo rechazas? (opcional)") || ""; b.disabled = true; rpc("mos_admin_pago", { p: { pago_id: b.dataset.rech, accion: "rechazar", motivo: mo } }).then(function () { return hecho("Pago rechazado") }).catch(function (e) { b.disabled = false; err(e) }) } });
      $$("[data-usr]", h).forEach(function (b) { b.onclick = function () { b.disabled = true; rpc("mos_admin_usuario", { n: id, u: b.dataset.usr, activo: b.dataset.act === "1" }).then(function () { return hecho(b.dataset.act === "1" ? "Usuario activado ✓" : "Usuario desactivado") }).catch(function (e) { b.disabled = false; err(e) }) } });
      $$("[data-pass]", h).forEach(function (b) { b.onclick = function () { nuevaContrasena(b.dataset.pass, b.dataset.mail) } });
    }).catch(function (e) { cerrar(); err(e) });
  }
  function claveNueva() { var a = "abcdefghjkmnpqrstuvwxyz23456789", s = ""; var r = crypto.getRandomValues(new Uint32Array(10)); for (var i = 0; i < 10; i++) s += a[r[i] % a.length]; return s.slice(0, 5) + "-" + s.slice(5) }
  function funcionUsuarios(cuerpo) {
    return sb.auth.getSession().then(function (r) {
      return fetch(C.url + "/functions/v1/mos-admin-usuarios", { method: "POST", headers: { "Content-Type": "application/json", apikey: C.key, Authorization: "Bearer " + r.data.session.access_token }, body: JSON.stringify(cuerpo) });
    }).then(function (r) { return r.json() }).then(function (j) { if (!j.ok) throw new Error(j.error || "No se pudo"); return j });
  }
  function credenciales(email, pass, titulo) {
    var txt = "Hola, ya tienes acceso a Mostrador.\nEntra en: " + location.href.replace(/admin\.html.*$/, "") + "\nCorreo: " + email + "\nContraseña: " + pass + "\nTe recomendamos cambiarla al entrar.";
    return '<div class="cred mt"><p style="margin:0 0 6px">' + esc(titulo) + "</p>Correo: <b>" + esc(email) + "</b><br>Contraseña: <b>" + esc(pass) + "</b></div>" +
      '<div class="acts"><button class="btn ghost" data-copiar="' + esc(txt) + '">' + ic("copy", 17) + ' Copiar</button><a class="btn" target="_blank" rel="noopener" href="https://wa.me/?text=' + encodeURIComponent(txt) + '">' + ic("smartphone", 17) + " Mandar por WhatsApp</a></div>";
  }
  function activarCopiar(el) { $$("[data-copiar]", el).forEach(function (b) { b.onclick = function () { (navigator.clipboard ? navigator.clipboard.writeText(b.dataset.copiar) : Promise.reject()).then(function () { toast("Copiado ✓", "ok") }).catch(function () { prompt("Copia el texto:", b.dataset.copiar) }) } }) }
  function nuevaContrasena(uid, mail) {
    var p = claveNueva(), h = hoja("<h2>Nueva contraseña</h2><p class=\"body\">Para <b>" + esc(mail) + '</b>.</p><label class="f"><span>Contraseña</span><input class="inp" id="np" value="' + p + '"></label><button class="btn block" id="np-ok">Cambiar contraseña</button><div id="np-r"></div>');
    $("#np-ok", h).onclick = function () {
      var b = this, v = $("#np", h).value.trim(); if (v.length < 6) return toast("Mínimo 6 caracteres", "bad"); b.disabled = true;
      funcionUsuarios({ accion: "restablecer", user_id: uid, password: v }).then(function () { $("#np-r", h).innerHTML = credenciales(mail, v, "Contraseña cambiada. Mándasela a tu cliente:"); activarCopiar(h); b.remove() }).catch(function (e) { b.disabled = false; err(e) });
    };
  }

  // ---------- Pagos ----------
  function vPagos(v) {
    var pend = S.pagos.filter(function (p) { return p.estado === "pendiente" }), resto = S.pagos.filter(function (p) { return p.estado !== "pendiente" });
    function fila(p, botones) {
      var t = tiendaDe(p.negocio_id) || { nombre: "(tienda borrada)" };
      return '<div class="li" style="flex-wrap:wrap"><span class="thumb">' + ic("banknote", 20) + '</span><span class="t"><b>' + esc(t.nombre) + " · " + money(p.monto) + "</b><small>" + p.meses + (p.meses === 1 ? " mes" : " meses") + " · " + esc(p.metodo) +
        (p.referencia ? " · Ref. " + esc(p.referencia) : "") + " · " + fecha(p.creado) + (p.nota ? " · " + esc(p.nota) : "") + "</small></span>" +
        (botones ? '<span class="row"><button class="btn sm ghost" data-rech="' + p.id + '">Rechazar</button><button class="btn sm" data-conf="' + p.id + '">Confirmar y dar acceso</button></span>'
                 : '<span class="pill ' + ({ confirmado: "p-ok", rechazado: "p-bad" }[p.estado] || "p-mute") + '">' + esc(p.estado) + (p.hasta ? " · hasta " + fecha(p.hasta) : "") + "</span>") + "</div>";
    }
    v.innerHTML = '<div class="pagehead"><h1>Pagos</h1><button class="btn ghost sm" id="rec">' + ic("refresh-cw", 16) + " Actualizar</button></div>" +
      '<div class="sec" style="margin-top:0"><h2>Por confirmar <span class="muted" style="font-weight:400">' + pend.length + "</span></h2></div>" +
      (pend.length ? '<p class="small muted">Revisa en tu banco que el dinero llegó y confirma: la tienda recibe el acceso al instante.</p><div class="list">' + pend.map(function (p) { return fila(p, true) }).join("") + "</div>" : '<div class="card empty"><b>Nada por confirmar</b>Cuando una tienda te avise que pagó, aparece aquí.</div>') +
      '<div class="sec"><h2>Historial</h2></div>' + (resto.length ? '<div class="list">' + resto.slice(0, 200).map(function (p) { return fila(p, false) }).join("") + "</div>" : '<div class="card empty">Aún no hay pagos.</div>');
    $("#rec").onclick = recargar;
    $$("[data-conf]", v).forEach(function (b) { b.onclick = function () { b.disabled = true; rpc("mos_admin_pago", { p: { pago_id: b.dataset.conf } }).then(function () { toast("Pago confirmado: la tienda ya tiene acceso ✓", "ok"); return recargar() }).catch(function (e) { b.disabled = false; err(e) }) } });
    $$("[data-rech]", v).forEach(function (b) { b.onclick = function () { var mo = prompt("¿Por qué lo rechazas? (opcional)") || ""; b.disabled = true; rpc("mos_admin_pago", { p: { pago_id: b.dataset.rech, accion: "rechazar", motivo: mo } }).then(function () { toast("Pago rechazado"); return recargar() }).catch(function (e) { b.disabled = false; err(e) }) } });
  }

  // ---------- Crear acceso ----------
  function vCrear(v) {
    v.innerHTML = '<div class="pagehead"><h1>Crear acceso para un cliente</h1></div><div class="card" style="max-width:560px">' +
      '<p class="body">Crea la cuenta de tu cliente con una contraseña. Al entrar registra su tienda y empieza su prueba de <b>' + ((S.conf && S.conf.dias_prueba) || 30) + " días</b>.</p>" +
      '<form id="fc" novalidate><label class="f"><span>Nombre del cliente</span><input class="inp" name="nombre" placeholder="Ej. Lupe Hernández"></label>' +
      '<label class="f"><span>Correo</span><input class="inp" name="email" placeholder="Ej. lupe@gmail.com (o un usuario si no tiene correo)"><small>Si no tiene correo escribe un usuario, por ejemplo <b>tiendalupe</b>.</small></label>' +
      '<label class="f"><span>Contraseña</span><div class="row"><input class="inp" name="pass" value="' + claveNueva() + '"><button type="button" class="btn ghost" id="gen" title="Generar otra">' + ic("refresh-cw", 17) + "</button></div></label>" +
      '<button class="btn block lg">' + ic("user-plus", 18) + ' Crear acceso</button></form><div id="res"></div></div>';
    var f = $("#fc");
    $("#gen").onclick = function () { f.pass.value = claveNueva() };
    f.onsubmit = function (e) {
      e.preventDefault(); var em = f.email.value.trim(), pw = f.pass.value.trim();
      if (!em) return toast("Escribe el correo o usuario", "bad"); if (pw.length < 6) return toast("La contraseña necesita 6 caracteres o más", "bad");
      var b = $("button.btn.block", f); b.disabled = true;
      funcionUsuarios({ accion: "crear", email: em, password: pw, nombre: f.nombre.value.trim() }).then(function (j) {
        b.disabled = false; $("#res").innerHTML = credenciales(j.email, pw, "¡Listo! Mándale estos datos a tu cliente:"); activarCopiar($("#res"));
        f.reset(); f.pass.value = claveNueva();
      }).catch(function (x) { b.disabled = false; err(x) });
    };
  }

  // ---------- Cobro y prueba ----------
  function vCobro(v) {
    var c = S.conf || {};
    v.innerHTML = '<div class="pagehead"><h1>Cobro y prueba gratis</h1></div><form class="card" id="fk" style="max-width:640px">' +
      '<p class="body">Esto es lo que ven las tiendas en <b>“Mi plan”</b> y cuando se les termina la prueba.</p>' +
      '<div class="grid2"><label class="f"><span>Mensualidad general (MXN)</span><input class="inp" name="precio_mensual" inputmode="decimal" value="' + esc(c.precio_mensual) + '"></label>' +
      '<label class="f"><span>Días de prueba gratis</span><input class="inp" name="dias_prueba" type="number" min="1" max="365" value="' + esc(c.dias_prueba) + '"><small>Para las tiendas nuevas.</small></label></div>' +
      '<div class="grid2"><label class="f"><span>Banco</span><input class="inp" name="banco" value="' + esc(c.banco) + '" placeholder="Ej. BBVA"></label><label class="f"><span>Titular</span><input class="inp" name="titular" value="' + esc(c.titular) + '"></label></div>' +
      '<div class="grid2"><label class="f"><span>CLABE o número de tarjeta</span><input class="inp" name="clabe" inputmode="numeric" value="' + esc(c.clabe) + '"></label><label class="f"><span>Tu WhatsApp</span><input class="inp" name="whatsapp" inputmode="tel" value="' + esc(c.whatsapp) + '" placeholder="10 dígitos"><small>Ahí te mandan su comprobante.</small></label></div>' +
      '<label class="f"><span>Instrucciones de pago</span><textarea class="inp" name="nota_pago" rows="3" maxlength="300">' + esc(c.nota_pago) + "</textarea></label>" +
      '<button class="btn lg">Guardar</button></form>';
    $("#fk").onsubmit = function (e) {
      e.preventDefault(); var f = this, b = $("button", f); b.disabled = true;
      var p = { precio_mensual: parseFloat(f.precio_mensual.value) || 0, dias_prueba: Math.max(1, Math.min(365, parseInt(f.dias_prueba.value, 10) || 30)), banco: f.banco.value.trim(), titular: f.titular.value.trim(), clabe: f.clabe.value.replace(/\s/g, ""), whatsapp: f.whatsapp.value.replace(/\D/g, ""), nota_pago: f.nota_pago.value.trim() };
      rpc("mos_admin_config", { p: p }).then(function () { b.disabled = false; toast("Guardado ✓", "ok"); return cargar() }).catch(function (x) { b.disabled = false; err(x) });
    };
  }

  window.addEventListener("hashchange", function () { var t = location.hash.replace("#", ""); if (t && t !== S.tab && S.cargado) { S.tab = t; pintar() } });
  inicio();
})();
