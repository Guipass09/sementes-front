// Service Worker para Firebase Cloud Messaging
// Este arquivo deve estar em /public para ser acessível

importScripts("https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js");

// Configuração do Firebase (mesma do frontend)
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID",
};

firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

// Escutar push notifications quando app está fechado
messaging.onBackgroundMessage((payload) => {
  console.log("Push notification recebida (app fechado):", payload);

  const notificationTitle = payload.notification?.title || "Notificação";
  const notificationOptions = {
    body: payload.notification?.body || "",
    icon: payload.notification?.icon || "/logo-sementes-da-fala.jpg",
    badge: "/logo-sementes-da-fala.jpg",
    data: payload.data || {},
    tag: payload.data?.kind || "notification",
    requireInteraction: false,
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Clique na notificação
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const data = event.notification.data || {};
  let url = "/";

  if (data.kind === "new_content" && data.content?.action_path) {
    url = data.content.action_path;
  } else if (data.kind === "appointment_30min" || data.kind === "appointment_completed") {
    url = "/paciente/sessoes";
  }

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === url && "focus" in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});
