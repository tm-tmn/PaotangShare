// เป๋าตังค์ service worker: app-shell cache + Android share target for slips.
const SHELL = "pt-shell-v3";
const SHARE = "pt-share";

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(["/icons/icon-192.png"])).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== SHELL && k !== SHARE).map((k) => caches.delete(k)))),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;

  // Shared image from another app -> stash it, then open the add screen
  if (e.request.method === "POST" && url.pathname === "/share-target") {
    e.respondWith(
      (async () => {
        const form = await e.request.formData();
        const files = form.getAll("slip");
        const cache = await caches.open(SHARE);
        for (let i = 0; i < files.length; i++) {
          const f = files[i];
          await cache.put(`/shared-slip-${Date.now()}-${i}`, new Response(f, { headers: { "Content-Type": f.type || "image/jpeg" } }));
        }
        return Response.redirect("/?shared=1", 303);
      })(),
    );
    return;
  }

  if (e.request.method !== "GET" || url.pathname.startsWith("/api/")) return;

  // Pages: network first, fall back to cache when offline
  if (e.request.mode === "navigate") {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          if (res.ok && !res.redirected) {
            const copy = res.clone();
            caches.open(SHELL).then((c) => c.put(e.request, copy));
          }
          return res;
        })
        .catch(() => caches.match(e.request).then((r) => r || caches.match("/"))),
    );
    return;
  }

  // Static build assets: cache first
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    e.respondWith(
      caches.match(e.request).then(
        (hit) =>
          hit ||
          fetch(e.request).then((res) => {
            const copy = res.clone();
            caches.open(SHELL).then((c) => c.put(e.request, copy));
            return res;
          }),
      ),
    );
  }
});
