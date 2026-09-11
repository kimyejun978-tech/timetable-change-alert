const CACHE_NAME = 'oneul-pe-v4';
const STATIC_ASSETS = [
  './',
  './index.html',
  './student.html',
  './teacher-login.html',
  './teacher.html',
  './style.css',
  './student-extra.css',
  './teacher-extra.css',
  './shared.js',
  './backend.js',
  './student-privacy.js',
  './student-resilience.js',
  './teacher-dashboard-controls.js',
  './pwa.js',
  './push-client.js',
  './student.js',
  './teacher-login.js',
  './teacher.js',
  './config.js',
  './manifest.webmanifest',
  './icon.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (url.pathname.includes('/api/')) return;
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(async () => (await caches.match(request)) || caches.match('./index.html'))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});

self.addEventListener('push', (event) => {
  let payload = {
    title: '오늘체육',
    body: '체육수업 안내가 변경되었습니다.',
    url: './student.html',
  };

  try {
    const data = event.data?.json();
    if (data) payload = { ...payload, ...data };
  } catch {
    const text = event.data?.text();
    if (text) payload.body = text;
  }

  event.waitUntil(self.registration.showNotification(payload.title, {
    body: payload.body,
    icon: './icon.svg',
    badge: './icon.svg',
    data: { url: payload.url || './student.html' },
    tag: payload.tag || 'oneul-pe-update',
    renotify: true,
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || './student.html', self.registration.scope).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((client) => client.url.startsWith(self.registration.scope));
      if (existing) {
        existing.navigate(target);
        return existing.focus();
      }
      return self.clients.openWindow(target);
    })
  );
});
