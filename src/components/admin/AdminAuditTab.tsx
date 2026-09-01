import React from 'react';
import type { AdminAuditLogItem } from '../../lib/adminApi';

interface AdminAuditTabProps {
  logs: AdminAuditLogItem[];
  loading: boolean;
  onRefresh: () => void;
}

export const AdminAuditTab: React.FC<AdminAuditTabProps> = ({ logs, loading, onRefresh }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: 14,
          padding: '14px 18px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        }}
      >
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 800, color: '#0F172A', margin: 0 }}>
            Security & Audit Activity Logs
          </h2>
          <p style={{ fontSize: 12.5, color: '#64748B', margin: '2px 0 0 0' }}>
            Immutable record of all administrative operations, shutdown events, and configuration updates.
          </p>
        </div>
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
          Refresh Logs
        </button>
      </div>

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
                <th style={{ padding: '14px 20px' }}>Timestamp</th>
                <th style={{ padding: '14px 16px' }}>Action</th>
                <th style={{ padding: '14px 16px' }}>Administrator</th>
                <th style={{ padding: '14px 20px' }}>Details / Metadata</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} style={{ padding: 32, textAlign: 'center', color: '#64748B' }}>
                    Loading audit trail...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ padding: 32, textAlign: 'center', color: '#64748B' }}>
                    No administrative audit events recorded yet.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr
                    key={log.id}
                    style={{
                      borderBottom: '1px solid #F1F5F9',
                      transition: 'background 120ms ease',
                    }}
                  >
                    <td style={{ padding: '14px 20px', color: '#64748B', fontSize: 12, whiteSpace: 'nowrap' }}>
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <span
                        style={{
                          background: log.action.includes('SHUTDOWN')
                            ? '#FEF2F2'
                            : log.action.includes('RESTART')
                            ? '#ECFDF5'
                            : '#EEF2FF',
                          color: log.action.includes('SHUTDOWN')
                            ? '#DC2626'
                            : log.action.includes('RESTART')
                            ? '#059669'
                            : '#4F46E5',
                          border: `1px solid ${
                            log.action.includes('SHUTDOWN')
                              ? '#FECACA'
                              : log.action.includes('RESTART')
                              ? '#A7F3D0'
                              : '#C7D2FE'
                          }`,
                          padding: '3px 8px',
                          borderRadius: 6,
                          fontSize: 11.5,
                          fontWeight: 700,
                        }}
                      >
                        {log.action}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px', color: '#0F172A', fontWeight: 600 }}>
                      {log.performedBy}
                    </td>
                    <td style={{ padding: '14px 20px', color: '#334155' }}>
                      {log.details}
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
