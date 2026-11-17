// Utilidades compartidas entre la tienda (index.html) y el panel (admin.html).
(function () {
  var C = window.VELAS || {};
  var sb = window.supabase.createClient(C.url, C.key, { auth: { persistSession: true, storageKey: "velas-auth" } });
  var V = window.V = { sb: sb, cfg: C };

  V.$ = function (s, el) { return (el || document).querySelector(s) };
  V.$$ = function (s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)) };
  V.esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] }) };
  V.money = function (n) { n = Number(n || 0); return "$" + n.toLocaleString("es-MX", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 }) };
  V.img = function (src) { return src || "img/p-vainilla.svg" };
  V.fecha = function (d) { return new Date(d).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" }) };
  V.fechaHora = function (d) { return new Date(d).toLocaleString("es-MX", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) };
  V.digits = function (s) { return String(s || "").replace(/\D/g, "") };
  V.wa = function (num, text) {
    var d = V.digits(num); if (d.length === 10) d = "52" + d;
    return "https://wa.me/" + d + "?text=" + encodeURIComponent(text);
  };
  V.ESTADOS = {
    pendiente: { t: "Esperando pago", c: "amber" },
    por_revisar: { t: "Pago en revisión", c: "blue" },
    pagado: { t: "Pagado", c: "green" },
    enviado: { t: "En camino", c: "violet" },
    entregado: { t: "Entregado", c: "ink" },
    cancelado: { t: "Cancelado", c: "red" }
  };
  V.chip = function (estado) { var e = V.ESTADOS[estado] || { t: estado, c: "ink" }; return '<span class="state s-' + e.c + '">' + e.t + "</span>" };
  V.stars = function (n) { var s = ""; for (var i = 1; i <= 5; i++) s += i <= Math.round(n) ? "★" : "☆"; return s };

  V.toast = function (msg, kind) {
    var t = document.createElement("div"); t.className = "toast " + (kind || "");
    t.textContent = msg; document.body.appendChild(t);
    requestAnimationFrame(function () { t.classList.add("on") });
    setTimeout(function () { t.classList.remove("on"); setTimeout(function () { t.remove() }, 400) }, 3200);
  };
  V.copy = function (txt) {
    (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(function () { V.toast("Copiado ✓") })
      .catch(function () { window.prompt("Copia el dato:", txt) });
  };

  V.ajustes = null;
  V.cargarAjustes = function () {
    return sb.from("velas_ajustes").select("*").eq("id", 1).maybeSingle().then(function (r) {
      V.ajustes = r.data || { nombre: "Tu Tienda", lema: "" }; return V.ajustes;
    });
  };
  V.velaSvg = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M12 2.5c1.6 1.8 2 3.2 0 5-2-1.8-1.6-3.2 0-5Z" fill="currentColor"/><rect x="7" y="10" width="10" height="11.5" rx="2.5"/><path d="M12 7.5V10"/></svg>';
  // Logo de la tienda: la imagen que sube el administrador o, si no hay, una vela + el nombre.
  V.marca = function (a) {
    a = a || V.ajustes || {};
    return (a.logo_url ? '<img class="logo-img" src="' + V.esc(a.logo_url) + '" alt="">' : '<span class="logo-ph" aria-hidden="true">' + V.velaSvg + "</span>") +
      '<span class="brand-name">' + V.esc(a.nombre || "Tu Tienda") + "</span>";
  };

  // Comprime una foto antes de subirla (más rápido con datos móviles).
  V.comprimir = function (file, max) {
    max = max || 1400;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return Promise.resolve(file);
    return new Promise(function (ok) {
      var im = new Image(), u = URL.createObjectURL(file);
      im.onload = function () {
        var s = Math.min(1, max / Math.max(im.width, im.height));
        var c = document.createElement("canvas"); c.width = Math.round(im.width * s); c.height = Math.round(im.height * s);
        c.getContext("2d").drawImage(im, 0, 0, c.width, c.height); URL.revokeObjectURL(u);
        c.toBlob(function (b) { ok(b && b.size < file.size ? new File([b], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" }) : file) }, "image/jpeg", 0.85);
      };
      im.onerror = function () { ok(file) }; im.src = u;
    });
  };

  // Instalar como app (Android: botón directo; iPhone: instrucciones)
  V.instalar = null;
  window.addEventListener("beforeinstallprompt", function (e) { e.preventDefault(); V.instalar = e; document.documentElement.classList.add("can-install") });
  V.pedirInstalar = function () {
    if (V.instalar) { V.instalar.prompt(); V.instalar = null; document.documentElement.classList.remove("can-install"); return }
    var ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    alert(ios ? "En iPhone: toca el botón Compartir (cuadro con flecha) y elige “Agregar a pantalla de inicio”."
              : "Abre el menú del navegador (⋮) y elige “Instalar app” o “Agregar a pantalla principal”.");
  };
  V.esApp = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone;
  if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost"))
    navigator.serviceWorker.register("sw.js").catch(function () {});
})();
