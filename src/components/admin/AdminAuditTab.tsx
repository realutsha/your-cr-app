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
          background: '#121624',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 14,
          padding: '14px 18px',
        }}
      >
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 800, color: '#FFFFFF', margin: 0 }}>
            Security & Audit Activity Logs
          </h2>
          <p style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.5)', margin: '2px 0 0 0' }}>
            Immutable record of all administrative operations, shutdown events, and configuration updates.
          </p>
        </div>
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
          Refresh Logs
        </button>
      </div>

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
                <th style={{ padding: '14px 20px' }}>Timestamp</th>
                <th style={{ padding: '14px 16px' }}>Action</th>
                <th style={{ padding: '14px 16px' }}>Administrator</th>
                <th style={{ padding: '14px 20px' }}>Details / Metadata</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} style={{ padding: 32, textAlign: 'center', color: 'rgba(255,255,255,0.5)' }}>
                    Loading audit trail...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ padding: 32, textAlign: 'center', color: 'rgba(255,255,255,0.5)' }}>
                    No administrative audit events recorded yet.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr
                    key={log.id}
                    style={{
                      borderBottom: '1px solid rgba(255,255,255,0.04)',
                      transition: 'background 120ms ease',
                    }}
                  >
                    <td style={{ padding: '14px 20px', color: 'rgba(255,255,255,0.6)', fontSize: 12, whiteSpace: 'nowrap' }}>
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <span
                        style={{
                          background: log.action.includes('SHUTDOWN')
                            ? 'rgba(239,68,68,0.15)'
                            : log.action.includes('RESTART')
                            ? 'rgba(16,185,129,0.15)'
                            : 'rgba(129,140,248,0.15)',
                          color: log.action.includes('SHUTDOWN')
                            ? '#FCA5A5'
                            : log.action.includes('RESTART')
                            ? '#6EE7B7'
                            : '#A5B4FC',
                          padding: '3px 8px',
                          borderRadius: 6,
                          fontSize: 11.5,
                          fontWeight: 700,
                        }}
                      >
                        {log.action}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px', color: '#FFFFFF', fontWeight: 500 }}>
                      {log.performedBy}
                    </td>
                    <td style={{ padding: '14px 20px', color: 'rgba(255,255,255,0.8)' }}>
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
