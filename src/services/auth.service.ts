/**
 * FRAMEFOLK — Auth Service
 * Wraps Firebase Auth operations with application-level logic.
 * All Firestore writes go through Cloud Functions (server-side) except
 * the initial user document creation which happens in onUserCreate trigger.
 * Username reservation uses a Firestore transaction for race-condition safety.
 */
"use client";

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

  await setDoc(userRef, {
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

export async function claimUsername(
  payload: ClaimUsernamePayload
): Promise<void> {
  if (!db) throw new Error("Firebase not configured");

  const lower = payload.username.toLowerCase();
  const usernameRef = doc(db, "usernames", lower);
  const userRef = doc(db, "users", payload.uid);

  // Get old username before transaction so we can delete it after
  const userSnap = await getDoc(userRef);
  const oldUsername = userSnap.exists() ? (userSnap.data().username as string) ?? "" : "";

  await runTransaction(db, async (tx) => {
    const usernameSnap = await tx.get(usernameRef);
    if (usernameSnap.exists()) {
      throw new Error("USERNAME_TAKEN");
    }

    // Reserve new username
    tx.set(usernameRef, {
      uid: payload.uid,
      createdAt: serverTimestamp(),
    });

    // Update user document
    tx.set(
      userRef,
      {
        username: lower,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  });

  // Delete old username reservation (outside transaction — best effort)
  if (oldUsername && oldUsername !== lower) {
    await deleteDoc(doc(db, "usernames", oldUsername)).catch(() => {});
  }
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
  if (!db) return null;
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) return null;
  return { uid, ...snap.data() } as Record<string, unknown>;
}

// ─────────────────────────────────────────────
// Follow / Unfollow
// ─────────────────────────────────────────────

export async function followUser(
  currentUid: string,
  targetUid: string
): Promise<void> {
  if (!db) throw new Error("Firebase not configured");

  // Check if target account is private
  const targetSnap = await getDoc(doc(db, "users", targetUid));
  if (!targetSnap.exists()) throw new Error("User not found");

  const isPrivate = targetSnap.data().isPrivate ?? false;
  const currentUserSnap = await getDoc(doc(db, "users", currentUid));
  const currentUsername = currentUserSnap.exists()
    ? (currentUserSnap.data().username as string) ?? ""
    : "";
  const currentPhotoUrl = currentUserSnap.exists()
    ? (currentUserSnap.data().profilePhotoUrl as string) ?? ""
    : "";

  if (isPrivate) {
    // Create follow request instead
    await setDoc(
      doc(db, "followRequests", `${currentUid}_${targetUid}`),
      {
        fromUid: currentUid,
        toUid: targetUid,
        status: "pending",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }
    );

    // Notify the target about the follow request
    const { addDoc } = await import("firebase/firestore");
    await addDoc(collection(db, "notifications"), {
      recipientUid: targetUid,
      senderUid: currentUid,
      senderUsername: currentUsername,
      senderPhotoUrl: currentPhotoUrl,
      type: "followRequest",
      entityType: "user",
      entityId: currentUid,
      text: `@${currentUsername} requested to follow you.`,
      isRead: false,
      readAt: null,
      createdAt: serverTimestamp(),
    }).catch(() => {});
  } else {
    // Direct follow
    await setDoc(
      doc(db, "followers", currentUid, "following", targetUid),
      { targetUid, createdAt: serverTimestamp() }
    );
    await setDoc(
      doc(db, "followers", targetUid, "followers", currentUid),
      { sourceUid: currentUid, createdAt: serverTimestamp() }
    );

    // Increment follower/following counts
    await updateDoc(doc(db, "users", targetUid), { followersCount: increment(1) });
    await updateDoc(doc(db, "users", currentUid), { followingCount: increment(1) });

    // Notify the target about the follow
    const { addDoc } = await import("firebase/firestore");
    await addDoc(collection(db, "notifications"), {
      recipientUid: targetUid,
      senderUid: currentUid,
      senderUsername: currentUsername,
      senderPhotoUrl: currentPhotoUrl,
      type: "follow",
      entityType: "user",
      entityId: currentUid,
      text: `@${currentUsername} started following you.`,
      isRead: false,
      readAt: null,
      createdAt: serverTimestamp(),
    }).catch(() => {});

    // Auto-create conversation so they can message each other
    const convId = [currentUid, targetUid].sort().join("_");
    const convRef = doc(db, "conversations", convId);
    const convSnap = await getDoc(convRef);
    if (!convSnap.exists()) {
      await setDoc(convRef, {
        id: convId,
        participants: [currentUid, targetUid],
        lastMessage: null,
        lastMessageAt: null,
        unreadCounts: { [currentUid]: 0, [targetUid]: 0 },
        createdAt: serverTimestamp(),
      });
    }
  }
}

export async function unfollowUser(
  currentUid: string,
  targetUid: string
): Promise<void> {
  if (!db) throw new Error("Firebase not configured");

  await deleteDoc(doc(db, "followers", currentUid, "following", targetUid));
  await deleteDoc(doc(db, "followers", targetUid, "followers", currentUid));

  // Decrement counts (ignore errors if counts are already 0)
  await updateDoc(doc(db, "users", targetUid), { followersCount: increment(-1) }).catch(() => {});
  await updateDoc(doc(db, "users", currentUid), { followingCount: increment(-1) }).catch(() => {});
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
            const userSnap = await getDoc(doc(db, "users", fromUid));
            if (userSnap.exists()) {
              fromUsername = (userSnap.data().username as string) ?? "";
              fromDisplayName = (userSnap.data().displayName as string) ?? "";
              fromPhotoUrl = (userSnap.data().profilePhotoUrl as string) ?? "";
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

export async function acceptFollowRequest(
  requestId: string,
  fromUid: string,
  toUid: string
): Promise<void> {
  if (!db) throw new Error("Firebase not configured");

  // Update request status
  await updateDoc(doc(db, "followRequests", requestId), {
    status: "accepted",
    updatedAt: serverTimestamp(),
  });

  // Create follower/following documents
  await setDoc(
    doc(db, "followers", fromUid, "following", toUid),
    { targetUid: toUid, createdAt: serverTimestamp() }
  );
  await setDoc(
    doc(db, "followers", toUid, "followers", fromUid),
    { sourceUid: fromUid, createdAt: serverTimestamp() }
  );

  // Increment follower/following counts
  const { increment: inc, addDoc } = await import("firebase/firestore");
  await updateDoc(doc(db, "users", toUid), { followersCount: inc(1) });
  await updateDoc(doc(db, "users", fromUid), { followingCount: inc(1) });

  // Notify the requester that their request was accepted
  await addDoc(collection(db, "notifications"), {
    recipientUid: fromUid,
    senderUid: toUid,
    senderUsername: "",  // will show from Firestore user doc on client
    senderPhotoUrl: "",
    type: "followAccepted",
    entityType: "user",
    entityId: toUid,
    text: "Your follow request was accepted.",
    isRead: false,
    readAt: null,
    createdAt: serverTimestamp(),
  }).catch(() => {});

  // Auto-create a conversation so they can message each other immediately
  const convId = [fromUid, toUid].sort().join("_");
  const convRef = doc(db, "conversations", convId);
  const convSnap = await getDoc(convRef);
  if (!convSnap.exists()) {
    await setDoc(convRef, {
      id: convId,
      participants: [fromUid, toUid],
      lastMessage: null,
      lastMessageAt: null,
      unreadCounts: { [fromUid]: 0, [toUid]: 0 },
      createdAt: serverTimestamp(),
    });
  }
}

export async function rejectFollowRequest(
  requestId: string
): Promise<void> {
  if (!db) return;
  await updateDoc(doc(db, "followRequests", requestId), {
    status: "rejected",
    updatedAt: serverTimestamp(),
  });
}

// ─────────────────────────────────────────────
// Block / Unblock user
// ─────────────────────────────────────────────

export async function blockUser(
  currentUid: string,
  targetUid: string
): Promise<void> {
  if (!db) throw new Error("Firebase not configured");
  await setDoc(doc(db, "blocks", `${currentUid}_${targetUid}`), {
    blockerUid: currentUid,
    blockedUid: targetUid,
    createdAt: serverTimestamp(),
  });
  // Remove any existing follow relationship
  try {
    await deleteDoc(doc(db, "followers", currentUid, "following", targetUid));
    await deleteDoc(doc(db, "followers", targetUid, "followers", currentUid));
    await deleteDoc(doc(db, "followers", targetUid, "following", currentUid));
    await deleteDoc(doc(db, "followers", currentUid, "followers", targetUid));
  } catch { /* ignore — may not exist */ }
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
