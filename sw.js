// Casa de Los Ponpones: guarda la app en el celular para abrirla rápido y aunque falle la conexión.
// Solo atiende los archivos de Los Ponpones; las otras apps de este sitio y Supabase pasan directo.
var C = "ponpones-v1", BASE = new URL("./", self.location).href;
var FILES = ["./", "index.html", "config.js", "manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png"];

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(C).then(function (c) { return c.addAll(FILES) }).then(function () { return self.skipWaiting() }));
});

self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k.indexOf("ponpones-") === 0 && k !== C }).map(function (k) { return caches.delete(k) }));
  }).then(function () { return self.clients.claim() }));
});

self.addEventListener("fetch", function (e) {
  var r = e.request;
  if (r.method !== "GET") return;
  var href = r.url.split("#")[0].split("?")[0];
  if (href.indexOf(BASE) !== 0) return;
  var rel = href.slice(BASE.length) || "./";
  if (FILES.indexOf(rel) < 0) return;
  // Primero la red (para tener siempre la última versión); si no hay conexión, la copia guardada.
  e.respondWith(fetch(r).then(function (res) {
    if (res.ok) { var cp = res.clone(); caches.open(C).then(function (c) { c.put(href, cp) }) }
    return res;
  }).catch(function () {
    return caches.match(href).then(function (m) {
      return m || (r.mode === "navigate" ? caches.match(BASE + "index.html") : Response.error());
    });
  }));
});
