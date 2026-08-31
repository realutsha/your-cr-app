import React, { useState, useEffect, useCallback, useRef } from 'react';
import { auth, onAuthStateChanged, firebaseSignOut, type FirebaseUser } from '../../lib/firebase';
import {
  adminApi,
  setAdminUserSession,
  type AdminStats,
  type AdminSystemConfig,
  type AdminGroupItem,
  type AdminUserItem,
  type AdminAuditLogItem,
} from '../../lib/adminApi';
import { AdminLogin } from './AdminLogin';
import { AdminOverviewTab } from './AdminOverviewTab';
import { AdminGroupsTab } from './AdminGroupsTab';
import { AdminUsersTab } from './AdminUsersTab';
import { AdminSettingsTab } from './AdminSettingsTab';
import { AdminAuditTab } from './AdminAuditTab';
import { Toast } from '../common/Toast';

type AdminTab = 'overview' | 'groups' | 'users' | 'settings' | 'audit';
type AuthState = 'checking' | 'unauthenticated' | 'authorized' | 'unauthorized';

export const AdminLayout: React.FC = () => {
  const [authState, setAuthState] = useState<AuthState>('checking');
  const [adminUser, setAdminUser] = useState<FirebaseUser | null>(null);
  const [adminEmail, setAdminEmail] = useState<string | null>(null);
  const [attemptedEmail, setAttemptedEmail] = useState<string | null>(null);

  const adminUserRef = useRef<FirebaseUser | null>(null);
  adminUserRef.current = adminUser;

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

  const [loadingData, setLoadingData] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }, []);

  const loadDashboardData = useCallback(async (activeUser?: FirebaseUser | null) => {
    const userToUse = activeUser || adminUserRef.current || auth?.currentUser;

    if (!userToUse) {
      console.warn('[Admin Dashboard] Cannot load data: No authenticated admin session available.');
      return;
    }

    setLoadingData(true);
    setDataError(null);

    console.log('[Admin Dashboard] Fetching dashboard data via authenticated admin API endpoints...');

    let statsError: string | null = null;
    let groupsError: string | null = null;
    let usersError: string | null = null;

    try {
      const [statsRes, groupsRes, usersRes, auditRes] = await Promise.all([
        adminApi.getStats(userToUse).catch((err) => {
          statsError = err.message || String(err);
          return null;
        }),
        adminApi.getGroups(userToUse).catch((err) => {
          groupsError = err.message || String(err);
          return null;
        }),
        adminApi.getUsers(userToUse).catch((err) => {
          usersError = err.message || String(err);
          return null;
        }),
        adminApi.getAuditLogs(userToUse).catch(() => []),
      ]);

      if (statsRes) {
        setStats(statsRes.stats);
        setSystem(statsRes.system);
      }
      if (groupsRes) {
        setGroups(groupsRes);
      }
      if (usersRes) {
        setUsers(usersRes);
      }
      if (auditRes) {
        setAuditLogs(auditRes);
      }

      const combinedError = statsError || groupsError || usersError;
      if (combinedError) {
        setDataError(combinedError);
        console.error('[Admin Dashboard] Encountered errors during data sync:', combinedError);
      } else {
        console.log('[Admin Dashboard] Dashboard data synced successfully.');
      }
    } catch (err: any) {
      console.error('[Admin Dashboard] Exception in loadDashboardData:', err);
      setDataError(err.message || 'Failed to sync admin data.');
    } finally {
      setLoadingData(false);
    }
  }, []);

  // Subscribe to Firebase Auth state changes
  useEffect(() => {
    if (!auth) {
      setAuthState('unauthenticated');
      return;
    }

    let isMounted = true;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!isMounted) return;

      if (!user) {
        setAuthState('unauthenticated');
        setAdminUser(null);
        setAdminUserSession(null);
        setAdminEmail(null);
        setAttemptedEmail(null);

        // If on a protected route while logged out, redirect URL to /admin/login
        if (
          typeof window !== 'undefined' &&
          window.location.pathname.startsWith('/admin') &&
          window.location.pathname !== '/admin/login'
        ) {
          window.history.replaceState({}, '', '/admin/login');
        }
        return;
      }

      // User exists -> verify admin authorization with resolved user object
      try {
        const res = await adminApi.verifyAdmin(user);
        if (!isMounted) return;

        if (res.authorized) {
          setAdminUser(user);
          setAdminUserSession(user);
          setAuthState('authorized');
          setAdminEmail(user.email);
          setAttemptedEmail(null);

          // If was on /admin/login, redirect URL to /admin
          if (typeof window !== 'undefined' && window.location.pathname === '/admin/login') {
            window.history.replaceState({}, '', '/admin');
            setCurrentTab('overview');
          }

          // Trigger data query ONLY AFTER session and authorization are confirmed
          loadDashboardData(user);
        } else {
          setAuthState('unauthorized');
          setAdminUser(null);
          setAdminUserSession(null);
          setAttemptedEmail(user.email);
        }
      } catch {
        if (!isMounted) return;
        setAuthState('unauthorized');
        setAdminUser(null);
        setAdminUserSession(null);
        setAttemptedEmail(user.email);
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [loadDashboardData]);

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
    setAdminUser(null);
    setAdminUserSession(null);
    setAuthState('unauthenticated');
    setAdminEmail(null);
    setAttemptedEmail(null);
    if (typeof window !== 'undefined' && window.history) {
      window.history.pushState({}, '', '/admin/login');
    }
    showToast('Signed out of Admin Portal');
  };

  const handleGoToApp = () => {
    if (typeof window !== 'undefined') {
      window.location.href = '/';
    }
  };

  // 1. Initial Loading State: explicit spinner, NO error text
  if (authState === 'checking') {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: '#0B0D14',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 14,
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            border: '2.5px solid rgba(255,255,255,0.15)',
            borderTopColor: '#818CF8',
            animation: 'spin 0.6s linear infinite',
          }}
        />
        <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13.5, fontWeight: 500 }}>
          Verifying administrator session...
        </div>
      </div>
    );
  }

  // 2. Unauthenticated state OR directly on /admin/login OR unauthorized account
  const isLoginPage = typeof window !== 'undefined' && window.location.pathname === '/admin/login';
  if (authState === 'unauthenticated' || authState === 'unauthorized' || isLoginPage) {
    return (
      <AdminLogin
        onSuccess={() => {
          // Handled by onAuthStateChanged subscription
        }}
        onGoToApp={handleGoToApp}
        isAccessDenied={authState === 'unauthorized'}
        attemptedEmail={attemptedEmail}
        onResetAuth={() => {
          setAuthState('unauthenticated');
          setAdminUser(null);
          setAdminUserSession(null);
          setAttemptedEmail(null);
        }}
      />
    );
  }

  // 3. Authorized Admin Dashboard
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
            loading={loadingData}
            error={dataError}
            onRetry={() => loadDashboardData(adminUser)}
            onNavigateTab={handleTabChange}
          />
        )}

        {currentTab === 'groups' && (
          <AdminGroupsTab
            groups={groups}
            loading={loadingData}
            error={dataError}
            onRefresh={() => loadDashboardData(adminUser)}
          />
        )}

        {currentTab === 'users' && (
          <AdminUsersTab
            users={users}
            loading={loadingData}
            error={dataError}
            onRefresh={() => loadDashboardData(adminUser)}
          />
        )}

        {currentTab === 'settings' && (
          <AdminSettingsTab
            system={system}
            onUpdateSuccess={(newConfig) => {
              setSystem(newConfig);
              loadDashboardData(adminUser);
            }}
            showToast={showToast}
          />
        )}

        {currentTab === 'audit' && (
          <AdminAuditTab
            logs={auditLogs}
            loading={loadingData}
            onRefresh={() => loadDashboardData(adminUser)}
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
