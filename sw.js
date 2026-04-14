const CACHE_NAME = 'presensi-azzahro-v1.0.3';
const OFFLINE_URL = './offline.html';
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwCXbDTuaFkN7GlcXJxaFgDaKPEp2G9vySF1IKfWxUCTuEOCYt39nMmlEmI25pz4PSd/exec';

const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './offline.html',
  './manifest.json',
  './logo-smp-azzahro.png',
  './logo-smk-azzahro.png',
  'https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js',
  './icon-apk-presensi-azzahro.png'
];

// 1. INSTALL: Simpan aset ke cache
self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('SW: Menyiapkan Cache Az-Zahro...');
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

// 2. ACTIVATE: Bersihkan cache lama
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

// 3. FETCH: Ambil aset dari cache, kecuali untuk Google Script
self.addEventListener('fetch', (e) => {
  if (e.request.url.includes('script.google.com')) {
    return; // Biarkan logika di index.html yang menangani API
  }

  e.respondWith(
    caches.match(e.request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;

      return fetch(e.request).catch(() => {
        if (e.request.mode === 'navigate' || (e.request.method === 'GET' && e.request.headers.get('accept').includes('text/html'))) {
          return caches.match(OFFLINE_URL);
        }
      });
    })
  );
});

// 4. SYNC: Kirim data presensi saat internet kembali aktif (Background Sync)
self.addEventListener('sync', (e) => {
  if (e.tag === 'sinkron-presensi') {
    console.log('SW: Mendeteksi Internet. Menjalankan Sinkronisasi Latar Belakang...');
    e.waitUntil(kirimDataDariIndexedDB());
  }
});

// Fungsi untuk membaca data dari IndexedDB dan mengirim ke Google Sheets
async function kirimDataDariIndexedDB() {
  const dbPromise = new Promise((resolve) => {
    const request = indexedDB.open("PresensiOfflineDB", 1);
    request.onsuccess = () => resolve(request.result);
  });

  const db = await dbPromise;
  
  // Cek apakah Object Store "antrean" ada
  if (!db.objectStoreNames.contains("antrean")) return;

  const transaction = db.transaction(["antrean"], "readwrite");
  const store = transaction.objectStore("antrean");
  
  const dataAntrean = await new Promise(resolve => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
  });

  if (dataAntrean.length > 0) {
    for (const item of dataAntrean) {
      try {
        // Kirim data ke Google Apps Script
        await fetch(`${SCRIPT_URL}?nama=${encodeURIComponent(item.nama)}&keterangan=${encodeURIComponent(item.keterangan)}`, { 
          method: 'GET', 
          mode: 'no-cors' 
        });
        console.log(`SW: Berhasil mengirim data: ${item.nama}`);
      } catch (err) {
        console.error("SW: Gagal mengirim, akan dicoba lagi nanti.", err);
        return; // Berhenti jika ada error (mungkin internet putus lagi)
      }
    }
    
    // Hapus semua antrean setelah pengiriman berhasil
    const clearTx = db.transaction(["antrean"], "readwrite");
    clearTx.objectStore("antrean").clear();
    console.log("SW: Sinkronisasi selesai, antrean dibersihkan.");
  }
}
