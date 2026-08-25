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
    // 1. Query groups
    const groupsRes = await fetch(`${firestoreBase}/groups?pageSize=300`, { headers });
    const groupsData = groupsRes.ok ? await groupsRes.json() : {};
    const groupsList = (groupsData.documents || []).map(parseFirestoreDoc);

    // 2. Query users
    const usersRes = await fetch(`${firestoreBase}/users?pageSize=1000`, { headers });
    const usersData = usersRes.ok ? await usersRes.json() : {};
    const usersList = (usersData.documents || []).map(parseFirestoreDoc);

    // 3. Query group members
    const membersRes = await fetch(`${firestoreBase}/groupMembers?pageSize=1000`, { headers });
    const membersData = membersRes.ok ? await membersRes.json() : {};
    const membersList = (membersData.documents || []).map(parseFirestoreDoc);

    // 4. Query system status
    const configRes = await fetch(`${firestoreBase}/appConfig/system`, { headers });
    const configDoc = configRes.ok ? await configRes.json() : null;
    const sysConfig = configDoc ? parseFirestoreDoc(configDoc) : null;

    // Calculate aggregated metrics
    const totalGroups = groupsList.length;
    const totalUsers = usersList.length;
    const approvedMembers = membersList.filter((m) => m.status === 'approved');
    const totalMembers = approvedMembers.length;
    const totalCRs = usersList.filter((u) => u.role === 'cr').length;
    
    // Unique hosts
    const hostIds = new Set(groupsList.map((g) => g.host_id).filter(Boolean));
    const totalHosts = hostIds.size;

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
    return res.status(500).json({ error: err.message || 'Failed to fetch admin statistics.' });
  }
}
