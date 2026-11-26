// Mostrador: guarda la app en el celular para abrir rápido y vender aunque falle el internet.
// Sólo atiende los archivos de esta carpeta; Supabase y otras apps del sitio pasan directo.
var C = "mostrador-v15", BASE = new URL("./", self.location).href;
var FILES = ["./", "index.html", "config.js", "js/iconos.js", "js/giros.js", "js/core.js", "js/app.js", "js/admin.js", "admin.html", "css/mostrador.css", "manifest.webmanifest",
  "icons/icon-192.png", "icons/icon-512.png", "icons/apple-180.png"];
var CDN = ["https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js"];

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(C).then(function (c) { return c.addAll(FILES.concat(CDN)) }).then(function () { return self.skipWaiting() }));
});
self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k.indexOf("mostrador-") === 0 && k !== C }).map(function (k) { return caches.delete(k) }));
  }).then(function () { return self.clients.claim() }));
});
self.addEventListener("fetch", function (e) {
  var r = e.request; if (r.method !== "GET") return;
  var href = r.url.split("#")[0].split("?")[0];
  var propio = href.indexOf(BASE) === 0 && FILES.indexOf(href.slice(BASE.length) || "./") >= 0;
  if (!propio && CDN.indexOf(href) < 0) return;
  // Primero la red (siempre la última versión); sin conexión, la copia guardada.
  // "no-cache": siempre pregunta a GitHub si hay versión nueva (antes se reusaba la copia guardada hasta 10 min)
  e.respondWith(fetch(r, { cache: "no-cache" }).then(function (res) {
    if (res.ok) { var cp = res.clone(); caches.open(C).then(function (c) { c.put(href, cp) }) }
    return res;
  }).catch(function () {
    return caches.match(href).then(function (m) { return m || (r.mode === "navigate" ? caches.match(BASE + "index.html") : Response.error()) });
  }));
});
self.addEventListener("notificationclick", function (e) {
  e.notification.close();
  var url = BASE + ((e.notification.data && e.notification.data.url) || "index.html");
  e.waitUntil(self.clients.matchAll({ type: "window" }).then(function (cs) {
    for (var i = 0; i < cs.length; i++) if (cs[i].url.indexOf(BASE) === 0) { cs[i].navigate(url); return cs[i].focus() }
    return self.clients.openWindow(url);
  }));
});
