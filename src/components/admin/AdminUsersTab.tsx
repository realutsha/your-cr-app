import React, { useState, useMemo } from 'react';
import type { AdminUserItem } from '../../lib/adminApi';

interface AdminUsersTabProps {
  users: AdminUserItem[];
  loading: boolean;
  error?: string | null;
  onRefresh: () => void;
}

export const AdminUsersTab: React.FC<AdminUsersTabProps> = ({ users, loading, error, onRefresh }) => {
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const q = search.toLowerCase().trim();
      const matchSearch =
        !q ||
        u.email.toLowerCase().includes(q) ||
        u.username.toLowerCase().includes(q) ||
        u.id.toLowerCase().includes(q) ||
        (u.group_name && u.group_name.toLowerCase().includes(q)) ||
        (u.group_code && u.group_code.toLowerCase().includes(q));

      const matchRole =
        roleFilter === 'all' ||
        (roleFilter === 'host' && u.is_host) ||
        (roleFilter === 'cr' && (u.role === 'cr' || u.is_host)) ||
        (roleFilter === 'student' && u.role === 'student' && !u.is_host);

      return matchSearch && matchRole;
    });
  }, [users, search, roleFilter]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Search & Filter Bar */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 12,
          alignItems: 'center',
          justifyContent: 'space-between',
          background: '#121624',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 14,
          padding: '14px 18px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: '1 1 260px' }}>
          <input
            type="text"
            placeholder="Search by email, username, user ID, class..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: '100%',
              background: '#1E2438',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 8,
              padding: '8px 14px',
              color: '#FFFFFF',
              fontSize: 13,
              outline: 'none',
            }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            style={{
              background: '#1E2438',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 8,
              padding: '8px 12px',
              color: '#FFFFFF',
              fontSize: 13,
              outline: 'none',
            }}
          >
            <option value="all">All Roles</option>
            <option value="student">Students</option>
            <option value="cr">CRs</option>
            <option value="host">Hosts</option>
          </select>

          <button
            onClick={onRefresh}
            style={{
              background: '#1E2438',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 8,
              padding: '8px 14px',
              color: '#FFFFFF',
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Users Table */}
      <div
        style={{
          background: '#121624',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 16,
          overflow: 'hidden',
        }}
      >
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', fontSize: 11, letterSpacing: 0.5 }}>
                <th style={{ padding: '14px 20px' }}>User / Display Name</th>
                <th style={{ padding: '14px 16px' }}>Email Address</th>
                <th style={{ padding: '14px 16px' }}>Role / Status</th>
                <th style={{ padding: '14px 16px' }}>Assigned Class</th>
                <th style={{ padding: '14px 16px' }}>User ID</th>
                <th style={{ padding: '14px 20px' }}>Joined Date</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} style={{ padding: 32, textAlign: 'center', color: 'rgba(255,255,255,0.5)' }}>
                    Loading users list...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={6} style={{ padding: 32, textAlign: 'center', color: '#FCA5A5' }}>
                    <div style={{ fontWeight: 700, marginBottom: 4 }}>⚠️ Error loading users</div>
                    <div style={{ fontSize: 12 }}>{error}</div>
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: 32, textAlign: 'center', color: 'rgba(255,255,255,0.5)' }}>
                    No users found.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => (
                  <tr
                    key={u.id}
                    style={{
                      borderBottom: '1px solid rgba(255,255,255,0.04)',
                      transition: 'background 120ms ease',
                    }}
                  >
                    <td style={{ padding: '14px 20px', fontWeight: 600, color: '#FFFFFF' }}>
                      {u.username}
                    </td>
                    <td style={{ padding: '14px 16px', color: '#A5B4FC' }}>
                      {u.email}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <span
                        style={{
                          background: u.is_host
                            ? 'rgba(245,158,11,0.15)'
                            : u.role === 'cr'
                            ? 'rgba(129,140,248,0.15)'
                            : 'rgba(16,185,129,0.15)',
                          color: u.is_host
                            ? '#FCD34D'
                            : u.role === 'cr'
                            ? '#A5B4FC'
                            : '#6EE7B7',
                          padding: '3px 8px',
                          borderRadius: 6,
                          fontSize: 11.5,
                          fontWeight: 700,
                          textTransform: 'uppercase',
                        }}
                      >
                        {u.is_host ? 'Host CR' : u.role.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px', color: 'rgba(255,255,255,0.85)' }}>
                      {u.group_name ? (
                        <div>
                          <div>{u.group_name}</div>
                          {u.group_code && (
                            <span style={{ fontSize: 11, color: '#A5B4FC', fontFamily: 'monospace' }}>
                              [{u.group_code}]
                            </span>
                          )}
                        </div>
                      ) : (
                        <span style={{ color: 'rgba(255,255,255,0.35)' }}>None</span>
                      )}
                    </td>
                    <td style={{ padding: '14px 16px', color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace', fontSize: 11.5 }}>
                      {u.id.substring(0, 10)}...
                    </td>
                    <td style={{ padding: '14px 20px', color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
