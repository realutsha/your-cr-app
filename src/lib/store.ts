import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  onSnapshot,
  runTransaction,
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

  private initFirebaseAuthListener() {
    const authInstance = auth;
    if (!isFirebaseConfigured || !authInstance) {
      this.authReady = true;
      this.notify();
      return;
    }

    // Process redirect sign-in result if returning from a redirect OAuth flow
    getRedirectResult(authInstance)
      .then(async (credential) => {
        if (credential && credential.user) {
          const user = credential.user;
          const email = (user.email || '').trim().toLowerCase();
          const isVerified = Boolean(user.emailVerified);

          if (isDiuEmail(email) && isVerified) {
            const username = extractUsernameFromEmail(email);
            await this.syncFirebaseUserProfile(user.uid, email, username);
          } else {
            await firebaseSignOut(authInstance).catch(() => {});
            this.currentUser = null;
            this.clearFirestoreListeners();
            this.notify();
          }
        }
      })
      .catch((err) => {
        console.warn('[Firebase Auth] Redirect result error:', err);
      });

    onAuthStateChanged(authInstance, async (firebaseUser: FirebaseUser | null) => {
      try {
        if (firebaseUser) {
          const email = (firebaseUser.email || '').trim().toLowerCase();
          const isVerified = Boolean(firebaseUser.emailVerified);

          if (isDiuEmail(email) && isVerified) {
            const username = extractUsernameFromEmail(email);
            await this.syncFirebaseUserProfile(firebaseUser.uid, email, username);
          } else {
            // Unauthorized or non-DIU email: immediately sign out
            await firebaseSignOut(authInstance).catch(() => {});
            this.currentUser = null;
            this.clearFirestoreListeners();
            this.persist();
            this.notify();
          }
        } else {
          this.currentUser = null;
          this.clearFirestoreListeners();
          this.persist();
          this.notify();
        }
      } finally {
        this.authReady = true;
        this.notify();
      }
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

    if (!db) {
      this.currentUser = defaultUser;
      this.persist();
      this.notify();
      return defaultUser;
    }

    try {
      const userRef = doc(db, 'users', uid);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        await setDoc(userRef, {
          ...defaultUser,
          created_at: serverTimestamp(),
          last_active_at: serverTimestamp(),
        });
        this.currentUser = defaultUser;
      } else {
        const data = userSnap.data() as Partial<User>;
        this.currentUser = {
          id: uid,
          email: data.email || email,
          username: data.username || username,
          role: data.role || 'student',
          current_group_id: data.current_group_id || null,
          created_at: typeof data.created_at === 'string' ? data.created_at : new Date().toISOString(),
        };
        await updateDoc(userRef, { last_active_at: serverTimestamp() }).catch(() => {});
      }
    } catch (e) {
      console.warn('Could not sync Firestore user profile:', e);
      this.currentUser = defaultUser;
    }

    this.persist();
    this.notify();
    this.attachFirestoreListeners();
    return this.currentUser;
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
      const viewsQuery = query(collection(db, 'updateViews'), where('group_id', '==', currentGroupId));
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
        return { error: this.formatFirebaseAuthError(err) };
      }
    }

    try {
      // 25-second timeout wrapper to prevent hanging indefinitely if popup is blocked or stalled
      const popupPromise = signInWithPopup(authInstance, googleProvider);
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error('auth/timeout'));
        }, 25000);
      });

      const cred = await Promise.race([popupPromise, timeoutPromise]);
      const user = cred.user;
      const email = (user.email || '').trim().toLowerCase();
      const isVerified = Boolean(user.emailVerified);

      // Strict DIU Domain & Google Email Verification Check
      if (!email || !isVerified || !isDiuEmail(email)) {
        await firebaseSignOut(authInstance).catch(() => {});
        this.currentUser = null;
        this.clearFirestoreListeners();
        this.persist();
        this.notify();
        return {
          error:
            'Access restricted: Only verified Daffodil International University Google accounts (@diu.edu.bd) are permitted. Please sign in with your official DIU account.',
        };
      }

      const username = extractUsernameFromEmail(email);
      const userProfile = await this.syncFirebaseUserProfile(user.uid, email, username);
      return { user: userProfile };
    } catch (e: unknown) {
      const err = e as { code?: string; message?: string };
      return { error: this.formatFirebaseAuthError(err) };
    }
  }

  private formatFirebaseAuthError(err: { code?: string; message?: string }): string {
    const code = err.code || '';
    const message = err.message || '';

    if (message === 'auth/timeout') {
      return 'Authentication timed out. If the Google popup did not appear, please allow popups or try "Sign in with redirect".';
    }
    if (code === 'auth/popup-closed-by-user' || message.includes('auth/popup-closed-by-user')) {
      return 'Sign-in cancelled. The Google sign-in window was closed.';
    }
    if (code === 'auth/popup-blocked' || message.includes('auth/popup-blocked')) {
      return 'Popup was blocked by your browser. Please allow popups for this site or try "Sign in with redirect".';
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

  public createGroup(
    name: string,
    approvalMode: ApprovalMode = 'auto'
  ): { group?: Group; error?: string } {
    if (!this.currentUser) return { error: 'Not authenticated' };

    // Enforce One Group Per User
    const existingGroup = this.getCurrentUserGroup();
    if (existingGroup) {
      return {
        error: `You already belong to "${existingGroup.name}". You must leave your current class first.`,
      };
    }

    const code = generateGroupCode(6);
    const createdAt = new Date().toISOString();
    const expiresAt = calculateExpirationDate(new Date());
    const groupId = `grp-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;

    const newGroup: Group = {
      id: groupId,
      name: name.trim(),
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

    // Update state & role
    this.currentUser.role = 'cr';
    this.currentUser.current_group_id = groupId;
    this.groups.push(newGroup);
    this.members.push(hostMember);

    // Sync with Firestore if connected
    if (db) {
      const userRef = doc(db, 'users', this.currentUser.id);
      const groupRef = doc(db, 'groups', groupId);
      const memberRef = doc(db, 'groupMembers', `${groupId}_${this.currentUser.id}`);

      runTransaction(db, async (tx) => {
        tx.update(userRef, { current_group_id: groupId, role: 'cr' });
        tx.set(groupRef, newGroup);
        tx.set(memberRef, { ...hostMember, expires_at: expiresAt });
      }).catch((e) => console.warn('Firestore transaction failed:', e));
    }

    this.persist();
    this.notify();
    this.attachFirestoreListeners();
    return { group: newGroup };
  }

  public joinGroupByCode(code: string): {
    group?: Group;
    status?: 'joined' | 'pending';
    error?: string;
  } {
    if (!this.currentUser) return { error: 'Not authenticated' };

    // Enforce One Group Per User
    const existingGroup = this.getCurrentUserGroup();
    if (existingGroup) {
      return {
        error: `You are already enrolled in "${existingGroup.name}". You must leave your current class before joining another.`,
      };
    }

    const cleanCode = code.trim().toUpperCase();
    const group = this.groups.find(
      (g) => g.code.toUpperCase() === cleanCode && g.status === 'active'
    );

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

      this.currentUser.current_group_id = group.id;
      this.members.push(newMember);

      if (db) {
        const userRef = doc(db, 'users', this.currentUser.id);
        const memberRef = doc(db, 'groupMembers', `${group.id}_${this.currentUser.id}`);
        setDoc(memberRef, { ...newMember, expires_at: group.expires_at }).catch(() => {});
        updateDoc(userRef, { current_group_id: group.id }).catch(() => {});
      }

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

      if (db) {
        const reqRef = doc(db, 'joinRequests', requestId);
        setDoc(reqRef, { ...newReq, expires_at: group.expires_at }).catch(() => {});
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

  public getViewTrackingRoster(updateId: string): {
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

    const updateViews = this.views.filter((v) => v.update_id === updateId);
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
