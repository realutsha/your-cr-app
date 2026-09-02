import { requestFcmToken, onForegroundFcmMessage, isFirebaseConfigured, vapidKey, auth } from './firebase';
import { store } from './store';

export async function requestNotificationPermission(): Promise<{
  granted: boolean;
  token?: string;
  error?: string;
  needsVapidKey?: boolean;
}> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return { granted: false, error: 'Notifications not supported' };
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return { granted: false, error: 'Notification permission was denied' };
    }

    if (isFirebaseConfigured) {
      const fcmRes = await requestFcmToken();
      if (fcmRes.token) {
        // Save FCM token for current user
        store.saveUserFcmToken(fcmRes.token);
        return { granted: true, token: fcmRes.token };
      }
      return {
        granted: true,
        needsVapidKey: fcmRes.needsVapidKey,
        error: fcmRes.error,
      };
    }

    return { granted: true };
  } catch (e: unknown) {
    return { granted: false, error: (e as Error).message };
  }
}

export function sendLocalNotification(title: string, body: string, data?: Record<string, unknown>) {
  if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification(title, {
        body,
        icon: '/favicon.svg',
        badge: '/favicon.svg',
        tag: data?.update_id ? `update-${data.update_id}` : 'diu-class-notice',
        data,
      });
    } catch (e) {
      console.warn('Native notification failed:', e);
    }
  }
}

export function playSubtleChime() {
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const audioCtx = new AudioContextClass();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
    osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.12); // A5

    gain.gain.setValueAtTime(0.06, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.22);

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start();
    osc.stop(audioCtx.currentTime + 0.22);
  } catch {
    // AudioContext autoplay restriction or not supported
  }
}

/**
 * Dispatches an FCM push notification request to approved class members via the serverless dispatcher
 */
export async function dispatchUpdateNotification(data: {
  updateId: string;
  courseId?: string;
  groupId: string;
  courseName: string;
  category: string;
  title: string;
  date: string;
  time: string;
}): Promise<{ success: boolean; delivered?: number; error?: string }> {
  try {
    const currentUser = auth?.currentUser;
    if (!currentUser) return { success: false, error: 'User not signed in' };

    const token = await currentUser.getIdToken();
    const response = await fetch('/api/send-notification', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      return { success: false, error: errData.error || `HTTP ${response.status}` };
    }

    const result = await response.json();
    return { success: true, delivered: result.delivered };
  } catch (err: unknown) {
    const e = err as Error;
    return { success: false, error: e.message };
  }
}

/**
 * Initializes foreground push listener that triggers chime and in-app/native notification
 */
export function initForegroundNotificationListener(
  onReceive?: (title: string, body: string, data?: Record<string, any>) => void
): () => void {
  return onForegroundFcmMessage((payload) => {
    playSubtleChime();
    const title = payload.title || 'ClassMate';
    const body = payload.body || 'New academic update posted';

    // If app is hidden/minimized, trigger local notification; otherwise trigger in-app toast
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
      sendLocalNotification(title, body, payload.data);
    }

    if (onReceive) {
      onReceive(title, body, payload.data);
    }
  });
}

export { isFirebaseConfigured, vapidKey };

