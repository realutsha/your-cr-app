import React, { useState, useEffect, useCallback } from 'react';
import { auth, firebaseSignOut } from '../../lib/firebase';
import { adminApi, type AdminStats, type AdminSystemConfig, type AdminGroupItem, type AdminUserItem, type AdminAuditLogItem } from '../../lib/adminApi';
import { AdminLogin } from './AdminLogin';
import { AdminOverviewTab } from './AdminOverviewTab';
import { AdminGroupsTab } from './AdminGroupsTab';
import { AdminUsersTab } from './AdminUsersTab';
import { AdminSettingsTab } from './AdminSettingsTab';
import { AdminAuditTab } from './AdminAuditTab';
import { Toast } from '../common/Toast';

type AdminTab = 'overview' | 'groups' | 'users' | 'settings' | 'audit';

export const AdminLayout: React.FC = () => {
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [adminEmail, setAdminEmail] = useState<string | null>(null);
  const [isAccessDenied, setIsAccessDenied] = useState<boolean>(false);

  const getInitialTab = (): AdminTab => {
    if (typeof window !== 'undefined') {
      const path = window.location.pathname;
      if (path.includes('/groups')) return 'groups';
      if (path.includes('/users')) return 'users';
      if (path.includes('/settings')) return 'settings';
      if (path.includes('/audit')) return 'audit';
    }
    return 'overview';
  };

  const [currentTab, setCurrentTab] = useState<AdminTab>(getInitialTab);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [system, setSystem] = useState<AdminSystemConfig | null>(null);
  const [groups, setGroups] = useState<AdminGroupItem[]>([]);
  const [users, setUsers] = useState<AdminUserItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<AdminAuditLogItem[]>([]);

  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }, []);

  const loadDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes, groupsRes, usersRes, auditRes] = await Promise.allSettled([
        adminApi.getStats(),
        adminApi.getGroups(),
        adminApi.getUsers(),
        adminApi.getAuditLogs(),
      ]);

      if (statsRes.status === 'fulfilled') {
        setStats(statsRes.value.stats);
        setSystem(statsRes.value.system);
      }
      if (groupsRes.status === 'fulfilled') {
        setGroups(groupsRes.value);
      }
      if (usersRes.status === 'fulfilled') {
        setUsers(usersRes.value);
      }
      if (auditRes.status === 'fulfilled') {
        setAuditLogs(auditRes.value);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const checkAuth = useCallback(async () => {
    if (!auth?.currentUser) {
      setAuthorized(false);
      setLoading(false);
      // If user visited a protected admin path directly while unauthenticated, ensure URL is /admin/login
      if (typeof window !== 'undefined' && window.location.pathname.startsWith('/admin') && window.location.pathname !== '/admin/login') {
        window.history.replaceState({}, '', '/admin/login');
      }
      return;
    }

    try {
      const res = await adminApi.verifyAdmin();
      if (res.authorized) {
        setAuthorized(true);
        setIsAccessDenied(false);
        setAdminEmail(res.email || auth.currentUser.email);
        
        // If user logged in from /admin/login, redirect URL to /admin
        if (typeof window !== 'undefined' && window.location.pathname === '/admin/login') {
          window.history.replaceState({}, '', '/admin');
          setCurrentTab('overview');
        }
        loadDashboardData();
      } else {
        setAuthorized(false);
        setIsAccessDenied(true);
      }
    } catch {
      setAuthorized(false);
      setIsAccessDenied(true);
    } finally {
      setLoading(false);
    }
  }, [loadDashboardData]);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Sync tab with URL on popstate
  useEffect(() => {
    const handlePopState = () => {
      setCurrentTab(getInitialTab());
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleTabChange = (tab: AdminTab) => {
    setCurrentTab(tab);
    if (typeof window !== 'undefined' && window.history) {
      const targetPath = tab === 'overview' ? '/admin' : `/admin/${tab}`;
      window.history.pushState({}, '', targetPath);
    }
  };

  const handleAdminLogout = async () => {
    if (auth) {
      await firebaseSignOut(auth).catch(() => {});
    }
    setAuthorized(false);
    setAdminEmail(null);
    setIsAccessDenied(false);
    if (typeof window !== 'undefined' && window.history) {
      window.history.pushState({}, '', '/admin/login');
    }
    showToast('Signed out of admin dashboard');
  };

  const handleGoToApp = () => {
    if (typeof window !== 'undefined') {
      window.location.href = '/';
    }
  };

  // If unauthenticated, unauthorized, or currently on /admin/login -> Render Admin Login Page
  const isLoginPage = typeof window !== 'undefined' && window.location.pathname === '/admin/login';
  if (isLoginPage || authorized === false || (!loading && !authorized)) {
    return (
      <AdminLogin
        onSuccess={() => {
          checkAuth();
        }}
        onGoToApp={handleGoToApp}
        isAccessDeniedInitial={isAccessDenied}
      />
    );
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#0B0D14',
        color: '#FFFFFF',
        fontFamily: 'var(--font-body)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {toast && <Toast message={toast} />}

      {/* Top Header */}
      <header
        style={{
          background: '#121624',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          position: 'sticky',
          top: 0,
          zIndex: 100,
          padding: '0 24px',
        }}
      >
        <div
          style={{
            maxWidth: 1200,
            margin: '0 auto',
            height: 64,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
          }}
        >
          {/* Brand */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: '#818CF8',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                fontSize: 16,
                color: '#FFFFFF',
              }}
            >
              CM
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 16, color: '#FFFFFF', lineHeight: 1.2 }}>
                ClassMate <span style={{ color: '#818CF8', fontSize: 12, fontWeight: 700, background: 'rgba(129,140,248,0.15)', padding: '2px 6px', borderRadius: 4, marginLeft: 4 }}>ADMIN PORTAL</span>
              </div>
            </div>
          </div>

          {/* Right Action Items */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            {adminEmail && (
              <span style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.7)', fontWeight: 500 }}>
                {adminEmail}
              </span>
            )}

            <button
              onClick={handleGoToApp}
              style={{
                background: '#1E2438',
                border: '1px solid rgba(255,255,255,0.1)',
                color: '#FFFFFF',
                padding: '6px 12px',
                borderRadius: 8,
                fontSize: 12.5,
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Student App &rarr;
            </button>

            <button
              id="admin-logout-btn"
              onClick={handleAdminLogout}
              style={{
                background: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                color: '#FCA5A5',
                fontSize: 12.5,
                fontWeight: 600,
                cursor: 'pointer',
                padding: '6px 12px',
                borderRadius: 8,
                transition: 'all 140ms ease',
              }}
            >
              Admin Logout
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <div style={{ maxWidth: 1200, width: '100%', margin: '0 auto', padding: '24px', flex: 1 }}>
        {/* Navigation Tabs */}
        <nav
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 8,
            marginBottom: 24,
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            paddingBottom: 12,
          }}
        >
          <TabButton active={currentTab === 'overview'} label="📊 Overview" onClick={() => handleTabChange('overview')} />
          <TabButton active={currentTab === 'groups'} label="🏫 Groups / Classes" onClick={() => handleTabChange('groups')} />
          <TabButton active={currentTab === 'users'} label="👥 Users & Members" onClick={() => handleTabChange('users')} />
          <TabButton active={currentTab === 'settings'} label="⚙️ App Controls & Shutdown" onClick={() => handleTabChange('settings')} />
          <TabButton active={currentTab === 'audit'} label="📜 Audit Logs" onClick={() => handleTabChange('audit')} />
        </nav>

        {/* Tab Content */}
        {currentTab === 'overview' && (
          <AdminOverviewTab
            stats={stats}
            system={system}
            auditLogs={auditLogs}
            loading={loading}
            onNavigateTab={handleTabChange}
          />
        )}

        {currentTab === 'groups' && (
          <AdminGroupsTab
            groups={groups}
            loading={loading}
            onRefresh={loadDashboardData}
          />
        )}

        {currentTab === 'users' && (
          <AdminUsersTab
            users={users}
            loading={loading}
            onRefresh={loadDashboardData}
          />
        )}

        {currentTab === 'settings' && (
          <AdminSettingsTab
            system={system}
            onUpdateSuccess={(newConfig) => {
              setSystem(newConfig);
              loadDashboardData();
            }}
            showToast={showToast}
          />
        )}

        {currentTab === 'audit' && (
          <AdminAuditTab
            logs={auditLogs}
            loading={loading}
            onRefresh={loadDashboardData}
          />
        )}
      </div>
    </div>
  );
};

const TabButton: React.FC<{ active: boolean; label: string; onClick: () => void }> = ({ active, label, onClick }) => (
  <button
    onClick={onClick}
    style={{
      background: active ? 'rgba(129,140,248,0.15)' : 'transparent',
      border: active ? '1px solid rgba(129,140,248,0.35)' : '1px solid transparent',
      color: active ? '#818CF8' : 'rgba(255,255,255,0.7)',
      padding: '8px 16px',
      borderRadius: 10,
      fontSize: 13.5,
      fontWeight: 600,
      cursor: 'pointer',
      transition: 'all 140ms ease',
    }}
  >
    {label}
  </button>
);
