/**
 * FRAMEFOLK — Messaging Service
 * Real-time one-to-one direct messaging via Firestore.
 */
"use client";

import {
  collection, doc, getDoc, setDoc,
  updateDoc, query, where, orderBy, limit, onSnapshot,
  serverTimestamp, increment, writeBatch,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import type { Conversation, Message } from "@/types";

// ─────────────────────────────────────────────
// Conversation helpers
// ─────────────────────────────────────────────

/** Deterministic conversation ID for two users (sorted UIDs joined by _) */
function conversationId(uidA: string, uidB: string): string {
  return [uidA, uidB].sort().join("_");
}

export async function getOrCreateConversation(
  uidA: string,
  uidB: string
): Promise<string> {
  if (!db) throw new Error("Firebase not configured");

  const convId = conversationId(uidA, uidB);
  const convRef = doc(db, "conversations", convId);
  const snap = await getDoc(convRef);

  if (!snap.exists()) {
    await setDoc(convRef, {
      id: convId,
      participants: [uidA, uidB],
      lastMessage: null,
      lastMessageAt: null,
      unreadCounts: { [uidA]: 0, [uidB]: 0 },
      createdAt: serverTimestamp(),
    });
  }

  return convId;
}

// ─────────────────────────────────────────────
// Load conversations for a user
// ─────────────────────────────────────────────

export function subscribeToConversations(
  uid: string,
  callback: (convs: Conversation[]) => void
): Unsubscribe {
  if (!db) return () => {};
  const q = query(
    collection(db, "conversations"),
    where("participants", "array-contains", uid),
    orderBy("lastMessageAt", "desc"),
    limit(30)
  );
  return onSnapshot(q, (snap) => {
    const convs = snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        participants: data.participants as [string, string],
        lastMessage: data.lastMessage ?? null,
        lastMessageAt: data.lastMessageAt?.toDate() ?? null,
        unreadCounts: data.unreadCounts ?? {},
        createdAt: data.createdAt?.toDate() ?? new Date(),
      } as Conversation;
    });
    callback(convs);
  });
}

// ─────────────────────────────────────────────
// Messages within a conversation
// ─────────────────────────────────────────────

export function subscribeToMessages(
  conversationId: string,
  callback: (messages: Message[]) => void,
  pageSize = 50
): Unsubscribe {
  if (!db) return () => {};
  const q = query(
    collection(db, "conversations", conversationId, "messages"),
    where("isDeleted", "==", false),
    orderBy("createdAt", "asc"),
    limit(pageSize)
  );
  return onSnapshot(q, (snap) => {
    const messages = snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        senderUid: data.senderUid as string,
        type: (data.type as Message["type"]) ?? "text",
        text: (data.text as string) ?? null,
        mediaId: (data.mediaId as string) ?? null,
        isRead: (data.isRead as boolean) ?? false,
        readAt: data.readAt?.toDate() ?? null,
        isDeleted: (data.isDeleted as boolean) ?? false,
        deletedAt: data.deletedAt?.toDate() ?? null,
        createdAt: data.createdAt?.toDate() ?? new Date(),
        updatedAt: data.updatedAt?.toDate() ?? new Date(),
      } as Message;
    });
    callback(messages);
  });
}

// ─────────────────────────────────────────────
// Send a message
// ─────────────────────────────────────────────

export async function sendMessage(
  conversationId: string,
  senderUid: string,
  recipientUid: string,
  text: string
): Promise<string> {
  if (!db) throw new Error("Firebase not configured");

  const batch = writeBatch(db);
  const msgRef = doc(collection(db, "conversations", conversationId, "messages"));

  batch.set(msgRef, {
    id: msgRef.id,
    senderUid,
    type: "text",
    text: text.trim(),
    mediaId: null,
    isRead: false,
    readAt: null,
    isDeleted: false,
    deletedAt: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  // Update conversation metadata
  const convRef = doc(db, "conversations", conversationId);
  batch.update(convRef, {
    lastMessage: {
      text: text.trim().slice(0, 100),
      senderUid,
      sentAt: serverTimestamp(),
      type: "text",
    },
    lastMessageAt: serverTimestamp(),
    [`unreadCounts.${recipientUid}`]: increment(1),
  });

  await batch.commit();
  return msgRef.id;
}

// ─────────────────────────────────────────────
// Mark messages as read
// ─────────────────────────────────────────────

export async function markMessagesRead(
  conversationId: string,
  readerUid: string
): Promise<void> {
  if (!db) return;
  const convRef = doc(db, "conversations", conversationId);
  await updateDoc(convRef, {
    [`unreadCounts.${readerUid}`]: 0,
  });
}

// ─────────────────────────────────────────────
// Typing indicator (lightweight presence)
// ─────────────────────────────────────────────

export async function setTyping(
  conversationId: string,
  uid: string,
  isTyping: boolean
): Promise<void> {
  if (!db) return;
  const convRef = doc(db, "conversations", conversationId);
  await updateDoc(convRef, {
    [`typing.${uid}`]: isTyping ? serverTimestamp() : null,
  }).catch(() => {}); // ignore if conv doesn't exist yet
}

// ─────────────────────────────────────────────
// Unsend a message (soft delete)
// ─────────────────────────────────────────────

export async function unsendMessage(
  conversationId: string,
  messageId: string,
  senderUid: string
): Promise<void> {
  if (!db) return;
  const msgRef = doc(db, "conversations", conversationId, "messages", messageId);
  const snap = await getDoc(msgRef);
  if (!snap.exists() || snap.data().senderUid !== senderUid) return;

  await updateDoc(msgRef, {
    isDeleted: true,
    deletedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

// ─────────────────────────────────────────────
// Get other participant's profile for chat header
// ─────────────────────────────────────────────

export async function getConversationPartner(
  conversationId: string,
  currentUid: string
): Promise<{ uid: string; username: string; displayName: string; photoUrl: string } | null> {
  if (!db) return null;

  const convSnap = await getDoc(doc(db, "conversations", conversationId));
  if (!convSnap.exists()) return null;

  const participants = convSnap.data().participants as string[];
  const partnerUid = participants.find((uid) => uid !== currentUid);
  if (!partnerUid) return null;

  const userSnap = await getDoc(doc(db, "users", partnerUid));
  if (!userSnap.exists()) return null;

  const data = userSnap.data();
  return {
    uid: partnerUid,
    username: (data.username as string) ?? "",
    displayName: (data.displayName as string) ?? "",
    photoUrl: (data.profilePhotoUrl as string) ?? "",
  };
}

// ─────────────────────────────────────────────
// Get total unread message count across all conversations
// ─────────────────────────────────────────────

export function subscribeToUnreadCount(
  uid: string,
  callback: (count: number) => void
): Unsubscribe {
  if (!db) return () => {};
  const q = query(
    collection(db, "conversations"),
    where("participants", "array-contains", uid),
    limit(30)
  );
  return onSnapshot(q, (snap) => {
    let total = 0;
    snap.docs.forEach((d) => {
      const counts = d.data().unreadCounts as Record<string, number> ?? {};
      total += counts[uid] ?? 0;
    });
    callback(total);
  });
}
