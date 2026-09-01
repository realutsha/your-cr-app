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
          background: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: 14,
          padding: '14px 18px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
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
              background: '#F8FAFC',
              border: '1px solid #CBD5E1',
              borderRadius: 8,
              padding: '8px 14px',
              color: '#0F172A',
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
              background: '#F8FAFC',
              border: '1px solid #CBD5E1',
              borderRadius: 8,
              padding: '8px 12px',
              color: '#0F172A',
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
              background: '#F1F5F9',
              border: '1px solid #CBD5E1',
              borderRadius: 8,
              padding: '8px 14px',
              color: '#0F172A',
              fontSize: 13,
              fontWeight: 600,
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
          background: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: 16,
          overflow: 'hidden',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        }}
      >
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#64748B', textTransform: 'uppercase', fontSize: 11, letterSpacing: 0.5 }}>
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
                  <td colSpan={6} style={{ padding: 32, textAlign: 'center', color: '#64748B' }}>
                    Loading users list...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={6} style={{ padding: 32, textAlign: 'center', color: '#DC2626' }}>
                    <div style={{ fontWeight: 700, marginBottom: 4 }}>⚠️ Error loading users</div>
                    <div style={{ fontSize: 12 }}>{error}</div>
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: 32, textAlign: 'center', color: '#64748B' }}>
                    No users found.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => (
                  <tr
                    key={u.id}
                    style={{
                      borderBottom: '1px solid #F1F5F9',
                      transition: 'background 120ms ease',
                    }}
                  >
                    <td style={{ padding: '14px 20px', fontWeight: 600, color: '#0F172A' }}>
                      {u.username}
                    </td>
                    <td style={{ padding: '14px 16px', color: '#4F46E5', fontWeight: 500 }}>
                      {u.email}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <span
                        style={{
                          background: u.is_host
                            ? '#FFFBEB'
                            : u.role === 'cr'
                            ? '#EEF2FF'
                            : '#ECFDF5',
                          color: u.is_host
                            ? '#D97706'
                            : u.role === 'cr'
                            ? '#4F46E5'
                            : '#059669',
                          border: `1px solid ${
                            u.is_host
                              ? '#FDE68A'
                              : u.role === 'cr'
                              ? '#C7D2FE'
                              : '#A7F3D0'
                          }`,
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
                    <td style={{ padding: '14px 16px', color: '#0F172A' }}>
                      {u.group_name ? (
                        <div>
                          <div style={{ fontWeight: 500 }}>{u.group_name}</div>
                          {u.group_code && (
                            <span style={{ fontSize: 11, color: '#4F46E5', fontFamily: 'monospace' }}>
                              [{u.group_code}]
                            </span>
                          )}
                        </div>
                      ) : (
                        <span style={{ color: '#94A3B8' }}>None</span>
                      )}
                    </td>
                    <td style={{ padding: '14px 16px', color: '#94A3B8', fontFamily: 'monospace', fontSize: 11.5 }}>
                      {u.id.substring(0, 10)}...
                    </td>
                    <td style={{ padding: '14px 20px', color: '#64748B', fontSize: 12 }}>
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
