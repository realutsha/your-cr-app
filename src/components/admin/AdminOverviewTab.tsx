import React from 'react';
import type { AdminStats, AdminSystemConfig, AdminAuditLogItem } from '../../lib/adminApi';

interface AdminOverviewTabProps {
  stats: AdminStats | null;
  system: AdminSystemConfig | null;
  auditLogs: AdminAuditLogItem[];
  loading: boolean;
  error?: string | null;
  onRetry?: () => void;
  onNavigateTab: (tab: 'groups' | 'users' | 'settings' | 'audit') => void;
}

export const AdminOverviewTab: React.FC<AdminOverviewTabProps> = ({
  stats,
  system,
  auditLogs,
  loading,
  error,
  onRetry,
  onNavigateTab,
}) => {
  const isMaintenance = system?.isShutdown;
  const isScheduled = Boolean(system?.scheduledStart && system?.scheduledEnd && !isMaintenance);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Error Banner: Only displayed if counts could not be retrieved */}
      {error && !stats && (
        <div
          style={{
            background: '#FEF2F2',
            border: '1px solid #FCA5A5',
            borderRadius: 14,
            padding: '16px 20px',
            color: '#991B1B',
            fontSize: 13.5,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 14,
          }}
        >
          <div>
            <div style={{ fontWeight: 700, marginBottom: 2 }}>⚠️ Dashboard Query Error</div>
            <div>{error}</div>
          </div>
          {onRetry && (
            <button
              onClick={onRetry}
              style={{
                background: '#DC2626',
                border: 'none',
                color: '#FFFFFF',
                padding: '8px 14px',
                borderRadius: 8,
                fontSize: 12.5,
                fontWeight: 600,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              Retry Query
            </button>
          )}
        </div>
      )}

      {/* System Status Banner */}
      <div
        style={{
          background: isMaintenance
            ? '#FEF2F2'
            : isScheduled
            ? '#FFFBEB'
            : '#ECFDF5',
          border: `1px solid ${
            isMaintenance
              ? '#FCA5A5'
              : isScheduled
              ? '#FDE68A'
              : '#A7F3D0'
          }`,
          borderRadius: 16,
          padding: '20px 24px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div
            style={{
              width: 14,
              height: 14,
              borderRadius: '50%',
              background: isMaintenance ? '#EF4444' : isScheduled ? '#F59E0B' : '#10B981',
              boxShadow: isMaintenance
                ? '0 0 8px rgba(239, 68, 68, 0.5)'
                : isScheduled
                ? '0 0 8px rgba(245, 158, 11, 0.5)'
                : '0 0 8px rgba(16, 185, 129, 0.5)',
            }}
          />
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: isMaintenance ? '#B91C1C' : isScheduled ? '#B45309' : '#047857' }}>
              Current Application Status
            </div>
            <div style={{ fontSize: 18, fontWeight: 800, color: isMaintenance ? '#991B1B' : isScheduled ? '#92400E' : '#065F46', marginTop: 2 }}>
              {isMaintenance ? 'MAINTENANCE MODE (OFFLINE)' : isScheduled ? 'SCHEDULED MAINTENANCE' : 'ONLINE & OPERATIONAL'}
            </div>
            {isMaintenance && system?.shutdownMessage && (
              <div style={{ fontSize: 13, color: '#7F1D1D', marginTop: 4 }}>
                Message: "{system.shutdownMessage}"
              </div>
            )}
          </div>
        </div>

        <button
          onClick={() => onNavigateTab('settings')}
          style={{
            background: isMaintenance ? '#DC2626' : '#4F46E5',
            border: 'none',
            color: '#FFFFFF',
            padding: '10px 18px',
            borderRadius: 10,
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            boxShadow: isMaintenance ? '0 2px 6px rgba(220, 38, 38, 0.25)' : '0 2px 6px rgba(79, 70, 229, 0.25)',
          }}
        >
          <span>Manage App Controls &rarr;</span>
        </button>
      </div>

      {/* Metric Cards Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 16,
        }}
      >
        <MetricCard
          title="Total Groups / Classes"
          value={stats ? String(stats.totalGroups) : '0'}
          loading={loading}
          icon="🏫"
          onClick={() => onNavigateTab('groups')}
        />
        <MetricCard
          title="Total Registered Users"
          value={stats ? String(stats.totalUsers) : '0'}
          loading={loading}
          icon="👥"
          onClick={() => onNavigateTab('users')}
        />
        <MetricCard
          title="Total Class Members"
          value={stats ? String(stats.totalMembers) : '0'}
          loading={loading}
          icon="🎓"
          onClick={() => onNavigateTab('groups')}
        />
        <MetricCard
          title="Total Class Representatives"
          value={stats ? String(stats.totalCRs) : '0'}
          loading={loading}
          icon="🎖️"
          onClick={() => onNavigateTab('users')}
        />
        <MetricCard
          title="Total Hosts"
          value={stats ? String(stats.totalHosts) : '0'}
          loading={loading}
          icon="👑"
          onClick={() => onNavigateTab('groups')}
        />
        <MetricCard
          title="Application Status"
          value={stats?.appStatus || 'ONLINE'}
          loading={loading}
          icon="⚡"
          valueColor={isMaintenance ? '#DC2626' : isScheduled ? '#D97706' : '#059669'}
          onClick={() => onNavigateTab('settings')}
        />
      </div>

      {/* Quick Recent Activity */}
      <div
        style={{
          background: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: 16,
          padding: '20px 24px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#0F172A' }}>Recent Administrative Activity</div>
          <button
            onClick={() => onNavigateTab('audit')}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#4F46E5',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            View All Audit Logs &rarr;
          </button>
        </div>

        {auditLogs.length === 0 ? (
          <div style={{ color: '#64748B', fontSize: 13, padding: '16px 0' }}>
            No administrative events recorded yet.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {auditLogs.slice(0, 4).map((log) => (
              <div
                key={log.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  background: '#F8FAFC',
                  border: '1px solid #F1F5F9',
                  borderRadius: 10,
                  fontSize: 13,
                }}
              >
                <div>
                  <span style={{ fontWeight: 600, color: '#0F172A' }}>{log.action}</span>
                  <span style={{ color: '#64748B', marginLeft: 8 }}>by {log.performedBy}</span>
                  <div style={{ fontSize: 12.5, color: '#475569', marginTop: 2 }}>{log.details}</div>
                </div>
                <div style={{ fontSize: 12, color: '#94A3B8', whiteSpace: 'nowrap' }}>
                  {new Date(log.timestamp).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const MetricCard: React.FC<{
  title: string;
  value: string;
  icon: string;
  valueColor?: string;
  loading?: boolean;
  onClick?: () => void;
}> = ({ title, value, icon, valueColor, loading, onClick }) => (
  <div
    onClick={onClick}
    style={{
      background: '#FFFFFF',
      border: '1px solid #E2E8F0',
      borderRadius: 16,
      padding: '20px',
      cursor: onClick ? 'pointer' : 'default',
      boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      transition: 'border-color 160ms ease, transform 120ms ease, box-shadow 160ms ease',
    }}
  >
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {title}
      </div>
      <span style={{ fontSize: 20 }}>{icon}</span>
    </div>
    {loading ? (
      <div
        style={{
          height: 34,
          width: '60%',
          borderRadius: 8,
          background: '#F1F5F9',
          animation: 'pulse 1.5s ease-in-out infinite',
        }}
      />
    ) : (
      <div style={{ fontSize: 28, fontWeight: 800, color: valueColor || '#0F172A', fontFamily: 'var(--font-head)' }}>
        {value}
      </div>
    )}
  </div>
);
