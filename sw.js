const CACHE_NAME = 'presensi-azzahro-v1.0.2';
const OFFLINE_URL = './offline.html';

const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './offline.html',
  './manifest.json', // Penting agar PWA tetap valid saat offline
  './logo-smp-azzahro.png',
  './logo-smk-azzahro.png',
  'https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js',
  './icon-apk-presensi-azzahro.png'
];

// Install: Simpan semua aset ke cache
self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('SW: Menyiapkan Cache Az-Zahro...');
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

// Activate: Hapus cache lama (v1.0.1, dll)
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('SW: Menghapus Cache Lama:', key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

// Fetch: Ambil dari cache, jika gagal baru internet
self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(e.request).catch(() => {
        // JIKA OFFLINE:
        // Cek apakah permintaan berupa navigasi halaman
        if (e.request.mode === 'navigate' || (e.request.method === 'GET' && e.request.headers.get('accept').includes('text/html'))) {
          return caches.match(OFFLINE_URL);
        }
      });
    })
  );
});
