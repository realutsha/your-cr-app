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
            background: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.35)',
            borderRadius: 14,
            padding: '16px 20px',
            color: '#FCA5A5',
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
                background: '#EF4444',
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
            ? 'linear-gradient(135deg, rgba(239,68,68,0.15), rgba(185,28,28,0.1))'
            : isScheduled
            ? 'linear-gradient(135deg, rgba(245,158,11,0.15), rgba(217,119,6,0.1))'
            : 'linear-gradient(135deg, rgba(16,185,129,0.15), rgba(5,150,105,0.1))',
          border: `1px solid ${
            isMaintenance
              ? 'rgba(239,68,68,0.35)'
              : isScheduled
              ? 'rgba(245,158,11,0.35)'
              : 'rgba(16,185,129,0.35)'
          }`,
          borderRadius: 16,
          padding: '20px 24px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
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
                ? '0 0 12px #EF4444'
                : isScheduled
                ? '0 0 12px #F59E0B'
                : '0 0 12px #10B981',
            }}
          />
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: isMaintenance ? '#FCA5A5' : isScheduled ? '#FDE68A' : '#A7F3D0' }}>
              Current Application Status
            </div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#FFFFFF', marginTop: 2 }}>
              {isMaintenance ? 'MAINTENANCE MODE (OFFLINE)' : isScheduled ? 'SCHEDULED MAINTENANCE' : 'ONLINE & OPERATIONAL'}
            </div>
            {isMaintenance && system?.shutdownMessage && (
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 4 }}>
                Message: "{system.shutdownMessage}"
              </div>
            )}
          </div>
        </div>

        <button
          onClick={() => onNavigateTab('settings')}
          style={{
            background: isMaintenance ? '#EF4444' : '#1E2438',
            border: '1px solid rgba(255,255,255,0.15)',
            color: '#FFFFFF',
            padding: '10px 18px',
            borderRadius: 10,
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
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
          valueColor={isMaintenance ? '#EF4444' : isScheduled ? '#F59E0B' : '#10B981'}
          onClick={() => onNavigateTab('settings')}
        />
      </div>

      {/* Quick Recent Activity */}
      <div
        style={{
          background: '#121624',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 16,
          padding: '20px 24px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#FFFFFF' }}>Recent Administrative Activity</div>
          <button
            onClick={() => onNavigateTab('audit')}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#818CF8',
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            View All Audit Logs &rarr;
          </button>
        </div>

        {auditLogs.length === 0 ? (
          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, padding: '16px 0' }}>
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
                  background: 'rgba(255,255,255,0.03)',
                  borderRadius: 10,
                  fontSize: 13,
                }}
              >
                <div>
                  <span style={{ fontWeight: 600, color: '#FFFFFF' }}>{log.action}</span>
                  <span style={{ color: 'rgba(255,255,255,0.5)', marginLeft: 8 }}>by {log.performedBy}</span>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>{log.details}</div>
                </div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', whiteSpace: 'nowrap' }}>
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
      background: '#121624',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 16,
      padding: '20px',
      cursor: onClick ? 'pointer' : 'default',
      transition: 'border-color 160ms ease, transform 120ms ease',
    }}
  >
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
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
          background: 'rgba(255,255,255,0.08)',
          animation: 'pulse 1.5s ease-in-out infinite',
        }}
      />
    ) : (
      <div style={{ fontSize: 28, fontWeight: 800, color: valueColor || '#FFFFFF', fontFamily: 'var(--font-head)' }}>
        {value}
      </div>
    )}
  </div>
);
