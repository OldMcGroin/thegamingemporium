// Minimal service worker for The Gaming Emporium PWA.
// The site remains network-first so normal Hugo/Cloudflare deployments are never held back by an app cache.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
