// Imperio Sistemas - Service Worker
const CACHE_NAME = 'imperio-pdv-v1';
const OFFLINE_URL = '/pdv';

// Resources to cache
const STATIC_ASSETS = [
  '/',
  '/pdv',
  '/login',
  '/manifest.json',
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME)
            .map((name) => caches.delete(name))
        );
      })
      .then(() => self.clients.claim())
  );
});

// Fetch event - network first, fall back to cache
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip API and auth requests - always go to network
  if (url.pathname.startsWith('/api/') || url.pathname.includes('supabase')) {
    return;
  }

  // For navigation requests, use network-first strategy
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .catch(() => {
          return caches.match(OFFLINE_URL);
        })
    );
    return;
  }

  // For static assets, use cache-first strategy
  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.match(/\.(js|css|png|jpg|jpeg|svg|gif|ico|woff|woff2)$/)
  ) {
    event.respondWith(
      caches.match(request)
        .then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          return fetch(request)
            .then((response) => {
              if (response.ok) {
                const responseClone = response.clone();
                caches.open(CACHE_NAME)
                  .then((cache) => cache.put(request, responseClone));
              }
              return response;
            });
        })
    );
    return;
  }

  // For other requests, use network-first with cache fallback
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME)
            .then((cache) => cache.put(request, responseClone));
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});

// Background sync for offline sales
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-vendas') {
    event.waitUntil(syncVendas());
  }
});

async function syncVendas() {
  // This would trigger sync from IndexedDB
  // The actual sync logic is in the React app
  const clients = await self.clients.matchAll();
  clients.forEach((client) => {
    client.postMessage({ type: 'SYNC_VENDAS' });
  });
}

// Push notifications (for future use)
self.addEventListener('push', (event) => {
  const data = event.data?.json() || {};
  const title = data.title || 'Imperio Sistemas';
  const options = {
    body: data.body || 'Nova notificacao',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    data: data.url || '/',
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data)
  );
});

console.log('[SW] Service Worker loaded');
