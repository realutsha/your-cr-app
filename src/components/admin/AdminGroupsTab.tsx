import React, { useState, useMemo } from 'react';
import type { AdminGroupItem } from '../../lib/adminApi';
import { adminApi } from '../../lib/adminApi';

interface AdminGroupsTabProps {
  groups: AdminGroupItem[];
  loading: boolean;
  onRefresh: () => void;
}

export const AdminGroupsTab: React.FC<AdminGroupsTabProps> = ({ groups, loading, onRefresh }) => {
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
          background: '#121624',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 14,
          padding: '14px 18px',
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
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
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
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="expired">Expired</option>
            <option value="archived">Archived</option>
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

      {/* Groups Table / List */}
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
                  <td colSpan={7} style={{ padding: 32, textAlign: 'center', color: 'rgba(255,255,255,0.5)' }}>
                    Loading groups data...
                  </td>
                </tr>
              ) : filteredGroups.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: 32, textAlign: 'center', color: 'rgba(255,255,255,0.5)' }}>
                    No groups found.
                  </td>
                </tr>
              ) : (
                filteredGroups.map((g) => (
                  <tr
                    key={g.id}
                    style={{
                      borderBottom: '1px solid rgba(255,255,255,0.04)',
                      transition: 'background 120ms ease',
                    }}
                  >
                    <td style={{ padding: '14px 20px', fontWeight: 600, color: '#FFFFFF' }}>
                      {g.name}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <span
                        style={{
                          background: 'rgba(129,140,248,0.15)',
                          color: '#A5B4FC',
                          padding: '3px 8px',
                          borderRadius: 6,
                          fontFamily: 'monospace',
                          fontWeight: 700,
                        }}
                      >
                        {g.code}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px', color: 'rgba(255,255,255,0.85)' }}>
                      <div>{g.host_username}</div>
                      {g.host_email && <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.45)' }}>{g.host_email}</div>}
                    </td>
                    <td style={{ padding: '14px 16px', fontWeight: 700, color: '#FFFFFF' }}>
                      {g.member_count} / {g.max_members || 50}
                    </td>
                    <td style={{ padding: '14px 16px', color: 'rgba(255,255,255,0.8)' }}>
                      {g.cr_count || 1}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <span
                        style={{
                          background: g.status === 'active' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                          color: g.status === 'active' ? '#6EE7B7' : '#FCA5A5',
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
                          background: '#1E2438',
                          border: '1px solid rgba(255,255,255,0.12)',
                          color: '#818CF8',
                          padding: '6px 12px',
                          borderRadius: 8,
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: 'pointer',
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
            background: 'rgba(0,0,0,0.7)',
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
              background: '#121624',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 20,
              maxWidth: 640,
              width: '100%',
              maxHeight: '85vh',
              overflowY: 'auto',
              padding: '28px 24px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#818CF8', letterSpacing: 1 }}>
                  Group Roster Details
                </div>
                <h2 style={{ fontSize: 20, fontWeight: 800, color: '#FFFFFF', margin: '4px 0 0 0' }}>
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
                  color: 'rgba(255,255,255,0.5)',
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
                background: 'rgba(255,255,255,0.03)',
                padding: 16,
                borderRadius: 12,
                marginBottom: 20,
                fontSize: 13,
              }}
            >
              <div>
                <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11 }}>CLASS CODE</div>
                <div style={{ fontWeight: 700, color: '#A5B4FC', fontFamily: 'monospace' }}>{selectedGroup.code}</div>
              </div>
              <div>
                <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11 }}>TOTAL MEMBERS</div>
                <div style={{ fontWeight: 700, color: '#FFFFFF' }}>{selectedGroup.member_count} / {selectedGroup.max_members || 50}</div>
              </div>
              <div>
                <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11 }}>HOST</div>
                <div style={{ fontWeight: 600, color: '#FFFFFF' }}>{selectedGroup.host_username}</div>
              </div>
              <div>
                <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11 }}>STATUS</div>
                <div style={{ fontWeight: 600, color: selectedGroup.status === 'active' ? '#6EE7B7' : '#FCA5A5' }}>
                  {selectedGroup.status.toUpperCase()}
                </div>
              </div>
            </div>

            {/* Member List */}
            <div style={{ marginBottom: 10, fontSize: 14, fontWeight: 700, color: '#FFFFFF' }}>
              Enrolled Members ({groupDetails?.members?.length || 0})
            </div>

            {loadingDetails ? (
              <div style={{ padding: 24, textAlign: 'center', color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>
                Loading member records...
              </div>
            ) : !groupDetails?.members || groupDetails.members.length === 0 ? (
              <div style={{ padding: 16, color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>
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
                      background: 'rgba(255,255,255,0.02)',
                      border: '1px solid rgba(255,255,255,0.05)',
                      borderRadius: 10,
                      fontSize: 12.5,
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, color: '#FFFFFF' }}>
                        {m.username || m.email?.split('@')[0] || `User ${m.user_id?.substring(0, 6)}`}
                      </div>
                      <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11 }}>
                        ID: {m.user_id} {m.email ? `· ${m.email}` : ''}
                      </div>
                    </div>
                    <span
                      style={{
                        background: m.status === 'approved' ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)',
                        color: m.status === 'approved' ? '#6EE7B7' : '#FCD34D',
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
