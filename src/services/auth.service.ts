/**
 * FRAMEFOLK — Auth Service
 * Wraps Firebase Auth operations with application-level logic.
 * All Firestore writes go through Cloud Functions (server-side) except
 * the initial user document creation which happens in onUserCreate trigger.
 * Username reservation uses a Firestore transaction for race-condition safety.
 */
"use client";
import { platformRequest } from "./platform.service";

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  sendEmailVerification,
  sendPasswordResetEmail,
  signOut,
  updateProfile,
  type User as FirebaseUser,
} from "firebase/auth";
import {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  updateDoc,
  runTransaction,
  serverTimestamp,
  query,
  collection,
  where,
  getDocs,
  onSnapshot,
  orderBy,
  limit,
  increment,
  type Unsubscribe,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase/client";

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

// ─────────────────────────────────────────────
// Internal: ensure Firestore user document exists
// Called client-side when Cloud Functions are unavailable (Spark plan).
// Safe to call multiple times — uses set with merge:false only on create.
// ─────────────────────────────────────────────

async function ensureUserDocument(user: FirebaseUser): Promise<void> {
  if (!db) return;
  const userRef = doc(db, "users", user.uid);
  const snap = await getDoc(userRef);
  if (snap.exists()) return; // already created

  await runTransaction(db, async tx => {
    if ((await tx.get(userRef)).exists()) return;
    tx.set(userRef, {
    uid: user.uid,
    email: user.email ?? "",
    displayName: user.displayName ?? "",
    username: "",
    bio: "",
    profilePhotoUrl: user.photoURL ?? "",
    profilePhotoPublicId: "",
    coverPhotoUrl: "",
    coverPhotoPublicId: "",
    // Auto-approve: no manual admin approval required.
    // Admins can block/suspend accounts via the admin dashboard.
    status: "approved",
    isPrivate: false,
    isEmailVerified: user.emailVerified,
    storageProvider: "central",
    followersCount: 0,
    followingCount: 0,
    postsCount: 0,
    theme: "default",
    onboardingComplete: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    approvedAt: serverTimestamp(),
    });
  });
}

// ─────────────────────────────────────────────
// Registration
// ─────────────────────────────────────────────

export interface RegisterPayload {
  displayName: string;
  email: string;
  password: string;
}

/**
 * Step 1 of registration: create Firebase Auth user + Firestore document +
 * send verification email.
 */
export async function registerWithEmail(
  payload: RegisterPayload
): Promise<FirebaseUser> {
  if (!auth) throw new Error("Firebase not configured");

  const { user } = await createUserWithEmailAndPassword(
    auth,
    payload.email,
    payload.password
  );

  // Update display name in Firebase Auth profile
  await updateProfile(user, { displayName: payload.displayName });

  // Create Firestore user document immediately (no Cloud Function needed)
  await ensureUserDocument({ ...user, displayName: payload.displayName });

  // Send email verification
  await sendEmailVerification(user, {
    url: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/onboarding`,
  });

  return user;
}

/**
 * Google Sign-In — creates or signs in the user.
 * Ensures a Firestore user document exists for new users.
 */
export async function signInWithGoogle(): Promise<FirebaseUser> {
  if (!auth) throw new Error("Firebase not configured");
  const { user } = await signInWithPopup(auth, googleProvider);
  // Create doc for first-time Google sign-ins
  await ensureUserDocument(user);
  return user;
}

// ─────────────────────────────────────────────
// Login
// ─────────────────────────────────────────────

export async function loginWithEmail(
  email: string,
  password: string
): Promise<FirebaseUser> {
  if (!auth) throw new Error("Firebase not configured");
  const { user } = await signInWithEmailAndPassword(auth, email, password);
  return user;
}

// ─────────────────────────────────────────────
// Logout
// ─────────────────────────────────────────────

export async function logout(): Promise<void> {
  if (!auth) return;
  await signOut(auth);
  if (typeof window !== "undefined") {
    document.cookie = "ff_session=; path=/; max-age=0; SameSite=Strict";
    if ("caches" in window) await Promise.all((await caches.keys()).filter(k => k.startsWith("framefolk-")).map(k => caches.delete(k)));
  }
}

// ─────────────────────────────────────────────
// Password reset
// ─────────────────────────────────────────────

export async function sendPasswordReset(email: string): Promise<void> {
  if (!auth) throw new Error("Firebase not configured");
  await sendPasswordResetEmail(auth, email, {
    url: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/login`,
  });
}

// ─────────────────────────────────────────────
// Username availability
// ─────────────────────────────────────────────

export async function checkUsernameAvailable(
  username: string
): Promise<boolean> {
  if (!db) return false;
  const snap = await getDoc(doc(db, "usernames", username.toLowerCase()));
  return !snap.exists();
}

// ─────────────────────────────────────────────
// Username reservation (onboarding step)
// Uses a Firestore transaction — race-condition safe.
// ─────────────────────────────────────────────

export interface ClaimUsernamePayload {
  uid: string;
  username: string;
}

export async function claimUsername(payload: ClaimUsernamePayload): Promise<void> {
  await platformRequest("claimUsername", { username: payload.username });
}

// ─────────────────────────────────────────────
// Complete onboarding — set bio, mark profile complete
// ─────────────────────────────────────────────

export interface CompleteOnboardingPayload {
  uid: string;
  bio: string;
  displayName: string;
}

export async function completeOnboarding(
  payload: CompleteOnboardingPayload
): Promise<void> {
  if (!db) throw new Error("Firebase not configured");

  const userRef = doc(db, "users", payload.uid);
  await setDoc(
    userRef,
    {
      bio: payload.bio,
      displayName: payload.displayName,
      onboardingComplete: true,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

// ─────────────────────────────────────────────
// Fetch user by username (for profile pages)
// ─────────────────────────────────────────────

export async function getUserByUsername(
  username: string
): Promise<{ uid: string } | null> {
  if (!db) return null;

  const snap = await getDoc(doc(db, "usernames", username.toLowerCase()));
  if (!snap.exists()) return null;
  return { uid: snap.data().uid };
}

export async function getUserDoc(uid: string): Promise<Record<string, unknown> | null> {
 if (auth?.currentUser?.uid === uid) {
   const snap = await getDoc(doc(db, "users", uid));
   return snap.exists() ? { ...snap.data(), uid } : null;
 }
 return platformRequest("user", { targetUid: uid });
}

// ─────────────────────────────────────────────
// Follow / Unfollow
// ─────────────────────────────────────────────

export async function followUser(currentUid: string, targetUid: string): Promise<void> {
  await platformRequest("follow", { targetUid });
}

export async function unfollowUser(currentUid: string, targetUid: string): Promise<void> {
  await platformRequest("unfollow", { targetUid });
}

export async function isFollowing(
  currentUid: string,
  targetUid: string
): Promise<boolean> {
  if (!db) return false;
  const snap = await getDoc(
    doc(db, "followers", currentUid, "following", targetUid)
  );
  return snap.exists();
}

export async function hasPendingFollowRequest(
  currentUid: string,
  targetUid: string
): Promise<boolean> {
  if (!db) return false;
  const q = query(
    collection(db, "followRequests"),
    where("fromUid", "==", currentUid),
    where("toUid", "==", targetUid),
    where("status", "==", "pending"),
    limit(1)
  );
  const snap = await getDocs(q);
  return !snap.empty;
}

// ─────────────────────────────────────────────
// Follow Request inbox (for private accounts)
// ─────────────────────────────────────────────

export interface FollowRequestWithUser {
  id: string;
  fromUid: string;
  fromUsername: string;
  fromDisplayName: string;
  fromPhotoUrl: string;
  createdAt: Date;
}

export function subscribeToFollowRequests(
  uid: string,
  callback: (requests: FollowRequestWithUser[]) => void
): Unsubscribe {
  if (!db) return () => {};
  // Query only by toUid — no compound filter to avoid index issues.
  // Filter status client-side.
  const q = query(
    collection(db, "followRequests"),
    where("toUid", "==", uid),
    where("status", "==", "pending"),
    orderBy("createdAt", "desc"),
    limit(50)
  );
  return onSnapshot(q, async (snap) => {
    // Filter to only pending requests client-side
    const pendingDocs = snap.docs.filter(
      (d) => !d.data().status || d.data().status === "pending"
    );
    if (pendingDocs.length === 0) { callback([]); return; }

    // Fetch user docs for each requester
    const requests = await Promise.all(
      pendingDocs.map(async (d) => {
        const data = d.data();
        const fromUid = data.fromUid as string;
        let fromUsername = "";
        let fromDisplayName = "";
        let fromPhotoUrl = "";
        try {
          if (db) {
            const profile = await getUserDoc(fromUid);
            if (profile) {
              fromUsername = (profile.username as string) ?? "";
              fromDisplayName = (profile.displayName as string) ?? "";
              fromPhotoUrl = (profile.profilePhotoUrl as string) ?? "";
            }
          }
        } catch { /* ignore */ }
        return {
          id: d.id,
          fromUid,
          fromUsername,
          fromDisplayName,
          fromPhotoUrl,
          createdAt: data.createdAt?.toDate() ?? new Date(),
        } as FollowRequestWithUser;
      })
    );
    callback(requests.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()));
  });
}

export async function acceptFollowRequest(requestId: string, fromUid: string, toUid: string): Promise<void> {
  await platformRequest("respondFollow", { requestId, accept: true });
}

export async function rejectFollowRequest(requestId: string): Promise<void> {
  await platformRequest("respondFollow", { requestId, accept: false });
}

// ─────────────────────────────────────────────
// Block / Unblock user
// ─────────────────────────────────────────────

export async function blockUser(currentUid: string, targetUid: string): Promise<void> {
  await platformRequest("block", { targetUid });
}

export async function unblockUser(
  currentUid: string,
  targetUid: string
): Promise<void> {
  if (!db) return;
  await deleteDoc(doc(db, "blocks", `${currentUid}_${targetUid}`));
}

export function subscribeToBlockedUsers(
  uid: string,
  callback: (blockedUids: string[]) => void
): Unsubscribe {
  if (!db) return () => {};
  const q = query(
    collection(db, "blocks"),
    where("blockerUid", "==", uid),
    limit(200)
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => d.data().blockedUid as string));
  });
}

export async function isBlocked(
  currentUid: string,
  targetUid: string
): Promise<boolean> {
  if (!db) return false;
  const snap = await getDoc(doc(db, "blocks", `${currentUid}_${targetUid}`));
  return snap.exists();
}

// ─────────────────────────────────────────────
// Report user
// ─────────────────────────────────────────────

export async function reportUser(
  reporterUid: string,
  targetUid: string,
  reason: string
): Promise<void> {
  if (!db) return;
  const { addDoc } = await import("firebase/firestore");
  await addDoc(collection(db, "reports"), {
    reporterUid,
    entityType: "user",
    entityId: targetUid,
    reason,
    details: "",
    status: "pending",
    reviewedBy: null,
    reviewedAt: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

// ─────────────────────────────────────────────
// Submit post deletion request (user-facing)
// ─────────────────────────────────────────────

export async function submitDeletionRequest(
  requesterUid: string,
  postId: string,
  mediaIds: string[],
  reason: string
): Promise<void> {
  if (!db) throw new Error("Firebase not configured");
  const { addDoc } = await import("firebase/firestore");
  await addDoc(collection(db, "deletionRequests"), {
    requesterUid,
    entityType: "post",
    entityId: postId,
    mediaIds,
    reason,
    status: "pending",
    adminUid: null,
    adminNote: null,
    cloudinaryJobId: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

// ─────────────────────────────────────────────
// Update account privacy toggle
// ─────────────────────────────────────────────

export async function updatePrivacySettings(
  uid: string,
  isPrivate: boolean
): Promise<void> {
  if (!db) return;
  await updateDoc(doc(db, "users", uid), {
    isPrivate,
    updatedAt: serverTimestamp(),
  });
}
