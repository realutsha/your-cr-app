import React, { useState, useMemo } from 'react';
import type { AdminGroupItem } from '../../lib/adminApi';
import { adminApi } from '../../lib/adminApi';

interface AdminGroupsTabProps {
  groups: AdminGroupItem[];
  loading: boolean;
  error?: string | null;
  onRefresh: () => void;
}

export const AdminGroupsTab: React.FC<AdminGroupsTabProps> = ({ groups, loading, error, onRefresh }) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedGroup, setSelectedGroup] = useState<AdminGroupItem | null>(null);
  const [groupDetails, setGroupDetails] = useState<{ group: AdminGroupItem; members: any[] } | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  const filteredGroups = useMemo(() => {
    return groups.filter((g) => {
      const q = search.toLowerCase().trim();
      const matchSearch =
        !q ||
        g.name.toLowerCase().includes(q) ||
        g.code.toLowerCase().includes(q) ||
        (g.host_username && g.host_username.toLowerCase().includes(q)) ||
        (g.host_email && g.host_email.toLowerCase().includes(q));

      const matchStatus = statusFilter === 'all' || g.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [groups, search, statusFilter]);

  const handleOpenGroup = async (group: AdminGroupItem) => {
    setSelectedGroup(group);
    setLoadingDetails(true);
    try {
      const res = await adminApi.getGroupDetails(group.id);
      setGroupDetails(res);
    } catch {
      setGroupDetails({ group, members: [] });
    } finally {
      setLoadingDetails(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Filters Bar */}
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
            placeholder="Search by class name, code, host..."
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
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
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
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="expired">Expired</option>
            <option value="archived">Archived</option>
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

      {/* Groups Table / List */}
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
                <th style={{ padding: '14px 20px' }}>Class / Group Name</th>
                <th style={{ padding: '14px 16px' }}>Code</th>
                <th style={{ padding: '14px 16px' }}>Host / Creator</th>
                <th style={{ padding: '14px 16px' }}>Members</th>
                <th style={{ padding: '14px 16px' }}>CRs</th>
                <th style={{ padding: '14px 16px' }}>Status</th>
                <th style={{ padding: '14px 20px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} style={{ padding: 32, textAlign: 'center', color: '#64748B' }}>
                    Loading groups data...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={7} style={{ padding: 32, textAlign: 'center', color: '#DC2626' }}>
                    <div style={{ fontWeight: 700, marginBottom: 4 }}>⚠️ Error loading groups</div>
                    <div style={{ fontSize: 12 }}>{error}</div>
                  </td>
                </tr>
              ) : filteredGroups.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: 32, textAlign: 'center', color: '#64748B' }}>
                    No groups found.
                  </td>
                </tr>
              ) : (
                filteredGroups.map((g) => (
                  <tr
                    key={g.id}
                    style={{
                      borderBottom: '1px solid #F1F5F9',
                      transition: 'background 120ms ease',
                    }}
                  >
                    <td style={{ padding: '14px 20px', fontWeight: 600, color: '#0F172A' }}>
                      {g.name}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <span
                        style={{
                          background: '#EEF2FF',
                          color: '#4F46E5',
                          border: '1px solid #C7D2FE',
                          padding: '3px 8px',
                          borderRadius: 6,
                          fontFamily: 'monospace',
                          fontWeight: 700,
                        }}
                      >
                        {g.code}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px', color: '#0F172A' }}>
                      <div style={{ fontWeight: 500 }}>{g.host_username}</div>
                      {g.host_email && <div style={{ fontSize: 11.5, color: '#64748B' }}>{g.host_email}</div>}
                    </td>
                    <td style={{ padding: '14px 16px', fontWeight: 700, color: '#0F172A' }}>
                      {g.member_count} / {g.max_members || 50}
                    </td>
                    <td style={{ padding: '14px 16px', color: '#475569' }}>
                      {g.cr_count || 1}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <span
                        style={{
                          background: g.status === 'active' ? '#ECFDF5' : '#FEF2F2',
                          color: g.status === 'active' ? '#059669' : '#DC2626',
                          border: `1px solid ${g.status === 'active' ? '#A7F3D0' : '#FECACA'}`,
                          padding: '3px 8px',
                          borderRadius: 6,
                          fontSize: 11.5,
                          fontWeight: 600,
                          textTransform: 'uppercase',
                        }}
                      >
                        {g.status}
                      </span>
                    </td>
                    <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                      <button
                        onClick={() => handleOpenGroup(g)}
                        style={{
                          background: '#EEF2FF',
                          border: '1px solid #C7D2FE',
                          color: '#4F46E5',
                          padding: '6px 12px',
                          borderRadius: 8,
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: 'pointer',
                          transition: 'background 120ms ease',
                        }}
                      >
                        View Roster
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Group Details Modal */}
      {selectedGroup && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.45)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 20,
          }}
          onClick={() => {
            setSelectedGroup(null);
            setGroupDetails(null);
          }}
        >
          <div
            style={{
              background: '#FFFFFF',
              border: '1px solid #E2E8F0',
              borderRadius: 20,
              maxWidth: 640,
              width: '100%',
              maxHeight: '85vh',
              overflowY: 'auto',
              padding: '28px 24px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#4F46E5', letterSpacing: 1 }}>
                  Group Roster Details
                </div>
                <h2 style={{ fontSize: 20, fontWeight: 800, color: '#0F172A', margin: '4px 0 0 0' }}>
                  {selectedGroup.name}
                </h2>
              </div>
              <button
                onClick={() => {
                  setSelectedGroup(null);
                  setGroupDetails(null);
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#64748B',
                  fontSize: 20,
                  cursor: 'pointer',
                  padding: 4,
                }}
              >
                ✕
              </button>
            </div>

            {/* Overview Details */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                gap: 12,
                background: '#F8FAFC',
                border: '1px solid #E2E8F0',
                padding: 16,
                borderRadius: 12,
                marginBottom: 20,
                fontSize: 13,
              }}
            >
              <div>
                <div style={{ color: '#64748B', fontSize: 11, fontWeight: 600 }}>CLASS CODE</div>
                <div style={{ fontWeight: 700, color: '#4F46E5', fontFamily: 'monospace', fontSize: 14 }}>{selectedGroup.code}</div>
              </div>
              <div>
                <div style={{ color: '#64748B', fontSize: 11, fontWeight: 600 }}>TOTAL MEMBERS</div>
                <div style={{ fontWeight: 700, color: '#0F172A' }}>{selectedGroup.member_count} / {selectedGroup.max_members || 50}</div>
              </div>
              <div>
                <div style={{ color: '#64748B', fontSize: 11, fontWeight: 600 }}>HOST</div>
                <div style={{ fontWeight: 600, color: '#0F172A' }}>{selectedGroup.host_username}</div>
              </div>
              <div>
                <div style={{ color: '#64748B', fontSize: 11, fontWeight: 600 }}>STATUS</div>
                <div style={{ fontWeight: 600, color: selectedGroup.status === 'active' ? '#059669' : '#DC2626' }}>
                  {selectedGroup.status.toUpperCase()}
                </div>
              </div>
            </div>

            {/* Member List */}
            <div style={{ marginBottom: 10, fontSize: 14, fontWeight: 700, color: '#0F172A' }}>
              Enrolled Members ({groupDetails?.members?.length || 0})
            </div>

            {loadingDetails ? (
              <div style={{ padding: 24, textAlign: 'center', color: '#64748B', fontSize: 13 }}>
                Loading member records...
              </div>
            ) : !groupDetails?.members || groupDetails.members.length === 0 ? (
              <div style={{ padding: 16, color: '#64748B', fontSize: 13 }}>
                No separate member records found.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {groupDetails.members.map((m: any, idx: number) => (
                  <div
                    key={m.id || idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      background: '#F8FAFC',
                      border: '1px solid #E2E8F0',
                      borderRadius: 10,
                      fontSize: 12.5,
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, color: '#0F172A' }}>
                        {m.username || m.email?.split('@')[0] || `User ${m.user_id?.substring(0, 6)}`}
                      </div>
                      <div style={{ color: '#64748B', fontSize: 11 }}>
                        ID: {m.user_id} {m.email ? `· ${m.email}` : ''}
                      </div>
                    </div>
                    <span
                      style={{
                        background: m.status === 'approved' ? '#ECFDF5' : '#FFFBEB',
                        color: m.status === 'approved' ? '#059669' : '#D97706',
                        border: `1px solid ${m.status === 'approved' ? '#A7F3D0' : '#FDE68A'}`,
                        padding: '2px 8px',
                        borderRadius: 6,
                        fontSize: 11,
                        fontWeight: 600,
                      }}
                    >
                      {m.status || 'member'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
