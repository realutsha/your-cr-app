// Vercel Serverless Function: Secure FCM Notification Dispatcher
// Dispatches push notifications strictly to approved members of a class group
import { getMessaging } from 'firebase-admin/messaging';
import { getFirestore } from 'firebase-admin/firestore';
import { getFirebaseAdminApp, handleCors } from './_adminAuth';

export const config = {
  maxDuration: 25,
};

function formatCategoryLabel(cat: string): string {
  const norm = (cat || '').toLowerCase().trim();
  if (norm === 'quiz') return 'Quiz';
  if (norm === 'lab') return 'Lab';
  if (norm === 'presentation') return 'Presentation';
  if (norm === 'assignment') return 'Assignment';
  return cat.charAt(0).toUpperCase() + cat.slice(1);
}

export default async function handler(req: any, res: any) {
  // CORS & Method Guard
  if (handleCors(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header.' });
  }

  const idToken = authHeader.split('Bearer ')[1].trim();
  const { updateId, courseId, groupId, courseName, category, title, date, time } = req.body || {};

  if (!groupId || !title || !category) {
    return res.status(400).json({ error: 'Missing required parameters (groupId, title, category).' });
  }

  try {
    const adminApp = getFirebaseAdminApp();
    const projectId = process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || 'classmate-6f10c';
    const apiKey = process.env.VITE_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY || '';

    // 1. Verify User ID Token
    let callerUid = '';
    let callerEmail = '';

    if (adminApp) {
      try {
        const { getAuth } = await import('firebase-admin/auth');
        const decoded = await getAuth(adminApp).verifyIdToken(idToken);
        callerUid = decoded.uid || decoded.sub;
        callerEmail = (decoded.email || '').toLowerCase().trim();
      } catch (adminErr: any) {
        console.warn('[FCM Dispatcher] Admin verifyIdToken error, attempting Identity Toolkit fallback:', adminErr?.message);
      }
    }

    if (!callerUid && apiKey) {
      const verifyRes = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken }),
        }
      );

      if (verifyRes.ok) {
        const userData = await verifyRes.json();
        const callerUser = userData.users?.[0];
        callerUid = callerUser?.localId || '';
        callerEmail = (callerUser?.email || '').toLowerCase().trim();
      }
    }

    if (!callerUid || !callerEmail.endsWith('@diu.edu.bd')) {
      return res.status(403).json({ error: 'Unauthorized. Valid @diu.edu.bd account required.' });
    }

    // 2. Fetch Group & verify caller is Host/CR
    const firestoreBase = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;
    const groupRes = await fetch(`${firestoreBase}/groups/${groupId}`);
    if (!groupRes.ok) {
      return res.status(404).json({ error: 'Group not found.' });
    }

    const groupDoc = await groupRes.json();
    const hostId = groupDoc.fields?.host_id?.stringValue;
    const originalHostId = groupDoc.fields?.original_host_id?.stringValue;
    const groupStatus = groupDoc.fields?.status?.stringValue || 'active';
    const expiresAt = groupDoc.fields?.expires_at?.stringValue;

    if (hostId !== callerUid && originalHostId !== callerUid) {
      return res.status(403).json({ error: 'Only the CR host can dispatch notifications for this class.' });
    }

    if (groupStatus !== 'active' || (expiresAt && new Date(expiresAt).getTime() <= Date.now())) {
      return res.status(400).json({ error: 'Cannot dispatch notifications for inactive or expired class.' });
    }

    // 3. Query approved group members (strictly excluding CR caller)
    const membersPayload = {
      structuredQuery: {
        from: [{ collectionId: 'groupMembers' }],
        where: {
          compositeFilter: {
            op: 'AND',
            filters: [
              {
                fieldFilter: {
                  field: { fieldPath: 'group_id' },
                  op: 'EQUAL',
                  value: { stringValue: groupId },
                },
              },
              {
                fieldFilter: {
                  field: { fieldPath: 'status' },
                  op: 'EQUAL',
                  value: { stringValue: 'approved' },
                },
              },
            ],
          },
        },
      },
    };

    const membersQueryRes = await fetch(
      `${firestoreBase}:runQuery`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(membersPayload),
      }
    );

    const memberDocs = await membersQueryRes.json();
    const approvedUserIds: string[] = [];

    if (Array.isArray(memberDocs)) {
      for (const m of memberDocs) {
        const uId = m.document?.fields?.user_id?.stringValue;
        if (uId && uId !== callerUid && !approvedUserIds.includes(uId)) {
          approvedUserIds.push(uId);
        }
      }
    }

    if (approvedUserIds.length === 0) {
      return res.status(200).json({ success: true, message: 'No student members to notify.', delivered: 0 });
    }

    // 4. Query FCM device tokens for approved members in batches of 30
    const deviceTokens: string[] = [];
    for (let i = 0; i < approvedUserIds.length; i += 30) {
      const chunk = approvedUserIds.slice(i, i + 30);
      const devicesPayload = {
        structuredQuery: {
          from: [{ collectionId: 'devices' }],
          where: {
            fieldFilter: {
              field: { fieldPath: 'user_id' },
              op: 'IN',
              value: {
                arrayValue: {
                  values: chunk.map((id) => ({ stringValue: id })),
                },
              },
            },
          },
        },
      };

      const devicesRes = await fetch(
        `${firestoreBase}:runQuery`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(devicesPayload),
        }
      );

      const devDocs = await devicesRes.json();
      if (Array.isArray(devDocs)) {
        for (const d of devDocs) {
          const tok = d.document?.fields?.fcm_token?.stringValue;
          if (tok && !deviceTokens.includes(tok)) {
            deviceTokens.push(tok);
          }
        }
      }
    }

    if (deviceTokens.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'Students found, but no active device push tokens registered.',
        membersFound: approvedUserIds.length,
        delivered: 0,
      });
    }

    // 5. Format Notification Content
    const catLabel = formatCategoryLabel(category);
    const notifTitle = title;
    const bodyParts: string[] = [];
    if (courseName) bodyParts.push(courseName);
    bodyParts.push(catLabel);
    if (date) {
      bodyParts.push(time ? `${date} at ${time}` : date);
    }
    const notifBody = bodyParts.join(' • ');

    const targetUrl = updateId ? `/?update=${encodeURIComponent(updateId)}` : '/';

    // 6. Dispatch Push Notifications via Firebase Admin SDK
    if (!adminApp) {
      console.info('[FCM Dispatcher] Admin SDK not initialized with service account; tokens resolved:', deviceTokens.length);
      return res.status(200).json({
        success: true,
        delivered: 0,
        warning: 'FCM Server credentials not configured on serverless environment. Set FIREBASE_SERVICE_ACCOUNT_KEY in Vercel.',
        tokensFound: deviceTokens.length,
        membersFound: approvedUserIds.length,
      });
    }

    const messaging = getMessaging(adminApp);
    const multicastMessage = {
      tokens: deviceTokens,
      notification: {
        title: notifTitle,
        body: notifBody,
      },
      data: {
        update_id: String(updateId || ''),
        updateId: String(updateId || ''),
        course_id: String(courseId || ''),
        courseId: String(courseId || ''),
        category: String(category || ''),
        group_id: String(groupId || ''),
        groupId: String(groupId || ''),
        course_name: String(courseName || ''),
        title: String(title || ''),
        click_action: targetUrl,
        url: targetUrl,
      },
      webpush: {
        fcmOptions: {
          link: targetUrl,
        },
        notification: {
          title: notifTitle,
          body: notifBody,
          icon: '/icons/icon-192.png',
          badge: '/favicon.svg',
          tag: `update-${updateId || 'notice'}`,
          requireInteraction: true,
        },
      },
    };

    const sendResult = await messaging.sendEachForMulticast(multicastMessage);
    let successCount = 0;
    let failCount = 0;
    const staleTokens: string[] = [];

    sendResult.responses.forEach((resp, idx) => {
      if (resp.success) {
        successCount++;
      } else {
        failCount++;
        const code = resp.error?.code;
        if (
          code === 'messaging/invalid-registration-token' ||
          code === 'messaging/registration-token-not-registered'
        ) {
          staleTokens.push(deviceTokens[idx]);
        }
      }
    });

    // 7. Cleanup invalid/stale tokens from Firestore devices collection
    if (staleTokens.length > 0) {
      try {
        const db = getFirestore(adminApp);
        const purgePromises = staleTokens.map(async (tok) => {
          const snap = await db.collection('devices').where('fcm_token', '==', tok).get();
          const batch = db.batch();
          snap.docs.forEach((d) => batch.delete(d.ref));
          return batch.commit().catch(() => {});
        });
        await Promise.allSettled(purgePromises);
      } catch (cleanupErr) {
        console.warn('[FCM Dispatcher] Token cleanup notice:', cleanupErr);
      }
    }

    return res.status(200).json({
      success: true,
      delivered: successCount,
      failed: failCount,
      tokensTotal: deviceTokens.length,
      membersFound: approvedUserIds.length,
      notification: {
        title: notifTitle,
        body: notifBody,
        updateId,
        groupId,
      },
    });
  } catch (error: any) {
    console.error('Notification dispatcher error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
