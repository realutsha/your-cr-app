import { auth } from './firebase';

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

/**
 * Helper: get the current user's Firebase ID token for server-side API calls.
 */
async function getIdToken(): Promise<string> {
  if (!auth?.currentUser) {
    throw new Error('Not authenticated. Please sign in.');
  }
  return auth.currentUser.getIdToken(/* forceRefresh */ false);
}

/**
 * Helper: make an authenticated fetch request to a server-side admin API endpoint.
 */
async function adminFetch(path: string, options?: RequestInit): Promise<any> {
  const token = await getIdToken();
  const res = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options?.headers || {}),
    },
  });

  const data = await res.json();

  if (!res.ok) {
    const errMsg = data?.error || `Server responded with status ${res.status}`;
    throw new Error(errMsg);
  }

  return data;
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
    console.log('[Admin Dashboard] Fetching stats via /api/admin/stats...');

    const data = await adminFetch('/api/admin/stats');

    console.log(
      `[Admin Dashboard] Stats received: ${data.stats.totalGroups} groups, ${data.stats.totalUsers} users, ${data.stats.totalMembers} members.`
    );

    return {
      stats: {
        totalGroups: data.stats.totalGroups ?? 0,
        totalUsers: data.stats.totalUsers ?? 0,
        totalMembers: data.stats.totalMembers ?? 0,
        totalCRs: data.stats.totalCRs ?? 0,
        totalHosts: data.stats.totalHosts ?? 0,
        appStatus: data.stats.appStatus || 'ONLINE',
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

  async getGroups(): Promise<AdminGroupItem[]> {
    console.log('[Admin Dashboard] Fetching groups via /api/admin/groups...');

    const data = await adminFetch('/api/admin/groups');
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

  async getGroupDetails(groupId: string): Promise<{ group: AdminGroupItem; members: any[] }> {
    console.log(`[Admin Dashboard] Fetching group details via /api/admin/groups?id=${groupId}...`);

    const data = await adminFetch(`/api/admin/groups?id=${encodeURIComponent(groupId)}`);
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

  async getUsers(): Promise<AdminUserItem[]> {
    console.log('[Admin Dashboard] Fetching users via /api/admin/users...');

    const data = await adminFetch('/api/admin/users');
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

  async getSystemStatus(): Promise<AdminSystemConfig> {
    console.log('[Admin Dashboard] Fetching system status via /api/admin/system...');

    const data = await adminFetch('/api/admin/system');
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

  async updateSystemStatus(payload: {
    isShutdown: boolean;
    shutdownMessage: string;
    scheduledStart: string | null;
    scheduledEnd: string | null;
    actionType?: string;
    notes?: string;
  }): Promise<AdminSystemConfig> {
    console.log('[Admin Dashboard] Updating system status via POST /api/admin/system...');

    const data = await adminFetch('/api/admin/system', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

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

  async getAuditLogs(): Promise<AdminAuditLogItem[]> {
    console.log('[Admin Dashboard] Fetching audit logs via /api/admin/audit...');

    const data = await adminFetch('/api/admin/audit');
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
