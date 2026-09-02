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
    const groupId = req.query.id as string | undefined;

    // 1. If Firebase Admin SDK is available
    if (adminApp) {
      console.log('[Admin API: groups] Querying via Firebase Admin Firestore SDK...');
      const db = getFirestore(adminApp);

      if (groupId) {
        const groupDoc = await db.doc(`groups/${groupId}`).get();
        if (!groupDoc.exists) {
          return res.status(404).json({ error: 'Group not found.' });
        }
        const groupData = { id: groupDoc.id, ...groupDoc.data() } as any;

        const membersSnap = await db.collection('groupMembers').where('group_id', '==', groupId).get();
        const membersList = membersSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

        let hostEmail = '';
        let hostUsername = groupData.host_username || 'Host';
        const hostUid = groupData.host_id || groupData.original_host_id;
        if (hostUid) {
          const hostDoc = await db.doc(`users/${hostUid}`).get();
          if (hostDoc.exists) {
            const hData = hostDoc.data() as any;
            hostEmail = hData?.email || '';
            hostUsername = hData?.username || hostUsername;
          }
        }

        return res.status(200).json({
          success: true,
          group: {
            ...groupData,
            host_email: hostEmail,
            host_username: hostUsername,
          },
          members: membersList,
        });
      }

      const [groupsSnap, membersSnap, usersSnap] = await Promise.all([
        db.collection('groups').get(),
        db.collection('groupMembers').get(),
        db.collection('users').get(),
      ]);

      const groupsList = groupsSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as any[];
      const membersList = membersSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as any[];
      const usersList = usersSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as any[];

      const userMap = new Map(usersList.map((u) => [u.id, u]));
      const memberCountsByGroup: Record<string, number> = {};

      for (const m of membersList) {
        if ((m.status === 'approved' || !m.status) && m.group_id) {
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
          max_members: g.max_members || 50,
          cr_count: g.cr_count || 1,
        };
      });

      return res.status(200).json({
        success: true,
        groups: enhancedGroups,
      });
    }

    // 2. Fallback: Query via Firestore REST API
    console.log('[Admin API: groups] Querying via Firestore REST API fallback...');
    const firestoreBase = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;
    const headers = {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    };

    if (groupId) {
      const groupRes = await fetch(`${firestoreBase}/groups/${groupId}`, { headers });
      if (!groupRes.ok) {
        return res.status(404).json({ error: 'Group not found.' });
      }
      const group = parseFirestoreDoc(await groupRes.json());

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

      let hostUser: any = null;
      const hostUid = group.host_id || group.original_host_id;
      if (hostUid) {
        const hostRes = await fetch(`${firestoreBase}/users/${hostUid}`, { headers });
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

    const [groupsRes, membersRes, usersRes] = await Promise.all([
      fetch(`${firestoreBase}/groups?pageSize=300`, { headers }),
      fetch(`${firestoreBase}/groupMembers?pageSize=1000`, { headers }),
      fetch(`${firestoreBase}/users?pageSize=1000`, { headers }),
    ]);

    const groupsData = groupsRes.ok ? await groupsRes.json() : {};
    const groupsList = (groupsData.documents || []).map(parseFirestoreDoc);

    const membersData = membersRes.ok ? await membersRes.json() : {};
    const membersList = (membersData.documents || []).map(parseFirestoreDoc);

    const usersData = usersRes.ok ? await usersRes.json() : {};
    const usersList = (usersData.documents || []).map(parseFirestoreDoc);
    const userMap = new Map(usersList.map((u) => [u.id, u]));

    const memberCountsByGroup: Record<string, number> = {};
    for (const m of membersList) {
      if ((m.status === 'approved' || !m.status) && m.group_id) {
        memberCountsByGroup[m.group_id] = (memberCountsByGroup[m.group_id] || 0) + 1;
      }
    }

    const enhancedGroups = groupsList.map((g) => {
      const host = userMap.get(g.host_id) || (g.original_host_id ? userMap.get(g.original_host_id) : undefined);
      return {
        ...g,
        host_email: host?.email || '',
        host_username: host?.username || g.host_username || 'Host',
        member_count: memberCountsByGroup[g.id] || g.member_count || 1,
        max_members: g.max_members || 50,
        cr_count: g.cr_count || 1,
      };
    });

    return res.status(200).json({
      success: true,
      groups: enhancedGroups,
    });
  } catch (err: any) {
    console.error('[Admin API: groups] Handler exception:', err);
    return res.status(500).json({
      error: err.message || 'Failed to fetch groups.',
      code: err.code || 'GROUPS_ERROR',
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    });
  }
}
