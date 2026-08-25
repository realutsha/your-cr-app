import { handleCors, verifyAdminRequest, parseFirestoreDoc } from '../_adminAuth';

export const config = {
  maxDuration: 15,
};

export default async function handler(req: any, res: any) {
  if (handleCors(req, res)) return;

  const admin = await verifyAdminRequest(req, res);
  if (!admin) return;

  const { projectId, idToken } = admin;
  const firestoreBase = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;
  const headers = {
    Authorization: `Bearer ${idToken}`,
    'Content-Type': 'application/json',
  };

  try {
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
    return res.status(500).json({ error: err.message || 'Failed to fetch audit logs.' });
  }
}
