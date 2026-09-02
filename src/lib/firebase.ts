import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  type Auth,
  type User as FirebaseUser,
} from 'firebase/auth';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  memoryLocalCache,
  getFirestore,
  type Firestore,
} from 'firebase/firestore';
import {
  getMessaging,
  getToken,
  onMessage,
  isSupported,
  type Messaging,
} from 'firebase/messaging';

// Read Firebase Web App configuration from environment variables
const rawAuthDomain = (import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '').trim();
const projectId = (import.meta.env.VITE_FIREBASE_PROJECT_ID || '').trim();

// Ensure authDomain points to the real Firebase auth handler domain (e.g. <project-id>.firebaseapp.com)
// and not the Vercel deployment URL (which serves the SPA instead of Firebase auth iframe handler).
const authDomain =
  rawAuthDomain && !rawAuthDomain.includes('.vercel.app')
    ? rawAuthDomain
    : projectId
    ? `${projectId}.firebaseapp.com`
    : rawAuthDomain;

const firebaseConfig = {
  apiKey: (import.meta.env.VITE_FIREBASE_API_KEY || '').trim(),
  authDomain,
  projectId,
  storageBucket: (import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || (projectId ? `${projectId}.firebasestorage.app` : '')).trim(),
  messagingSenderId: (import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '').trim(),
  appId: (import.meta.env.VITE_FIREBASE_APP_ID || '').trim(),
  measurementId: (import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || '').trim(),
};

export const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY || '';

export const firebaseConfigSummary = {
  projectId: firebaseConfig.projectId,
  authDomain: firebaseConfig.authDomain,
  hasApiKey: Boolean(firebaseConfig.apiKey),
  hasAppId: Boolean(firebaseConfig.appId),
};

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
  firebaseConfig.projectId &&
  firebaseConfig.messagingSenderId &&
  firebaseConfig.appId
);

// Initialize Firebase App
export const app: FirebaseApp | null = isFirebaseConfigured
  ? getApps().length === 0
    ? initializeApp(firebaseConfig)
    : getApp()
  : null;

// Initialize Firebase Authentication
export const auth: Auth | null = app ? getAuth(app) : null;

// Explicitly set persistence to browserLocalPersistence so admin sessions survive page refresh.
// Firebase defaults to this, but making it explicit guards against misconfiguration.
if (auth) {
  setPersistence(auth, browserLocalPersistence).catch((err) => {
    console.warn('[Firebase] Failed to set auth persistence:', err);
  });
}

// Initialize Cloud Firestore with multi-tab persistence and fallback
function initFirestore(firebaseApp: FirebaseApp): Firestore {
  try {
    return initializeFirestore(firebaseApp, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
    });
  } catch {
    try {
      return initializeFirestore(firebaseApp, {
        localCache: memoryLocalCache(),
      });
    } catch {
      return getFirestore(firebaseApp);
    }
  }
}

export const db: Firestore | null = app ? initFirestore(app) : null;

// Google Auth Provider setup with DIU domain hint
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  hd: 'diu.edu.bd',
  prompt: 'select_account',
});

// Dedicated Admin Google Auth Provider without domain restriction
export const adminGoogleProvider = new GoogleAuthProvider();
adminGoogleProvider.setCustomParameters({
  prompt: 'select_account',
});

let messagingPromise: Promise<Messaging | null> | null = null;

export async function getFirebaseMessaging(): Promise<Messaging | null> {
  if (typeof window === 'undefined' || !app) return null;

  if (!messagingPromise) {
    messagingPromise = isSupported().then((supported) => {
      if (supported) {
        return getMessaging(app);
      }
      console.warn('Firebase Cloud Messaging is not supported in this browser/environment.');
      return null;
    });
  }

  return messagingPromise;
}

/**
 * Requests Notification permission and generates an FCM Device Registration Token.
 */
export async function requestFcmToken(): Promise<{
  token?: string;
  error?: string;
  needsVapidKey?: boolean;
}> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return { error: 'Notifications are not supported by this browser.' };
  }

  if (!isFirebaseConfigured || !app) {
    return { error: 'Firebase is not configured in environment variables.' };
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return { error: 'Notification permission was denied.' };
    }

    const messaging = await getFirebaseMessaging();
    if (!messaging) {
      return { error: 'Firebase Messaging is not available.' };
    }

    // Register and ensure service worker is active
    let swRegistration: ServiceWorkerRegistration | undefined = undefined;
    if ('serviceWorker' in navigator) {
      try {
        swRegistration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/' });
        await navigator.serviceWorker.ready;
      } catch (e) {
        console.warn('[FCM] Service worker registration notice:', e);
      }
    }

    if (!vapidKey) {
      return {
        needsVapidKey: true,
        error: 'Firebase Web Push certificate (VAPID Key) is not set in VITE_FIREBASE_VAPID_KEY.',
      };
    }

    const token = await getToken(messaging, {
      vapidKey,
      serviceWorkerRegistration: swRegistration,
    });

    if (token) {
      return { token };
    } else {
      return { error: 'No FCM registration token received.' };
    }
  } catch (e: unknown) {
    const err = e as Error;
    if (
      err.message &&
      (err.message.includes('vapid') ||
        err.message.includes('publicKey') ||
        err.message.includes('missing-app-config-value'))
    ) {
      return {
        needsVapidKey: true,
        error: 'Invalid or missing Firebase Web Push VAPID key.',
      };
    }
    return { error: err.message || 'Failed to generate FCM token.' };
  }
}

/**
 * Listens for FCM push messages when the app is in the foreground.
 */
export function onForegroundFcmMessage(
  callback: (payload: { title?: string; body?: string; data?: Record<string, any> }) => void
): () => void {
  let unsubscribe: (() => void) | null = null;

  getFirebaseMessaging().then((messaging) => {
    if (messaging) {
      unsubscribe = onMessage(messaging, (payload) => {
        const title = payload.notification?.title || payload.data?.title || 'DIU Class Notice';
        const body = payload.notification?.body || payload.data?.body || 'New academic update';
        callback({
          title,
          body,
          data: payload.data,
        });
      });
    }
  });

  return () => {
    if (unsubscribe) unsubscribe();
  };
}

export {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  firebaseSignOut,
  onAuthStateChanged,
  type FirebaseUser,
};
