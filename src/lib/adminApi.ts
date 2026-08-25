import { auth, db } from './firebase';
import {
  collection,
  getDocs,
  doc,
  getDoc,
  setDoc,
  addDoc,
  serverTimestamp,
  query,
  orderBy,
  limit,
} from 'firebase/firestore';

export const AUTHORIZED_ADMIN_EMAILS = ['madhurzamutsha@gmail.com'];

export interface AdminStats {
  totalGroups: number;
  totalUsers: number;
  totalMembers: number;
  totalCRs: number;
  totalHosts: number;
  appStatus: 'ONLINE' | 'MAINTENANCE' | 'SCHEDULED';
}

export interface AdminSystemConfig {
  isShutdown: boolean;
  shutdownMessage: string;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  updatedAt?: string;
  updatedBy?: string;
}

export interface AdminGroupItem {
  id: string;
  name: string;
  code: string;
  host_id: string;
  host_username: string;
  host_email?: string;
  member_count: number;
  max_members: number;
  cr_count: number;
  status: string;
  approval_mode: string;
  created_at: string;
  expires_at: string;
}

export interface AdminUserItem {
  id: string;
  email: string;
  username: string;
  role: 'student' | 'cr';
  is_host: boolean;
  current_group_id: string | null;
  group_name: string | null;
  group_code: string | null;
  created_at: string;
  last_active_at: string | null;
}

export interface AdminAuditLogItem {
  id: string;
  performedBy: string;
  action: string;
  details: string;
  isShutdown?: boolean;
  scheduledStart?: string | null;
  scheduledEnd?: string | null;
  timestamp: string;
}

async function getAdminHeaders(overrideToken?: string): Promise<HeadersInit> {
  const token = overrideToken || (auth?.currentUser ? await auth.currentUser.getIdToken(true) : null);
  if (!token) {
    throw new Error('Not authenticated.');
  }
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

export const adminApi = {
  async verifyAdmin(token?: string): Promise<{ authorized: boolean; email?: string; error?: string }> {
    if (!auth?.currentUser && !token) {
      return { authorized: false, error: 'Not authenticated.' };
    }

    try {
      const user = auth?.currentUser;
      const email = (user?.email || '').toLowerCase().trim();
      let hasAdminClaim = false;

      if (user) {
        try {
          const tokenResult = await user.getIdTokenResult(true);
          hasAdminClaim = Boolean(tokenResult.claims.admin);
        } catch {}
      }

      const isKnownEmail = AUTHORIZED_ADMIN_EMAILS.includes(email);

      // Attempt serverless verification endpoint
      try {
        const headers = await getAdminHeaders(token);
        const res = await fetch('/api/admin/verify', { headers });

        if (res.ok) {
          const data = await res.json();
          return { authorized: Boolean(data.authorized), email: data.email || email };
        } else if (res.status === 403) {
          // Explicit 403 from server
          const errData = await res.json().catch(() => ({}));
          return {
            authorized: false,
            email,
            error: errData.error || 'Access Denied: You do not have administrator permissions for ClassMate.',
          };
        }
      } catch (netErr) {
        // Fall back to client claims/email if server endpoint is unreachable (e.g. Vite local dev)
        console.warn('Backend verify endpoint unreachable, using client auth claims:', netErr);
      }

      if (isKnownEmail || hasAdminClaim) {
        return { authorized: true, email };
      }

      return {
        authorized: false,
        email,
        error: 'Access Denied: You do not have administrator permissions for ClassMate.',
      };
    } catch (e: any) {
      return { authorized: false, error: e.message || 'Verification failed.' };
    }
  },

  async getStats(token?: string): Promise<{ stats: AdminStats; system: AdminSystemConfig }> {
    try {
      const headers = await getAdminHeaders(token);
      const res = await fetch('/api/admin/stats', { headers });
      if (res.ok) {
        const data = await res.json();
        return { stats: data.stats, system: data.system };
      }
    } catch {}

    // Firestore fallback (rules allow this for isAdmin())
    if (!db) throw new Error('Firestore not initialized');

    const [usersSnap, groupsSnap, membersSnap, configSnap] = await Promise.all([
      getDocs(collection(db, 'users')),
      getDocs(collection(db, 'groups')),
      getDocs(collection(db, 'groupMembers')),
      getDoc(doc(db, 'appConfig', 'system')),
    ]);

    const users = usersSnap.docs.map((d) => d.data());
    const totalUsers = usersSnap.size;
    const totalGroups = groupsSnap.size;
    const totalMembers = membersSnap.size;
    const totalCRs = users.filter((u) => u.role === 'cr').length;
    const totalHosts = users.filter((u) => Boolean(u.is_host)).length;

    const configData = configSnap.exists() ? configSnap.data() : {};
    const isShutdown = Boolean(configData?.isShutdown);
    const scheduledStart = configData?.scheduledStart || null;
    const scheduledEnd = configData?.scheduledEnd || null;

    let appStatus: 'ONLINE' | 'MAINTENANCE' | 'SCHEDULED' = isShutdown ? 'MAINTENANCE' : 'ONLINE';
    if (!isShutdown && scheduledStart && scheduledEnd) {
      const now = Date.now();
      const start = new Date(scheduledStart).getTime();
      const end = new Date(scheduledEnd).getTime();
      if (!isNaN(start) && !isNaN(end)) {
        if (now >= start && now <= end) appStatus = 'MAINTENANCE';
        else if (now < start) appStatus = 'SCHEDULED';
      }
    }

    return {
      stats: { totalGroups, totalUsers, totalMembers, totalCRs, totalHosts, appStatus },
      system: {
        isShutdown,
        shutdownMessage: configData?.shutdownMessage || 'Class Mate is temporarily unavailable due to maintenance.',
        scheduledStart,
        scheduledEnd,
        updatedAt: configData?.updatedAt,
        updatedBy: configData?.updatedBy,
      },
    };
  },

  async getGroups(token?: string): Promise<AdminGroupItem[]> {
    try {
      const headers = await getAdminHeaders(token);
      const res = await fetch('/api/admin/groups', { headers });
      if (res.ok) {
        const data = await res.json();
        return data.groups || [];
      }
    } catch {}

    if (!db) throw new Error('Firestore not initialized');
    const [groupsSnap, membersSnap] = await Promise.all([
      getDocs(collection(db, 'groups')),
      getDocs(collection(db, 'groupMembers')),
    ]);

    const memberCounts: Record<string, number> = {};
    const crCounts: Record<string, number> = {};

    membersSnap.forEach((docSnap) => {
      const m = docSnap.data();
      const gid = m.group_id;
      if (gid) {
        memberCounts[gid] = (memberCounts[gid] || 0) + 1;
        if (m.role === 'cr') crCounts[gid] = (crCounts[gid] || 0) + 1;
      }
    });

    return groupsSnap.docs.map((d) => {
      const g = d.data();
      return {
        id: d.id,
        name: g.name || 'Unnamed Class',
        code: g.code || '',
        host_id: g.host_id || '',
        host_username: g.host_username || 'Unknown Host',
        host_email: g.host_email || undefined,
        member_count: memberCounts[d.id] ?? g.member_count ?? 0,
        max_members: g.max_members || 50,
        cr_count: crCounts[d.id] ?? 0,
        status: g.is_active === false ? 'inactive' : 'active',
        approval_mode: g.approval_mode || 'automatic',
        created_at: g.created_at || new Date().toISOString(),
        expires_at: g.expires_at || '',
      };
    });
  },

  async getGroupDetails(groupId: string, token?: string): Promise<{ group: AdminGroupItem; members: any[] }> {
    try {
      const headers = await getAdminHeaders(token);
      const res = await fetch(`/api/admin/groups?id=${encodeURIComponent(groupId)}`, { headers });
      if (res.ok) {
        const data = await res.json();
        return { group: data.group, members: data.members || [] };
      }
    } catch {}

    if (!db) throw new Error('Firestore not initialized');
    const [groupDoc, membersSnap, usersSnap] = await Promise.all([
      getDoc(doc(db, 'groups', groupId)),
      getDocs(collection(db, 'groupMembers')),
      getDocs(collection(db, 'users')),
    ]);

    if (!groupDoc.exists()) throw new Error('Group not found');
    const g = groupDoc.data();

    const usersMap: Record<string, any> = {};
    usersSnap.forEach((u) => {
      usersMap[u.id] = u.data();
    });

    const members: any[] = [];
    membersSnap.forEach((mSnap) => {
      const m = mSnap.data();
      if (m.group_id === groupId) {
        const u = usersMap[m.user_id] || {};
        members.push({
          id: mSnap.id,
          user_id: m.user_id,
          role: m.role || 'student',
          joined_at: m.joined_at,
          username: u.username || 'Student',
          email: u.email || '',
        });
      }
    });

    return {
      group: {
        id: groupDoc.id,
        name: g.name || 'Unnamed Class',
        code: g.code || '',
        host_id: g.host_id || '',
        host_username: g.host_username || 'Unknown Host',
        host_email: g.host_email,
        member_count: members.length,
        max_members: g.max_members || 50,
        cr_count: members.filter((m) => m.role === 'cr').length,
        status: g.is_active === false ? 'inactive' : 'active',
        approval_mode: g.approval_mode || 'automatic',
        created_at: g.created_at || '',
        expires_at: g.expires_at || '',
      },
      members,
    };
  },

  async getUsers(token?: string): Promise<AdminUserItem[]> {
    try {
      const headers = await getAdminHeaders(token);
      const res = await fetch('/api/admin/users', { headers });
      if (res.ok) {
        const data = await res.json();
        return data.users || [];
      }
    } catch {}

    if (!db) throw new Error('Firestore not initialized');
    const [usersSnap, groupsSnap] = await Promise.all([
      getDocs(collection(db, 'users')),
      getDocs(collection(db, 'groups')),
    ]);

    const groupsMap: Record<string, { name: string; code: string }> = {};
    groupsSnap.forEach((g) => {
      const data = g.data();
      groupsMap[g.id] = { name: data.name || '', code: data.code || '' };
    });

    return usersSnap.docs.map((d) => {
      const u = d.data();
      const grp = u.current_group_id ? groupsMap[u.current_group_id] : null;
      return {
        id: d.id,
        email: u.email || '',
        username: u.username || 'Anonymous',
        role: u.role || 'student',
        is_host: Boolean(u.is_host),
        current_group_id: u.current_group_id || null,
        group_name: grp?.name || null,
        group_code: grp?.code || null,
        created_at: u.created_at || '',
        last_active_at: u.last_active_at || null,
      };
    });
  },

  async getSystemStatus(token?: string): Promise<AdminSystemConfig> {
    try {
      const headers = await getAdminHeaders(token);
      const res = await fetch('/api/admin/system', { headers });
      if (res.ok) {
        const data = await res.json();
        return data.config;
      }
    } catch {}

    if (!db) throw new Error('Firestore not initialized');
    const configSnap = await getDoc(doc(db, 'appConfig', 'system'));
    const d = configSnap.exists() ? configSnap.data() : {};
    return {
      isShutdown: Boolean(d?.isShutdown),
      shutdownMessage: d?.shutdownMessage || 'Class Mate is temporarily unavailable due to maintenance.',
      scheduledStart: d?.scheduledStart || null,
      scheduledEnd: d?.scheduledEnd || null,
      updatedAt: d?.updatedAt,
      updatedBy: d?.updatedBy,
    };
  },

  async updateSystemStatus(
    payload: {
      isShutdown: boolean;
      shutdownMessage: string;
      scheduledStart: string | null;
      scheduledEnd: string | null;
      actionType?: string;
      notes?: string;
    },
    token?: string
  ): Promise<AdminSystemConfig> {
    try {
      const headers = await getAdminHeaders(token);
      const res = await fetch('/api/admin/system', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const data = await res.json();
        return data.config;
      }
    } catch {}

    if (!db) throw new Error('Firestore not initialized');
    const callerEmail = (auth?.currentUser?.email || 'admin').toLowerCase();
    const configRef = doc(db, 'appConfig', 'system');
    const updateData = {
      isShutdown: payload.isShutdown,
      shutdownMessage: payload.shutdownMessage,
      scheduledStart: payload.scheduledStart,
      scheduledEnd: payload.scheduledEnd,
      updatedAt: new Date().toISOString(),
      updatedBy: callerEmail,
    };

    await setDoc(configRef, updateData, { merge: true });

    // Write audit log
    await addDoc(collection(db, 'adminAuditLogs'), {
      performedBy: callerEmail,
      action: payload.actionType || (payload.isShutdown ? 'APP_SHUTDOWN' : 'APP_RESTART'),
      details: payload.notes || (payload.isShutdown ? 'Manual application shutdown initiated.' : 'Application brought back online.'),
      isShutdown: payload.isShutdown,
      scheduledStart: payload.scheduledStart,
      scheduledEnd: payload.scheduledEnd,
      timestamp: serverTimestamp(),
    });

    return updateData;
  },

  async getAuditLogs(token?: string): Promise<AdminAuditLogItem[]> {
    try {
      const headers = await getAdminHeaders(token);
      const res = await fetch('/api/admin/audit', { headers });
      if (res.ok) {
        const data = await res.json();
        return data.logs || [];
      }
    } catch {}

    if (!db) throw new Error('Firestore not initialized');
    const q = query(collection(db, 'adminAuditLogs'), orderBy('timestamp', 'desc'), limit(50));
    const logsSnap = await getDocs(q);

    return logsSnap.docs.map((d) => {
      const l = d.data();
      let ts = new Date().toISOString();
      if (l.timestamp?.toDate) ts = l.timestamp.toDate().toISOString();
      else if (typeof l.timestamp === 'string') ts = l.timestamp;

      return {
        id: d.id,
        performedBy: l.performedBy || 'admin',
        action: l.action || 'UPDATE',
        details: l.details || '',
        isShutdown: l.isShutdown,
        scheduledStart: l.scheduledStart,
        scheduledEnd: l.scheduledEnd,
        timestamp: ts,
      };
    });
  },
};
