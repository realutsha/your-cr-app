import React, { useState, useEffect, useCallback, useRef } from 'react';
import { collection, onSnapshot, type QuerySnapshot, type DocumentData } from 'firebase/firestore';
import { auth, db, onAuthStateChanged, firebaseSignOut, type FirebaseUser } from '../../lib/firebase';
import {
  adminApi,
  setAdminUserSession,
  AUTHORIZED_ADMIN_EMAILS,
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

export const AdminLayout: React.FC = () => {
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(true);
  const [adminUser, setAdminUser] = useState<FirebaseUser | null>(null);
  const [adminEmail, setAdminEmail] = useState<string | null>(null);
  const [isAccessDenied, setIsAccessDenied] = useState<boolean>(false);
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

  // Refs to hold latest raw snapshot data for cross-collection recomputation
  const groupsDocsRef = useRef<{ id: string; data: any }[]>([]);
  const usersDocsRef = useRef<{ id: string; data: any }[]>([]);
  const membersDocsRef = useRef<{ id: string; data: any }[]>([]);

  // Recompute stats, groups list, and users list from the latest snapshot refs.
  // Called whenever any of the 3 onSnapshot listeners fires.
  const recomputeFromSnapshots = useCallback(() => {
    const groupsDocs = groupsDocsRef.current;
    const usersDocs = usersDocsRef.current;
    const membersDocs = membersDocsRef.current;

    // --- Stats ---
    const totalGroups = groupsDocs.length;
    const totalUsers = usersDocs.length;
    const totalMembers = membersDocs.length;

    let totalCRs = 0;
    const hostUserIds = new Set<string>();

    usersDocs.forEach((u) => {
      if (u.data.role === 'cr') totalCRs++;
      if (u.data.is_host && u.id) hostUserIds.add(u.id);
    });

    groupsDocs.forEach((g) => {
      if (g.data.host_id) hostUserIds.add(g.data.host_id);
    });

    const totalHosts = hostUserIds.size;

    setStats((prev) => ({
      totalGroups,
      totalUsers,
      totalMembers,
      totalCRs,
      totalHosts,
      appStatus: prev?.appStatus || 'ONLINE',
    }));

    // --- Groups table ---
    const userMap = new Map<string, any>();
    usersDocs.forEach((u) => userMap.set(u.id, u.data));

    const memberCountsByGroup: Record<string, number> = {};
    membersDocs.forEach((m) => {
      if (m.data.group_id && (m.data.status === 'approved' || !m.data.status)) {
        memberCountsByGroup[m.data.group_id] = (memberCountsByGroup[m.data.group_id] || 0) + 1;
      }
    });

    const groupItems: AdminGroupItem[] = groupsDocs.map((d) => {
      const g = d.data;
      const host = userMap.get(g.host_id);
      return {
        id: d.id,
        name: g.name || 'Unnamed Class',
        code: g.code || '',
        host_id: g.host_id || '',
        host_username: host?.username || g.host_username || 'Host',
        host_email: host?.email || undefined,
        member_count: memberCountsByGroup[d.id] || g.member_count || 1,
        max_members: g.max_members || 50,
        cr_count: g.cr_count || 1,
        status: g.status || 'active',
        approval_mode: g.approval_mode || 'automatic',
        created_at: g.created_at
          ? typeof g.created_at === 'string'
            ? g.created_at
            : g.created_at.toDate?.()?.toISOString?.() || ''
          : new Date().toISOString(),
        expires_at: g.expires_at || '',
      };
    });
    setGroups(groupItems);

    // --- Users table ---
    const groupMap = new Map<string, any>();
    const hostUserIdsFromGroups = new Set<string>();
    groupsDocs.forEach((d) => {
      groupMap.set(d.id, d.data);
      if (d.data.host_id) hostUserIdsFromGroups.add(d.data.host_id);
    });

    const userItems: AdminUserItem[] = usersDocs.map((d) => {
      const u = d.data;
      const userGroup = u.current_group_id ? groupMap.get(u.current_group_id) : null;
      const isHost = hostUserIdsFromGroups.has(d.id) || Boolean(u.is_host);

      const createdDate = u.created_at
        ? typeof u.created_at === 'string'
          ? u.created_at
          : u.created_at.toDate?.()?.toISOString?.() || ''
        : '';
      const lastActiveDate = u.last_active_at
        ? typeof u.last_active_at === 'string'
          ? u.last_active_at
          : u.last_active_at.toDate?.()?.toISOString?.() || ''
        : null;

      return {
        id: d.id,
        email: u.email || '',
        username: u.username || u.email?.split('@')[0] || 'Anonymous',
        role: u.role || (isHost ? 'cr' : 'student'),
        is_host: isHost,
        current_group_id: u.current_group_id || null,
        group_name: userGroup?.name || null,
        group_code: userGroup?.code || null,
        created_at: createdDate || new Date().toISOString(),
        last_active_at: lastActiveDate,
      };
    });
    setUsers(userItems);

    setDataError(null);
    console.log(
      `[Admin Dashboard] Real-time update: ${totalGroups} groups, ${totalUsers} users, ${totalMembers} members, ${totalCRs} CRs, ${totalHosts} hosts.`
    );
  }, []);

  // Load only audit logs + system config (non-real-time pieces)
  const loadAuditAndSystem = useCallback(async (activeUser?: FirebaseUser | null) => {
    const userToUse = activeUser || adminUserRef.current || auth?.currentUser;

    if (!userToUse) {
      console.warn('[Admin Dashboard] Cannot load data: No authenticated admin session available.');
      return;
    }

    setLoadingData(true);

    try {
      const [statsRes, auditRes] = await Promise.all([
        adminApi.getStats(userToUse).catch((err) => {
          console.warn('[Admin Dashboard] System config error:', err);
          return null;
        }),
        adminApi.getAuditLogs(userToUse).catch((err) => {
          console.warn('[Admin Dashboard] Audit logs error:', err);
          return [];
        }),
      ]);

      if (statsRes) {
        setSystem(statsRes.system);
        // Update appStatus from system config
        setStats((prev) => prev ? { ...prev, appStatus: statsRes.stats.appStatus } : null);
      }

      if (auditRes) {
        setAuditLogs(auditRes);
      }

      console.log('[Admin Dashboard] Audit logs and system config loaded.');
    } catch (err: any) {
      console.error('[Admin Dashboard] Exception in loadAuditAndSystem:', err);
    } finally {
      setLoadingData(false);
    }
  }, []);

  // Real-time Firestore listeners — auth-gated, only attach when admin is confirmed
  useEffect(() => {
    if (isAuthLoading || !adminUser || !db) return;
    const email = (adminUser.email || '').toLowerCase().trim();
    const isAuthorizedAdmin = email === 'madhurzamutsha@gmail.com' || AUTHORIZED_ADMIN_EMAILS.includes(email);
    if (!isAuthorizedAdmin) return;

    console.log('[Admin Dashboard] Attaching real-time Firestore listeners...');

    const unsubGroups = onSnapshot(
      collection(db, 'groups'),
      (snap: QuerySnapshot<DocumentData>) => {
        groupsDocsRef.current = snap.docs.map((d) => ({ id: d.id, data: d.data() }));
        recomputeFromSnapshots();
      },
      (err) => {
        console.warn('[Admin Dashboard] groups onSnapshot error:', err);
      }
    );

    const unsubUsers = onSnapshot(
      collection(db, 'users'),
      (snap: QuerySnapshot<DocumentData>) => {
        usersDocsRef.current = snap.docs.map((d) => ({ id: d.id, data: d.data() }));
        recomputeFromSnapshots();
      },
      (err) => {
        console.warn('[Admin Dashboard] users onSnapshot error:', err);
      }
    );

    const unsubMembers = onSnapshot(
      collection(db, 'groupMembers'),
      (snap: QuerySnapshot<DocumentData>) => {
        membersDocsRef.current = snap.docs.map((d) => ({ id: d.id, data: d.data() }));
        recomputeFromSnapshots();
      },
      (err) => {
        console.warn('[Admin Dashboard] groupMembers onSnapshot error:', err);
      }
    );

    return () => {
      console.log('[Admin Dashboard] Detaching real-time Firestore listeners.');
      unsubGroups();
      unsubUsers();
      unsubMembers();
      // Clear refs on cleanup to avoid stale data on re-auth
      groupsDocsRef.current = [];
      usersDocsRef.current = [];
      membersDocsRef.current = [];
    };
  }, [isAuthLoading, adminUser, recomputeFromSnapshots]);

  // Subscribe to Firebase Auth state changes with strict auth-readiness gating
  useEffect(() => {
    if (!auth) {
      setIsAuthLoading(false);
      return;
    }

    let isMounted = true;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!isMounted) return;

      if (!user) {
        setAdminUser(null);
        setAdminUserSession(null);
        setAdminEmail(null);
        setIsAccessDenied(false);
        setAttemptedEmail(null);
        setIsAuthLoading(false);

        // If on a protected route while confirmed logged out, redirect URL to /admin/login
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
          setAdminEmail(user.email);
          setIsAccessDenied(false);
          setAttemptedEmail(null);
          setIsAuthLoading(false);

          // If was on /admin/login, redirect URL to /admin
          if (typeof window !== 'undefined' && window.location.pathname === '/admin/login') {
            window.history.replaceState({}, '', '/admin');
            setCurrentTab('overview');
          }

          // Trigger data query ONLY AFTER session and authorization are confirmed
          loadAuditAndSystem(user);
        } else {
          setAdminUser(null);
          setAdminUserSession(null);
          setAdminEmail(null);
          setIsAccessDenied(true);
          setAttemptedEmail(user.email);
          setIsAuthLoading(false);
        }
      } catch {
        if (!isMounted) return;
        setAdminUser(null);
        setAdminUserSession(null);
        setAdminEmail(null);
        setIsAccessDenied(true);
        setAttemptedEmail(user.email);
        setIsAuthLoading(false);
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [loadAuditAndSystem]);

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
    setAdminEmail(null);
    setIsAccessDenied(false);
    setAttemptedEmail(null);
    setIsAuthLoading(false);
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

  // 1. Initial Loading State: explicit spinner while resolving auth from IndexedDB
  if (isAuthLoading) {
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
  const isAuthorized = Boolean(
    adminUser &&
    adminUser.email &&
    (adminUser.email.toLowerCase().trim() === 'madhurzamutsha@gmail.com' ||
      AUTHORIZED_ADMIN_EMAILS.includes(adminUser.email.toLowerCase().trim()))
  );

  const isLoginPage = typeof window !== 'undefined' && window.location.pathname === '/admin/login';
  if (!isAuthorized || isAccessDenied || isLoginPage) {
    return (
      <AdminLogin
        onSuccess={() => {
          // Handled by onAuthStateChanged subscription
        }}
        onGoToApp={handleGoToApp}
        isAccessDenied={isAccessDenied}
        attemptedEmail={attemptedEmail}
        onResetAuth={() => {
          setIsAccessDenied(false);
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
            onRetry={() => loadAuditAndSystem(adminUser)}
            onNavigateTab={handleTabChange}
          />
        )}

        {currentTab === 'groups' && (
          <AdminGroupsTab
            groups={groups}
            loading={loadingData}
            error={dataError}
            onRefresh={() => loadAuditAndSystem(adminUser)}
          />
        )}

        {currentTab === 'users' && (
          <AdminUsersTab
            users={users}
            loading={loadingData}
            error={dataError}
            onRefresh={() => loadAuditAndSystem(adminUser)}
          />
        )}

        {currentTab === 'settings' && (
          <AdminSettingsTab
            system={system}
            onUpdateSuccess={(newConfig) => {
              setSystem(newConfig);
              loadAuditAndSystem(adminUser);
            }}
            showToast={showToast}
          />
        )}

        {currentTab === 'audit' && (
          <AdminAuditTab
            logs={auditLogs}
            loading={loadingData}
            onRefresh={() => loadAuditAndSystem(adminUser)}
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
