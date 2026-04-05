// Dashboard no longer uses an offline-first app shell.
// This worker now acts as a cleanup bridge for previously installed stale caches.
// Once activated, it deletes old caches, unregisters itself, and refreshes open tabs.

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    } catch {}

    try {
      await self.registration.unregister();
    } catch {}

    try {
      const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      await Promise.all(clients.map((client) => client.navigate(client.url).catch(() => undefined)));
    } catch {}
  })());

  self.clients.claim();
});
