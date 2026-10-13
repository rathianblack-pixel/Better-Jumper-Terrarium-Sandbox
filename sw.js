// Jumper-only offline shell. Superseded app caches are evicted within this scope.
const CACHE='tr-jumper-mv6p2byu', FILES=["./", "index.html", "jumper.html", "manifest.webmanifest", "README.md", "icons/apple-touch-icon.png", "icons/favicon-64.png", "icons/hero-jumper-storybook.webp", "icons/icon-192.png", "icons/icon-512.png", "icons/icon-maskable-512.png", "QA_REPORT.md"];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('tr-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{const r=event.request;if(r.method!=='GET'||new URL(r.url).origin!==location.origin)return;
if(r.mode==='navigate'){event.respondWith(fetch(r).then(res=>{if(res.ok){const copy=res.clone();event.waitUntil(caches.open(CACHE).then(c=>c.put(r,copy)))}return res}).catch(()=>caches.match(r,{ignoreSearch:true}).then(hit=>hit||caches.match('index.html'))));return}
event.respondWith(caches.match(r,{ignoreSearch:true}).then(hit=>hit||fetch(r)));});
