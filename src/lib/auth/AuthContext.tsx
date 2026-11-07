"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import {
  onIdTokenChanged,
  type User as FirebaseUser,
} from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "@/lib/firebase/client";
import { clearSessionCookie } from "./session";
import type { User, AccountStatus } from "@/types";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface AuthContextValue {
  /** Raw Firebase Auth user — null when signed out */
  firebaseUser: FirebaseUser | null;
  /** Full Firestore user document — null when signed out or not yet loaded */
  user: User | null;
  /** True while auth state is being determined on first load */
  loading: boolean;
  /** True once we have a definitive answer (signed in or out) */
  initialized: boolean;
  /** Current account status — null when signed out */
  status: AccountStatus | null;
  /** True if user is signed in AND status === "approved" */
  isApproved: boolean;
  /** True if user has superAdmin or moderator custom claim */
  isAdmin: boolean;
  /** Force-refresh the ID token (e.g. after admin approves account) */
  refreshToken: () => Promise<void>;
}

// ─────────────────────────────────────────────
// Context
// ─────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue>({
  firebaseUser: null,
  user: null,
  loading: true,
  initialized: false,
  status: null,
  isApproved: false,
  isAdmin: false,
  refreshToken: async () => {},
});

// ─────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  const refreshToken = useCallback(async () => {
    if (auth?.currentUser) {
      await auth.currentUser.getIdToken(true);
      const claims = (await auth.currentUser.getIdTokenResult()).claims;
      setIsAdmin(
        claims.role === "superAdmin" || claims.role === "moderator"
      );
    }
  }, []);

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      setInitialized(true);
      return;
    }

    // Keep ff_session cookie in sync for middleware
    clearSessionCookie();
    let generation = 0;
    let currentUid: string | null = null;
    let firestoreUnsub: (() => void) | null = null;

    const authUnsub = onIdTokenChanged(auth, async (fbUser) => {
      const currentGeneration = ++generation;
      if (currentUid !== (fbUser?.uid ?? null)) {
        currentUid = fbUser?.uid ?? null;
        setLoading(true);
        setUser(null);
      }
      // Clean up previous Firestore listener
      if (firestoreUnsub) {
        firestoreUnsub();
        firestoreUnsub = null;
      }

      if (!fbUser) {
        setFirebaseUser(null);
        setUser(null);
        setIsAdmin(false);
        setLoading(false);
        setInitialized(true);
        return;
      }

      setFirebaseUser(fbUser);

      // Read custom claims for admin check
      try {
        const tokenResult = await fbUser.getIdTokenResult();
        if (currentGeneration !== generation) return;
        setIsAdmin(
          tokenResult.claims.role === "superAdmin" ||
            tokenResult.claims.role === "moderator"
        );
      } catch {
        setIsAdmin(false);
      }

      if (currentGeneration !== generation) return;

      // Subscribe to Firestore user document in real-time
      if (!db) {
        setLoading(false);
        setInitialized(true);
        return;
      }

      const userRef = doc(db, "users", fbUser.uid);
      firestoreUnsub = onSnapshot(
        userRef,
        (snap) => {
          if (currentGeneration !== generation) return;
          if (snap.exists()) {
            const data = snap.data();
            setUser({
              uid: fbUser.uid,
              email: fbUser.email ?? "",
              displayName: data.displayName ?? "",
              username: data.username ?? "",
              bio: data.bio ?? "",
              profilePhotoUrl: data.profilePhotoUrl ?? "",
              profilePhotoPublicId: data.profilePhotoPublicId ?? "",
              coverPhotoUrl: data.coverPhotoUrl ?? "",
              coverPhotoPublicId: data.coverPhotoPublicId ?? "",
              status: data.status ?? "pending",
              isPrivate: data.isPrivate ?? false,
              isEmailVerified: fbUser.emailVerified,
              storageProvider: data.storageProvider ?? "central",
              followersCount: data.followersCount ?? 0,
              followingCount: data.followingCount ?? 0,
              postsCount: data.postsCount ?? 0,
              theme: data.theme ?? "default",
              onboardingComplete: data.onboardingComplete ?? false,
              createdAt: data.createdAt?.toDate() ?? new Date(),
              updatedAt: data.updatedAt?.toDate() ?? new Date(),
              approvedAt: data.approvedAt?.toDate() ?? null,
            });
          } else {
            // Doc doesn't exist yet — user just created, onboarding in progress
            setUser(null);
          }
          setLoading(false);
          setInitialized(true);
        },
        () => {
          // Firestore read error (rules denied, offline, etc.)
          setUser(null);
          setLoading(false);
          setInitialized(true);
        }
      );
    });

    return () => {
      authUnsub();
      generation++;
      if (firestoreUnsub) firestoreUnsub();
    };
  }, []);

  const status = user?.status ?? null;
  const isApproved = !!firebaseUser && status === "approved";

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        user,
        loading,
        initialized,
        status,
        isApproved,
        isAdmin,
        refreshToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ─────────────────────────────────────────────
// Hooks
// ─────────────────────────────────────────────

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

/** Returns the approved user — throws if not approved (use in protected pages) */
export function useRequireAuth(): AuthContextValue & { user: User } {
  const ctx = useAuth();
  if (!ctx.initialized) return ctx as AuthContextValue & { user: User };
  if (!ctx.isApproved || !ctx.user) {
    throw new Error("useRequireAuth: user is not authenticated or approved");
  }
  return ctx as AuthContextValue & { user: User };
}
