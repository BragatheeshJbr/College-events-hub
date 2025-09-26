self.addEventListener("install", event => {
  console.log("Service Worker installed");
  event.waitUntil(
    caches.open("vec-cache").then(cache => {
      return cache.addAll([
        "./",
        "./index.html",
        "./style.css",
        "./app.js",
        "./logo-192.png",
        "./logo-512.png"
      ]);
    })
  );
});

self.addEventListener("fetch", event => {
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request);
    })
  );
});

