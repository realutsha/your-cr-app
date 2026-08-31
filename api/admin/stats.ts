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

    let totalGroups = 0;
    let totalUsers = 0;
    let totalMembers = 0;
    let totalCRs = 0;
    let totalHosts = 0;
    let sysConfig: any = null;

    // 1. If Firebase Admin SDK is available, query Firestore directly with admin privileges
    if (adminApp) {
      console.log('[Admin API: stats] Querying collections via Firebase Admin Firestore SDK...');
      const db = getFirestore(adminApp);

      const [groupsSnap, usersSnap, membersSnap, configSnap] = await Promise.all([
        db.collection('groups').get(),
        db.collection('users').get(),
        db.collection('groupMembers').get(),
        db.doc('appConfig/system').get(),
      ]);

      const groupsList = groupsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const usersList = usersSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const membersList = membersSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

      totalGroups = groupsList.length;
      totalUsers = usersList.length;
      totalMembers = membersList.filter((m: any) => m.status === 'approved' || !m.status).length;
      totalCRs = usersList.filter((u: any) => u.role === 'cr').length;

      const hostIds = new Set(groupsList.map((g: any) => g.host_id).filter(Boolean));
      totalHosts = hostIds.size;

      sysConfig = configSnap.exists ? configSnap.data() : null;
    } else {
      // 2. Fallback: Query Firestore REST API using ID token
      console.log('[Admin API: stats] Querying collections via Firestore REST API fallback...');
      const firestoreBase = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;
      const headers = {
        Authorization: `Bearer ${idToken}`,
        'Content-Type': 'application/json',
      };

      const [groupsRes, usersRes, membersRes, configRes] = await Promise.all([
        fetch(`${firestoreBase}/groups?pageSize=300`, { headers }),
        fetch(`${firestoreBase}/users?pageSize=1000`, { headers }),
        fetch(`${firestoreBase}/groupMembers?pageSize=1000`, { headers }),
        fetch(`${firestoreBase}/appConfig/system`, { headers }),
      ]);

      const groupsData = groupsRes.ok ? await groupsRes.json() : {};
      const usersData = usersRes.ok ? await usersRes.json() : {};
      const membersData = membersRes.ok ? await membersRes.json() : {};
      const configDoc = configRes.ok ? await configRes.json() : null;

      const groupsList = (groupsData.documents || []).map(parseFirestoreDoc);
      const usersList = (usersData.documents || []).map(parseFirestoreDoc);
      const membersList = (membersData.documents || []).map(parseFirestoreDoc);

      totalGroups = groupsList.length;
      totalUsers = usersList.length;
      totalMembers = membersList.filter((m) => m.status === 'approved' || !m.status).length;
      totalCRs = usersList.filter((u) => u.role === 'cr').length;

      const hostIds = new Set(groupsList.map((g) => g.host_id).filter(Boolean));
      totalHosts = hostIds.size;

      sysConfig = configDoc ? parseFirestoreDoc(configDoc) : null;
    }

    // Operational status calculation
    let appStatus: 'ONLINE' | 'MAINTENANCE' | 'SCHEDULED' = 'ONLINE';
    if (sysConfig?.isShutdown) {
      appStatus = 'MAINTENANCE';
    } else if (sysConfig?.scheduledStart && sysConfig?.scheduledEnd) {
      const now = Date.now();
      const start = new Date(sysConfig.scheduledStart).getTime();
      const end = new Date(sysConfig.scheduledEnd).getTime();
      if (!isNaN(start) && !isNaN(end)) {
        if (now >= start && now <= end) {
          appStatus = 'MAINTENANCE';
        } else if (now < start) {
          appStatus = 'SCHEDULED';
        }
      }
    }

    return res.status(200).json({
      success: true,
      stats: {
        totalGroups,
        totalUsers,
        totalMembers,
        totalCRs,
        totalHosts,
        appStatus,
      },
      system: sysConfig || {
        isShutdown: false,
        shutdownMessage: 'Class Mate is temporarily unavailable due to maintenance. Please try again later.',
        scheduledStart: null,
        scheduledEnd: null,
      },
    });
  } catch (err: any) {
    console.error('[Admin API: stats] Handler exception:', err);
    return res.status(500).json({
      error: err.message || 'Failed to fetch admin statistics.',
      code: err.code || 'STATS_ERROR',
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
      diagnostics: {
        route: '/api/admin/stats',
        timestamp: new Date().toISOString(),
      },
    });
  }
}
