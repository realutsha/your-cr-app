import { auth, onAuthStateChanged, type FirebaseUser } from './firebase';

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
  return currentAdminUser;
}

/**
 * Helper: wait for Firebase Auth to finish resolving initial session,
 * and return the authenticated user (or null).
 */
export async function getAuthenticatedAdminUser(): Promise<FirebaseUser | null> {
  if (currentAdminUser) return currentAdminUser;
  if (!auth) return null;
  if (auth.currentUser) return auth.currentUser;

  try {
    if (typeof auth.authStateReady === 'function') {
      await auth.authStateReady();
      if (auth.currentUser) return auth.currentUser;
    }
  } catch (err) {
    console.warn('[Admin Auth] authStateReady error:', err);
  }

  const authInstance = auth;
  // Fallback: wait on onAuthStateChanged with a 4s timeout
  return new Promise<FirebaseUser | null>((resolve) => {
    const timer = setTimeout(() => {
      resolve(authInstance.currentUser || null);
    }, 4000);

    const unsubscribe = onAuthStateChanged(authInstance, (user) => {
      clearTimeout(timer);
      unsubscribe();
      if (user) {
        setAdminUserSession(user);
      }
      resolve(user);
    });
  });
}

/**
 * Helper: get the current user's Firebase ID token for server-side API calls.
 * Waits for auth initialization to eliminate race conditions.
 */
export async function getAdminIdToken(userOverride?: FirebaseUser | null, forceRefresh = false): Promise<string> {
  const user = userOverride || currentAdminUser || auth?.currentUser || (await getAuthenticatedAdminUser());
  if (!user) {
    throw new Error('Not authenticated. Please sign in.');
  }
  return user.getIdToken(forceRefresh);
}

/**
 * Helper: make an authenticated fetch request to a server-side admin API endpoint.
 * Automatically retries with a refreshed token if a 401 is encountered.
 */
export async function adminFetch(path: string, options?: RequestInit, userOverride?: FirebaseUser | null): Promise<any> {
  const user = userOverride || currentAdminUser || auth?.currentUser || (await getAuthenticatedAdminUser());
  if (!user) {
    throw new Error('Not authenticated. Please sign in.');
  }

  let token = await user.getIdToken(false);
  let res = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options?.headers || {}),
    },
  });

  // If unauthorized (e.g. token expired), attempt one retry with force refresh
  if (res.status === 401) {
    try {
      token = await user.getIdToken(true);
      res = await fetch(path, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          ...(options?.headers || {}),
        },
      });
    } catch {
      // Continue to error parsing below
    }
  }

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const errMsg = data?.error || `Server responded with status ${res.status}`;
    throw new Error(errMsg);
  }

  return data;
}

export const adminApi = {
  async verifyAdmin(explicitUser?: FirebaseUser | null): Promise<{ authorized: boolean; email?: string; error?: string }> {
    const user = explicitUser || currentAdminUser || auth?.currentUser || (await getAuthenticatedAdminUser());
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
        console.warn('[Admin Dashboard] Failed to refresh token claims:', tokenErr);
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

  async getStats(user?: FirebaseUser | null): Promise<{ stats: AdminStats; system: AdminSystemConfig }> {
    console.log('[Admin Dashboard] Fetching stats via /api/admin/stats...');

    const data = await adminFetch('/api/admin/stats', undefined, user);

    console.log(
      `[Admin Dashboard] Stats received: ${data.stats?.totalGroups} groups, ${data.stats?.totalUsers} users, ${data.stats?.totalMembers} members.`
    );

    return {
      stats: {
        totalGroups: data.stats?.totalGroups ?? 0,
        totalUsers: data.stats?.totalUsers ?? 0,
        totalMembers: data.stats?.totalMembers ?? 0,
        totalCRs: data.stats?.totalCRs ?? 0,
        totalHosts: data.stats?.totalHosts ?? 0,
        appStatus: data.stats?.appStatus || 'ONLINE',
      },
      system: {
        isShutdown: Boolean(data.system?.isShutdown),
        shutdownMessage: data.system?.shutdownMessage || 'Class Mate is temporarily unavailable due to maintenance.',
        scheduledStart: data.system?.scheduledStart || null,
        scheduledEnd: data.system?.scheduledEnd || null,
        updatedAt: data.system?.updatedAt,
        updatedBy: data.system?.updatedBy,
      },
    };
  },

  async getGroups(user?: FirebaseUser | null): Promise<AdminGroupItem[]> {
    console.log('[Admin Dashboard] Fetching groups via /api/admin/groups...');

    const data = await adminFetch('/api/admin/groups', undefined, user);
    const groups = data.groups || [];

    console.log(`[Admin Dashboard] Groups received: ${groups.length} groups.`);

    return groups.map((g: any) => ({
      id: g.id || '',
      name: g.name || 'Unnamed Class',
      code: g.code || '',
      host_id: g.host_id || '',
      host_username: g.host_username || 'Host',
      host_email: g.host_email || undefined,
      member_count: g.member_count ?? 1,
      max_members: g.max_members || 50,
      cr_count: g.cr_count || 1,
      status: g.status || 'active',
      approval_mode: g.approval_mode || 'automatic',
      created_at: g.created_at || new Date().toISOString(),
      expires_at: g.expires_at || '',
    }));
  },

  async getGroupDetails(groupId: string, user?: FirebaseUser | null): Promise<{ group: AdminGroupItem; members: any[] }> {
    console.log(`[Admin Dashboard] Fetching group details via /api/admin/groups?id=${groupId}...`);

    const data = await adminFetch(`/api/admin/groups?id=${encodeURIComponent(groupId)}`, undefined, user);
    const g = data.group || {};
    const members = data.members || [];

    console.log(`[Admin Dashboard] Group ${groupId} roster returned ${members.length} members.`);

    return {
      group: {
        id: g.id || groupId,
        name: g.name || 'Unnamed Class',
        code: g.code || '',
        host_id: g.host_id || '',
        host_username: g.host_username || 'Host',
        host_email: g.host_email,
        member_count: members.length || g.member_count || 1,
        max_members: g.max_members || 50,
        cr_count: members.filter((m: any) => m.role === 'cr').length || 1,
        status: g.status || 'active',
        approval_mode: g.approval_mode || 'automatic',
        created_at: g.created_at || '',
        expires_at: g.expires_at || '',
      },
      members: members.map((m: any) => ({
        id: m.id || '',
        user_id: m.user_id || '',
        role: m.role || 'student',
        status: m.status || 'approved',
        joined_at: m.joined_at,
        username: m.username || m.email?.split('@')[0] || `User ${(m.user_id || '').substring(0, 6)}`,
        email: m.email || '',
      })),
    };
  },

  async getUsers(user?: FirebaseUser | null): Promise<AdminUserItem[]> {
    console.log('[Admin Dashboard] Fetching users via /api/admin/users...');

    const data = await adminFetch('/api/admin/users', undefined, user);
    const users = data.users || [];

    console.log(`[Admin Dashboard] Users received: ${users.length} users.`);

    return users.map((u: any) => ({
      id: u.id || '',
      email: u.email || '',
      username: u.username || u.email?.split('@')[0] || 'Anonymous',
      role: u.role || 'student',
      is_host: Boolean(u.is_host),
      current_group_id: u.current_group_id || null,
      group_name: u.group_name || null,
      group_code: u.group_code || null,
      created_at: u.created_at || new Date().toISOString(),
      last_active_at: u.last_active_at || null,
    }));
  },

  async getSystemStatus(user?: FirebaseUser | null): Promise<AdminSystemConfig> {
    console.log('[Admin Dashboard] Fetching system status via /api/admin/system...');

    const data = await adminFetch('/api/admin/system', undefined, user);
    const config = data.config || {};

    return {
      isShutdown: Boolean(config.isShutdown),
      shutdownMessage: config.shutdownMessage || 'Class Mate is temporarily unavailable due to maintenance.',
      scheduledStart: config.scheduledStart || null,
      scheduledEnd: config.scheduledEnd || null,
      updatedAt: config.updatedAt,
      updatedBy: config.updatedBy,
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
    user?: FirebaseUser | null
  ): Promise<AdminSystemConfig> {
    console.log('[Admin Dashboard] Updating system status via POST /api/admin/system...');

    const data = await adminFetch(
      '/api/admin/system',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      user
    );

    const config = data.config || {};

    return {
      isShutdown: Boolean(config.isShutdown),
      shutdownMessage: config.shutdownMessage || 'Class Mate is temporarily unavailable due to maintenance.',
      scheduledStart: config.scheduledStart || null,
      scheduledEnd: config.scheduledEnd || null,
      updatedAt: config.updatedAt,
      updatedBy: config.updatedBy,
    };
  },

  async getAuditLogs(user?: FirebaseUser | null): Promise<AdminAuditLogItem[]> {
    console.log('[Admin Dashboard] Fetching audit logs via /api/admin/audit...');

    const data = await adminFetch('/api/admin/audit', undefined, user);
    const logs = data.logs || [];

    console.log(`[Admin Dashboard] Audit logs received: ${logs.length} entries.`);

    return logs.map((l: any) => ({
      id: l.id || '',
      performedBy: l.performedBy || 'admin',
      action: l.action || 'UPDATE',
      details: l.details || '',
      isShutdown: l.isShutdown,
      scheduledStart: l.scheduledStart,
      scheduledEnd: l.scheduledEnd,
      timestamp: l.timestamp || new Date().toISOString(),
    }));
  },
};
