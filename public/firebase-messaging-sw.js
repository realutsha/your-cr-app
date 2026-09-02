// Class Mate PWA & Firebase Cloud Messaging Service Worker
importScripts('https://www.gstatic.com/firebasejs/10.13.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.13.0/firebase-messaging-compat.js');

const CACHE_NAME = 'classmate-shell-v1';
const STATIC_SHELL = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.svg',
  '/icons/icon-192.png',
  '/icons/icon-384.png',
  '/icons/icon-512.png',
  '/icons/icon-1024.png',
  '/icons/icon-maskable-192.png',
  '/icons/icon-maskable-512.png',
  '/icons/apple-touch-icon.png',
  '/icons/favicon-32.png',
];

// 1. Service Worker Lifecycle: Cache Shell
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_SHELL).catch(() => {});
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then((keys) => {
        return Promise.all(
          keys.map((key) => {
            if (key !== CACHE_NAME) {
              return caches.delete(key);
            }
          })
        );
      }),
    ])
  );
});

// 2. Fetch Handler: Network-First for Static Assets, Strictly Bypass Firebase/Firestore
self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // STRICTLY IGNORE Firebase Auth, Firestore, Google APIs, Cloud Functions, and API endpoints
  if (
    url.hostname.includes('firestore.googleapis.com') ||
    url.hostname.includes('identitytoolkit.googleapis.com') ||
    url.hostname.includes('securetoken.googleapis.com') ||
    url.hostname.includes('firebaseinstallations.googleapis.com') ||
    url.hostname.includes('fcm.googleapis.com') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('firebaseio.com') ||
    url.hostname.includes('google.com') ||
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/__/')
  ) {
    return; // Pass through directly to live network, NEVER cache sensitive or real-time data
  }

  // Same-origin static asset handling (HTML, JS, CSS, fonts, icons)
  if (url.origin === self.location.origin) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200 && response.type === 'basic') {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return response;
        })
        .catch(async () => {
          const cachedResponse = await caches.match(request);
          if (cachedResponse) return cachedResponse;
          if (request.mode === 'navigate') {
            const fallback = await caches.match('/');
            if (fallback) return fallback;
          }
          return new Response('Offline - Please reconnect to access real-time academic updates.', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: { 'Content-Type': 'text/plain' },
          });
        })
    );
  }
});

// 3. Initialize Firebase in Service Worker for Background Push
const params = new URLSearchParams(location.search);
const firebaseConfig = {
  apiKey: params.get('apiKey') || "AIzaSyB_cX1cgjITzik4huErJug7WoRe3iPo2eU",
  authDomain: params.get('authDomain') || "classmate-6f10c.firebaseapp.com",
  projectId: params.get('projectId') || "classmate-6f10c",
  storageBucket: params.get('storageBucket') || "classmate-6f10c.firebasestorage.app",
  messagingSenderId: params.get('messagingSenderId') || "364243941198",
  appId: params.get('appId') || "1:364243941198:web:a24971e9ef80330406d01f",
  measurementId: params.get('measurementId') || "G-3WJEF0R81S"
};

if (firebase.apps.length === 0) {
  firebase.initializeApp(firebaseConfig);
}

let messaging = null;
try {
  messaging = firebase.messaging();
} catch (e) {
  console.warn('Firebase messaging not supported in this service worker environment', e);
}

if (messaging) {
  messaging.onBackgroundMessage((payload) => {
    const notificationTitle = payload.notification?.title || payload.data?.title || 'ClassMate';
    const notificationBody = payload.notification?.body || payload.data?.body || 'New academic update posted';
    const updateId = payload.data?.update_id || payload.data?.updateId;

    const notificationOptions = {
      body: notificationBody,
      icon: '/icons/icon-192.png',
      badge: '/favicon.svg',
      tag: updateId ? `update-${updateId}` : 'classmate-notice',
      data: payload.data || {},
      requireInteraction: true,
      vibrate: [200, 100, 200],
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
  });
} else {
  // Fallback listener for raw Web Push events only if firebase.messaging() is not supported
  self.addEventListener('push', (event) => {
    if (!event.data) return;
    try {
      const payload = event.data.json();
      const title = payload.notification?.title || payload.data?.title || 'ClassMate';
      const body = payload.notification?.body || payload.data?.body || 'New academic update posted';
      const updateId = payload.data?.update_id || payload.data?.updateId;

      const options = {
        body,
        icon: '/icons/icon-192.png',
        badge: '/favicon.svg',
        tag: updateId ? `update-${updateId}` : 'classmate-notice',
        data: payload.data || {},
        requireInteraction: true,
        vibrate: [200, 100, 200],
      };
      event.waitUntil(self.registration.showNotification(title, options));
    } catch {}
  });
}

// Handle notification click to focus or open window and navigate to exact update
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const updateId = data.update_id || data.updateId || data.announcement_id;
  const courseId = data.course_id || data.courseId;
  const category = data.category;
  const groupId = data.group_id || data.groupId;

  const targetPath = updateId ? `/?update=${encodeURIComponent(updateId)}` : '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // 1. If an active client window is already open, focus it and post a message to open the update
      for (const client of windowClients) {
        if ('focus' in client) {
          client.focus();
          client.postMessage({
            type: 'NAVIGATE_UPDATE',
            updateId,
            courseId,
            category,
            groupId,
          });
          return;
        }
      }
      // 2. If no window is open, open a new window with query params
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetPath);
      }
    })
  );
});
