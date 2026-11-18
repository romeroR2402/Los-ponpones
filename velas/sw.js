// Tienda de velas: guarda la app en el celular para abrir rápido y aunque falle la conexión.
// Solo atiende los archivos de esta carpeta; Supabase y otras apps del sitio pasan directo.
var C = "velas-v3", BASE = new URL("./", self.location).href;
var FILES = ["./", "index.html", "admin.html", "config.js", "js/velas.js", "css/velas.css", "manifest.webmanifest", "admin.webmanifest",
  "icons/icon-192.png", "icons/icon-512.png", "icons/apple-180.png",
  "img/p-vainilla.svg"];

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(C).then(function (c) { return c.addAll(FILES) }).then(function () { return self.skipWaiting() }));
});
self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k.indexOf("velas-") === 0 && k !== C }).map(function (k) { return caches.delete(k) }));
  }).then(function () { return self.clients.claim() }));
});
self.addEventListener("fetch", function (e) {
  var r = e.request; if (r.method !== "GET") return;
  var href = r.url.split("#")[0].split("?")[0];
  if (href.indexOf(BASE) !== 0) return;
  var rel = href.slice(BASE.length) || "./";
  if (FILES.indexOf(rel) < 0) return;
  // Primero la red (siempre la última versión); sin conexión, la copia guardada.
  e.respondWith(fetch(r).then(function (res) {
    if (res.ok) { var cp = res.clone(); caches.open(C).then(function (c) { c.put(href, cp) }) }
    return res;
  }).catch(function () {
    return caches.match(href).then(function (m) { return m || (r.mode === "navigate" ? caches.match(BASE + "index.html") : Response.error()) });
  }));
});
// Al tocar un aviso, abre el panel
self.addEventListener("notificationclick", function (e) {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: "window" }).then(function (cs) {
    for (var i = 0; i < cs.length; i++) if (cs[i].url.indexOf("admin.html") >= 0) return cs[i].focus();
    return self.clients.openWindow(BASE + "admin.html#/pedidos");
  }));
});
