import { useState, useEffect, useRef, useCallback } from 'react';
import { store } from './lib/store';
import {
  getThemePreference,
  setThemePreference,
  subscribeTheme,
  type ThemePreference,
} from './lib/theme';
import {
  initForegroundNotificationListener,
  requestNotificationPermission,
} from './lib/notifications';
import type {
  User,
  Group,
  Course,
  AcademicUpdate,
  AcademicCategory,
  UpdateStatus,
  ApprovalMode,
} from './types';
import { AuthModal } from './components/auth/AuthModal';
import { Sheet } from './components/common/Sheet';
import { Toast } from './components/common/Toast';
import { ConfirmSheet } from './components/common/ConfirmSheet';
import { BottomNav, NAV_H } from './components/navigation/BottomNav';
import { HomeScreen } from './components/home/HomeScreen';
import { CourseScreen } from './components/course/CourseScreen';
import { CategoryScreen } from './components/category/CategoryScreen';
import { DetailSheet } from './components/update/DetailSheet';
import { ComposeSheet } from './components/update/ComposeSheet';
import { CourseManageSheet } from './components/course/CourseManageSheet';
import { JoinSheet } from './components/group/JoinSheet';
import { CreateClassSheet } from './components/group/CreateClassSheet';
import { ProfileScreen } from './components/profile/ProfileScreen';

const CANONICAL_DOMAIN = 'class-mate-woad.vercel.app';

// Canonical domain routing: automatically redirect any temporary Vercel preview URLs
// to the stable production domain so OAuth and persistence are always centralized.
if (typeof window !== 'undefined') {
  const hostname = window.location.hostname;
  if (
    hostname.endsWith('.vercel.app') &&
    hostname !== CANONICAL_DOMAIN &&
    !hostname.includes('localhost')
  ) {
    const targetUrl = `https://${CANONICAL_DOMAIN}${window.location.pathname}${window.location.search}${window.location.hash}`;
    window.location.replace(targetUrl);
  }
}

export function App() {
  const [authReady, setAuthReady] = useState<boolean>(store.isAuthReady());
  const [currentUser, setCurrentUser] = useState<User | null>(store.getCurrentUser());
  const [currentGroup, setCurrentGroup] = useState<Group | null>(store.getCurrentUserGroup());
  const [courses, setCourses] = useState<Course[]>(store.getCourses());
  const [, setUpdates] = useState<AcademicUpdate[]>(store.getAcademicUpdates());
  const [themePref, setThemePref] = useState<ThemePreference>(getThemePreference());
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | 'unsupported'>(
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'unsupported'
  );
  const [hasFcmToken, setHasFcmToken] = useState<boolean>(Boolean(store.getUserFcmToken()));

  const [screen, setScreen] = useState<'home' | 'profile'>('home');

  // Navigation Hierarchy State
  const [activeCourseId, setActiveCourseId] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<AcademicCategory | null>(null);

  // Sheets
  const [selectedUpdate, setSelectedUpdate] = useState<AcademicUpdate | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [editingUpdate, setEditingUpdate] = useState<AcademicUpdate | null>(null);
  const [composeDefaultCourseId, setComposeDefaultCourseId] = useState<string | undefined>(undefined);
  const [composeDefaultCategory, setComposeDefaultCategory] = useState<AcademicCategory>('quiz');

  const [manageCoursesOpen, setManageCoursesOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);

  const [joinOpen, setJoinOpen] = useState(false);
  const [createClassOpen, setCreateClassOpen] = useState(false);
  const [confirm, setConfirm] = useState<'leave' | 'logout' | 'deleteGroup' | null>(null);
  const [isDeletingGroup, setIsDeletingGroup] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const showToast = useCallback((msg: string) => {
    clearTimeout(toastTimer.current);
    setToast(msg);
    toastTimer.current = setTimeout(() => setToast(null), 2500);
  }, []);

  // Android & Mobile History Back Button Handler
  useEffect(() => {
    const handlePopState = () => {
      if (confirm) {
        setConfirm(null);
      } else if (selectedUpdate) {
        setSelectedUpdate(null);
      } else if (composeOpen) {
        setComposeOpen(false);
        setEditingUpdate(null);
      } else if (manageCoursesOpen) {
        setManageCoursesOpen(false);
        setEditingCourse(null);
      } else if (joinOpen) {
        setJoinOpen(false);
      } else if (createClassOpen) {
        setCreateClassOpen(false);
      } else if (activeCategory) {
        setActiveCategory(null);
      } else if (activeCourseId) {
        setActiveCourseId(null);
      } else if (screen === 'profile') {
        setScreen('home');
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [confirm, selectedUpdate, composeOpen, manageCoursesOpen, joinOpen, createClassOpen, activeCategory, activeCourseId, screen]);

  // Push history state whenever a sub-view or sheet opens
  const pushNavState = useCallback(() => {
    if (typeof window !== 'undefined' && window.history) {
      window.history.pushState({ appNav: true }, '');
    }
  }, []);

  useEffect(() => {
    const unsubStore = store.subscribe(() => {
      setAuthReady(store.isAuthReady());
      setCurrentUser(store.getCurrentUser());
      setCurrentGroup(store.getCurrentUserGroup());
      setCourses(store.getCourses());
      setUpdates(store.getAcademicUpdates());
      setHasFcmToken(Boolean(store.getUserFcmToken()));
    });
    const unsubTheme = subscribeTheme((t) => setThemePref(t));
    const unsubFCM = initForegroundNotificationListener((title, body) => {
      showToast(`${title}: ${body}`);
    });

    // Fast fallback: if network is slow or offline, render UI shell in max 1 second
    const timeoutTimer = setTimeout(() => {
      setAuthReady(true);
    }, 1000);

    return () => {
      clearTimeout(timeoutTimer);
      unsubStore();
      unsubTheme();
      unsubFCM();
    };
  }, [showToast]);

  const isCR = currentUser ? currentUser.role === 'cr' || currentUser.id === currentGroup?.host_id : false;
  const totalUnreadCount = store.getTotalUnreadCount();
  const activeCourse = courses.find((c) => c.id === activeCourseId);

  // Open update details & automatically record view for student
  const handleOpenUpdate = (u: AcademicUpdate) => {
    pushNavState();
    setSelectedUpdate(u);
    if (!isCR) {
      store.recordView(u.id);
    }
  };

  const handleEnableNotifications = async () => {
    const res = await requestNotificationPermission();
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setNotifPermission(Notification.permission);
    }
    if (res.granted) {
      if (res.token) {
        setHasFcmToken(true);
        showToast('Push notifications enabled & active');
      } else if (res.needsVapidKey) {
        showToast('Notifications allowed (VAPID key needed for FCM token)');
      } else {
        showToast('Browser notifications enabled');
      }
    } else if (res.error) {
      showToast(res.error);
    }
  };

  const handleSaveUpdate = async (data: {
    id?: string;
    course_id: string;
    category: AcademicCategory;
    title: string;
    date: string;
    time: string;
    topic?: string;
    description?: string;
    resource_url?: string;
    status?: UpdateStatus;
  }) => {
    if (data.id) {
      const res = await store.updateAcademicUpdate(data.id, data);
      if (res.error) {
        showToast(res.error);
        return;
      }
      showToast('Announcement updated');
    } else {
      const res = await store.createAcademicUpdate(data);
      if (res.error) {
        showToast(res.error);
        return;
      }
      showToast('Announcement posted');
    }
    setComposeOpen(false);
    setEditingUpdate(null);
  };

  const handleDeleteUpdate = async (id: string) => {
    const res = await store.deleteAcademicUpdate(id);
    if (res.error) {
      showToast(res.error);
      return;
    }
    setSelectedUpdate(null);
    showToast('Announcement deleted');
  };

  const handleCreateCourse = (name: string) => {
    const res = store.createCourse(name);
    if (res.error) {
      showToast(res.error);
    } else {
      setEditingCourse(null);
      showToast('Course added');
    }
  };

  const handleUpdateCourse = (id: string, name: string) => {
    const res = store.updateCourse(id, name);
    if (res.error) {
      showToast(res.error);
    } else {
      setEditingCourse(null);
      showToast('Course updated');
    }
  };

  const handleDeleteCourse = (id: string) => {
    store.deleteCourse(id);
    setEditingCourse(null);
    if (activeCourseId === id) {
      setActiveCourseId(null);
      setActiveCategory(null);
    }
    showToast('Course deleted');
  };

  const handleJoinClass = async (code: string) => {
    const res = await store.joinGroupByCode(code);
    if (res.error) {
      showToast(res.error);
    } else if (res.status === 'joined') {
      setJoinOpen(false);
      showToast(`Joined ${res.group?.name}`);
    } else {
      setJoinOpen(false);
      showToast('Request submitted for CR approval');
    }
  };

  const handleCreateClass = async (
    name: string,
    mode: ApprovalMode
  ): Promise<{ success: boolean; error?: string }> => {
    const res = await store.createGroup(name, mode);
    if (res.error) {
      showToast(res.error);
      return { success: false, error: res.error };
    } else {
      setCreateClassOpen(false);
      setActiveCourseId(null);
      setActiveCategory(null);
      setScreen('home');
      showToast(`Class created (${res.group?.code})`);
      return { success: true };
    }
  };

  const handleCopyCode = () => {
    if (currentGroup?.code) {
      try {
        navigator.clipboard.writeText(currentGroup.code);
      } catch {}
      showToast('Code copied');
    }
  };

  const handleLeaveClass = () => {
    store.leaveCurrentGroup();
    setActiveCourseId(null);
    setActiveCategory(null);
    setConfirm(null);
    showToast('Left class');
  };

  const handleDeleteGroup = async () => {
    if (!currentGroup || isDeletingGroup) return;
    setIsDeletingGroup(true);
    const res = await store.deleteGroup(currentGroup.id);
    setIsDeletingGroup(false);
    if (res.success) {
      setConfirm(null);
      setActiveCourseId(null);
      setActiveCategory(null);
      setScreen('home');
      showToast('Group deleted successfully.');
    } else {
      showToast(res.error || 'Failed to delete group.');
    }
  };

  const handleLogout = () => {
    store.signOut();
    setActiveCourseId(null);
    setActiveCategory(null);
    setConfirm(null);
    showToast('Signed out');
  };

  if (!authReady) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: 'var(--c-bg)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
        }}
      >
        <div
          style={{
            width: 24,
            height: 24,
            borderRadius: '50%',
            border: '2px solid var(--c-hairline-strong)',
            borderTopColor: 'var(--c-accent)',
            animation: 'spin 0.6s linear infinite',
          }}
        />
      </div>
    );
  }

  if (!currentUser) {
    return (
      <AuthModal
        onSuccess={() => {
          setCurrentUser(store.getCurrentUser());
          setCurrentGroup(store.getCurrentUserGroup());
        }}
        showToast={showToast}
      />
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--c-bg)', transition: 'background 220ms ease' }}>
      {toast && <Toast message={toast} />}

      {/* Main Viewport */}
      <div
        style={{
          maxWidth: 480,
          margin: '0 auto',
          padding: '0 20px',
          paddingTop: 'max(28px, env(safe-area-inset-top))',
          paddingBottom: NAV_H + 28,
        }}
      >
        {screen === 'home' ? (
          !currentGroup ? (
            /* No Group Screen */
            <div style={{ paddingTop: 40, textAlign: 'center' }}>
              <div style={{ fontFamily: 'var(--font-head)', fontSize: 18, fontWeight: 700, color: 'var(--c-text)', marginBottom: 8 }}>
                Join your class
              </div>
              <div style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--c-text-soft)', maxWidth: 300, margin: '0 auto 28px', lineHeight: 1.5 }}>
                Enter the 6-character group code provided by your Class Representative.
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 260, margin: '0 auto' }}>
                <button
                  onClick={() => {
                    pushNavState();
                    setJoinOpen(true);
                  }}
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: 14,
                    fontWeight: 600,
                    color: '#FFFFFF',
                    background: 'var(--c-accent)',
                    padding: '11px 18px',
                    borderRadius: 12,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                  }}
                >
                  <span>Enter class code</span>
                </button>

                <button
                  onClick={() => {
                    pushNavState();
                    setCreateClassOpen(true);
                  }}
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: 13,
                    color: 'var(--c-text-soft)',
                    padding: '10px 18px',
                    borderRadius: 12,
                    border: '1px solid var(--c-hairline)',
                    background: 'var(--c-card-bg)',
                  }}
                >
                  Are you a CR? Create a class
                </button>
              </div>
            </div>
          ) : activeCourseId === null ? (
            /* 1. HOME: Show Courses with Unread Badges */
            <HomeScreen
              group={currentGroup}
              courses={courses}
              isCR={isCR}
              onSelectCourse={(c) => {
                pushNavState();
                setActiveCourseId(c.id);
              }}
              onCompose={() => {
                pushNavState();
                setEditingUpdate(null);
                setComposeDefaultCourseId(courses[0]?.id);
                setComposeDefaultCategory('quiz');
                setComposeOpen(true);
              }}
              onManageCourses={() => {
                pushNavState();
                setEditingCourse(null);
                setManageCoursesOpen(true);
              }}
            />
          ) : activeCategory === null && activeCourse ? (
            /* 2. COURSE SCREEN: Show 4 Fixed Categories */
            <CourseScreen
              course={activeCourse}
              isCR={isCR}
              onBack={() => setActiveCourseId(null)}
              onSelectCategory={(cat) => {
                pushNavState();
                setActiveCategory(cat);
              }}
              onComposeForCourse={(c) => {
                pushNavState();
                setEditingUpdate(null);
                setComposeDefaultCourseId(c.id);
                setComposeDefaultCategory('quiz');
                setComposeOpen(true);
              }}
              onEditCourse={(c) => {
                pushNavState();
                setEditingCourse(c);
                setManageCoursesOpen(true);
              }}
            />
          ) : activeCourse && activeCategory ? (
            /* 3. CATEGORY SCREEN: List Updates for that Category */
            <CategoryScreen
              course={activeCourse}
              categoryKey={activeCategory}
              isCR={isCR}
              onBack={() => setActiveCategory(null)}
              onOpenUpdate={handleOpenUpdate}
              onComposeForCategory={(c, cat) => {
                pushNavState();
                setEditingUpdate(null);
                setComposeDefaultCourseId(c.id);
                setComposeDefaultCategory(cat);
                setComposeOpen(true);
              }}
            />
          ) : null
        ) : (
          /* Profile Screen */
          <ProfileScreen
            user={currentUser}
            group={currentGroup}
            isCR={isCR}
            themePreference={themePref}
            notificationPermission={notifPermission}
            hasFcmToken={hasFcmToken}
            onThemeChange={(p) => setThemePreference(p)}
            onEnableNotifications={handleEnableNotifications}
            onCopyCode={handleCopyCode}
            onLeave={() => {
              pushNavState();
              setConfirm('leave');
            }}
            onDeleteGroup={() => {
              pushNavState();
              setConfirm('deleteGroup');
            }}
            onLogout={() => {
              pushNavState();
              setConfirm('logout');
            }}
            onToggleApprovalMode={(mode) => {
              if (currentGroup) {
                store.updateApprovalMode(currentGroup.id, mode);
                showToast(`Approval mode set to ${mode}`);
              }
            }}
            onJoinClick={() => {
              pushNavState();
              setJoinOpen(true);
            }}
            onCreateClassClick={() => {
              pushNavState();
              setCreateClassOpen(true);
            }}
          />
        )}
      </div>

      {/* Fixed Bottom Navigation */}
      <BottomNav
        screen={screen}
        setScreen={(s) => {
          setScreen(s);
        }}
        unreadCount={totalUnreadCount}
      />

      {/* Update Detail Sheet */}
      <Sheet open={!!selectedUpdate} onClose={() => setSelectedUpdate(null)}>
        <DetailSheet
          u={selectedUpdate}
          isCR={isCR}
          onClose={() => setSelectedUpdate(null)}
          onEdit={(u) => {
            setSelectedUpdate(null);
            setEditingUpdate(u);
            setComposeDefaultCourseId(u.course_id);
            setComposeDefaultCategory(u.category || u.section);
            setComposeOpen(true);
          }}
          onDelete={handleDeleteUpdate}
        />
      </Sheet>

      {/* CR Compose / Edit Update Sheet */}
      <Sheet
        open={composeOpen}
        onClose={() => {
          setComposeOpen(false);
          setEditingUpdate(null);
        }}
      >
        <ComposeSheet
          courses={courses}
          initialUpdate={editingUpdate}
          defaultCourseId={composeDefaultCourseId}
          defaultCategory={composeDefaultCategory}
          onClose={() => {
            setComposeOpen(false);
            setEditingUpdate(null);
          }}
          onSave={handleSaveUpdate}
        />
      </Sheet>

      {/* CR Course Management Sheet */}
      <Sheet
        open={manageCoursesOpen}
        onClose={() => {
          setManageCoursesOpen(false);
          setEditingCourse(null);
        }}
      >
        <CourseManageSheet
          courses={courses}
          editingCourse={editingCourse}
          onClose={() => {
            setManageCoursesOpen(false);
            setEditingCourse(null);
          }}
          onCreateCourse={handleCreateCourse}
          onUpdateCourse={handleUpdateCourse}
          onDeleteCourse={handleDeleteCourse}
        />
      </Sheet>

      {/* Join Class Sheet */}
      <Sheet open={joinOpen} onClose={() => setJoinOpen(false)}>
        <JoinSheet onClose={() => setJoinOpen(false)} onJoin={handleJoinClass} />
      </Sheet>

      {/* Create Class Sheet */}
      <Sheet open={createClassOpen} onClose={() => setCreateClassOpen(false)}>
        <CreateClassSheet onClose={() => setCreateClassOpen(false)} onCreate={handleCreateClass} />
      </Sheet>

      {/* Confirm Action Sheet */}
      <Sheet open={!!confirm} onClose={() => { if (!isDeletingGroup) setConfirm(null); }}>
        {confirm === 'deleteGroup' && (
          <ConfirmSheet
            title="Delete this group?"
            description="This will permanently delete the group for all members. This action cannot be undone."
            confirmLabel={isDeletingGroup ? 'Deleting group...' : 'Delete Group'}
            disabled={isDeletingGroup}
            onCancel={() => { if (!isDeletingGroup) setConfirm(null); }}
            onConfirm={handleDeleteGroup}
          />
        )}
        {confirm === 'leave' && (
          <ConfirmSheet
            description="You'll lose access to this class's academic updates. You can rejoin later with the group code, if it hasn't expired."
            confirmLabel="Leave class"
            onCancel={() => setConfirm(null)}
            onConfirm={handleLeaveClass}
          />
        )}
        {confirm === 'logout' && (
          <ConfirmSheet
            description="You'll need to sign in again with your DIU email to access your announcements."
            confirmLabel="Log out"
            onCancel={() => setConfirm(null)}
            onConfirm={handleLogout}
          />
        )}
      </Sheet>
    </div>
  );
}

export default App;
