// Pip service worker v2: works offline, updates itself when you're online.
const CACHE = "pip-v2.0";
const CORE = ["./", "./index.html", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png", "./icon-maskable-512.png"];

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(CORE.map(u => new Request(u, { cache: "reload" }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function timeout(ms) { return new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms)); }

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const isPage = req.mode === "navigate";
  if (isPage) {
    // Network first (so updates show up), fall back to the saved copy when offline.
    e.respondWith(
      Promise.race([fetch(req), timeout(3500)])
        .then(res => {
          if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put("./index.html", copy)); }
          return res;
        })
        .catch(() => caches.match("./index.html").then(r => r || caches.match("./")))
    );
    return;
  }
  // Everything else: serve saved copy instantly, refresh it in the background.
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then(hit => {
      const net = fetch(req).then(res => {
        if (res && (res.ok || res.type === "opaque")) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
        return res;
      }).catch(() => hit);
      return hit || net;
    })
  );
});

self.addEventListener("notificationclick", e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(cs => {
    for (const c of cs) if ("focus" in c) return c.focus();
    return self.clients.openWindow("./");
  }));
});
