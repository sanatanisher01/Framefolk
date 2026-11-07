/**
 * FRAMEFOLK — Messaging Service
 * Real-time one-to-one direct messaging via Firestore.
 */
"use client";
import { getUserDoc } from "./auth.service";
import { platformRequest, poll } from "./platform.service";

import {
  collection, doc, getDoc, setDoc,
  updateDoc, query, where, orderBy, limit, onSnapshot,
  serverTimestamp, increment, writeBatch,
  limitToLast, type Unsubscribe,
} from "firebase/firestore";
import { db, auth } from "@/lib/firebase/client";
import type { Conversation, Message } from "@/types";

// ─────────────────────────────────────────────
// Conversation helpers
// ─────────────────────────────────────────────

/** Deterministic conversation ID for two users (sorted UIDs joined by _) */
function conversationId(uidA: string, uidB: string): string {
  return [uidA, uidB].sort().join("_");
}

export async function getOrCreateConversation(uidA: string, uidB: string): Promise<string> {
 return platformRequest<string>("conversation", { targetUid: uidB });
}

// ─────────────────────────────────────────────
// Load conversations for a user
// ─────────────────────────────────────────────

export function subscribeToConversations(uid: string, callback: (convs: Conversation[]) => void): Unsubscribe {
 return poll(() => platformRequest<Conversation[]>("conversations"), callback, () => callback([]));
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
  // Simple orderBy only — filter isDeleted client-side to avoid composite index requirement
  const q = query(
    collection(db, "conversations", conversationId, "messages"),
    orderBy("createdAt", "asc"), limitToLast(pageSize)
  );
  let lastReadAt = 0;
  let myReadAt = 0;
  let latest: Message[] = [];
  const publish = () => callback(latest.map(m => ({ ...m, isRead: m.isRead || m.createdAt.getTime() <= (m.senderUid === auth?.currentUser?.uid ? lastReadAt : myReadAt) })));
  const stopConversation = onSnapshot(doc(db, "conversations", conversationId), snap => {
    const d = snap.data();
    const partner = (d?.participants as string[] | undefined)?.find(p => p !== auth?.currentUser?.uid);
    myReadAt = d?.lastReadAt?.[auth?.currentUser?.uid ?? ""]?.toMillis() ?? 0;
    lastReadAt = partner ? d?.lastReadAt?.[partner]?.toMillis() ?? 0 : 0;
    publish();
  }, () => callback([]));
  const stopMessages = onSnapshot(q, (snap) => {
    const messages = snap.docs
      .map((d) => {
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
      })
      .filter((m) => !m.isDeleted); // filter client-side
    latest = messages; publish();
  }, () => callback([]));
  return () => { stopConversation(); stopMessages(); };
}

// ─────────────────────────────────────────────
// Send a message
// ─────────────────────────────────────────────

export async function sendMessage(conversationId: string, senderUid: string, recipientUid: string, text: string): Promise<string> {
 return platformRequest<string>("sendMessage", { conversationId, text });
}

// ─────────────────────────────────────────────
// Mark messages as read
// ─────────────────────────────────────────────

export async function markMessagesRead(conversationId: string, readerUid: string): Promise<void> {
 await platformRequest("readMessages", { conversationId });
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

export async function unsendMessage(conversationId: string, messageId: string, senderUid: string): Promise<void> {
 await platformRequest("unsend", { conversationId, messageId });
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

  const data = await getUserDoc(partnerUid);
  if (!data) return null;
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

export function subscribeToUnreadCount(uid: string, callback: (count: number) => void): Unsubscribe {
 return subscribeToConversations(uid, convs => callback(convs.reduce((sum,c) => sum + (c.unreadCounts?.[uid] ?? 0), 0)));
}
