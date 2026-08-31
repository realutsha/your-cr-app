import {
  collection,
  getDocs,
  doc,
  getDoc,
  setDoc,
  addDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
} from 'firebase/firestore';
import { db, auth, type FirebaseUser } from './firebase';

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

let currentAdminUser: FirebaseUser | null = null;

export function setAdminUserSession(user: FirebaseUser | null) {
  currentAdminUser = user;
}

export function getAdminUserSession(): FirebaseUser | null {
  return currentAdminUser || auth?.currentUser || null;
}

export const adminApi = {
  async verifyAdmin(explicitUser?: FirebaseUser | null): Promise<{ authorized: boolean; email?: string; error?: string }> {
    const user = explicitUser || currentAdminUser || auth?.currentUser;
    if (!user) {
      return { authorized: false, error: 'Not authenticated. Please sign in.' };
    }

    try {
      const email = (user.email || '').toLowerCase().trim();
      let hasAdminClaim = false;

      try {
        const tokenResult = await user.getIdTokenResult(true);
        hasAdminClaim = Boolean(tokenResult.claims.admin);
      } catch (tokenErr) {
        console.warn('[Admin Dashboard] Token claims check error:', tokenErr);
      }

      const isKnownEmail = AUTHORIZED_ADMIN_EMAILS.includes(email);

      if (isKnownEmail || hasAdminClaim) {
        setAdminUserSession(user);
        console.log(`[Admin Dashboard] Admin verification SUCCESS for: ${email}`);
        return { authorized: true, email };
      }

      console.warn(`[Admin Dashboard] Admin verification FAILED for non-admin user: ${email}`);
      return {
        authorized: false,
        email,
        error: 'Access Denied: You do not have administrator permissions for ClassMate.',
      };
    } catch (e: any) {
      console.error('[Admin Dashboard] Verification exception:', e);
      return { authorized: false, error: e.message || 'Verification failed.' };
    }
  },

  async getStats(_user?: FirebaseUser | null): Promise<{ stats: AdminStats; system: AdminSystemConfig }> {
    if (!db) throw new Error('Firestore database is not initialized.');
    console.log('[Admin Dashboard] Querying Firestore collections directly on client side...');

    const [groupsSnap, usersSnap, membersSnap, configSnap] = await Promise.all([
      getDocs(collection(db, 'groups')),
      getDocs(collection(db, 'users')),
      getDocs(collection(db, 'groupMembers')),
      getDoc(doc(db, 'appConfig', 'system')),
    ]);

    const totalGroups = groupsSnap.size;
    const totalUsers = usersSnap.size;
    const totalMembers = membersSnap.size;

    let totalCRs = 0;
    const hostUserIds = new Set<string>();

    usersSnap.forEach((docSnap) => {
      const u = docSnap.data();
      if (u.role === 'cr') totalCRs++;
      if (u.is_host) hostUserIds.add(docSnap.id);
    });

    groupsSnap.forEach((docSnap) => {
      const g = docSnap.data();
      if (g.host_id) hostUserIds.add(g.host_id);
    });

    const totalHosts = hostUserIds.size;

    const sysConfig = configSnap.exists() ? (configSnap.data() as AdminSystemConfig) : null;

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

    console.log(
      `[Admin Dashboard] Direct Firestore stats calculated: ${totalGroups} groups, ${totalUsers} users, ${totalMembers} members, ${totalCRs} CRs, ${totalHosts} hosts.`
    );

    return {
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
        shutdownMessage: 'Class Mate is temporarily unavailable due to maintenance.',
        scheduledStart: null,
        scheduledEnd: null,
      },
    };
  },

  async getGroups(_user?: FirebaseUser | null): Promise<AdminGroupItem[]> {
    if (!db) throw new Error('Firestore database is not initialized.');
    console.log('[Admin Dashboard] Querying groups, users, and members directly from Firestore...');

    const [groupsSnap, usersSnap, membersSnap] = await Promise.all([
      getDocs(collection(db, 'groups')),
      getDocs(collection(db, 'users')),
      getDocs(collection(db, 'groupMembers')),
    ]);

    const userMap = new Map<string, any>();
    usersSnap.forEach((d) => {
      userMap.set(d.id, d.data());
    });

    const memberCountsByGroup: Record<string, number> = {};
    membersSnap.forEach((d) => {
      const m = d.data();
      if (m.group_id && (m.status === 'approved' || !m.status)) {
        memberCountsByGroup[m.group_id] = (memberCountsByGroup[m.group_id] || 0) + 1;
      }
    });

    return groupsSnap.docs.map((d) => {
      const g = d.data();
      const host = userMap.get(g.host_id);
      return {
        id: d.id,
        name: g.name || 'Unnamed Class',
        code: g.code || '',
        host_id: g.host_id || '',
        host_username: host?.username || g.host_username || 'Host',
        host_email: host?.email || undefined,
        member_count: memberCountsByGroup[d.id] || g.member_count || 1,
        max_members: g.max_members || 50,
        cr_count: g.cr_count || 1,
        status: g.status || 'active',
        approval_mode: g.approval_mode || 'automatic',
        created_at: g.created_at
          ? typeof g.created_at === 'string'
            ? g.created_at
            : g.created_at.toDate?.()?.toISOString?.() || ''
          : new Date().toISOString(),
        expires_at: g.expires_at || '',
      };
    });
  },

  async getGroupDetails(groupId: string, _user?: FirebaseUser | null): Promise<{ group: AdminGroupItem; members: any[] }> {
    if (!db) throw new Error('Firestore database is not initialized.');
    console.log(`[Admin Dashboard] Fetching group ${groupId} and roster directly from Firestore...`);

    const groupDocSnap = await getDoc(doc(db, 'groups', groupId));
    if (!groupDocSnap.exists()) {
      throw new Error('Group not found');
    }

    const g = groupDocSnap.data();

    // Query members belonging to this group
    const membersSnap = await getDocs(
      query(collection(db, 'groupMembers'), where('group_id', '==', groupId))
    );

    let hostEmail = '';
    let hostUsername = g.host_username || 'Host';

    if (g.host_id) {
      const hostDocSnap = await getDoc(doc(db, 'users', g.host_id));
      if (hostDocSnap.exists()) {
        const hData = hostDocSnap.data();
        hostEmail = hData.email || '';
        hostUsername = hData.username || hostUsername;
      }
    }

    const members = membersSnap.docs.map((d) => {
      const m = d.data();
      return {
        id: d.id,
        user_id: m.user_id || '',
        role: m.role || 'student',
        status: m.status || 'approved',
        joined_at: m.joined_at,
        username: m.username || m.email?.split('@')[0] || `User ${(m.user_id || '').substring(0, 6)}`,
        email: m.email || '',
      };
    });

    return {
      group: {
        id: groupDocSnap.id,
        name: g.name || 'Unnamed Class',
        code: g.code || '',
        host_id: g.host_id || '',
        host_username: hostUsername,
        host_email: hostEmail || undefined,
        member_count: members.length || g.member_count || 1,
        max_members: g.max_members || 50,
        cr_count: members.filter((m) => m.role === 'cr').length || 1,
        status: g.status || 'active',
        approval_mode: g.approval_mode || 'automatic',
        created_at: g.created_at
          ? typeof g.created_at === 'string'
            ? g.created_at
            : g.created_at.toDate?.()?.toISOString?.() || ''
          : '',
        expires_at: g.expires_at || '',
      },
      members,
    };
  },

  async getUsers(_user?: FirebaseUser | null): Promise<AdminUserItem[]> {
    if (!db) throw new Error('Firestore database is not initialized.');
    console.log('[Admin Dashboard] Querying users and groups directly from Firestore...');

    const [usersSnap, groupsSnap] = await Promise.all([
      getDocs(collection(db, 'users')),
      getDocs(collection(db, 'groups')),
    ]);

    const groupMap = new Map<string, any>();
    const hostUserIds = new Set<string>();

    groupsSnap.forEach((d) => {
      const g = d.data();
      groupMap.set(d.id, g);
      if (g.host_id) hostUserIds.add(g.host_id);
    });

    return usersSnap.docs.map((d) => {
      const u = d.data();
      const userGroup = u.current_group_id ? groupMap.get(u.current_group_id) : null;
      const isHost = hostUserIds.has(d.id) || Boolean(u.is_host);

      const createdDate = u.created_at
        ? typeof u.created_at === 'string'
          ? u.created_at
          : u.created_at.toDate?.()?.toISOString?.() || ''
        : '';
      const lastActiveDate = u.last_active_at
        ? typeof u.last_active_at === 'string'
          ? u.last_active_at
          : u.last_active_at.toDate?.()?.toISOString?.() || ''
        : null;

      return {
        id: d.id,
        email: u.email || '',
        username: u.username || u.email?.split('@')[0] || 'Anonymous',
        role: u.role || (isHost ? 'cr' : 'student'),
        is_host: isHost,
        current_group_id: u.current_group_id || null,
        group_name: userGroup?.name || null,
        group_code: userGroup?.code || null,
        created_at: createdDate || new Date().toISOString(),
        last_active_at: lastActiveDate,
      };
    });
  },

  async getSystemStatus(_user?: FirebaseUser | null): Promise<AdminSystemConfig> {
    if (!db) throw new Error('Firestore database is not initialized.');
    console.log('[Admin Dashboard] Fetching appConfig/system directly from Firestore...');

    const configSnap = await getDoc(doc(db, 'appConfig', 'system'));
    const d = configSnap.exists() ? (configSnap.data() as any) : {};

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
    _user?: FirebaseUser | null
  ): Promise<AdminSystemConfig> {
    if (!db) throw new Error('Firestore database is not initialized.');
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

    console.log('[Admin Dashboard] Updating appConfig/system directly in Firestore:', updateData);
    await setDoc(configRef, updateData, { merge: true });

    // Write audit log
    try {
      await addDoc(collection(db, 'adminAuditLogs'), {
        performedBy: callerEmail,
        action: payload.actionType || (payload.isShutdown ? 'APP_SHUTDOWN' : 'APP_RESTART'),
        details:
          payload.notes ||
          (payload.isShutdown ? 'Manual application shutdown initiated.' : 'Application brought back online.'),
        isShutdown: payload.isShutdown,
        scheduledStart: payload.scheduledStart,
        scheduledEnd: payload.scheduledEnd,
        timestamp: serverTimestamp(),
      });
    } catch (auditErr) {
      console.warn('[Admin Dashboard] Could not record audit log:', auditErr);
    }

    return updateData;
  },

  async getAuditLogs(_user?: FirebaseUser | null): Promise<AdminAuditLogItem[]> {
    if (!db) throw new Error('Firestore database is not initialized.');
    console.log('[Admin Dashboard] Querying adminAuditLogs directly from Firestore...');

    let logsSnap;
    try {
      const q = query(collection(db, 'adminAuditLogs'), orderBy('timestamp', 'desc'), limit(100));
      logsSnap = await getDocs(q);
    } catch (err: any) {
      console.warn('[Admin Dashboard] Ordered audit log query failed, falling back to unordered query:', err);
      logsSnap = await getDocs(collection(db, 'adminAuditLogs')).catch(() => null);
    }

    if (!logsSnap) return [];

    return logsSnap.docs
      .map((d) => {
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
      })
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  },
};
