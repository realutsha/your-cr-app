import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  query,
  where,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';
import {
  auth,
  db,
  googleProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  firebaseSignOut,
  onAuthStateChanged,
  isFirebaseConfigured,
  type FirebaseUser,
} from './firebase';
import {
  isDiuEmail,
  extractUsernameFromEmail,
  generateGroupCode,
  calculateExpirationDate,
  isGroupExpired,
} from './auth';
import {
  LIMITS,
  validateText,
  validateClassName,
  validateUrl,
} from './validation';
import { dispatchUpdateNotification } from './notifications';
import type {
  User,
  Group,
  GroupMember,
  JoinRequest,
  Course,
  AcademicUpdate,
  AcademicCategory,
  UpdateView,
  UpdateStatus,
  ApprovalMode,
} from '../types';

/* ------------------------------------------------------------------
   STORAGE KEYS FOR PERSISTENCE & LOCAL CACHE
-------------------------------------------------------------------*/
const STORAGE_KEYS = {
  USER: 'diu_cr_user_cache',
  USERS: 'diu_cr_users',
  GROUPS: 'diu_cr_groups',
  MEMBERS: 'diu_cr_members',
  REQUESTS: 'diu_cr_requests',
  COURSES: 'diu_cr_courses',
  UPDATES: 'diu_cr_updates',
  VIEWS: 'diu_cr_views',
  FCM_TOKENS: 'diu_cr_fcm_tokens',
};

function sanitizeForFirestore<T extends Record<string, any>>(obj: T): Record<string, any> {
  const clean: Record<string, any> = {};
  for (const [key, val] of Object.entries(obj)) {
    if (val !== undefined) {
      clean[key] = val;
    }
  }
  return clean;
}

function parseTimestampToIso(val: any): string {
  if (!val) return new Date().toISOString();
  if (typeof val === 'string') return val;
  if (typeof val.toDate === 'function') return val.toDate().toISOString();
  if (typeof val.seconds === 'number') return new Date(val.seconds * 1000).toISOString();
  if (typeof val._seconds === 'number') return new Date(val._seconds * 1000).toISOString();
  return new Date().toISOString();
}

/* ------------------------------------------------------------------
   FIREBASE CLOUD FIRESTORE APP STORE
-------------------------------------------------------------------*/
class AppStore {
  private currentUser: User | null = null;
  private authReady: boolean = false;
  private authErrorMessage: string | null = null;
  private users: User[] = [];
  private groups: Group[] = [];
  private members: GroupMember[] = [];
  private requests: JoinRequest[] = [];
  private courses: Course[] = [];
  private updates: AcademicUpdate[] = [];
  private views: UpdateView[] = [];
  private isShutdown: boolean = false;
  private shutdownMessage: string = 'Class Mate is temporarily unavailable for maintenance. Please try again later.';
  private scheduledStart: string | null = null;
  private scheduledEnd: string | null = null;
  private systemStatusUnsub: (() => void) | null = null;
  private listeners: Set<() => void> = new Set();
  private firestoreUnsubscribers: (() => void)[] = [];
  private activeSyncPromise: Promise<User> | null = null;
  private activeSyncUid: string | null = null;

  constructor() {
    this.loadFromStorage();
    this.checkGroupExpirations();
    this.initFirebaseAuthListener();
    this.initSystemStatusListener();

    if (typeof window !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && this.currentUser) {
          // Reconnect listeners if they were cleared
          if (this.firestoreUnsubscribers.length === 0) {
            this.attachFirestoreListeners();
          }
        }
      });
    }
  }

  private loadFromStorage() {
    try {
      const storedUsers = localStorage.getItem(STORAGE_KEYS.USERS);
      const storedGroups = localStorage.getItem(STORAGE_KEYS.GROUPS);
      const storedMembers = localStorage.getItem(STORAGE_KEYS.MEMBERS);
      const storedRequests = localStorage.getItem(STORAGE_KEYS.REQUESTS);
      const storedCourses = localStorage.getItem(STORAGE_KEYS.COURSES);
      const storedUpdates = localStorage.getItem(STORAGE_KEYS.UPDATES);
      const storedViews = localStorage.getItem(STORAGE_KEYS.VIEWS);

      // Note: currentUser is NEVER trusted from localStorage to prevent auth bypass.
      this.currentUser = null;
      this.users = storedUsers ? JSON.parse(storedUsers) : [];
      this.groups = storedGroups ? JSON.parse(storedGroups) : [];
      this.members = storedMembers ? JSON.parse(storedMembers) : [];
      this.requests = storedRequests ? JSON.parse(storedRequests) : [];
      this.courses = storedCourses ? JSON.parse(storedCourses) : [];
      this.updates = storedUpdates ? JSON.parse(storedUpdates) : [];
      this.views = storedViews ? JSON.parse(storedViews) : [];
    } catch {
      this.currentUser = null;
      this.users = [];
      this.groups = [];
      this.members = [];
      this.requests = [];
      this.courses = [];
      this.updates = [];
      this.views = [];
    }
  }

  private persist() {
    try {
      if (this.currentUser) {
        localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(this.currentUser));
      } else {
        localStorage.removeItem(STORAGE_KEYS.USER);
      }
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(this.users));
      localStorage.setItem(STORAGE_KEYS.GROUPS, JSON.stringify(this.groups));
      localStorage.setItem(STORAGE_KEYS.MEMBERS, JSON.stringify(this.members));
      localStorage.setItem(STORAGE_KEYS.REQUESTS, JSON.stringify(this.requests));
      localStorage.setItem(STORAGE_KEYS.COURSES, JSON.stringify(this.courses));
      localStorage.setItem(STORAGE_KEYS.UPDATES, JSON.stringify(this.updates));
      localStorage.setItem(STORAGE_KEYS.VIEWS, JSON.stringify(this.views));
    } catch {}
  }

  private isSyncing = false;

  public isSyncingData(): boolean {
    return this.isSyncing;
  }

  private initFirebaseAuthListener() {
    const authInstance = auth;
    if (!isFirebaseConfigured || !authInstance) {
      this.authReady = true;
      this.notify();
      return;
    }

    // 1. Immediately listen to onAuthStateChanged for instant session restore
    onAuthStateChanged(authInstance, (firebaseUser: FirebaseUser | null) => {
      if (firebaseUser) {
        const email = (firebaseUser.email || '').trim().toLowerCase();
        const isVerified = Boolean(firebaseUser.emailVerified);

        if (isDiuEmail(email) && isVerified) {
          const username = extractUsernameFromEmail(email);

          // Optimistically restore session immediately so UI shell renders in 0ms
          if (!this.currentUser || this.currentUser.id !== firebaseUser.uid) {
            this.currentUser = {
              id: firebaseUser.uid,
              email,
              username,
              role: this.currentUser?.role || 'student',
              current_group_id: this.currentUser?.current_group_id || null,
              created_at: new Date().toISOString(),
            };
          }
          this.authReady = true;
          this.authErrorMessage = null;
          this.notify();

          // Sync full profile & groups asynchronously in background
          this.syncFirebaseUserProfile(firebaseUser.uid, email, username).catch((err) => {
            console.warn('Background profile sync error:', err);
          });
        } else if (
          email === 'madhurzamutsha@gmail.com' ||
          (typeof window !== 'undefined' && window.location.pathname.startsWith('/admin'))
        ) {
          // Admin account or on admin route: do not sign out Firebase Auth, but leave student currentUser null
          this.currentUser = null;
          this.clearFirestoreListeners();
          this.authReady = true;
          this.notify();
        } else {
          // Unauthorized or non-DIU email: immediately sign out
          firebaseSignOut(authInstance).catch(() => {});
          this.currentUser = null;
          this.clearFirestoreListeners();
          this.persist();
          if (!this.authErrorMessage) {
            this.authErrorMessage =
              'Access restricted: Only verified Daffodil International University Google accounts (@diu.edu.bd) are permitted.';
          }
          this.authReady = true;
          this.notify();
        }
      } else {
        this.currentUser = null;
        this.clearFirestoreListeners();
        this.persist();
        this.authReady = true;
        this.notify();
      }
    });

    // 2. In parallel, process redirect result if returning from a redirect OAuth flow
    getRedirectResult(authInstance)
      .then(async (credential) => {
        if (credential && credential.user) {
          const user = credential.user;
          const email = (user.email || '').trim().toLowerCase();
          const isVerified = Boolean(user.emailVerified);

          if (isDiuEmail(email) && isVerified) {
            const username = extractUsernameFromEmail(email);
            await this.syncFirebaseUserProfile(user.uid, email, username);
            this.authErrorMessage = null;
          } else if (
            email === 'madhurzamutsha@gmail.com' ||
            (typeof window !== 'undefined' && window.location.pathname.startsWith('/admin'))
          ) {
            // Admin account redirect or on admin route: do not sign out
            this.currentUser = null;
            this.clearFirestoreListeners();
            this.notify();
          } else {
            await firebaseSignOut(authInstance).catch(() => {});
            this.currentUser = null;
            this.clearFirestoreListeners();
            this.authErrorMessage =
              'Access restricted: Only verified Daffodil International University Google accounts (@diu.edu.bd) are permitted.';
            this.notify();
          }
        }
      })
      .catch((err) => {
        console.warn('[Firebase Auth] Redirect result error:', err);
        const e = err as { code?: string; message?: string };
        this.authErrorMessage = this.formatFirebaseAuthError(e);
        this.notify();
      });
  }

  private async syncFirebaseUserProfile(uid: string, email: string, username: string): Promise<User> {
    if (this.activeSyncPromise && this.activeSyncUid === uid) {
      return this.activeSyncPromise;
    }
    this.activeSyncUid = uid;
    this.activeSyncPromise = this.performSyncUserProfile(uid, email, username).finally(() => {
      this.activeSyncPromise = null;
      this.activeSyncUid = null;
    });
    return this.activeSyncPromise;
  }

  private async performSyncUserProfile(uid: string, email: string, username: string): Promise<User> {
    const defaultUser: User = {
      id: uid,
      email,
      username,
      role: 'student',
      current_group_id: null,
      created_at: new Date().toISOString(),
    };

    const dbInstance = db;
    if (!dbInstance) {
      this.currentUser = defaultUser;
      this.persist();
      this.notify();
      return defaultUser;
    }

    this.isSyncing = true;
    this.notify();

    try {
      const userRef = doc(dbInstance, 'users', uid);
      const userSnap = await getDoc(userRef);

      let currentGroupId: string | null = null;
      let userRole: 'student' | 'cr' = 'student';
      let hasSeenFreeAccessOffer = false;

      if (!userSnap.exists()) {
        await setDoc(userRef, {
          ...defaultUser,
          has_seen_free_access_offer: false,
          created_at: serverTimestamp(),
          last_active_at: serverTimestamp(),
        });
        this.currentUser = { ...defaultUser, has_seen_free_access_offer: false };
      } else {
        const data = userSnap.data() as Partial<User>;
        currentGroupId = data.current_group_id || null;
        userRole = data.role || 'student';
        hasSeenFreeAccessOffer = Boolean(data.has_seen_free_access_offer);
      }

      // If current_group_id is null on user doc, check if user has an active approved membership in groupMembers
      if (!currentGroupId) {
        const memberSnap = await getDocs(
          query(collection(dbInstance, 'groupMembers'), where('user_id', '==', uid), where('status', '==', 'approved'))
        ).catch(() => null);

        if (memberSnap && !memberSnap.empty) {
          const mData = memberSnap.docs[0].data() as GroupMember;
          currentGroupId = mData.group_id;

          const groupSnap = await getDoc(doc(dbInstance, 'groups', currentGroupId)).catch(() => null);
          if (groupSnap && groupSnap.exists()) {
            const groupData = { id: groupSnap.id, ...groupSnap.data() } as Group;
            const gIdx = this.groups.findIndex((g) => g.id === groupData.id);
            if (gIdx >= 0) this.groups[gIdx] = groupData;
            else this.groups.push(groupData);

            if (groupData.original_host_id === uid || groupData.host_id === uid) {
              userRole = 'cr';
            }
          }
          updateDoc(userRef, { current_group_id: currentGroupId, role: userRole }).catch(() => {});
        }
      }

      this.currentUser = {
        id: uid,
        email,
        username,
        role: userRole,
        current_group_id: currentGroupId,
        has_seen_free_access_offer: hasSeenFreeAccessOffer,
        created_at:
          userSnap.exists() && typeof userSnap.data()?.created_at === 'string'
            ? (userSnap.data()?.created_at as string)
            : new Date().toISOString(),
      };
      // Throttle last_active_at write to at most once every 2 hours to avoid write churn
      const lastActive = userSnap.exists() ? (userSnap.data() as any)?.last_active_at : null;
      const lastActiveTime = lastActive?.toMillis ? lastActive.toMillis() : lastActive ? new Date(lastActive).getTime() : 0;
      if (!lastActiveTime || Date.now() - lastActiveTime > 2 * 60 * 60 * 1000) {
        updateDoc(userRef, { last_active_at: serverTimestamp() }).catch(() => {});
      }
    } catch (e) {
      console.warn('Could not sync Firestore user profile:', e);
      if (!this.currentUser) {
        this.currentUser = defaultUser;
      }
    } finally {
      this.isSyncing = false;
      this.persist();
      this.notify();
      this.attachFirestoreListeners();
    }

    return this.currentUser || defaultUser;
  }

  private attachFirestoreListeners() {
    this.clearFirestoreListeners();
    if (!db || !this.currentUser) return;

    const currentUserId = this.currentUser.id;
    const currentGroupId = this.currentUser.current_group_id;

    // Immediately isolate in-memory state to the active group
    if (currentGroupId) {
      this.courses = this.courses.filter((c) => c.group_id === currentGroupId);
      this.updates = this.updates.filter((u) => u.group_id === currentGroupId);
      this.views = this.views.filter((v) => !v.update_id || this.updates.some((u) => u.id === v.update_id));
      this.members = this.members.filter((m) => m.group_id === currentGroupId);
      this.requests = this.requests.filter((r) => r.group_id === currentGroupId);
    } else {
      this.courses = [];
      this.updates = [];
      this.views = [];
      this.members = [];
      this.requests = [];
    }

    // Listen to current user document
    try {
      const userUnsub = onSnapshot(
        doc(db, 'users', currentUserId),
        async (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data() as User;
            if (this.currentUser && this.currentUser.id === currentUserId) {
              const previousGroupId = this.currentUser.current_group_id;
              const newGroupId = data.current_group_id ?? null;
              this.currentUser.role = data.role || this.currentUser.role;
              this.currentUser.current_group_id = newGroupId;
              if (data.has_seen_free_access_offer !== undefined) {
                this.currentUser.has_seen_free_access_offer = Boolean(data.has_seen_free_access_offer);
              }

              if (previousGroupId !== newGroupId) {
                // Active group has changed -> proactively fetch new group document if not in memory
                if (newGroupId && db) {
                  const existing = this.groups.find((g) => g.id === newGroupId);
                  if (!existing) {
                    try {
                      const gSnap = await getDoc(doc(db, 'groups', newGroupId));
                      if (gSnap.exists()) {
                        const gData = { id: gSnap.id, ...gSnap.data() } as Group;
                        const idx = this.groups.findIndex((g) => g.id === newGroupId);
                        if (idx >= 0) this.groups[idx] = gData;
                        else this.groups.push(gData);
                      }
                    } catch (err) {
                      console.warn('[Firestore] Failed to fetch new group doc:', err);
                    }
                  }
                }
                this.attachFirestoreListeners();
              } else {
                this.persist();
                this.notify();
              }
            }
          }
        },
        (error) => {
          console.warn('[Firestore] User listener error:', error);
        }
      );
      this.firestoreUnsubscribers.push(userUnsub);
    } catch (e) {
      console.warn('[Firestore] Failed to attach user listener:', e);
    }

    // If user belongs to a group, listen to group-scoped collections
    if (currentGroupId) {
      // 1. Group Document
      try {
        const groupUnsub = onSnapshot(
          doc(db, 'groups', currentGroupId),
          (docSnap) => {
            if (docSnap.exists()) {
              const g = { id: docSnap.id, ...docSnap.data() } as Group;
              const idx = this.groups.findIndex((item) => item.id === g.id);
              if (idx >= 0) this.groups[idx] = g;
              else this.groups.push(g);
              this.persist();
              this.notify();
            } else {
              // Group was deleted on the server by the CR
              this.groups = this.groups.filter((item) => item.id !== currentGroupId);
              if (this.currentUser && this.currentUser.current_group_id === currentGroupId) {
                this.currentUser.current_group_id = null;
                this.currentUser.role = 'student';
                if (db) {
                  updateDoc(doc(db, 'users', this.currentUser.id), { current_group_id: null, role: 'student' }).catch(() => {});
                }
              }
              this.courses = [];
              this.updates = [];
              this.views = [];
              this.members = [];
              this.requests = [];
              this.persist();
              this.clearFirestoreListeners();
              this.notify();
            }
          },
          (error) => {
            console.warn('[Firestore] Group listener error:', error);
          }
        );
        this.firestoreUnsubscribers.push(groupUnsub);
      } catch (e) {
        console.warn('[Firestore] Failed to attach group listener:', e);
      }

      // 2. Courses
      try {
        const coursesQuery = query(collection(db, 'courses'), where('group_id', '==', currentGroupId));
        const coursesUnsub = onSnapshot(
          coursesQuery,
          (snap) => {
            const list: Course[] = [];
            snap.forEach((d) => list.push({ id: d.id, ...d.data() } as Course));
            this.courses = list;
            this.persist();
            this.notify();
          },
          (error) => {
            console.warn('[Firestore] Courses listener error:', error);
          }
        );
        this.firestoreUnsubscribers.push(coursesUnsub);
      } catch (e) {
        console.warn('[Firestore] Failed to attach courses listener:', e);
      }

      // 3. Academic Updates
      try {
        const updatesQuery = query(collection(db, 'updates'), where('group_id', '==', currentGroupId));
        const updatesUnsub = onSnapshot(
          updatesQuery,
          (snap) => {
            const list: AcademicUpdate[] = [];
            snap.forEach((d) => {
              const data = d.data();
              list.push({
                id: d.id,
                ...data,
                created_at: parseTimestampToIso(data.created_at),
                updated_at: parseTimestampToIso(data.updated_at),
              } as AcademicUpdate);
            });
            this.updates = list;
            this.persist();
            this.notify();
          },
          (error) => {
            console.warn('[Firestore] Updates listener error:', error);
          }
        );
        this.firestoreUnsubscribers.push(updatesUnsub);
      } catch (e) {
        console.warn('[Firestore] Failed to attach updates listener:', e);
      }

      // 4. Update Views
      // Students listen ONLY to their personal view receipts (scalable: ~20 docs instead of 1,500+).
      // CR fetches the full roster on-demand when opening an update detail sheet.
      try {
        const isCRUser = this.currentUser.role === 'cr';
        const viewsQuery = isCRUser
          ? query(collection(db, 'updateViews'), where('group_id', '==', currentGroupId))
          : query(
              collection(db, 'updateViews'),
              where('group_id', '==', currentGroupId),
              where('user_id', '==', currentUserId)
            );
        const viewsUnsub = onSnapshot(
          viewsQuery,
          (snap) => {
            const list: UpdateView[] = [];
            snap.forEach((d) => list.push({ id: d.id, ...d.data() } as UpdateView));
            this.views = list;
            this.persist();
            this.notify();
          },
          (error) => {
            console.warn('[Firestore] Views listener error:', error);
          }
        );
        this.firestoreUnsubscribers.push(viewsUnsub);
      } catch (e) {
        console.warn('[Firestore] Failed to attach views listener:', e);
      }

      // 5. Group Members
      try {
        const membersQuery = query(collection(db, 'groupMembers'), where('group_id', '==', currentGroupId));
        const membersUnsub = onSnapshot(
          membersQuery,
          (snap) => {
            const list: GroupMember[] = [];
            snap.forEach((d) => list.push(d.data() as GroupMember));
            this.members = list;
            this.persist();
            this.notify();
          },
          (error) => {
            console.warn('[Firestore] Members listener error:', error);
          }
        );
        this.firestoreUnsubscribers.push(membersUnsub);
      } catch (e) {
        console.warn('[Firestore] Failed to attach members listener:', e);
      }

      // 6. Join Requests (If CR)
      if (this.currentUser.role === 'cr') {
        try {
          const reqQuery = query(collection(db, 'joinRequests'), where('group_id', '==', currentGroupId));
          const reqUnsub = onSnapshot(
            reqQuery,
            (snap) => {
              const list: JoinRequest[] = [];
              snap.forEach((d) => list.push({ id: d.id, ...d.data() } as JoinRequest));
              this.requests = list;
              this.persist();
              this.notify();
            },
            (error) => {
              console.warn('[Firestore] Join requests listener error:', error);
            }
          );
          this.firestoreUnsubscribers.push(reqUnsub);
        } catch (e) {
          console.warn('[Firestore] Failed to attach join requests listener:', e);
        }
      }
    }
  }

  private clearFirestoreListeners() {
    this.firestoreUnsubscribers.forEach((unsub) => {
      try {
        unsub();
      } catch (e) {
        console.warn('[Firestore] Error unsubscribing listener:', e);
      }
    });
    this.firestoreUnsubscribers = [];
    if (this.systemStatusUnsub) {
      // Retain system listener or keep active
    }
  }

  public checkGroupExpirations() {
    let changed = false;
    this.groups.forEach((g) => {
      if (g.status === 'active' && isGroupExpired(g.expires_at)) {
        g.status = 'expired';
        changed = true;
      }
    });
    if (changed) {
      this.persist();
      this.notify();
    }
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    this.listeners.forEach((listener) => listener());
  }

  // ==========================================
  // AUTHENTICATION
  // ==========================================

  public isAuthReady(): boolean {
    return this.authReady;
  }

  public getCurrentUser(): User | null {
    return this.currentUser;
  }

  public getAuthErrorMessage(): string | null {
    return this.authErrorMessage;
  }

  public clearAuthErrorMessage() {
    this.authErrorMessage = null;
    this.notify();
  }

  public async signInWithGoogle(options?: { useRedirect?: boolean }): Promise<{ user?: User; error?: string }> {
    const authInstance = auth;
    if (!isFirebaseConfigured || !authInstance) {
      return {
        error:
          'Firebase Authentication is not configured. Please ensure VITE_FIREBASE_API_KEY, VITE_FIREBASE_PROJECT_ID, VITE_FIREBASE_AUTH_DOMAIN, and VITE_FIREBASE_APP_ID are set.',
      };
    }

    if (options?.useRedirect) {
      try {
        await signInWithRedirect(authInstance, googleProvider);
        return {};
      } catch (e: unknown) {
        const err = e as { code?: string; message?: string };
        const formattedErr = this.formatFirebaseAuthError(err);
        this.authErrorMessage = formattedErr;
        return { error: formattedErr };
      }
    }

    try {
      const cred = await signInWithPopup(authInstance, googleProvider);
      const user = cred.user;
      const email = (user.email || '').trim().toLowerCase();
      const isVerified = Boolean(user.emailVerified);

      // Strict DIU Domain & Google Email Verification Check
      if (!email || !isVerified || !isDiuEmail(email)) {
        await firebaseSignOut(authInstance).catch(() => {});
        this.currentUser = null;
        this.clearFirestoreListeners();
        this.persist();
        const accessError =
          'Access restricted: Only verified Daffodil International University Google accounts (@diu.edu.bd) are permitted. Please sign in with your official DIU account.';
        this.authErrorMessage = accessError;
        this.notify();
        return { error: accessError };
      }

      const username = extractUsernameFromEmail(email);
      const userProfile = await this.syncFirebaseUserProfile(user.uid, email, username);
      this.authErrorMessage = null;
      return { user: userProfile };
    } catch (e: unknown) {
      const err = e as { code?: string; message?: string };
      const formattedErr = this.formatFirebaseAuthError(err);
      this.authErrorMessage = formattedErr;
      return { error: formattedErr };
    }
  }

  private formatFirebaseAuthError(err: { code?: string; message?: string }): string {
    const code = err.code || '';
    const message = err.message || '';

    if (code === 'auth/popup-closed-by-user' || message.includes('auth/popup-closed-by-user')) {
      return 'Sign-in cancelled. The Google sign-in window was closed.';
    }
    if (code === 'auth/popup-blocked' || message.includes('auth/popup-blocked')) {
      return 'Popup was blocked by your browser. Please allow popups for this site or use "Sign in with redirect" below.';
    }
    if (code === 'auth/cancelled-popup-request' || message.includes('auth/cancelled-popup-request')) {
      return 'Sign-in window was closed or interrupted by another request.';
    }
    if (code === 'auth/unauthorized-domain' || message.includes('auth/unauthorized-domain')) {
      const currentHost = typeof window !== 'undefined' ? window.location.hostname : 'class-mate-woad.vercel.app';
      return `Domain "${currentHost}" is not authorized in Firebase Console. Please add "${currentHost}" under Firebase Console -> Authentication -> Settings -> Authorized domains.`;
    }
    if (code === 'auth/network-request-failed' || message.includes('auth/network-request-failed')) {
      return 'Network connection error during sign-in. Please check your internet connection.';
    }
    if (code === 'auth/operation-not-allowed' || message.includes('auth/operation-not-allowed')) {
      return 'Google sign-in provider is not enabled in Firebase Console. Please enable Google under Firebase Authentication -> Sign-in method.';
    }
    if (code === 'auth/invalid-api-key' || message.includes('auth/invalid-api-key')) {
      return 'Invalid Firebase configuration. Please check your VITE_FIREBASE_API_KEY environment variable.';
    }
    return message || 'Google authentication failed. Please try again.';
  }

  public async signOut() {
    this.currentUser = null;
    this.authErrorMessage = null;
    this.clearFirestoreListeners();
    localStorage.removeItem(STORAGE_KEYS.USER);
    const authInstance = auth;
    if (isFirebaseConfigured && authInstance) {
      await firebaseSignOut(authInstance).catch(() => {});
    }
    this.notify();
  }

  public async markFreeAccessOfferClaimed(): Promise<void> {
    if (!this.currentUser) return;
    this.currentUser.has_seen_free_access_offer = true;
    this.persist();
    this.notify();

    if (db && this.currentUser.id) {
      try {
        const userRef = doc(db, 'users', this.currentUser.id);
        await updateDoc(userRef, {
          has_seen_free_access_offer: true,
        });
      } catch (err) {
        console.warn('Could not persist free access offer claim:', err);
      }
    }
  }

  // ==========================================
  // GROUP MANAGEMENT (One Group Per User)
  // ==========================================

  public getUserHostedGroups(): Group[] {
    if (!this.currentUser) return [];
    return this.groups.filter(
      (g) => (g.original_host_id === this.currentUser!.id || g.host_id === this.currentUser!.id) && g.status === 'active'
    );
  }

  public async switchActiveGroup(groupId: string): Promise<{ success: boolean; error?: string }> {
    if (!this.currentUser) return { success: false, error: 'Not authenticated' };
    const targetGroup = this.groups.find((g) => g.id === groupId && g.status === 'active');
    if (!targetGroup) return { success: false, error: 'Class not found' };

    this.currentUser.current_group_id = targetGroup.id;
    const isTargetHost = targetGroup.original_host_id === this.currentUser.id || targetGroup.host_id === this.currentUser.id;
    this.currentUser.role = isTargetHost ? 'cr' : 'student';

    const dbInstance = db;
    if (dbInstance) {
      updateDoc(doc(dbInstance, 'users', this.currentUser.id), {
        current_group_id: targetGroup.id,
        role: this.currentUser.role,
      }).catch(() => {});
    }

    this.persist();
    this.notify();
    this.attachFirestoreListeners();
    return { success: true };
  }

  public getCurrentUserGroup(): Group | null {
    if (!this.currentUser) return null;

    const currentGroupId = this.currentUser.current_group_id;
    if (!currentGroupId) return null;

    const group = this.groups.find((g) => g.id === currentGroupId);
    if (!group || isGroupExpired(group.expires_at) || group.status === 'expired') {
      return null;
    }

    const activeMembers = this.members.filter(
      (m) => m.group_id === group.id && m.status === 'approved'
    );
    return {
      ...group,
      member_count: activeMembers.length,
    };
  }

  public async createGroup(
    name: string,
    approvalMode: ApprovalMode = 'manual'
  ): Promise<{ group?: Group; error?: string }> {
    if (!this.currentUser) {
      return { error: 'Not authenticated. Please sign in with your DIU account.' };
    }

    const nameValidation = validateClassName(name);
    if (!nameValidation.isValid) {
      return { error: nameValidation.error };
    }

    const trimmedName = nameValidation.sanitized;
    const code = generateGroupCode(6);
    const createdAt = new Date().toISOString();
    const expiresAt = calculateExpirationDate(new Date());
    const groupId = `grp-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;

    const newGroup: Group = {
      id: groupId,
      name: trimmedName,
      code,
      host_id: this.currentUser.id,
      original_host_id: this.currentUser.id,
      host_username: this.currentUser.username,
      approval_mode: approvalMode,
      created_at: createdAt,
      expires_at: expiresAt,
      status: 'active',
      member_count: 1,
    };

    const hostMember: GroupMember = {
      group_id: groupId,
      user_id: this.currentUser.id,
      joined_at: createdAt,
      status: 'approved',
      username: this.currentUser.username,
      email: this.currentUser.email,
    };

    // Persist to Firestore
    const dbInstance = db;
    if (dbInstance) {
      const userRef = doc(dbInstance, 'users', this.currentUser.id);
      const groupRef = doc(dbInstance, 'groups', groupId);
      const memberRef = doc(dbInstance, 'groupMembers', `${groupId}_${this.currentUser.id}`);

      try {
        // Ensure user document exists before attempting group creation.
        // syncFirebaseUserProfile runs in the background and may not have
        // completed yet. If the doc doesn't exist, updateDoc will fail
        // with NOT_FOUND and the security rule for create rejects role:'cr'.
        const userSnap = await getDoc(userRef);
        if (!userSnap.exists()) {
          await setDoc(userRef, {
            id: this.currentUser.id,
            email: this.currentUser.email,
            username: this.currentUser.username,
            role: 'student',
            current_group_id: null,
            created_at: serverTimestamp(),
            last_active_at: serverTimestamp(),
          });
        }

        // Phase 1: Atomically create the group + host membership.
        // These must exist before the user update so that the Firestore
        // security rule isGroupHost() can verify the group document.
        const batch = writeBatch(dbInstance);
        batch.set(groupRef, newGroup);
        batch.set(memberRef, { ...hostMember, expires_at: expiresAt });
        await batch.commit();

        // Phase 2: Update the user's profile to point to the new group.
        // Now the group document is committed and isGroupHost() will pass.
        await updateDoc(userRef, { current_group_id: groupId, role: 'cr' });
      } catch (err: unknown) {
        console.error('Firestore class creation failed:', err);
        const fireErr = err as { code?: string; message?: string };
        let userMessage: string;
        if (fireErr.code === 'permission-denied' || fireErr.message?.includes('PERMISSION_DENIED')) {
          userMessage = 'Permission denied. Please ensure you are signed in with a valid @diu.edu.bd account and try again.';
        } else if (fireErr.code === 'not-found' || fireErr.message?.includes('NOT_FOUND')) {
          userMessage = 'Your account profile was not found. Please log out, log in again, and retry.';
        } else if (fireErr.code === 'unavailable' || fireErr.message?.includes('unavailable')) {
          userMessage = 'Could not reach the server. Please check your internet connection and try again.';
        } else {
          userMessage = fireErr.message || 'Failed to create class. Please try again.';
        }
        return { error: userMessage };
      }
    }

    // Update local state upon verified Firestore write
    this.currentUser.role = 'cr';
    this.currentUser.current_group_id = groupId;

    const gIdx = this.groups.findIndex((g) => g.id === groupId);
    if (gIdx >= 0) this.groups[gIdx] = newGroup;
    else this.groups.push(newGroup);

    const mIdx = this.members.findIndex((m) => m.group_id === groupId && m.user_id === this.currentUser!.id);
    if (mIdx >= 0) this.members[mIdx] = hostMember;
    else this.members.push(hostMember);

    this.persist();
    this.notify();
    this.attachFirestoreListeners();
    return { group: newGroup };
  }

  public async joinGroupByCode(code: string): Promise<{
    group?: Group;
    status?: 'joined' | 'pending';
    isHostRecovery?: boolean;
    error?: string;
  }> {
    if (!this.currentUser) return { error: 'Not authenticated' };

    // Enforce One Group Per User
    const existingGroup = this.getCurrentUserGroup();
    if (existingGroup) {
      return {
        error: `You are already enrolled in "${existingGroup.name}". You must leave your current class before joining another.`,
      };
    }

    const codeValidation = validateText(code, {
      fieldName: 'Class code',
      maxLength: LIMITS.GROUP_CODE,
      minLength: 4,
      required: true,
    });
    if (!codeValidation.isValid) {
      return { error: codeValidation.error };
    }

    const cleanCode = codeValidation.sanitized.toUpperCase();
    let group = this.groups.find(
      (g) => g.code.toUpperCase() === cleanCode && g.status === 'active'
    );

    // Query Firestore if not already loaded in local memory
    const dbInstance = db;
    if (!group && dbInstance) {
      try {
        const q = query(
          collection(dbInstance, 'groups'),
          where('code', '==', cleanCode),
          where('status', '==', 'active')
        );
        const snap = await getDocs(q);
        if (!snap.empty) {
          const docSnap = snap.docs[0];
          group = { id: docSnap.id, ...docSnap.data() } as Group;
          const idx = this.groups.findIndex((g) => g.id === group!.id);
          if (idx >= 0) this.groups[idx] = group;
          else this.groups.push(group);
        }
      } catch (err) {
        console.warn('Failed to query group from Firestore by code:', err);
      }
    }

    if (!group) {
      return { error: 'Invalid or expired 6-character class code.' };
    }

    if (isGroupExpired(group.expires_at) || group.status === 'expired') {
      return { error: 'This class has reached its 4-month expiration.' };
    }

    // If user is already an active member in this group, do not re-request
    if (this.currentUser.current_group_id === group.id) {
      return { group, status: 'joined', isHostRecovery: false };
    }

    // Secure verification of original host identity
    const isOriginalHost =
      (group.original_host_id && group.original_host_id === this.currentUser.id) ||
      (!group.original_host_id && group.host_id === this.currentUser.id);

    if (isOriginalHost) {
      // ORIGINAL HOST RECOVERY FLOW:
      // Bypass approval, restore host membership, CR role, and permissions
      const hostMember: GroupMember = {
        group_id: group.id,
        user_id: this.currentUser.id,
        joined_at: new Date().toISOString(),
        status: 'approved',
        username: this.currentUser.username,
        email: this.currentUser.email,
      };

      if (dbInstance) {
        const userRef = doc(dbInstance, 'users', this.currentUser.id);
        const groupRef = doc(dbInstance, 'groups', group.id);
        const memberRef = doc(dbInstance, 'groupMembers', `${group.id}_${this.currentUser.id}`);
        const reqRef = doc(dbInstance, 'joinRequests', `req-${group.id}_${this.currentUser.id}`);

        try {
          // Ensure user document exists
          const userSnap = await getDoc(userRef);
          if (!userSnap.exists()) {
            await setDoc(userRef, {
              id: this.currentUser.id,
              email: this.currentUser.email,
              username: this.currentUser.username,
              role: 'student',
              current_group_id: null,
              created_at: serverTimestamp(),
              last_active_at: serverTimestamp(),
            });
          }

          // Ensure group document has original_host_id & host_id set before setting user role to CR
          // to satisfy Firestore security rule isGroupHost()
          const needsGroupUpdate =
            !group.original_host_id ||
            group.host_id !== this.currentUser.id;

          if (needsGroupUpdate) {
            await updateDoc(groupRef, {
              host_id: this.currentUser.id,
              original_host_id: group.original_host_id || this.currentUser.id,
              host_username: this.currentUser.username,
            }).catch(() => {});
          }

          const batch = writeBatch(dbInstance);
          batch.set(memberRef, { ...hostMember, expires_at: group.expires_at });
          batch.update(userRef, { current_group_id: group.id, role: 'cr' });
          batch.delete(reqRef);
          await batch.commit();
        } catch (err) {
          console.error('Failed to restore CR host membership:', err);
          const e = err as { message?: string };
          return { error: e?.message || 'Failed to restore class. Please try again.' };
        }
      }

      this.currentUser.role = 'cr';
      this.currentUser.current_group_id = group.id;
      group.host_id = this.currentUser.id;
      group.original_host_id = group.original_host_id || this.currentUser.id;

      const mIdx = this.members.findIndex((m) => m.group_id === group!.id && m.user_id === this.currentUser!.id);
      if (mIdx >= 0) this.members[mIdx] = hostMember;
      else this.members.push(hostMember);

      this.persist();
      this.notify();
      this.attachFirestoreListeners();
      return { group, status: 'joined', isHostRecovery: true };
    }

    // NORMAL STUDENT FLOW:
    if (group.approval_mode === 'auto') {
      const newMember: GroupMember = {
        group_id: group.id,
        user_id: this.currentUser.id,
        joined_at: new Date().toISOString(),
        status: 'approved',
        username: this.currentUser.username,
        email: this.currentUser.email,
      };

      if (dbInstance) {
        const userRef = doc(dbInstance, 'users', this.currentUser.id);
        const memberRef = doc(dbInstance, 'groupMembers', `${group.id}_${this.currentUser.id}`);
        const reqRef = doc(dbInstance, 'joinRequests', `req-${group.id}_${this.currentUser.id}`);
        try {
          // Ensure user doc exists (may not if background sync hasn't completed)
          const userSnap = await getDoc(userRef);
          if (!userSnap.exists()) {
            await setDoc(userRef, {
              id: this.currentUser.id,
              email: this.currentUser.email,
              username: this.currentUser.username,
              role: 'student',
              current_group_id: null,
              created_at: serverTimestamp(),
              last_active_at: serverTimestamp(),
            });
          }
          const batch = writeBatch(dbInstance);
          batch.set(memberRef, { ...newMember, expires_at: group.expires_at });
          batch.update(userRef, { current_group_id: group.id });
          batch.delete(reqRef);
          await batch.commit();
        } catch (err) {
          console.error('Failed to save group membership:', err);
          const e = err as { message?: string };
          return { error: e?.message || 'Failed to join class. Please try again.' };
        }
      }

      this.currentUser.current_group_id = group.id;
      this.currentUser.role = 'student';
      const mIdx = this.members.findIndex((m) => m.group_id === group!.id && m.user_id === this.currentUser!.id);
      if (mIdx >= 0) this.members[mIdx] = newMember;
      else this.members.push(newMember);

      this.persist();
      this.notify();
      this.attachFirestoreListeners();
      return { group, status: 'joined', isHostRecovery: false };
    } else {
      const requestId = `req-${group.id}_${this.currentUser.id}`;

      // If a pending request is already active in local memory, return cleanly
      const existingReq = this.requests.find((r) => r.id === requestId);
      if (existingReq && existingReq.status === 'pending') {
        return { group, status: 'pending', isHostRecovery: false };
      }

      const newReq: JoinRequest = {
        id: requestId,
        group_id: group.id,
        user_id: this.currentUser.id,
        status: 'pending',
        created_at: new Date().toISOString(),
        username: this.currentUser.username,
        email: this.currentUser.email,
        group_name: group.name,
      };

      const reqIdx = this.requests.findIndex((r) => r.id === requestId);
      if (reqIdx >= 0) {
        this.requests[reqIdx] = newReq;
      } else {
        this.requests.push(newReq);
      }

      if (dbInstance) {
        const reqRef = doc(dbInstance, 'joinRequests', requestId);
        await setDoc(reqRef, { ...newReq, expires_at: group.expires_at }).catch((e) =>
          console.warn('Failed to save join request:', e)
        );
      }

      this.persist();
      this.notify();
      return { group, status: 'pending', isHostRecovery: false };
    }
  }

  public leaveCurrentGroup(): { success: boolean; error?: string } {
    if (!this.currentUser) return { success: false, error: 'Not authenticated' };

    const currentGroup = this.getCurrentUserGroup();
    if (!currentGroup) return { success: false, error: 'No active class found.' };

    const userId = this.currentUser.id;
    const groupId = currentGroup.id;

    // Remove user from local active member & request lists
    this.members = this.members.filter(
      (m) => !(m.group_id === groupId && m.user_id === userId)
    );
    this.requests = this.requests.filter(
      (r) => !(r.group_id === groupId && r.user_id === userId)
    );

    this.currentUser.current_group_id = null;
    this.currentUser.role = 'student';

    const u = this.users.find((user) => user.id === userId);
    if (u) {
      u.role = 'student';
      u.current_group_id = null;
    }

    if (db) {
      const userRef = doc(db, 'users', userId);
      const memberRef = doc(db, 'groupMembers', `${groupId}_${userId}`);
      const reqRef = doc(db, 'joinRequests', `req-${groupId}_${userId}`);
      deleteDoc(memberRef).catch(() => {});
      deleteDoc(reqRef).catch(() => {});
      updateDoc(userRef, { current_group_id: null, role: 'student' }).catch(() => {});
    }

    this.courses = [];
    this.updates = [];
    this.views = [];
    this.members = [];
    this.requests = [];
    this.persist();
    this.notify();
    this.clearFirestoreListeners();
    return { success: true };
  }

  public async deleteGroup(groupId: string): Promise<{ success: boolean; error?: string }> {
    if (!this.currentUser) {
      return { success: false, error: 'You must be signed in to perform this action.' };
    }

    const currentGroup = this.groups.find((g) => g.id === groupId);
    if (!currentGroup) {
      return { success: false, error: 'Group not found.' };
    }

    // Strict Authorization: Only the CR host who owns this group can delete it
    if (currentGroup.host_id !== this.currentUser.id && currentGroup.original_host_id !== this.currentUser.id) {
      return { success: false, error: 'Unauthorized: Only the CR who created this class can delete it.' };
    }

    const currentUserId = this.currentUser.id;
    const dbInstance = db;

    if (dbInstance) {
      try {
        // Step 1: Collect all related documents across collections for this group while group is active
        const [
          coursesSnap,
          updatesSnap,
          membersSnap,
          requestsSnap,
          viewsSnap,
        ] = await Promise.all([
          getDocs(query(collection(dbInstance, 'courses'), where('group_id', '==', groupId))),
          getDocs(query(collection(dbInstance, 'updates'), where('group_id', '==', groupId))),
          getDocs(query(collection(dbInstance, 'groupMembers'), where('group_id', '==', groupId))),
          getDocs(query(collection(dbInstance, 'joinRequests'), where('group_id', '==', groupId))),
          getDocs(query(collection(dbInstance, 'updateViews'), where('group_id', '==', groupId))),
        ]);

        // Step 2: Reset members' current_group_id while group document still exists
        const memberResetPromises: Promise<any>[] = [];
        membersSnap.forEach((d) => {
          const memberData = d.data() as GroupMember;
          if (memberData && memberData.user_id && memberData.user_id !== currentUserId) {
            memberResetPromises.push(
              updateDoc(doc(dbInstance, 'users', memberData.user_id), {
                current_group_id: null,
              }).catch(() => {})
            );
          }
        });
        if (memberResetPromises.length > 0) {
          await Promise.allSettled(memberResetPromises);
        }

        // Step 3: Delete all child documents in batches while isGroupHost(groupId) is still valid
        const childDocRefs = [
          ...coursesSnap.docs.map((d) => d.ref),
          ...updatesSnap.docs.map((d) => d.ref),
          ...viewsSnap.docs.map((d) => d.ref),
          ...requestsSnap.docs.map((d) => d.ref),
          ...membersSnap.docs.map((d) => d.ref),
        ];

        // Chunk deletes to respect Firestore's batch limits (400 per batch)
        const BATCH_SIZE = 400;
        for (let i = 0; i < childDocRefs.length; i += BATCH_SIZE) {
          const chunk = childDocRefs.slice(i, i + BATCH_SIZE);
          const childBatch = writeBatch(dbInstance);
          chunk.forEach((ref) => childBatch.delete(ref));
          await childBatch.commit();
        }

        // Step 4: Delete the parent group document LAST
        await deleteDoc(doc(dbInstance, 'groups', groupId));

        // Step 5: Update the CR host's user document
        await updateDoc(doc(dbInstance, 'users', currentUserId), {
          current_group_id: null,
          role: 'student',
        }).catch(() => {});
      } catch (err: unknown) {
        console.error('Failed to delete group from Firestore:', err);
        const e = err as { message?: string };
        return {
          success: false,
          error: e.message || 'Failed to delete group from server. Please check your connection and try again.',
        };
      }
    }

    // Step 6: Clear in-memory state and local storage
    this.groups = this.groups.filter((g) => g.id !== groupId);
    this.courses = [];
    this.updates = [];
    this.members = [];
    this.requests = [];
    this.views = [];

    if (this.currentUser.current_group_id === groupId) {
      this.currentUser.current_group_id = null;
      this.currentUser.role = 'student';
    }

    const u = this.users.find((user) => user.id === currentUserId);
    if (u) {
      u.current_group_id = null;
      u.role = 'student';
    }

    this.persist();
    this.clearFirestoreListeners();
    this.notify();

    return { success: true };
  }

  public updateApprovalMode(groupId: string, mode: ApprovalMode) {
    const group = this.groups.find((g) => g.id === groupId);
    if (group && this.currentUser && (group.host_id === this.currentUser.id || group.original_host_id === this.currentUser.id)) {
      group.approval_mode = mode;
      if (db) {
        updateDoc(doc(db, 'groups', groupId), { approval_mode: mode }).catch(() => {});
      }
      this.persist();
      this.notify();
    }
  }

  public getPendingRequestsForHost(hostId: string): JoinRequest[] {
    const hostedGroups = this.groups.filter(
      (g) => (g.host_id === hostId || g.original_host_id === hostId) && g.status === 'active'
    );
    const hostedGroupIds = new Set(hostedGroups.map((g) => g.id));
    return this.requests.filter((r) => hostedGroupIds.has(r.group_id) && r.status === 'pending');
  }

  public respondToJoinRequest(requestId: string, approve: boolean): { success: boolean } {
    const req = this.requests.find((r) => r.id === requestId);
    if (!req) return { success: false };

    req.status = approve ? 'approved' : 'rejected';
    req.reviewed_at = new Date().toISOString();

    if (approve) {
      this.members.push({
        group_id: req.group_id,
        user_id: req.user_id,
        joined_at: new Date().toISOString(),
        status: 'approved',
        username: req.username,
        email: req.email,
      });

      if (db) {
        const group = this.groups.find((g) => g.id === req.group_id);
        const memberRef = doc(db, 'groupMembers', `${req.group_id}_${req.user_id}`);
        const userRef = doc(db, 'users', req.user_id);
        const reqRef = doc(db, 'joinRequests', requestId);

        setDoc(memberRef, {
          group_id: req.group_id,
          user_id: req.user_id,
          username: req.username,
          email: req.email,
          status: 'approved',
          joined_at: serverTimestamp(),
          expires_at: group?.expires_at || null,
        }).catch(() => {});

        updateDoc(userRef, { current_group_id: req.group_id }).catch(() => {});
        updateDoc(reqRef, { status: 'approved', reviewed_at: serverTimestamp() }).catch(() => {});
      }
    } else if (db) {
      updateDoc(doc(db, 'joinRequests', requestId), {
        status: 'rejected',
        reviewed_at: serverTimestamp(),
      }).catch(() => {});
    }

    this.persist();
    this.notify();
    return { success: true };
  }

  // ==========================================
  // COURSES MANAGEMENT
  // ==========================================

  public getCourses(groupId?: string): Course[] {
    const targetGroupId = groupId || this.getCurrentUserGroup()?.id;
    if (!targetGroupId) return [];

    return this.courses
      .filter((c) => c.group_id === targetGroupId)
      .map((c) => ({
        ...c,
        unread_count: this.getCourseUnreadCount(c.id),
      }));
  }

  public createCourse(name: string): { course?: Course; error?: string } {
    if (!this.currentUser) return { error: 'Not authenticated' };
    const currentGroup = this.getCurrentUserGroup();
    if (!currentGroup) return { error: 'No active class found.' };

    const nameValidation = validateText(name, {
      fieldName: 'Course name',
      maxLength: LIMITS.COURSE_NAME,
      required: true,
    });
    if (!nameValidation.isValid) {
      return { error: nameValidation.error };
    }

    const trimmed = nameValidation.sanitized;
    const exists = this.courses.some(
      (c) => c.group_id === currentGroup.id && c.name.toLowerCase() === trimmed.toLowerCase()
    );
    if (exists) return { error: 'A course with this name already exists in your class.' };

    const newCourse: Course = {
      id: `crs-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
      group_id: currentGroup.id,
      name: trimmed,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      unread_count: 0,
    };

    this.courses.push(newCourse);

    if (db) {
      const courseRef = doc(db, 'courses', newCourse.id);
      setDoc(courseRef, { ...newCourse, expires_at: currentGroup.expires_at }).catch(() => {});
    }

    this.persist();
    this.notify();
    return { course: newCourse };
  }

  public updateCourse(courseId: string, name: string): { course?: Course; error?: string } {
    const course = this.courses.find((c) => c.id === courseId);
    if (!course) return { error: 'Course not found.' };

    const nameValidation = validateText(name, {
      fieldName: 'Course name',
      maxLength: LIMITS.COURSE_NAME,
      required: true,
    });
    if (!nameValidation.isValid) {
      return { error: nameValidation.error };
    }

    const trimmed = nameValidation.sanitized;
    course.name = trimmed;
    course.updated_at = new Date().toISOString();

    // Denormalize into updates
    this.updates.forEach((u) => {
      if (u.course_id === courseId) {
        u.course_name = trimmed;
      }
    });

    if (db) {
      updateDoc(doc(db, 'courses', courseId), {
        name: trimmed,
        updated_at: serverTimestamp(),
      }).catch(() => {});
    }

    this.persist();
    this.notify();
    return { course };
  }

  public deleteCourse(courseId: string): { success: boolean; error?: string } {
    this.courses = this.courses.filter((c) => c.id !== courseId);
    this.updates = this.updates.filter((u) => u.course_id !== courseId);

    if (db) {
      deleteDoc(doc(db, 'courses', courseId)).catch(() => {});
    }

    this.persist();
    this.notify();
    return { success: true };
  }

  // ==========================================
  // UNREAD & VIEW TRACKING SYSTEM
  // ==========================================

  private isUserGroupHost(group: Group | null | undefined, userId: string = this.currentUser?.id || ''): boolean {
    if (!group || !userId) return false;
    return group.host_id === userId || (Boolean(group.original_host_id) && group.original_host_id === userId);
  }

  public isUpdateUnread(updateId: string): boolean {
    if (!this.currentUser) return false;
    // CR sees read state of students, does not have personal unread badges
    const currentGroup = this.getCurrentUserGroup();
    if (currentGroup && this.isUserGroupHost(currentGroup, this.currentUser.id)) {
      return false;
    }
    return !this.views.some((v) => v.update_id === updateId && v.user_id === this.currentUser!.id);
  }

  public getCategoryUpdateCount(courseId: string, category: AcademicCategory): number {
    const currentGroup = this.getCurrentUserGroup();
    if (!currentGroup) return 0;

    const normCat = (category || '').trim().toLowerCase();
    const normCourseId = (courseId || '').trim();

    return this.updates.filter((u) => {
      if (u.group_id !== currentGroup.id) return false;
      if ((u.course_id || '').trim() !== normCourseId) return false;
      const cat = (u.category || '').trim().toLowerCase();
      const sec = (u.section || '').trim().toLowerCase();
      return cat === normCat || sec === normCat;
    }).length;
  }

  public getCategoryUnreadCount(courseId: string, category: AcademicCategory): number {
    if (!this.currentUser) return 0;
    const currentGroup = this.getCurrentUserGroup();
    if (!currentGroup || this.isUserGroupHost(currentGroup, this.currentUser.id)) return 0;

    const normCat = (category || '').trim().toLowerCase();
    const normCourseId = (courseId || '').trim();

    const catUpdates = this.updates.filter(
      (u) =>
        u.group_id === currentGroup.id &&
        (u.course_id || '').trim() === normCourseId &&
        ((u.category || '').trim().toLowerCase() === normCat || (u.section || '').trim().toLowerCase() === normCat) &&
        u.status === 'pending'
    );

    return catUpdates.filter((u) => this.isUpdateUnread(u.id)).length;
  }

  public getCourseUpdateCount(courseId: string): number {
    const currentGroup = this.getCurrentUserGroup();
    if (!currentGroup) return 0;

    const normCourseId = (courseId || '').trim();
    return this.updates.filter(
      (u) => u.group_id === currentGroup.id && (u.course_id || '').trim() === normCourseId
    ).length;
  }

  public getCourseUnreadCount(courseId: string): number {
    if (!this.currentUser) return 0;
    const currentGroup = this.getCurrentUserGroup();
    if (!currentGroup || this.isUserGroupHost(currentGroup, this.currentUser.id)) return 0;

    const normCourseId = (courseId || '').trim();
    const courseUpdates = this.updates.filter(
      (u) =>
        u.group_id === currentGroup.id &&
        (u.course_id || '').trim() === normCourseId &&
        u.status === 'pending'
    );

    return courseUpdates.filter((u) => this.isUpdateUnread(u.id)).length;
  }

  public getTotalUnreadCount(): number {
    if (!this.currentUser) return 0;
    const currentGroup = this.getCurrentUserGroup();
    if (!currentGroup || this.isUserGroupHost(currentGroup, this.currentUser.id)) return 0;

    const pendingUpdates = this.updates.filter(
      (u) => u.group_id === currentGroup.id && u.status === 'pending'
    );

    return pendingUpdates.filter((u) => this.isUpdateUnread(u.id)).length;
  }

  public recordView(updateId: string) {
    if (!this.currentUser) return;
    const currentGroup = this.getCurrentUserGroup();
    if (!currentGroup) return;

    const alreadyViewed = this.views.some(
      (v) => v.update_id === updateId && v.user_id === this.currentUser!.id
    );

    if (!alreadyViewed) {
      const viewRecord: UpdateView = {
        id: `${updateId}_${this.currentUser.id}`,
        update_id: updateId,
        user_id: this.currentUser.id,
        viewed_at: new Date().toISOString(),
        username: this.currentUser.username,
        email: this.currentUser.email,
      };

      this.views.push(viewRecord);

      if (db) {
        const viewRef = doc(db, 'updateViews', `${updateId}_${this.currentUser.id}`);
        setDoc(viewRef, {
          ...viewRecord,
          group_id: currentGroup.id,
          expires_at: currentGroup.expires_at,
          viewed_at: serverTimestamp(),
        }).catch(() => {});
      }

      this.persist();
      this.notify();
    }
  }

  public async fetchRosterForUpdate(updateId: string): Promise<UpdateView[]> {
    if (!db || !this.currentUser) return [];
    try {
      const q = query(
        collection(db, 'updateViews'),
        where('update_id', '==', updateId)
      );
      const snap = await getDocs(q);
      const list: UpdateView[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() } as UpdateView));
      // Merge into local views cache
      list.forEach((v) => {
        const idx = this.views.findIndex((item) => item.id === v.id);
        if (idx >= 0) this.views[idx] = v;
        else this.views.push(v);
      });
      this.persist();
      this.notify();
      return list;
    } catch (err) {
      console.warn('Failed to fetch update views roster:', err);
      return [];
    }
  }

  public getViewTrackingRoster(updateId: string, remoteViews?: UpdateView[]): {
    viewCount: number;
    totalCount: number;
    viewed: string[];
    notViewed: string[];
  } {
    const currentGroup = this.getCurrentUserGroup();
    if (!currentGroup) return { viewCount: 0, totalCount: 0, viewed: [], notViewed: [] };

    const studentMembers = this.members.filter(
      (m) => m.group_id === currentGroup.id && m.status === 'approved' && !this.isUserGroupHost(currentGroup, m.user_id)
    );

    const viewsSource = remoteViews && remoteViews.length > 0 ? remoteViews : this.views;
    const updateViews = viewsSource.filter((v) => v.update_id === updateId);
    const viewedUserIds = new Set(updateViews.map((v) => v.user_id));

    const viewed: string[] = [];
    const notViewed: string[] = [];

    studentMembers.forEach((m) => {
      const label = m.username || m.user_id;
      if (viewedUserIds.has(m.user_id)) {
        viewed.push(label);
      } else {
        notViewed.push(label);
      }
    });

    return {
      viewCount: viewed.length,
      totalCount: studentMembers.length,
      viewed,
      notViewed,
    };
  }

  // ==========================================
  // ACADEMIC UPDATES / ANNOUNCEMENTS CRUD
  // ==========================================

  public getAcademicUpdates(courseId?: string, category?: AcademicCategory): AcademicUpdate[] {
    const currentGroup = this.getCurrentUserGroup();
    if (!currentGroup) return [];

    let list = this.updates.filter((u) => u.group_id === currentGroup.id);

    if (courseId) {
      const normCourseId = courseId.trim();
      list = list.filter((u) => (u.course_id || '').trim() === normCourseId);
    }

    if (category) {
      const normCat = category.trim().toLowerCase();
      list = list.filter((u) => {
        const cat = (u.category || '').trim().toLowerCase();
        const sec = (u.section || '').trim().toLowerCase();
        return cat === normCat || sec === normCat;
      });
    }

    const studentMembers = this.members.filter(
      (m) => m.group_id === currentGroup.id && m.status === 'approved' && !this.isUserGroupHost(currentGroup, m.user_id)
    );

    return list
      .map((u) => {
        const views = this.views.filter((v) => v.update_id === u.id);
        const viewedStudentViews = views.filter((v) => !this.isUserGroupHost(currentGroup, v.user_id));
        return {
          ...u,
          unread: this.isUpdateUnread(u.id),
          view_count: viewedStudentViews.length,
          total_members: studentMembers.length,
        };
      })
      .sort((a, b) => {
        // Pending first, then by created_at desc
        if (a.status === 'pending' && b.status !== 'pending') return -1;
        if (a.status !== 'pending' && b.status === 'pending') return 1;
        const timeA = new Date(a.created_at).getTime() || 0;
        const timeB = new Date(b.created_at).getTime() || 0;
        return timeB - timeA;
      });
  }

  public async createAcademicUpdate(data: {
    course_id: string;
    category: AcademicCategory;
    title: string;
    date: string;
    time: string;
    topic?: string;
    description?: string;
    resource_url?: string;
    status?: UpdateStatus;
  }): Promise<{ update?: AcademicUpdate; error?: string }> {
    if (!this.currentUser) return { error: 'Not authenticated' };
    const currentGroup = this.getCurrentUserGroup();
    if (!currentGroup) return { error: 'No active class found.' };

    const titleValidation = validateText(data.title, {
      fieldName: 'Title',
      maxLength: LIMITS.ANNOUNCEMENT_TITLE,
      required: true,
    });
    if (!titleValidation.isValid) return { error: titleValidation.error };

    const dateValidation = validateText(data.date, {
      fieldName: 'Date',
      maxLength: LIMITS.DATE,
      required: true,
    });
    if (!dateValidation.isValid) return { error: dateValidation.error };

    const timeValidation = validateText(data.time, {
      fieldName: 'Time',
      maxLength: LIMITS.TIME,
      required: false,
    });
    if (!timeValidation.isValid) return { error: timeValidation.error };

    const topicValidation = validateText(data.topic, {
      fieldName: 'Topic / Syllabus',
      maxLength: LIMITS.ANNOUNCEMENT_TOPIC,
      required: false,
    });
    if (!topicValidation.isValid) return { error: topicValidation.error };

    const descValidation = validateText(data.description, {
      fieldName: 'Description',
      maxLength: LIMITS.ANNOUNCEMENT_DESCRIPTION,
      required: false,
    });
    if (!descValidation.isValid) return { error: descValidation.error };

    const urlValidation = validateUrl(data.resource_url, 'Resource Link');
    if (!urlValidation.isValid) return { error: urlValidation.error };

    const course = this.courses.find((c) => c.id === data.course_id);
    const courseName = course ? course.name : 'Academic Update';

    const updateId = `upd-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
    const cleanTitle = titleValidation.sanitized;
    const cleanDate = dateValidation.sanitized;
    const cleanTime = timeValidation.sanitized || 'TBA';
    const cleanTopic = topicValidation.sanitized || undefined;
    const cleanDesc = descValidation.sanitized || undefined;
    const cleanUrl = urlValidation.sanitized || undefined;

    const newUpdate: AcademicUpdate = {
      id: updateId,
      group_id: currentGroup.id,
      course_id: data.course_id,
      host_id: this.currentUser.id,
      category: data.category,
      section: data.category,
      course_name: courseName,
      title: cleanTitle,
      date: cleanDate,
      time: cleanTime,
      topic: cleanTopic,
      description: cleanDesc,
      resource_url: cleanUrl,
      status: data.status || 'pending',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      unread: true,
    };

    if (db) {
      const updateRef = doc(db, 'updates', newUpdate.id);
      const firestorePayload = sanitizeForFirestore({
        id: newUpdate.id,
        group_id: newUpdate.group_id,
        course_id: newUpdate.course_id,
        host_id: newUpdate.host_id,
        category: newUpdate.category,
        section: newUpdate.section,
        course_name: newUpdate.course_name,
        title: newUpdate.title,
        date: newUpdate.date,
        time: newUpdate.time,
        topic: cleanTopic || '',
        description: cleanDesc || '',
        resource_url: cleanUrl || '',
        status: newUpdate.status,
        expires_at: currentGroup.expires_at,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      });

      try {
        await setDoc(updateRef, firestorePayload);

        // Dispatch push notification to approved class members in background
        dispatchUpdateNotification({
          updateId: newUpdate.id,
          groupId: currentGroup.id,
          courseName: courseName,
          category: newUpdate.category,
          title: newUpdate.title,
          date: newUpdate.date,
          time: newUpdate.time,
        }).catch((err) => console.warn('[FCM Notification] Dispatch error:', err));
      } catch (err: unknown) {
        console.error('[Firestore Error] Failed to create update in updates collection:', err);
        const fireErr = err as { code?: string; message?: string };
        let errorMessage = 'Failed to post academic update to Firestore.';

        if (fireErr.code === 'permission-denied' || fireErr.message?.includes('PERMISSION_DENIED')) {
          errorMessage = 'Permission denied: Only the CR host of this group can post updates.';
        } else if (fireErr.code === 'unauthenticated' || fireErr.message?.includes('unauthenticated')) {
          errorMessage = 'Unauthenticated: Please log in again with your DIU account.';
        } else if (fireErr.code === 'invalid-argument' || fireErr.message?.includes('invalid-argument')) {
          errorMessage = `Invalid update payload argument: ${fireErr.message}`;
        } else if (fireErr.code === 'unavailable' || fireErr.message?.includes('unavailable')) {
          errorMessage = 'Server unavailable. Please check your internet connection.';
        } else if (fireErr.message) {
          errorMessage = fireErr.message;
        }

        return { error: errorMessage };
      }
    }

    this.updates.unshift(newUpdate);
    this.persist();
    this.notify();
    return { update: newUpdate };
  }

  public async updateAcademicUpdate(
    id: string,
    data: Partial<AcademicUpdate>
  ): Promise<{ update?: AcademicUpdate; error?: string }> {
    const update = this.updates.find((u) => u.id === id);
    if (!update) return { error: 'Update not found.' };

    const currentGroup = this.getCurrentUserGroup();
    if (!currentGroup) return { error: 'No active class found.' };

    let cleanTitle = update.title;
    if (data.title !== undefined) {
      const titleVal = validateText(data.title, {
        fieldName: 'Title',
        maxLength: LIMITS.ANNOUNCEMENT_TITLE,
        required: true,
      });
      if (!titleVal.isValid) return { error: titleVal.error };
      cleanTitle = titleVal.sanitized;
    }

    let cleanDate = update.date;
    if (data.date !== undefined) {
      const dateVal = validateText(data.date, {
        fieldName: 'Date',
        maxLength: LIMITS.DATE,
        required: true,
      });
      if (!dateVal.isValid) return { error: dateVal.error };
      cleanDate = dateVal.sanitized;
    }

    let cleanTime = update.time;
    if (data.time !== undefined) {
      const timeVal = validateText(data.time, {
        fieldName: 'Time',
        maxLength: LIMITS.TIME,
        required: false,
      });
      if (!timeVal.isValid) return { error: timeVal.error };
      cleanTime = timeVal.sanitized || 'TBA';
    }

    let cleanTopic = update.topic;
    if (data.topic !== undefined) {
      const topicVal = validateText(data.topic, {
        fieldName: 'Topic / Syllabus',
        maxLength: LIMITS.ANNOUNCEMENT_TOPIC,
        required: false,
      });
      if (!topicVal.isValid) return { error: topicVal.error };
      cleanTopic = topicVal.sanitized || undefined;
    }

    let cleanDesc = update.description;
    if (data.description !== undefined) {
      const descVal = validateText(data.description, {
        fieldName: 'Description',
        maxLength: LIMITS.ANNOUNCEMENT_DESCRIPTION,
        required: false,
      });
      if (!descVal.isValid) return { error: descVal.error };
      cleanDesc = descVal.sanitized || undefined;
    }

    let cleanUrl = update.resource_url;
    if (data.resource_url !== undefined) {
      const urlVal = validateUrl(data.resource_url, 'Resource Link');
      if (!urlVal.isValid) return { error: urlVal.error };
      cleanUrl = urlVal.sanitized || undefined;
    }

    let newCourseName = update.course_name;
    if (data.course_id && data.course_id !== update.course_id) {
      const course = this.courses.find((c) => c.id === data.course_id);
      if (course) newCourseName = course.name;
    }

    if (db) {
      const payload: Record<string, any> = {
        updated_at: serverTimestamp(),
      };

      if (data.course_id) {
        payload.course_id = data.course_id;
        payload.course_name = newCourseName;
      }
      if (data.category) {
        payload.category = data.category;
        payload.section = data.category;
      }
      if (data.title !== undefined) payload.title = cleanTitle;
      if (data.date !== undefined) payload.date = cleanDate;
      if (data.time !== undefined) payload.time = cleanTime;
      if (data.topic !== undefined) payload.topic = cleanTopic || '';
      if (data.description !== undefined) payload.description = cleanDesc || '';
      if (data.resource_url !== undefined) payload.resource_url = cleanUrl || '';
      if (data.status) payload.status = data.status;

      const cleanPayload = sanitizeForFirestore(payload);

      try {
        await updateDoc(doc(db, 'updates', id), cleanPayload);
      } catch (err: unknown) {
        console.error('[Firestore Error] Failed to update academic update:', err);
        const fireErr = err as { code?: string; message?: string };
        let errorMessage = 'Failed to update announcement in Firestore.';

        if (fireErr.code === 'permission-denied' || fireErr.message?.includes('PERMISSION_DENIED')) {
          errorMessage = 'Permission denied: Only the CR host of this group can edit updates.';
        } else if (fireErr.message) {
          errorMessage = fireErr.message;
        }

        return { error: errorMessage };
      }
    }

    if (data.course_id && data.course_id !== update.course_id) {
      update.course_id = data.course_id;
      update.course_name = newCourseName;
    }
    if (data.category) {
      update.category = data.category;
      update.section = data.category;
    }
    if (data.title !== undefined) update.title = cleanTitle;
    if (data.date !== undefined) update.date = cleanDate;
    if (data.time !== undefined) update.time = cleanTime;
    if (data.topic !== undefined) update.topic = cleanTopic;
    if (data.description !== undefined) update.description = cleanDesc;
    if (data.resource_url !== undefined) update.resource_url = cleanUrl;
    if (data.status) update.status = data.status;

    update.updated_at = new Date().toISOString();

    this.persist();
    this.notify();
    return { update };
  }

  public async deleteAcademicUpdate(id: string): Promise<{ success: boolean; error?: string }> {
    if (db) {
      try {
        await deleteDoc(doc(db, 'updates', id));
      } catch (err: unknown) {
        console.error('[Firestore Error] Failed to delete academic update:', err);
        const fireErr = err as { code?: string; message?: string };
        return {
          success: false,
          error: fireErr.message || 'Failed to delete update from Firestore.',
        };
      }
    }

    this.updates = this.updates.filter((u) => u.id !== id);
    this.views = this.views.filter((v) => v.update_id !== id);

    this.persist();
    this.notify();
    return { success: true };
  }

  // ==========================================
  // FCM DEVICE TOKEN MANAGEMENT
  // ==========================================

  public saveUserFcmToken(token: string) {
    if (!this.currentUser) return;
    try {
      const tokensMap = JSON.parse(localStorage.getItem(STORAGE_KEYS.FCM_TOKENS) || '{}');
      tokensMap[this.currentUser.id] = {
        token,
        updated_at: new Date().toISOString(),
      };
      localStorage.setItem(STORAGE_KEYS.FCM_TOKENS, JSON.stringify(tokensMap));

      if (db) {
        const deviceDocId = `${this.currentUser.id}_${token.substring(0, 12)}`;
        const deviceRef = doc(db, 'devices', deviceDocId);
        setDoc(deviceRef, {
          user_id: this.currentUser.id,
          group_id: this.currentUser.current_group_id || null,
          fcm_token: token,
          device_type: 'web',
          user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
          updated_at: serverTimestamp(),
        }).catch(() => {});
      }
    } catch {}
  }

  public getUserFcmToken(): string | null {
    if (!this.currentUser) return null;
    try {
      const tokensMap = JSON.parse(localStorage.getItem(STORAGE_KEYS.FCM_TOKENS) || '{}');
      return tokensMap[this.currentUser.id]?.token || null;
    } catch {
      return null;
    }
  }

  // ==========================================
  // SYSTEM AVAILABILITY & SHUTDOWN STATUS
  // ==========================================

  private initSystemStatusListener() {
    const dbInstance = db;
    if (!dbInstance) return;

    try {
      const configRef = doc(dbInstance, 'appConfig', 'system');
      this.systemStatusUnsub = onSnapshot(
        configRef,
        (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.data();
            this.isShutdown = Boolean(data.isShutdown);
            this.shutdownMessage =
              data.shutdownMessage ||
              'Class Mate is temporarily unavailable for maintenance. Please try again later.';
            this.scheduledStart = data.scheduledStart || null;
            this.scheduledEnd = data.scheduledEnd || null;
          } else {
            this.isShutdown = false;
            this.scheduledStart = null;
            this.scheduledEnd = null;
          }
          this.notify();
        },
        (error) => {
          // Fail-safe: if permission or temporary network glitch occurs, do NOT lock out users
          console.warn('System status listener notice (failing safely to ONLINE):', error);
        }
      );
    } catch (e) {
      console.warn('Could not initialize system status listener:', e);
    }
  }

  public isAppShutdown(): boolean {
    if (this.isShutdown) return true;
    if (this.scheduledStart && this.scheduledEnd) {
      const now = Date.now();
      const start = new Date(this.scheduledStart).getTime();
      const end = new Date(this.scheduledEnd).getTime();
      if (!isNaN(start) && !isNaN(end) && now >= start && now <= end) {
        return true;
      }
    }
    return false;
  }

  public getShutdownMessage(): string {
    return this.shutdownMessage;
  }

  public async checkSystemStatusNow(): Promise<boolean> {
    const dbInstance = db;
    if (!dbInstance) return false;
    try {
      const configRef = doc(dbInstance, 'appConfig', 'system');
      const snap = await getDoc(configRef);
      if (snap.exists()) {
        const data = snap.data();
        this.isShutdown = Boolean(data.isShutdown);
        this.shutdownMessage =
          data.shutdownMessage ||
          'Class Mate is temporarily unavailable for maintenance. Please try again later.';
        this.scheduledStart = data.scheduledStart || null;
        this.scheduledEnd = data.scheduledEnd || null;
        this.notify();
      }
    } catch {}
    return this.isAppShutdown();
  }
}

export const store = new AppStore();

