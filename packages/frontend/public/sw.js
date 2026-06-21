self.addEventListener('install', (event) => {
  console.log('Service Worker: Installed successfully');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activated successfully');
  event.waitUntil(self.clients.claim());
});
