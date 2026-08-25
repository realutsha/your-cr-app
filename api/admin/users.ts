import { handleCors, verifyAdminRequest, parseFirestoreDoc } from '../_adminAuth';

export const config = {
  maxDuration: 20,
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
    // 1. Fetch all user profiles
    const usersRes = await fetch(`${firestoreBase}/users?pageSize=1000`, { headers });
    const usersData = usersRes.ok ? await usersRes.json() : {};
    const usersList = (usersData.documents || []).map(parseFirestoreDoc);

    // 2. Fetch groups to resolve group names
    const groupsRes = await fetch(`${firestoreBase}/groups?pageSize=300`, { headers });
    const groupsData = groupsRes.ok ? await groupsRes.json() : {};
    const groupsList = (groupsData.documents || []).map(parseFirestoreDoc);
    const groupMap = new Map(groupsList.map((g) => [g.id, g]));

    // 3. Enhance user objects
    const enhancedUsers = usersList.map((u) => {
      const userGroup = u.current_group_id ? groupMap.get(u.current_group_id) : null;
      const isHost = groupsList.some((g) => g.host_id === u.id);
      return {
        id: u.id,
        email: u.email || '',
        username: u.username || u.email?.split('@')[0] || 'User',
        role: u.role || (isHost ? 'cr' : 'student'),
        is_host: isHost,
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
    return res.status(500).json({ error: err.message || 'Failed to fetch users.' });
  }
}
