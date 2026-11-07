/**
 * FRAMEFOLK — Social Service
 * Likes, saves, comments, shares, reports.
 */
"use client";
import { platformRequest } from "./platform.service";

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
  await platformRequest("like", { postId });
}

export async function unlikePost(uid: string, postId: string): Promise<void> {
  await platformRequest("unlike", { postId });
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

export async function addComment(uid: string, username: string, photoUrl: string, postId: string, text: string): Promise<string> {
  return await platformRequest("comment", { postId, text });
}

export async function deleteComment(postId: string, commentId: string): Promise<void> {
  await platformRequest("deleteComment", { postId, commentId });
}

export async function likeComment(postId: string, commentId: string): Promise<void> {
 await platformRequest("likeComment", { postId, commentId });
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
    orderBy("createdAt", "asc")
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
  }, () => callback([]));
}

export async function addReply(uid: string, username: string, photoUrl: string, postId: string, commentId: string, text: string): Promise<void> {
  await platformRequest("reply", { postId, commentId, text });
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

export async function getSuggestedUsers(currentUid: string, count = 5): Promise<Record<string, unknown>[]> {
 return platformRequest("suggestedUsers", { count });
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
 if (!db) throw new Error("Firebase not configured");
 for (;;) {
  const snap = await getDocs(query(collection(db, "notifications"), where("recipientUid", "==", uid), where("isRead", "==", false), limit(100)));
  if (snap.empty) return;
  await Promise.all(snap.docs.map(d => updateDoc(d.ref, { isRead: true, readAt: serverTimestamp() })));
 }

}

// ─────────────────────────────────────────────
// Public feed (explore)
// ─────────────────────────────────────────────

export async function loadPublicPosts(afterDoc?: unknown, pageSize = 12): Promise<{ posts: Record<string, unknown>[]; cursor: unknown }> {
 return platformRequest("posts", { mode: "explore", cursor: typeof afterDoc === "string" ? afterDoc : undefined, pageSize });
}

export function subscribeToReplies(postId: string, commentId: string, callback: (replies: Comment[]) => void): Unsubscribe {
 if (!db) { callback([]); return () => {}; }
 return onSnapshot(query(collection(db, "posts", postId, "comments", commentId, "replies"), orderBy("createdAt", "asc")), snap => {
  callback(snap.docs.filter(d => !d.data().isDeleted).map(d => ({ ...d.data(), id: d.id, createdAt: d.data().createdAt?.toDate() ?? new Date(), updatedAt: d.data().updatedAt?.toDate() ?? new Date() } as Comment)));
 }, () => callback([]));
}
