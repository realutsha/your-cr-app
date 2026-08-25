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

export const adminApi = {
  async verifyAdmin(): Promise<{ authorized: boolean; email?: string; error?: string }> {
    if (!auth?.currentUser) {
      return { authorized: false, error: 'Not authenticated.' };
    }

    try {
      const user = auth.currentUser;
      const email = (user.email || '').toLowerCase().trim();
      let hasAdminClaim = false;

      try {
        const tokenResult = await user.getIdTokenResult(true);
        hasAdminClaim = Boolean(tokenResult.claims.admin);
      } catch (tokenErr) {
        console.warn('[Admin Dashboard] Failed to refresh token claims:', tokenErr);
      }

      const isKnownEmail = AUTHORIZED_ADMIN_EMAILS.includes(email);

      if (isKnownEmail || hasAdminClaim) {
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

  async getStats(): Promise<{ stats: AdminStats; system: AdminSystemConfig }> {
    if (!db) {
      console.error('[Admin Dashboard] Firestore database instance (db) is not initialized.');
      throw new Error('Firestore database instance is not initialized in firebase.ts');
    }

    console.log('[Admin Dashboard] Querying collections: "groups", "users", "groupMembers", "appConfig/system"...');

    let groupsSnap, usersSnap, membersSnap, configSnap;
    try {
      [groupsSnap, usersSnap, membersSnap, configSnap] = await Promise.all([
        getDocs(collection(db, 'groups')),
        getDocs(collection(db, 'users')),
        getDocs(collection(db, 'groupMembers')),
        getDoc(doc(db, 'appConfig', 'system')),
      ]);
    } catch (err: any) {
      console.error('[Admin Dashboard] Firestore query failed with error:', err);
      const code = err.code ? `[${err.code}] ` : '';
      throw new Error(`${code}${err.message || String(err)}`);
    }

    console.log(
      `[Admin Dashboard] Collections fetched successfully: ${groupsSnap.size} groups, ${usersSnap.size} users, ${membersSnap.size} groupMembers.`
    );

    const groups = groupsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const users = usersSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const members = membersSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

    const totalGroups = groupsSnap.size;
    const totalUsers = usersSnap.size;
    const totalMembers = membersSnap.size;

    // Total CRs: Unique users where role === 'cr' OR members where role === 'cr'
    const crUserIds = new Set<string>();
    users.forEach((u: any) => {
      if (u.role === 'cr') crUserIds.add(u.id);
    });
    members.forEach((m: any) => {
      if (m.role === 'cr' && m.user_id) crUserIds.add(m.user_id);
    });
    const totalCRs = crUserIds.size;

    // Total Hosts: Unique hosts from groups (host_id) OR users marked is_host
    const hostUserIds = new Set<string>();
    groups.forEach((g: any) => {
      if (g.host_id) hostUserIds.add(g.host_id);
    });
    users.forEach((u: any) => {
      if (u.is_host) hostUserIds.add(u.id);
    });
    const totalHosts = hostUserIds.size;

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

  async getGroups(): Promise<AdminGroupItem[]> {
    if (!db) {
      console.error('[Admin Dashboard] Firestore not initialized');
      throw new Error('Firestore not initialized');
    }

    console.log('[Admin Dashboard] Fetching groups list from Firestore collection: "groups"...');

    let groupsSnap, membersSnap;
    try {
      [groupsSnap, membersSnap] = await Promise.all([
        getDocs(collection(db, 'groups')),
        getDocs(collection(db, 'groupMembers')),
      ]);
    } catch (err: any) {
      console.error('[Admin Dashboard] Failed to load groups:', err);
      const code = err.code ? `[${err.code}] ` : '';
      throw new Error(`${code}${err.message || String(err)}`);
    }

    console.log(`[Admin Dashboard] "groups" returned ${groupsSnap.size} docs, "groupMembers" returned ${membersSnap.size} docs.`);

    const memberCounts: Record<string, number> = {};
    const crCounts: Record<string, number> = {};

    membersSnap.forEach((docSnap) => {
      const m = docSnap.data();
      const gid = m.group_id;
      if (gid) {
        if (m.status === 'approved' || !m.status) {
          memberCounts[gid] = (memberCounts[gid] || 0) + 1;
        }
        if (m.role === 'cr') crCounts[gid] = (crCounts[gid] || 0) + 1;
      }
    });

    return groupsSnap.docs.map((d) => {
      const g = d.data();
      const createdDate = g.created_at
        ? typeof g.created_at === 'string'
          ? g.created_at
          : g.created_at.toDate?.()?.toISOString?.() || ''
        : '';

      return {
        id: d.id,
        name: g.name || 'Unnamed Class',
        code: g.code || '',
        host_id: g.host_id || '',
        host_username: g.host_username || 'Host',
        host_email: g.host_email || undefined,
        member_count: memberCounts[d.id] ?? g.member_count ?? 1,
        max_members: g.max_members || 50,
        cr_count: crCounts[d.id] || 1,
        status: g.status || (g.is_active === false ? 'inactive' : 'active'),
        approval_mode: g.approval_mode || 'automatic',
        created_at: createdDate || new Date().toISOString(),
        expires_at: g.expires_at || '',
      };
    });
  },

  async getGroupDetails(groupId: string): Promise<{ group: AdminGroupItem; members: any[] }> {
    if (!db) throw new Error('Firestore not initialized');
    console.log(`[Admin Dashboard] Fetching group roster for: ${groupId}...`);

    let groupDoc, membersSnap, usersSnap;
    try {
      [groupDoc, membersSnap, usersSnap] = await Promise.all([
        getDoc(doc(db, 'groups', groupId)),
        getDocs(collection(db, 'groupMembers')),
        getDocs(collection(db, 'users')),
      ]);
    } catch (err: any) {
      console.error(`[Admin Dashboard] Failed to load group ${groupId}:`, err);
      const code = err.code ? `[${err.code}] ` : '';
      throw new Error(`${code}${err.message || String(err)}`);
    }

    if (!groupDoc.exists()) {
      throw new Error(`Group "${groupId}" not found in Firestore.`);
    }

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
          status: m.status || 'approved',
          joined_at: m.joined_at,
          username: m.username || u.username || u.email?.split('@')[0] || `User ${m.user_id?.substring(0, 6)}`,
          email: m.email || u.email || '',
        });
      }
    });

    console.log(`[Admin Dashboard] Group ${groupId} roster returned ${members.length} members.`);

    return {
      group: {
        id: groupDoc.id,
        name: g.name || 'Unnamed Class',
        code: g.code || '',
        host_id: g.host_id || '',
        host_username: g.host_username || 'Host',
        host_email: g.host_email,
        member_count: members.length,
        max_members: g.max_members || 50,
        cr_count: members.filter((m) => m.role === 'cr').length || 1,
        status: g.status || 'active',
        approval_mode: g.approval_mode || 'automatic',
        created_at: g.created_at || '',
        expires_at: g.expires_at || '',
      },
      members,
    };
  },

  async getUsers(): Promise<AdminUserItem[]> {
    if (!db) {
      console.error('[Admin Dashboard] Firestore not initialized');
      throw new Error('Firestore not initialized');
    }

    console.log('[Admin Dashboard] Fetching user directory from Firestore collection: "users"...');

    let usersSnap, groupsSnap;
    try {
      [usersSnap, groupsSnap] = await Promise.all([
        getDocs(collection(db, 'users')),
        getDocs(collection(db, 'groups')),
      ]);
    } catch (err: any) {
      console.error('[Admin Dashboard] Failed to load users:', err);
      const code = err.code ? `[${err.code}] ` : '';
      throw new Error(`${code}${err.message || String(err)}`);
    }

    console.log(`[Admin Dashboard] "users" returned ${usersSnap.size} docs, "groups" returned ${groupsSnap.size} docs.`);

    const groupsMap: Record<string, { name: string; code: string }> = {};
    groupsSnap.forEach((g) => {
      const data = g.data();
      groupsMap[g.id] = { name: data.name || '', code: data.code || '' };
    });

    return usersSnap.docs.map((d) => {
      const u = d.data();
      const grp = u.current_group_id ? groupsMap[u.current_group_id] : null;
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
        role: u.role || 'student',
        is_host: Boolean(u.is_host),
        current_group_id: u.current_group_id || null,
        group_name: grp?.name || null,
        group_code: grp?.code || null,
        created_at: createdDate || new Date().toISOString(),
        last_active_at: lastActiveDate,
      };
    });
  },

  async getSystemStatus(): Promise<AdminSystemConfig> {
    if (!db) throw new Error('Firestore not initialized');
    console.log('[Admin Dashboard] Fetching appConfig/system...');

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

  async updateSystemStatus(payload: {
    isShutdown: boolean;
    shutdownMessage: string;
    scheduledStart: string | null;
    scheduledEnd: string | null;
    actionType?: string;
    notes?: string;
  }): Promise<AdminSystemConfig> {
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

    console.log('[Admin Dashboard] Updating appConfig/system with:', updateData);
    await setDoc(configRef, updateData, { merge: true });

    // Write audit log
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

    return updateData;
  },

  async getAuditLogs(): Promise<AdminAuditLogItem[]> {
    if (!db) throw new Error('Firestore not initialized');
    console.log('[Admin Dashboard] Fetching audit logs from "adminAuditLogs"...');

    const q = query(collection(db, 'adminAuditLogs'), orderBy('timestamp', 'desc'), limit(50));
    let logsSnap;
    try {
      logsSnap = await getDocs(q);
    } catch (err: any) {
      console.warn('[Admin Dashboard] Error ordering adminAuditLogs, falling back to unordered query:', err);
      logsSnap = await getDocs(collection(db, 'adminAuditLogs')).catch(() => null);
    }

    if (!logsSnap) return [];

    console.log(`[Admin Dashboard] "adminAuditLogs" returned ${logsSnap.size} docs.`);

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
