// Offline support. Bump VERSION on every deploy so phones pick up the new files.
const VERSION = 'v3';
const CORE = `core-${VERSION}`, RUNTIME = 'runtime', TILES = 'tiles';
const IMGS = ['h_coma','h_engo','h_ferro','h_madriu','h_quer','h_tristaina','p_barri','p_caldea','p_coloma','p_dali','p_esteve','p_margineda','p_poble','p_vall',
  'r_0gluten','r_angelo','r_cabana','r_canmanel','r_goiko','r_jaleo','r_monkeys','r_platin','r_riverside','r_tagliatella','r_terreta','r_vertical','r_verticalo',
  'r_viena','r_xtreme','t_avmeritxell','t_caldea','t_caselles','t_parc','t_santuari','t_thyssen'].map(k => `img/${k}.jpg`);
const PRECACHE = ['./', 'index.html', 'lib.js', 'gas.js', 'credits.js', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'icon-180.png', ...IMGS];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CORE).then(c => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('core-') && k !== CORE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

const LIVE = /open-meteo\.com|sig\.govern\.ad|sit\.andorralavella\.ad/;
const TILE = /tile\.openstreetmap\.org/;
const STATIC = /fonts\.(googleapis|gstatic)\.com|cdnjs\.cloudflare\.com/;

async function networkFirst(req, cacheName){
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch {
    return (await cache.match(req, {ignoreSearch: req.mode === 'navigate'})) || (await caches.match('index.html')) || Response.error();
  }
}
async function cacheFirst(req, cacheName, max){
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok || res.type === 'opaque'){
    cache.put(req, res.clone());
    if (max) cache.keys().then(k => { if (k.length > max) cache.delete(k[0]); }); // ponytail: FIFO trim, LRU if the map gets heavy use
  }
  return res;
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = req.url;
  if (LIVE.test(url)) return e.respondWith(networkFirst(req, RUNTIME));       // live data: fresh when online, last copy offline
  if (TILE.test(url)) return e.respondWith(cacheFirst(req, TILES, 600));       // map tiles seen once stay available offline
  if (STATIC.test(url)) return e.respondWith(cacheFirst(req, RUNTIME));
  if (new URL(url).origin === location.origin){
    if (req.mode === 'navigate' || /\.(html|js|webmanifest)$/.test(new URL(url).pathname)) return e.respondWith(networkFirst(req, CORE));
    return e.respondWith(cacheFirst(req, CORE));
  }
});
