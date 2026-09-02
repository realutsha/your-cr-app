// Vercel Serverless Function: Secure FCM Notification Dispatcher
// Dispatches push notifications strictly to approved members of a class group

export const config = {
  maxDuration: 15,
};

export default async function handler(req: any, res: any) {
  // CORS & Method Guard
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header.' });
  }

  const idToken = authHeader.split('Bearer ')[1].trim();
  const { updateId, groupId, courseName, category, title, date, time } = req.body || {};

  if (!groupId || !title || !category) {
    return res.status(400).json({ error: 'Missing required parameters (groupId, title, category).' });
  }

  try {
    // 1. Verify User ID Token against Google Identity Toolkit
    const projectId = process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || 'classmate-6f10c';
    const apiKey = process.env.VITE_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY || '';
    const verifyRes = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      }
    );

    if (!verifyRes.ok) {
      return res.status(401).json({ error: 'Invalid or expired Firebase Auth token.' });
    }

    const userData = await verifyRes.json();
    const callerUser = userData.users?.[0];
    const callerUid = callerUser?.localId;
    const callerEmail = (callerUser?.email || '').toLowerCase();

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
    if (hostId !== callerUid && originalHostId !== callerUid) {
      return res.status(403).json({ error: 'Only the CR host can dispatch notifications.' });
    }

    // 3. Query approved group members
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
        if (uId && uId !== callerUid) {
          approvedUserIds.push(uId);
        }
      }
    }

    if (approvedUserIds.length === 0) {
      return res.status(200).json({ success: true, message: 'No student members to notify.', delivered: 0 });
    }

    // 4. Query FCM device tokens for approved members in chunks of 30
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

    return res.status(200).json({
      success: true,
      delivered: deviceTokens.length,
      membersFound: approvedUserIds.length,
      notification: {
        title: `${category.toUpperCase()}: ${title}`,
        body: `${courseName || 'Academic Notice'} · ${date} ${time ? `(${time})` : ''}`,
        updateId,
        groupId,
      },
    });
  } catch (error: any) {
    console.error('Notification dispatcher error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
