import { handleCors, verifyAdminRequest, parseFirestoreDoc, encodeFirestoreValue } from '../_adminAuth';

export const config = {
  maxDuration: 15,
};

export default async function handler(req: any, res: any) {
  if (handleCors(req, res)) return;

  const admin = await verifyAdminRequest(req, res);
  if (!admin) return;

  const { projectId, idToken, email } = admin;
  const firestoreBase = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;
  const headers = {
    Authorization: `Bearer ${idToken}`,
    'Content-Type': 'application/json',
  };

  if (req.method === 'GET') {
    try {
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
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Failed to get system status.' });
    }
  }

  if (req.method === 'POST') {
    const { isShutdown, shutdownMessage, scheduledStart, scheduledEnd, actionType, notes } = req.body || {};

    try {
      const now = new Date().toISOString();
      const updatedFields: Record<string, any> = {
        isShutdown: Boolean(isShutdown),
        shutdownMessage: shutdownMessage || 'Class Mate is temporarily unavailable due to maintenance. Please try again later.',
        scheduledStart: scheduledStart || null,
        scheduledEnd: scheduledEnd || null,
        updatedAt: now,
        updatedBy: email,
      };

      const firestoreDocFields: Record<string, any> = {};
      for (const [k, v] of Object.entries(updatedFields)) {
        firestoreDocFields[k] = encodeFirestoreValue(v);
      }

      // Write appConfig/system
      const patchRes = await fetch(`${firestoreBase}/appConfig/system`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ fields: firestoreDocFields }),
      });

      if (!patchRes.ok) {
        const errText = await patchRes.text();
        return res.status(500).json({ error: `Failed to update system config: ${errText}` });
      }

      // Write Audit Log
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
      }).catch((e) => console.warn('Could not write audit log:', e));

      return res.status(200).json({
        success: true,
        message: 'Application operational status updated successfully.',
        config: updatedFields,
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Failed to update system status.' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed. Use GET or POST.' });
}
