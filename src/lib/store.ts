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
  private listeners: Set<() => void> = new Set();
  private firestoreUnsubscribers: (() => void)[] = [];

  constructor() {
    this.loadFromStorage();
    this.checkGroupExpirations();
    this.initFirebaseAuthListener();
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

      if (!userSnap.exists()) {
        await setDoc(userRef, {
          ...defaultUser,
          created_at: serverTimestamp(),
          last_active_at: serverTimestamp(),
        });
        this.currentUser = defaultUser;
      } else {
        const data = userSnap.data() as Partial<User>;
        currentGroupId = data.current_group_id || null;
        userRole = data.role || 'student';
      }

      // If current_group_id is null on user doc, check in parallel whether user is host or approved member
      if (!currentGroupId) {
        const [hostGroupsSnap, memberSnap] = await Promise.all([
          getDocs(
            query(collection(dbInstance, 'groups'), where('host_id', '==', uid), where('status', '==', 'active'))
          ).catch(() => null),
          getDocs(
            query(collection(dbInstance, 'groupMembers'), where('user_id', '==', uid), where('status', '==', 'approved'))
          ).catch(() => null),
        ]);

        if (hostGroupsSnap && !hostGroupsSnap.empty) {
          const groupDoc = hostGroupsSnap.docs[0];
          currentGroupId = groupDoc.id;
          userRole = 'cr';
          const groupData = { id: groupDoc.id, ...groupDoc.data() } as Group;
          const gIdx = this.groups.findIndex((g) => g.id === groupDoc.id);
          if (gIdx >= 0) this.groups[gIdx] = groupData;
          else this.groups.push(groupData);
          updateDoc(userRef, { current_group_id: currentGroupId, role: 'cr' }).catch(() => {});
        } else if (memberSnap && !memberSnap.empty) {
          const mData = memberSnap.docs[0].data() as GroupMember;
          currentGroupId = mData.group_id;
          updateDoc(userRef, { current_group_id: currentGroupId }).catch(() => {});
        }
      }

      this.currentUser = {
        id: uid,
        email,
        username,
        role: userRole,
        current_group_id: currentGroupId,
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

    const currentGroupId = this.currentUser.current_group_id;

    // Listen to current user document
    const userUnsub = onSnapshot(doc(db, 'users', this.currentUser.id), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as User;
        if (this.currentUser) {
          this.currentUser.role = data.role || this.currentUser.role;
          this.currentUser.current_group_id = data.current_group_id ?? null;
          this.persist();
          this.notify();
        }
      }
    });
    this.firestoreUnsubscribers.push(userUnsub);

    // If user belongs to a group, listen to group-scoped collections
    if (currentGroupId) {
      // 1. Group Document
      const groupUnsub = onSnapshot(doc(db, 'groups', currentGroupId), (docSnap) => {
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
      });
      this.firestoreUnsubscribers.push(groupUnsub);

      // 2. Courses
      const coursesQuery = query(collection(db, 'courses'), where('group_id', '==', currentGroupId));
      const coursesUnsub = onSnapshot(coursesQuery, (snap) => {
        const list: Course[] = [];
        snap.forEach((d) => list.push({ id: d.id, ...d.data() } as Course));
        this.courses = list;
        this.persist();
        this.notify();
      });
      this.firestoreUnsubscribers.push(coursesUnsub);

      // 3. Academic Updates
      const updatesQuery = query(collection(db, 'updates'), where('group_id', '==', currentGroupId));
      const updatesUnsub = onSnapshot(updatesQuery, (snap) => {
        const list: AcademicUpdate[] = [];
        snap.forEach((d) => list.push({ id: d.id, ...d.data() } as AcademicUpdate));
        this.updates = list;
        this.persist();
        this.notify();
      });
      this.firestoreUnsubscribers.push(updatesUnsub);

      // 4. Update Views
      // Students listen ONLY to their personal view receipts (scalable: ~20 docs instead of 1,500+).
      // CR fetches the full roster on-demand when opening an update detail sheet.
      const isCRUser = this.currentUser.role === 'cr';
      const viewsQuery = isCRUser
        ? query(collection(db, 'updateViews'), where('group_id', '==', currentGroupId))
        : query(
            collection(db, 'updateViews'),
            where('group_id', '==', currentGroupId),
            where('user_id', '==', this.currentUser.id)
          );
      const viewsUnsub = onSnapshot(viewsQuery, (snap) => {
        const list: UpdateView[] = [];
        snap.forEach((d) => list.push({ id: d.id, ...d.data() } as UpdateView));
        this.views = list;
        this.persist();
        this.notify();
      });
      this.firestoreUnsubscribers.push(viewsUnsub);

      // 5. Group Members
      const membersQuery = query(collection(db, 'groupMembers'), where('group_id', '==', currentGroupId));
      const membersUnsub = onSnapshot(membersQuery, (snap) => {
        const list: GroupMember[] = [];
        snap.forEach((d) => list.push(d.data() as GroupMember));
        this.members = list;
        this.persist();
        this.notify();
      });
      this.firestoreUnsubscribers.push(membersUnsub);

      // 6. Join Requests (If CR)
      if (this.currentUser.role === 'cr') {
        const reqQuery = query(collection(db, 'joinRequests'), where('group_id', '==', currentGroupId));
        const reqUnsub = onSnapshot(reqQuery, (snap) => {
          const list: JoinRequest[] = [];
          snap.forEach((d) => list.push({ id: d.id, ...d.data() } as JoinRequest));
          this.requests = list;
          this.persist();
          this.notify();
        });
        this.firestoreUnsubscribers.push(reqUnsub);
      }
    }
  }

  private clearFirestoreListeners() {
    this.firestoreUnsubscribers.forEach((unsub) => unsub());
    this.firestoreUnsubscribers = [];
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

  // ==========================================
  // GROUP MANAGEMENT (One Group Per User)
  // ==========================================

  public getUserHostedGroups(): Group[] {
    if (!this.currentUser) return [];
    return this.groups.filter((g) => g.host_id === this.currentUser!.id && g.status === 'active');
  }

  public async switchActiveGroup(groupId: string): Promise<{ success: boolean; error?: string }> {
    if (!this.currentUser) return { success: false, error: 'Not authenticated' };
    const targetGroup = this.groups.find((g) => g.id === groupId && g.status === 'active');
    if (!targetGroup) return { success: false, error: 'Class not found' };

    this.currentUser.current_group_id = targetGroup.id;
    this.currentUser.role = targetGroup.host_id === this.currentUser.id ? 'cr' : 'student';

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
    approvalMode: ApprovalMode = 'auto'
  ): Promise<{ group?: Group; error?: string }> {
    if (!this.currentUser) {
      return { error: 'Not authenticated. Please sign in with your DIU account.' };
    }

    const trimmedName = name.trim();
    if (trimmedName.length < 3) {
      return { error: 'Class name must be at least 3 characters long.' };
    }

    const code = generateGroupCode(6);
    const createdAt = new Date().toISOString();
    const expiresAt = calculateExpirationDate(new Date());
    const groupId = `grp-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;

    const newGroup: Group = {
      id: groupId,
      name: trimmedName,
      code,
      host_id: this.currentUser.id,
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

    const cleanCode = code.trim().toUpperCase();
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

    if (isGroupExpired(group.expires_at)) {
      return { error: 'This class has reached its 4-month expiration.' };
    }

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
          await setDoc(memberRef, { ...newMember, expires_at: group.expires_at });
          await updateDoc(userRef, { current_group_id: group.id });
        } catch (err) {
          console.error('Failed to save group membership:', err);
          const e = err as { message?: string };
          return { error: e?.message || 'Failed to join class. Please try again.' };
        }
      }

      this.currentUser.current_group_id = group.id;
      this.members.push(newMember);

      this.persist();
      this.notify();
      this.attachFirestoreListeners();
      return { group, status: 'joined' };
    } else {
      const requestId = `req-${group.id}_${this.currentUser.id}`;
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

      this.requests.push(newReq);

      if (dbInstance) {
        const reqRef = doc(dbInstance, 'joinRequests', requestId);
        await setDoc(reqRef, { ...newReq, expires_at: group.expires_at }).catch((e) =>
          console.warn('Failed to save join request:', e)
        );
      }

      this.persist();
      this.notify();
      return { group, status: 'pending' };
    }
  }

  public leaveCurrentGroup(): { success: boolean; error?: string } {
    if (!this.currentUser) return { success: false, error: 'Not authenticated' };

    const currentGroup = this.getCurrentUserGroup();
    if (!currentGroup) return { success: false, error: 'No active class found.' };

    const userId = this.currentUser.id;
    const groupId = currentGroup.id;

    this.members = this.members.filter(
      (m) => !(m.group_id === groupId && m.user_id === userId)
    );

    this.currentUser.current_group_id = null;

    if (currentGroup.host_id === userId) {
      currentGroup.status = 'archived';
      this.currentUser.role = 'student';
      const u = this.users.find((user) => user.id === userId);
      if (u) {
        u.role = 'student';
        u.current_group_id = null;
      }
    }

    if (db) {
      const userRef = doc(db, 'users', userId);
      const memberRef = doc(db, 'groupMembers', `${groupId}_${userId}`);
      deleteDoc(memberRef).catch(() => {});
      updateDoc(userRef, { current_group_id: null, role: this.currentUser.role }).catch(() => {});

      if (currentGroup.host_id === userId) {
        const groupRef = doc(db, 'groups', groupId);
        updateDoc(groupRef, { status: 'archived' }).catch(() => {});
      }
    }

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
    if (currentGroup.host_id !== this.currentUser.id) {
      return { success: false, error: 'Unauthorized: Only the CR who created this class can delete it.' };
    }

    const currentUserId = this.currentUser.id;

    const dbInstance = db;
    if (dbInstance) {
      try {
        // Collect all related documents across collections for this group
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

        // Batch delete child documents and reset member profiles
        const batch = writeBatch(dbInstance);

        coursesSnap.forEach((d) => batch.delete(d.ref));
        updatesSnap.forEach((d) => batch.delete(d.ref));
        membersSnap.forEach((d) => {
          const memberData = d.data() as GroupMember;
          if (memberData && memberData.user_id && memberData.user_id !== currentUserId) {
            batch.update(doc(dbInstance, 'users', memberData.user_id), {
              current_group_id: null,
            });
          }
          batch.delete(d.ref);
        });
        requestsSnap.forEach((d) => batch.delete(d.ref));
        viewsSnap.forEach((d) => batch.delete(d.ref));

        // Delete parent group document
        batch.delete(doc(dbInstance, 'groups', groupId));

        // Update CR's user document
        batch.update(doc(dbInstance, 'users', currentUserId), {
          current_group_id: null,
          role: 'student',
        });

        await batch.commit();
      } catch (err: unknown) {
        console.error('Failed to delete group from Firestore:', err);
        const e = err as { message?: string };
        return {
          success: false,
          error: e.message || 'Failed to delete group from server. Please check your connection and try again.',
        };
      }
    }

    // Update local state and memory store
    this.groups = this.groups.filter((g) => g.id !== groupId);
    this.courses = this.courses.filter((c) => c.group_id !== groupId);
    this.updates = this.updates.filter((u) => u.group_id !== groupId);
    this.members = this.members.filter((m) => m.group_id !== groupId);
    this.requests = this.requests.filter((r) => r.group_id !== groupId);
    this.views = this.views.filter((v) => !v.update_id || this.updates.some((u) => u.id === v.update_id));

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
    if (group && this.currentUser && group.host_id === this.currentUser.id) {
      group.approval_mode = mode;
      if (db) {
        updateDoc(doc(db, 'groups', groupId), { approval_mode: mode }).catch(() => {});
      }
      this.persist();
      this.notify();
    }
  }

  public getPendingRequestsForHost(hostId: string): JoinRequest[] {
    const hostedGroups = this.groups.filter((g) => g.host_id === hostId && g.status === 'active');
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

    const trimmed = name.trim();
    if (!trimmed) return { error: 'Course name is required.' };

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

    const trimmed = name.trim();
    if (!trimmed) return { error: 'Course name cannot be empty.' };

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

  public isUpdateUnread(updateId: string): boolean {
    if (!this.currentUser) return false;
    // CR sees read state of students, does not have personal unread badges
    const currentGroup = this.getCurrentUserGroup();
    if (currentGroup && currentGroup.host_id === this.currentUser.id) {
      return false;
    }
    return !this.views.some((v) => v.update_id === updateId && v.user_id === this.currentUser!.id);
  }

  public getCategoryUnreadCount(courseId: string, category: AcademicCategory): number {
    if (!this.currentUser) return 0;
    const currentGroup = this.getCurrentUserGroup();
    if (!currentGroup || currentGroup.host_id === this.currentUser.id) return 0;

    const catUpdates = this.updates.filter(
      (u) =>
        u.group_id === currentGroup.id &&
        u.course_id === courseId &&
        (u.category === category || u.section === category) &&
        u.status === 'pending'
    );

    return catUpdates.filter((u) => this.isUpdateUnread(u.id)).length;
  }

  public getCourseUnreadCount(courseId: string): number {
    if (!this.currentUser) return 0;
    const currentGroup = this.getCurrentUserGroup();
    if (!currentGroup || currentGroup.host_id === this.currentUser.id) return 0;

    const courseUpdates = this.updates.filter(
      (u) => u.group_id === currentGroup.id && u.course_id === courseId && u.status === 'pending'
    );

    return courseUpdates.filter((u) => this.isUpdateUnread(u.id)).length;
  }

  public getTotalUnreadCount(): number {
    if (!this.currentUser) return 0;
    const currentGroup = this.getCurrentUserGroup();
    if (!currentGroup || currentGroup.host_id === this.currentUser.id) return 0;

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
      (m) => m.group_id === currentGroup.id && m.status === 'approved' && m.user_id !== currentGroup.host_id
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
      list = list.filter((u) => u.course_id === courseId);
    }

    if (category) {
      list = list.filter((u) => u.category === category || u.section === category);
    }

    const studentMembers = this.members.filter(
      (m) => m.group_id === currentGroup.id && m.status === 'approved' && m.user_id !== currentGroup.host_id
    );

    return list
      .map((u) => {
        const views = this.views.filter((v) => v.update_id === u.id);
        const viewedStudentViews = views.filter((v) => v.user_id !== currentGroup.host_id);
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
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
  }

  public createAcademicUpdate(data: {
    course_id: string;
    category: AcademicCategory;
    title: string;
    date: string;
    time: string;
    topic?: string;
    description?: string;
    resource_url?: string;
    status?: UpdateStatus;
  }): { update?: AcademicUpdate; error?: string } {
    if (!this.currentUser) return { error: 'Not authenticated' };
    const currentGroup = this.getCurrentUserGroup();
    if (!currentGroup) return { error: 'No active class found.' };

    const course = this.courses.find((c) => c.id === data.course_id);
    const courseName = course ? course.name : 'Academic Update';

    const newUpdate: AcademicUpdate = {
      id: `upd-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
      group_id: currentGroup.id,
      course_id: data.course_id,
      host_id: this.currentUser.id,
      category: data.category,
      section: data.category,
      course_name: courseName,
      title: data.title.trim(),
      date: data.date.trim(),
      time: data.time.trim() || 'TBA',
      topic: data.topic?.trim() || undefined,
      description: data.description?.trim() || undefined,
      resource_url: data.resource_url?.trim() || undefined,
      status: data.status || 'pending',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      unread: true,
    };

    this.updates.unshift(newUpdate);

    if (db) {
      const updateRef = doc(db, 'updates', newUpdate.id);
      setDoc(updateRef, {
        ...newUpdate,
        expires_at: currentGroup.expires_at,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      }).catch(() => {});

      // Dispatch push notification to approved class members in background
      dispatchUpdateNotification({
        updateId: newUpdate.id,
        groupId: currentGroup.id,
        courseName: courseName,
        category: newUpdate.category,
        title: newUpdate.title,
        date: newUpdate.date,
        time: newUpdate.time,
      }).catch(() => {});
    }

    this.persist();
    this.notify();
    return { update: newUpdate };
  }

  public updateAcademicUpdate(
    id: string,
    data: Partial<AcademicUpdate>
  ): { update?: AcademicUpdate; error?: string } {
    const update = this.updates.find((u) => u.id === id);
    if (!update) return { error: 'Update not found.' };

    if (data.course_id && data.course_id !== update.course_id) {
      update.course_id = data.course_id;
      const course = this.courses.find((c) => c.id === data.course_id);
      if (course) update.course_name = course.name;
    }
    if (data.category) {
      update.category = data.category;
      update.section = data.category;
    }
    if (data.title) update.title = data.title.trim();
    if (data.date) update.date = data.date.trim();
    if (data.time) update.time = data.time.trim();
    if (data.topic !== undefined) update.topic = data.topic.trim();
    if (data.description !== undefined) update.description = data.description.trim();
    if (data.resource_url !== undefined) update.resource_url = data.resource_url.trim() || undefined;
    if (data.status) update.status = data.status;

    update.updated_at = new Date().toISOString();

    if (db) {
      updateDoc(doc(db, 'updates', id), {
        ...data,
        updated_at: serverTimestamp(),
      }).catch(() => {});
    }

    this.persist();
    this.notify();
    return { update };
  }

  public deleteAcademicUpdate(id: string): { success: boolean; error?: string } {
    this.updates = this.updates.filter((u) => u.id !== id);
    this.views = this.views.filter((v) => v.update_id !== id);

    if (db) {
      deleteDoc(doc(db, 'updates', id)).catch(() => {});
    }

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
}

export const store = new AppStore();
