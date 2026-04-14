const CACHE_NAME = 'presensi-azzahro-v1.0.5';
const OFFLINE_URL = './offline.html';
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwCXbDTuaFkN7GlcXJxaFgDaKPEp2G9vySF1IKfWxUCTuEOCYt39nMmlEmI25pz4PSd/exec';

const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './offline.html',
  './manifest.json',
  './logo-smp-azzahro.png',
  './logo-smk-azzahro.png',
  './notification/Notif01.mp3',
  'https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js',
  './icon-apk-presensi-azzahro.png'
];

// 1. Install: Simpan aset ke cache
self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_CACHE))
  );
});

// 2. Activate: Bersihkan cache lama
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) return caches.delete(key);
        })
      );
    })
  );
  return self.clients.claim();
});

// 3. Fetch: Ambil aset dari cache, biarkan Google Script lewat
self.addEventListener('fetch', (e) => {
  if (e.request.url.includes('script.google.com')) return;
  e.respondWith(
    caches.match(e.request).then((res) => res || fetch(e.request))
  );
});

// 4. Listener Background Sync
self.addEventListener('sync', (e) => {
  if (e.tag === 'sinkron-presensi') {
    console.log('SW: Sinkronisasi latar belakang berjalan...');
    e.waitUntil(kirimDataDariIndexedDB());
  }
});

// 5. Fungsi kirim data dari antrean lokal
async function kirimDataDariIndexedDB() {
  const dbPromise = new Promise((resolve) => {
    const request = indexedDB.open("PresensiOfflineDB", 1);
    request.onsuccess = () => resolve(request.result);
  });

  const db = await dbPromise;
  if (!db.objectStoreNames.contains("antrean")) return;

  const transaction = db.transaction(["antrean"], "readwrite");
  const store = transaction.objectStore("antrean");
  const dataAntrean = await new Promise(resolve => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
  });

  if (dataAntrean.length > 0) {
    let suksesCount = 0;
    for (const item of dataAntrean) {
      try {
        await fetch(`${SCRIPT_URL}?nama=${encodeURIComponent(item.nama)}&keterangan=${encodeURIComponent(item.keterangan)}`, { 
          method: 'GET', 
          mode: 'no-cors' 
        });
        suksesCount++;
      } catch (err) {
        console.error("SW: Gagal mengirim data, akan dicoba lagi nanti.");
        return; // Berhenti agar data tetap di IndexedDB
      }
    }
    
    // Hapus antrean jika semua terkirim
    const clearTx = db.transaction(["antrean"], "readwrite");
    clearTx.objectStore("antrean").clear();

    // TAMPILKAN NOTIFIKASI KE SISTEM HP
    showNotification(
      `Sinkronisasi Berhasil!`, 
      `${suksesCount} data presensi offline telah terkirim ke server.`
    );
  }
}

// 6. Fungsi pemicu Notifikasi Bar
function showNotification(title, body) {
  if (self.registration.showNotification) {
    self.registration.showNotification(title, {
      body: body,
      icon: './icon-apk-presensi-azzahro.png',
      badge: './icon-apk-presensi-azzahro.png',
      vibrate: [200, 100, 200],
      tag: 'sync-notification',
      data: {
        url: 'https://azzahrolocare.github.io/rekapitulasi-presensi-siswa/'
      },
      requireInteraction: true // Notifikasi tetap ada sampai diklik atau di-swipe
    });
  }
}

// Listener untuk menangani klik pada notifikasi
self.addEventListener('notificationclick', (e) => {
  e.notification.close(); // Tutup notifikasi setelah diklik

  // URL tujuan saat notifikasi diklik
  const urlToOpen = 'https://azzahrolocare.github.io/rekapitulasi-presensi-siswa/';

  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Jika tab aplikasi sudah terbuka, fokuskan ke tab tersebut dan arahkan URL-nya
      for (var i = 0; i < windowClients.length; i++) {
        var client = windowClients[i];
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      // Jika belum ada tab yang terbuka, buka jendela baru
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
