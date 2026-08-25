import { auth } from './firebase';

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
    try {
      const headers = await getAdminHeaders(token);
      const res = await fetch('/api/admin/verify', { headers });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        return { authorized: false, error: errData.error || `HTTP ${res.status}` };
      }
      const data = await res.json();
      return { authorized: Boolean(data.authorized), email: data.email };
    } catch (e: any) {
      return { authorized: false, error: e.message || 'Verification failed.' };
    }
  },

  async getStats(token?: string): Promise<{ stats: AdminStats; system: AdminSystemConfig }> {
    const headers = await getAdminHeaders(token);
    const res = await fetch('/api/admin/stats', { headers });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to fetch statistics.');
    }
    const data = await res.json();
    return { stats: data.stats, system: data.system };
  },

  async getGroups(token?: string): Promise<AdminGroupItem[]> {
    const headers = await getAdminHeaders(token);
    const res = await fetch('/api/admin/groups', { headers });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to fetch groups.');
    }
    const data = await res.json();
    return data.groups || [];
  },

  async getGroupDetails(groupId: string, token?: string): Promise<{ group: AdminGroupItem; members: any[] }> {
    const headers = await getAdminHeaders(token);
    const res = await fetch(`/api/admin/groups?id=${encodeURIComponent(groupId)}`, { headers });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to fetch group details.');
    }
    const data = await res.json();
    return { group: data.group, members: data.members || [] };
  },

  async getUsers(token?: string): Promise<AdminUserItem[]> {
    const headers = await getAdminHeaders(token);
    const res = await fetch('/api/admin/users', { headers });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to fetch users.');
    }
    const data = await res.json();
    return data.users || [];
  },

  async getSystemStatus(token?: string): Promise<AdminSystemConfig> {
    const headers = await getAdminHeaders(token);
    const res = await fetch('/api/admin/system', { headers });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to fetch system status.');
    }
    const data = await res.json();
    return data.config;
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
    const headers = await getAdminHeaders(token);
    const res = await fetch('/api/admin/system', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to update system status.');
    }
    const data = await res.json();
    return data.config;
  },

  async getAuditLogs(token?: string): Promise<AdminAuditLogItem[]> {
    const headers = await getAdminHeaders(token);
    const res = await fetch('/api/admin/audit', { headers });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to fetch audit logs.');
    }
    const data = await res.json();
    return data.logs || [];
  },
};
