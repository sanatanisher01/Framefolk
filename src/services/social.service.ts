/**
 * FRAMEFOLK — Social Service
 * Likes, saves, comments, shares, reports.
 */
"use client";

import {
  doc, setDoc, deleteDoc, getDoc, addDoc, updateDoc,
  collection, query, where, orderBy, limit, getDocs,
  serverTimestamp, increment, onSnapshot,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import type { Comment } from "@/types";

// ─────────────────────────────────────────────
// Internal: create a notification
// ─────────────────────────────────────────────

async function createNotification({
  recipientUid,
  senderUid,
  senderUsername,
  senderPhotoUrl,
  type,
  entityType,
  entityId,
  text,
}: {
  recipientUid: string;
  senderUid: string;
  senderUsername: string;
  senderPhotoUrl: string;
  type: string;
  entityType: string;
  entityId: string;
  text: string;
}): Promise<void> {
  if (!db || recipientUid === senderUid) return; // no self-notifications
  await addDoc(collection(db, "notifications"), {
    recipientUid,
    senderUid,
    senderUsername,
    senderPhotoUrl,
    type,
    entityType,
    entityId,
    text,
    isRead: false,
    readAt: null,
    createdAt: serverTimestamp(),
  });
}

// ─────────────────────────────────────────────
// Likes
// ─────────────────────────────────────────────

export async function likePost(uid: string, postId: string): Promise<void> {
  if (!db) return;
  const likeRef = doc(db, "posts", postId, "likes", uid);
  const postRef = doc(db, "posts", postId);
  await setDoc(likeRef, { uid, createdAt: serverTimestamp() });
  await updateDoc(postRef, { likesCount: increment(1) });

  // Fan-out: notify post author
  try {
    const postSnap = await getDoc(postRef);
    if (postSnap.exists()) {
      const post = postSnap.data();
      const likerSnap = await getDoc(doc(db, "users", uid));
      if (likerSnap.exists()) {
        const liker = likerSnap.data();
        await createNotification({
          recipientUid: post.authorUid as string,
          senderUid: uid,
          senderUsername: (liker.username as string) ?? "",
          senderPhotoUrl: (liker.profilePhotoUrl as string) ?? "",
          type: "like",
          entityType: "post",
          entityId: postId,
          text: `@${(liker.username as string) ?? "someone"} liked your post.`,
        });
      }
    }
  } catch { /* notifications are non-critical */ }
}

export async function unlikePost(uid: string, postId: string): Promise<void> {
  if (!db) return;
  const likeRef = doc(db, "posts", postId, "likes", uid);
  const postRef = doc(db, "posts", postId);
  await deleteDoc(likeRef);
  await updateDoc(postRef, { likesCount: increment(-1) });
}

export async function isPostLiked(uid: string, postId: string): Promise<boolean> {
  if (!db) return false;
  const snap = await getDoc(doc(db, "posts", postId, "likes", uid));
  return snap.exists();
}

export function subscribeToLikeStatus(
  uid: string,
  postId: string,
  callback: (liked: boolean) => void
): Unsubscribe {
  if (!db) return () => {};
  return onSnapshot(
    doc(db, "posts", postId, "likes", uid),
    (snap) => callback(snap.exists())
  );
}

// ─────────────────────────────────────────────
// Saves (bookmarks)
// ─────────────────────────────────────────────

export async function savePost(uid: string, postId: string): Promise<void> {
  if (!db) return;
  await setDoc(
    doc(db, "bookmarks", uid, "saved", postId),
    { postId, savedAt: serverTimestamp() }
  );
}

export async function unsavePost(uid: string, postId: string): Promise<void> {
  if (!db) return;
  await deleteDoc(doc(db, "bookmarks", uid, "saved", postId));
}

export async function isPostSaved(uid: string, postId: string): Promise<boolean> {
  if (!db) return false;
  const snap = await getDoc(doc(db, "bookmarks", uid, "saved", postId));
  return snap.exists();
}

// ─────────────────────────────────────────────
// Comments
// ─────────────────────────────────────────────

export async function addComment(
  uid: string,
  username: string,
  photoUrl: string,
  postId: string,
  text: string
): Promise<string> {
  if (!db) throw new Error("Firebase not configured");
  const postRef = doc(db, "posts", postId);
  const commentsRef = collection(db, "posts", postId, "comments");

  const commentRef = await addDoc(commentsRef, {
    authorUid: uid,
    authorUsername: username,
    authorPhotoUrl: photoUrl,
    text: text.trim(),
    mentions: [],
    likesCount: 0,
    repliesCount: 0,
    isDeleted: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  await updateDoc(postRef, { commentsCount: increment(1) });

  // Fan-out: notify post author
  try {
    const postSnap = await getDoc(postRef);
    if (postSnap.exists()) {
      const post = postSnap.data();
      const preview = text.trim().slice(0, 60);
      await createNotification({
        recipientUid: post.authorUid as string,
        senderUid: uid,
        senderUsername: username,
        senderPhotoUrl: photoUrl,
        type: "comment",
        entityType: "post",
        entityId: postId,
        text: `@${username} commented: "${preview}${text.length > 60 ? "…" : ""}"`,
      });
    }
  } catch { /* notifications are non-critical */ }

  return commentRef.id;
}

export async function deleteComment(
  postId: string,
  commentId: string
): Promise<void> {
  if (!db) return;
  await updateDoc(doc(db, "posts", postId, "comments", commentId), {
    isDeleted: true,
    updatedAt: serverTimestamp(),
  });
  await updateDoc(doc(db, "posts", postId), {
    commentsCount: increment(-1),
  });
}

export async function likeComment(
  postId: string,
  commentId: string
): Promise<void> {
  if (!db) return;
  await updateDoc(doc(db, "posts", postId, "comments", commentId), {
    likesCount: increment(1),
  });
}

export function subscribeToComments(
  postId: string,
  callback: (comments: Comment[]) => void,
  pageSize = 20
): Unsubscribe {
  if (!db) return () => {};
  // Only orderBy createdAt — no compound filter to avoid missing composite index.
  // Filter isDeleted client-side.
  const q = query(
    collection(db, "posts", postId, "comments"),
    orderBy("createdAt", "asc"),
    limit(pageSize)
  );
  return onSnapshot(q, (snap) => {
    const comments = snap.docs
      .map((d) => ({
        id: d.id,
        ...d.data(),
        createdAt: d.data().createdAt?.toDate() ?? new Date(),
        updatedAt: d.data().updatedAt?.toDate() ?? new Date(),
      } as Comment))
      .filter((c) => !c.isDeleted); // filter deleted client-side
    callback(comments);
  });
}

export async function addReply(
  uid: string,
  username: string,
  photoUrl: string,
  postId: string,
  commentId: string,
  text: string
): Promise<void> {
  if (!db) return;
  const repliesRef = collection(db, "posts", postId, "comments", commentId, "replies");
  await addDoc(repliesRef, {
    authorUid: uid,
    authorUsername: username,
    authorPhotoUrl: photoUrl,
    text: text.trim(),
    mentions: [],
    likesCount: 0,
    isDeleted: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await updateDoc(doc(db, "posts", postId, "comments", commentId), {
    repliesCount: increment(1),
  });
}

// ─────────────────────────────────────────────
// Reports
// ─────────────────────────────────────────────

export async function reportPost(
  reporterUid: string,
  postId: string,
  reason: string
): Promise<void> {
  if (!db) return;
  await addDoc(collection(db, "reports"), {
    reporterUid,
    entityType: "post",
    entityId: postId,
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
// Suggested users
// ─────────────────────────────────────────────

export async function getSuggestedUsers(
  currentUid: string,
  count = 5
): Promise<Record<string, unknown>[]> {
  if (!db) return [];
  const q = query(
    collection(db, "users"),
    where("status", "==", "approved"),
    limit(count + 1)
  );
  const snap = await getDocs(q);
  return snap.docs
    .filter((d) => d.id !== currentUid)
    .slice(0, count)
    .map((d) => ({ uid: d.id, ...d.data() }));
}

// ─────────────────────────────────────────────
// Notifications
// ─────────────────────────────────────────────

export function subscribeToNotifications(
  uid: string,
  callback: (notifications: Record<string, unknown>[]) => void,
  pageSize = 30
): Unsubscribe {
  if (!db) return () => {};
  const q = query(
    collection(db, "notifications"),
    where("recipientUid", "==", uid),
    orderBy("createdAt", "desc"),
    limit(pageSize)
  );
  return onSnapshot(q, (snap) => {
    callback(
      snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
        createdAt: d.data().createdAt?.toDate() ?? new Date(),
      }))
    );
  });
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  if (!db) return;
  await updateDoc(doc(db, "notifications", notificationId), {
    isRead: true,
    readAt: serverTimestamp(),
  });
}

export async function markAllNotificationsRead(uid: string): Promise<void> {
  if (!db) return;
  const q = query(
    collection(db, "notifications"),
    where("recipientUid", "==", uid),
    where("isRead", "==", false),
    limit(100)
  );
  const snap = await getDocs(q);
  const promises = snap.docs.map((d) =>
    updateDoc(d.ref, { isRead: true, readAt: serverTimestamp() })
  );
  await Promise.all(promises);
}

// ─────────────────────────────────────────────
// Public feed (explore)
// ─────────────────────────────────────────────

export async function loadPublicPosts(
  afterDoc?: unknown,
  pageSize = 12
): Promise<{ posts: Record<string, unknown>[]; cursor: unknown }> {
  if (!db) return { posts: [], cursor: null };
  const { startAfter } = await import("firebase/firestore");

  let q = query(
    collection(db, "posts"),
    where("visibility", "==", "public"),
    where("isHidden", "==", false),
    orderBy("createdAt", "desc"),
    limit(pageSize + 1)
  );
  if (afterDoc) q = query(q, startAfter(afterDoc));

  const snap = await getDocs(q);
  const hasMore = snap.docs.length > pageSize;
  const docs = snap.docs.slice(0, pageSize);

  return {
    posts: docs.map((d) => ({ id: d.id, ...d.data() })),
    cursor: hasMore ? docs[docs.length - 1] : null,
  };
}
