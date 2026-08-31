import { getFirestore } from 'firebase-admin/firestore';
import { handleCors, verifyAdminRequest, parseFirestoreDoc } from '../_adminAuth';

export const config = {
  maxDuration: 15,
};

export default async function handler(req: any, res: any) {
  if (handleCors(req, res)) return;

  try {
    const admin = await verifyAdminRequest(req, res);
    if (!admin) return;

    const { projectId, idToken, adminApp } = admin;

    // 1. If Firebase Admin SDK is available
    if (adminApp) {
      console.log('[Admin API: audit] Querying via Firebase Admin Firestore SDK...');
      const db = getFirestore(adminApp);

      let logsSnap;
      try {
        logsSnap = await db.collection('adminAuditLogs').orderBy('timestamp', 'desc').limit(100).get();
      } catch (err: any) {
        console.warn('[Admin API: audit] Ordered query failed, fetching unordered fallback:', err.message);
        logsSnap = await db.collection('adminAuditLogs').limit(100).get();
      }

      const logsList = logsSnap.docs.map((d) => {
        const data = d.data();
        let ts = new Date().toISOString();
        if (data.timestamp?.toDate) {
          ts = data.timestamp.toDate().toISOString();
        } else if (typeof data.timestamp === 'string') {
          ts = data.timestamp;
        }

        return {
          id: d.id,
          performedBy: data.performedBy || 'admin',
          action: data.action || 'UPDATE',
          details: data.details || '',
          isShutdown: data.isShutdown,
          scheduledStart: data.scheduledStart,
          scheduledEnd: data.scheduledEnd,
          timestamp: ts,
        };
      });

      return res.status(200).json({
        success: true,
        logs: logsList,
      });
    }

    // 2. Fallback: Query via Firestore REST API
    console.log('[Admin API: audit] Querying via Firestore REST API fallback...');
    const firestoreBase = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;
    const headers = {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    };

    const logsRes = await fetch(`${firestoreBase}/adminAuditLogs?pageSize=100`, { headers });
    const logsData = logsRes.ok ? await logsRes.json() : {};
    const logsList = (logsData.documents || [])
      .map(parseFirestoreDoc)
      .sort((a: any, b: any) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime());

    return res.status(200).json({
      success: true,
      logs: logsList,
    });
  } catch (err: any) {
    console.error('[Admin API: audit] Handler exception:', err);
    return res.status(500).json({
      error: err.message || 'Failed to fetch audit logs.',
      code: err.code || 'AUDIT_ERROR',
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    });
  }
}
