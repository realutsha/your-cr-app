import { getFirestore } from 'firebase-admin/firestore';
import { handleCors, verifyAdminRequest, parseFirestoreDoc } from '../_adminAuth';

export const config = {
  maxDuration: 20,
};

export default async function handler(req: any, res: any) {
  if (handleCors(req, res)) return;

  try {
    const admin = await verifyAdminRequest(req, res);
    if (!admin) return;

    const { projectId, idToken, adminApp } = admin;

    // 1. If Firebase Admin SDK is available
    if (adminApp) {
      console.log('[Admin API: users] Querying via Firebase Admin Firestore SDK...');
      const db = getFirestore(adminApp);

      const [usersSnap, groupsSnap] = await Promise.all([
        db.collection('users').get(),
        db.collection('groups').get(),
      ]);

      const usersList = usersSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as any[];
      const groupsList = groupsSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as any[];
      const groupMap = new Map(groupsList.map((g) => [g.id, g]));

      const enhancedUsers = usersList.map((u) => {
        const userGroup = u.current_group_id ? groupMap.get(u.current_group_id) : null;
        const isHost = groupsList.some((g) => g.host_id === u.id);
        return {
          id: u.id,
          email: u.email || '',
          username: u.username || u.email?.split('@')[0] || 'User',
          role: u.role || (isHost ? 'cr' : 'student'),
          is_host: isHost || Boolean(u.is_host),
          current_group_id: u.current_group_id || null,
          group_name: userGroup?.name || null,
          group_code: userGroup?.code || null,
          created_at: u.created_at || new Date().toISOString(),
          last_active_at: u.last_active_at || null,
        };
      });

      return res.status(200).json({
        success: true,
        users: enhancedUsers,
      });
    }

    // 2. Fallback: Query via Firestore REST API
    console.log('[Admin API: users] Querying via Firestore REST API fallback...');
    const firestoreBase = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;
    const headers = {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    };

    const [usersRes, groupsRes] = await Promise.all([
      fetch(`${firestoreBase}/users?pageSize=1000`, { headers }),
      fetch(`${firestoreBase}/groups?pageSize=300`, { headers }),
    ]);

    const usersData = usersRes.ok ? await usersRes.json() : {};
    const usersList = (usersData.documents || []).map(parseFirestoreDoc);

    const groupsData = groupsRes.ok ? await groupsRes.json() : {};
    const groupsList = (groupsData.documents || []).map(parseFirestoreDoc);
    const groupMap = new Map(groupsList.map((g) => [g.id, g]));

    const enhancedUsers = usersList.map((u) => {
      const userGroup = u.current_group_id ? groupMap.get(u.current_group_id) : null;
      const isHost = groupsList.some((g) => g.host_id === u.id);
      return {
        id: u.id,
        email: u.email || '',
        username: u.username || u.email?.split('@')[0] || 'User',
        role: u.role || (isHost ? 'cr' : 'student'),
        is_host: isHost || Boolean(u.is_host),
        current_group_id: u.current_group_id || null,
        group_name: userGroup?.name || null,
        group_code: userGroup?.code || null,
        created_at: u.created_at || new Date().toISOString(),
        last_active_at: u.last_active_at || null,
      };
    });

    return res.status(200).json({
      success: true,
      users: enhancedUsers,
    });
  } catch (err: any) {
    console.error('[Admin API: users] Handler exception:', err);
    return res.status(500).json({
      error: err.message || 'Failed to fetch users.',
      code: err.code || 'USERS_ERROR',
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    });
  }
}
