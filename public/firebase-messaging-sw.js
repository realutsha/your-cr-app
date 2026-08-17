// Firebase Cloud Messaging Background Service Worker
importScripts('https://www.gstatic.com/firebasejs/10.13.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.13.0/firebase-messaging-compat.js');

// Initialize Firebase in Service Worker using Web App config
const firebaseConfig = {
  apiKey: "AIzaSyB_cX1cgjITzik4huErJug7WoRe3iPo2eU",
  authDomain: "classmate-6f10c.firebaseapp.com",
  projectId: "classmate-6f10c",
  storageBucket: "classmate-6f10c.firebasestorage.app",
  messagingSenderId: "364243941198",
  appId: "1:364243941198:web:a24971e9ef80330406d01f",
  measurementId: "G-3WJEF0R81S"
};

firebase.initializeApp(firebaseConfig);

let messaging = null;
try {
  messaging = firebase.messaging();
} catch (e) {
  console.warn('Firebase messaging not supported in this service worker environment', e);
}

if (messaging) {
  messaging.onBackgroundMessage((payload) => {
    const notificationTitle = payload.notification?.title || payload.data?.title || 'DIU Class Notice';
    const notificationOptions = {
      body: payload.notification?.body || payload.data?.body || 'New academic update posted',
      icon: '/favicon.svg',
      badge: '/favicon.svg',
      tag: payload.data?.update_id ? `update-${payload.data.update_id}` : 'diu-notice',
      data: payload.data || {},
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
  });
}

// Fallback listener for raw Web Push events
self.addEventListener('push', (event) => {
  if (!event.data) return;
  try {
    const payload = event.data.json();
    const title = payload.notification?.title || payload.data?.title || 'DIU Class Notice';
    const options = {
      body: payload.notification?.body || payload.data?.body || 'New academic update posted',
      icon: '/favicon.svg',
      badge: '/favicon.svg',
      tag: payload.data?.update_id ? `update-${payload.data.update_id}` : 'diu-notice',
      data: payload.data || {},
    };
    event.waitUntil(self.registration.showNotification(title, options));
  } catch {}
});

// Handle notification click to focus or open window
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const updateId = event.notification.data?.update_id || event.notification.data?.announcement_id;
  const urlToOpen = updateId ? `/?update=${updateId}` : '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(urlToOpen);
      }
    })
  );
});
