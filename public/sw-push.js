// Service Worker DEDICAT pentru push notifications.
// NU cache-uim nimic, nu interceptăm fetch — doar push + notificationclick.
// Asta evită problemele cu PWA + preview iframe-ul Lovable (vezi project memory).

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = { title: "Notificare", body: "", link: "/", id: undefined };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch (e) {
    if (event.data) data.body = event.data.text();
  }

  const options = {
    body: data.body,
    icon: "/lovable-uploads/14a34d6c-2fa6-4719-8bb8-8f61820ae5ee.png",
    badge: "/lovable-uploads/14a34d6c-2fa6-4719-8bb8-8f61820ae5ee.png",
    data: { link: data.link || "/", id: data.id },
    tag: data.id || data.link || "coral-notif",
    renotify: true,
    requireInteraction: false,
    vibrate: [120, 60, 120],
  };

  event.waitUntil(
    (async () => {
      await self.registration.showNotification(data.title, options);
      // Setează badge pe iconiță (Android Chrome instalat)
      try {
        if ("setAppBadge" in self.navigator) {
          await self.navigator.setAppBadge();
        }
      } catch {}
    })()
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const link = event.notification?.data?.link || "/";

  event.waitUntil(
    (async () => {
      // Curăță badge-ul când userul apasă pe notificare
      try {
        if ("clearAppBadge" in self.navigator) {
          await self.navigator.clearAppBadge();
        }
      } catch {}

      const allClients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      // Caută o fereastră deja deschisă
      for (const client of allClients) {
        const url = new URL(client.url);
        if (url.origin === self.location.origin) {
          await client.focus();
          if ("navigate" in client) {
            try {
              await client.navigate(link);
            } catch {}
          }
          return;
        }
      }
      // Nu există -> deschide una nouă
      await self.clients.openWindow(link);
    })()
  );
});
