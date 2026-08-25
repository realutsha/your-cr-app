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

  const groupId = req.query.id as string | undefined;

  try {
    // If specific group ID requested, return detailed group data with member roster
    if (groupId) {
      const groupRes = await fetch(`${firestoreBase}/groups/${groupId}`, { headers });
      if (!groupRes.ok) {
        return res.status(404).json({ error: 'Group not found.' });
      }
      const group = parseFirestoreDoc(await groupRes.json());

      // Query members of this group
      const membersQueryPayload = {
        structuredQuery: {
          from: [{ collectionId: 'groupMembers' }],
          where: {
            fieldFilter: {
              field: { fieldPath: 'group_id' },
              op: 'EQUAL',
              value: { stringValue: groupId },
            },
          },
        },
      };

      const membersRes = await fetch(`${firestoreBase}:runQuery`, {
        method: 'POST',
        headers,
        body: JSON.stringify(membersQueryPayload),
      });

      const memberQueryDocs = membersRes.ok ? await membersRes.json() : [];
      const membersList: any[] = [];
      if (Array.isArray(memberQueryDocs)) {
        for (const item of memberQueryDocs) {
          if (item.document) {
            membersList.push(parseFirestoreDoc(item.document));
          }
        }
      }

      // Fetch user profile info for members where available
      const userIds = membersList.map((m) => m.user_id).filter(Boolean);
      if (group.host_id && !userIds.includes(group.host_id)) {
        userIds.push(group.host_id);
      }

      // Fetch host details
      let hostUser: any = null;
      if (group.host_id) {
        const hostRes = await fetch(`${firestoreBase}/users/${group.host_id}`, { headers });
        if (hostRes.ok) {
          hostUser = parseFirestoreDoc(await hostRes.json());
        }
      }

      return res.status(200).json({
        success: true,
        group: {
          ...group,
          host_email: hostUser?.email || '',
          host_username: hostUser?.username || group.host_username || '',
        },
        members: membersList,
      });
    }

    // Otherwise, return all groups with summary stats
    const groupsRes = await fetch(`${firestoreBase}/groups?pageSize=300`, { headers });
    const groupsData = groupsRes.ok ? await groupsRes.json() : {};
    const groupsList = (groupsData.documents || []).map(parseFirestoreDoc);

    // Fetch members to compute per-group count
    const membersRes = await fetch(`${firestoreBase}/groupMembers?pageSize=1000`, { headers });
    const membersData = membersRes.ok ? await membersRes.json() : {};
    const membersList = (membersData.documents || []).map(parseFirestoreDoc);

    // Fetch users for host lookup
    const usersRes = await fetch(`${firestoreBase}/users?pageSize=1000`, { headers });
    const usersData = usersRes.ok ? await usersRes.json() : {};
    const usersList = (usersData.documents || []).map(parseFirestoreDoc);
    const userMap = new Map(usersList.map((u) => [u.id, u]));

    const memberCountsByGroup: Record<string, number> = {};
    for (const m of membersList) {
      if (m.status === 'approved' && m.group_id) {
        memberCountsByGroup[m.group_id] = (memberCountsByGroup[m.group_id] || 0) + 1;
      }
    }

    const enhancedGroups = groupsList.map((g) => {
      const host = userMap.get(g.host_id);
      return {
        ...g,
        host_email: host?.email || '',
        host_username: host?.username || g.host_username || 'Host',
        member_count: memberCountsByGroup[g.id] || g.member_count || 1,
        max_members: 50, // Standard batch capacity
        cr_count: 1, // Primary host CR
      };
    });

    return res.status(200).json({
      success: true,
      groups: enhancedGroups,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to fetch groups.' });
  }
}
