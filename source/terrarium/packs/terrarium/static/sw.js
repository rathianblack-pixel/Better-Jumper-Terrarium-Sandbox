// Terrarium service worker: keeps the title screen and both games playable offline. Version changes with every build.
const CACHE = 'tr-1', FILES = ["./", "index.html", "jumper.html", "mantis.html", "manifest.webmanifest", "icons/apple-touch-icon.png", "icons/favicon-64.png", "icons/icon-192.png", "icons/icon-512.png", "icons/icon-maskable-512.png", "icons/card-jumper.png", "icons/card-mantis.png", "icons/dome.png", "icons/hero-jumper-hd2d.webp", "icons/hero-jumper-cuphead.webp", "icons/hero-jumper-storybook.webp", "icons/hero-mantis-hd2d.webp", "icons/hero-mantis-cuphead.webp", "icons/hero-mantis-storybook.webp"];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('tr-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const r = e.request; if (r.method !== 'GET' || new URL(r.url).origin !== location.origin) return;
  // pages: network first (picks up new versions), cached copy when offline; everything else cache first
  if (r.mode === 'navigate') { e.respondWith(fetch(r).then(res => { const cp = res.clone(); caches.open(CACHE).then(c => c.put(r, cp)); return res; }).catch(() => caches.match(r, { ignoreSearch: true }).then(h => h || caches.match('index.html')))); return; }
  e.respondWith(caches.match(r).then(hit => hit || fetch(r)));
});
