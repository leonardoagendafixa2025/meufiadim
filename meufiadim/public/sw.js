self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let data = {
    title: "Meu Fiadim",
    body: "Você tem uma nova atualização.",
    url: "/",
    tag: "meufiadim-alert",
    icon: "/logo.png",
    badge: "/logo.png",
  };

  try {
    const parsed = event.data.json();
    data = { ...data, ...parsed };
  } catch {
    data.body = event.data.text() || data.body;
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon || "/logo.png",
      badge: data.badge || "/logo.png",
      tag: data.tag || "meufiadim-alert",
      renotify: true,
      vibrate: [220, 90, 220],
      data: { url: data.url || "/" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const rawUrl = event.notification?.data?.url || "/";
  const targetUrl = new URL(rawUrl, self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.startsWith(self.location.origin) && "focus" in client) {
          return client.focus().then((focused) => {
            if (focused && "navigate" in focused && focused.url !== targetUrl) {
              return focused.navigate(targetUrl);
            }
            return focused;
          });
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
      return undefined;
    })
  );
});
