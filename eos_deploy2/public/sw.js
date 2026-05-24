const CACHE = 'eos-v10';
const ASSETS = ['./index.html', './manifest.json'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  // Check due reminders on every fetch (keep-alive ping triggers this)
  checkDueReminders().catch(() => {});
  e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
});

// ── PUSH: receive from Apple/Google push servers ──────────────────────────
self.addEventListener('push', e => {
  let data = { title: '📅 EOS', body: '' };
  try { data = e.data ? e.data.json() : data; } catch(err) {}
  e.waitUntil(
    self.registration.showNotification(data.title || '📅 EOS', {
      body: data.body || '',
      icon: './icon.png',
      badge: './icon.png',
      tag: 'eos-push',
      requireInteraction: false,
      vibrate: [200, 100, 200]
    })
  );
});

// ── MESSAGE: from app JS ──────────────────────────────────────────────────
const DB_NAME = 'eos-reminders';
const DB_STORE = 'reminders';

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = e => e.target.result.createObjectStore(DB_STORE, { keyPath: 'id' });
    req.onsuccess = e => resolve(e.target.result);
    req.onerror = () => reject();
  });
}

function dbPut(item) {
  return openDB().then(db => new Promise((resolve) => {
    const tx = db.transaction(DB_STORE, 'readwrite');
    tx.objectStore(DB_STORE).put(item);
    tx.oncomplete = resolve;
    tx.onerror = resolve;
  }));
}

function dbDelete(id) {
  return openDB().then(db => new Promise((resolve) => {
    const tx = db.transaction(DB_STORE, 'readwrite');
    tx.objectStore(DB_STORE).delete(id);
    tx.oncomplete = resolve;
    tx.onerror = resolve;
  }));
}

function dbGetAll() {
  return openDB().then(db => new Promise((resolve) => {
    const tx = db.transaction(DB_STORE, 'readonly');
    const req = tx.objectStore(DB_STORE).getAll();
    req.onsuccess = e => resolve(e.target.result || []);
    req.onerror = () => resolve([]);
  }));
}

function checkDueReminders() {
  const now = Date.now();
  return dbGetAll().then(items => {
    const due = items.filter(r => r.fireAt <= now);
    return Promise.all(due.map(r =>
      self.registration.showNotification(r.title || '📅 EOS', {
        body: r.body || '',
        icon: './icon.png',
        badge: './icon.png',
        tag: 'eos-' + r.id,
        requireInteraction: false,
        vibrate: [200, 100, 200]
      }).then(() => dbDelete(r.id))
    ));
  });
}

self.addEventListener('message', e => {
  if (!e.data) return;
  if (e.data.type === 'SHOW_NOTIFICATION') {
    self.registration.showNotification(e.data.title || '📅 EOS', {
      body: e.data.body || '',
      icon: './icon.png',
      badge: './icon.png',
      tag: e.data.tag || 'eos',
      requireInteraction: false,
      vibrate: [200, 100, 200]
    });
  }
  if (e.data.type === 'SCHEDULE_REMINDER') {
    dbPut({ id: e.data.id, title: e.data.title, body: e.data.body, fireAt: e.data.fireAt });
  }
  if (e.data.type === 'CANCEL_REMINDER') {
    dbDelete(e.data.id);
  }
});



self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      if (list.length > 0) return list[0].focus();
      return clients.openWindow('./');
    })
  );
});
