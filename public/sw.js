self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

// Do not cache authenticated pages or deadline data.
self.addEventListener("fetch", () => {});
