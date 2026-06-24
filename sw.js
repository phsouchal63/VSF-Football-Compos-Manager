/* VSF Compos - Service Worker
   Strategie :
   - HTML / navigation : RESEAU D'ABORD (pour recevoir les mises a jour GitHub),
     repli sur le cache si hors-ligne.
   - Autres ressources same-origin (icones, manifeste) : CACHE D'ABORD, repli reseau.
   Les donnees (localStorage cle vsf2) ne sont PAS gerees ici : elles vivent
   dans le navigateur et ne sont jamais touchees par ce worker. */
const CACHE = 'vsf-compos-v1';
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png'
];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).catch(() => {}));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  let url;
  try { url = new URL(req.url); } catch (_) { return; }
  if (url.origin !== location.origin) return; // on ne gere que le meme domaine

  const isHTML = req.mode === 'navigate' ||
                 (req.headers.get('accept') || '').includes('text/html');

  if (isHTML) {
    // Reseau d'abord : la derniere version GitHub gagne quand on est en ligne
    e.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put('./index.html', copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(req).then(r => r || caches.match('./index.html')))
    );
    return;
  }

  // Ressources statiques : cache d'abord
  e.respondWith(
    caches.match(req).then(cached =>
      cached || fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
        return res;
      }).catch(() => cached)
    )
  );
});
