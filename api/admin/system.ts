import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { handleCors, verifyAdminRequest, parseFirestoreDoc, encodeFirestoreValue } from '../_adminAuth';

export const config = {
  maxDuration: 15,
};

export default async function handler(req: any, res: any) {
  if (handleCors(req, res)) return;

  try {
    const admin = await verifyAdminRequest(req, res);
    if (!admin) return;

    const { projectId, idToken, email, adminApp } = admin;

    // GET Request: Retrieve system operational configuration
    if (req.method === 'GET') {
      if (adminApp) {
        const db = getFirestore(adminApp);
        const configDoc = await db.doc('appConfig/system').get();
        const data = configDoc.exists ? configDoc.data() : null;

        return res.status(200).json({
          success: true,
          config: data || {
            isShutdown: false,
            shutdownMessage: 'Class Mate is temporarily unavailable due to maintenance. Please try again later.',
            scheduledStart: null,
            scheduledEnd: null,
            updatedAt: new Date().toISOString(),
            updatedBy: email,
          },
        });
      }

      // REST API fallback
      const firestoreBase = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;
      const headers = {
        Authorization: `Bearer ${idToken}`,
        'Content-Type': 'application/json',
      };

      const configRes = await fetch(`${firestoreBase}/appConfig/system`, { headers });
      if (!configRes.ok) {
        return res.status(200).json({
          success: true,
          config: {
            isShutdown: false,
            shutdownMessage: 'Class Mate is temporarily unavailable due to maintenance. Please try again later.',
            scheduledStart: null,
            scheduledEnd: null,
            updatedAt: new Date().toISOString(),
            updatedBy: email,
          },
        });
      }

      const data = parseFirestoreDoc(await configRes.json());
      return res.status(200).json({ success: true, config: data });
    }

    // POST Request: Update system status and record audit log
    if (req.method === 'POST') {
      const { isShutdown, shutdownMessage, scheduledStart, scheduledEnd, actionType, notes } = req.body || {};
      const now = new Date().toISOString();

      const updatedFields: Record<string, any> = {
        isShutdown: Boolean(isShutdown),
        shutdownMessage: shutdownMessage || 'Class Mate is temporarily unavailable due to maintenance. Please try again later.',
        scheduledStart: scheduledStart || null,
        scheduledEnd: scheduledEnd || null,
        updatedAt: now,
        updatedBy: email,
      };

      if (adminApp) {
        const db = getFirestore(adminApp);

        // 1. Update appConfig/system
        await db.doc('appConfig/system').set(updatedFields, { merge: true });

        // 2. Write Audit Log
        const auditLogId = `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        await db.collection('adminAuditLogs').doc(auditLogId).set({
          id: auditLogId,
          performedBy: email,
          action: actionType || (isShutdown ? 'SHUTDOWN_APP' : 'RESTART_APP'),
          details: notes || `System status set to ${isShutdown ? 'OFFLINE (Maintenance)' : 'ONLINE'}`,
          isShutdown: Boolean(isShutdown),
          scheduledStart: scheduledStart || null,
          scheduledEnd: scheduledEnd || null,
          timestamp: FieldValue.serverTimestamp(),
        });

        return res.status(200).json({
          success: true,
          message: 'Application operational status updated successfully.',
          config: updatedFields,
        });
      }

      // REST API fallback
      const firestoreBase = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;
      const headers = {
        Authorization: `Bearer ${idToken}`,
        'Content-Type': 'application/json',
      };

      const firestoreDocFields: Record<string, any> = {};
      for (const [k, v] of Object.entries(updatedFields)) {
        firestoreDocFields[k] = encodeFirestoreValue(v);
      }

      const patchRes = await fetch(`${firestoreBase}/appConfig/system`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ fields: firestoreDocFields }),
      });

      if (!patchRes.ok) {
        const errText = await patchRes.text();
        return res.status(500).json({ error: `Failed to update system config: ${errText}` });
      }

      const auditLogId = `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const auditLogDoc = {
        fields: {
          id: encodeFirestoreValue(auditLogId),
          performedBy: encodeFirestoreValue(email),
          action: encodeFirestoreValue(actionType || (isShutdown ? 'SHUTDOWN_APP' : 'RESTART_APP')),
          details: encodeFirestoreValue(notes || `System status set to ${isShutdown ? 'OFFLINE (Maintenance)' : 'ONLINE'}`),
          isShutdown: encodeFirestoreValue(Boolean(isShutdown)),
          scheduledStart: encodeFirestoreValue(scheduledStart || null),
          scheduledEnd: encodeFirestoreValue(scheduledEnd || null),
          timestamp: encodeFirestoreValue(now),
        },
      };

      await fetch(`${firestoreBase}/adminAuditLogs/${auditLogId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(auditLogDoc),
      }).catch((e) => console.warn('Could not write audit log via REST:', e));

      return res.status(200).json({
        success: true,
        message: 'Application operational status updated successfully.',
        config: updatedFields,
      });
    }

    return res.status(405).json({ error: 'Method not allowed. Use GET or POST.' });
  } catch (err: any) {
    console.error('[Admin API: system] Handler exception:', err);
    return res.status(500).json({
      error: err.message || 'Failed to process system status request.',
      code: err.code || 'SYSTEM_ERROR',
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    });
  }
}
