/**
 * FRAMEFOLK — Admin Service
 * Loads platform stats, manages users, reports, deletion requests, audit logs.
 * Privileged mutations fall back to direct Firestore writes when Cloud Functions
 * are unavailable (Spark plan). When on Blaze plan + functions deployed, the
 * callable wrappers below will call the Cloud Functions instead.
 */
"use client";

import {
  collection, getDocs, query, where, orderBy, limit,
  onSnapshot, doc, getDoc, updateDoc, addDoc, serverTimestamp,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { auth } from "@/lib/firebase/client";
import { getFunctions, httpsCallable } from "firebase/functions";
import { getApp } from "firebase/app";

// ─────────────────────────────────────────────
// Callable Cloud Function helpers
// Falls back to direct Firestore writes when functions aren't deployed.
// ─────────────────────────────────────────────

let _functions: ReturnType<typeof getFunctions> | null = null;

function fns() {
  if (!_functions) _functions = getFunctions(getApp());
  return _functions;
}

function currentUid(): string {
  return auth?.currentUser?.uid ?? "unknown-admin";
}

export async function callApproveAccount(targetUid: string, note?: string): Promise<void> {
  if (!db) throw new Error("Firebase not configured");
  try {
    // Try Cloud Function first (works on Blaze plan)
    const fn = httpsCallable(fns(), "approveAccount");
    await fn({ targetUid, note });
    return;
  } catch {
    // Cloud Function not available — apply changes directly via Firestore
  }

  const now = serverTimestamp();
  const adminUid = currentUid();

  // 1. Update user status
  await updateDoc(doc(db, "users", targetUid), {
    status: "approved",
    approvedAt: now,
    updatedAt: now,
  });

  // 2. Notify the user
  await addDoc(collection(db, "notifications"), {
    recipientUid: targetUid,
    senderUid: adminUid,
    senderUsername: "FRAMEFOLK",
    senderPhotoUrl: "",
    type: "adminAction",
    entityType: "user",
    entityId: targetUid,
    text: "Your account has been approved! Welcome to FRAMEFOLK.",
    isRead: false,
    createdAt: now,
    readAt: null,
  }).catch(() => {});

  // 3. Audit log
  await addDoc(collection(db, "auditLogs"), {
    actorUid: adminUid,
    actorRole: "moderator",
    action: "accountApproved",
    targetUid,
    targetEntityType: "user",
    targetEntityId: targetUid,
    previousValue: { status: "pending" },
    newValue: { status: "approved" },
    reason: note ?? null,
    ipAddress: null,
    createdAt: now,
  }).catch(() => {});
}

export async function callRejectAccount(targetUid: string, reason: string): Promise<void> {
  if (!db) throw new Error("Firebase not configured");
  try {
    const fn = httpsCallable(fns(), "rejectAccount");
    await fn({ targetUid, reason });
    return;
  } catch {
    // Cloud Function not available — apply directly
  }

  const now = serverTimestamp();
  const adminUid = currentUid();

  await updateDoc(doc(db, "users", targetUid), {
    status: "rejected",
    updatedAt: now,
  });

  await addDoc(collection(db, "notifications"), {
    recipientUid: targetUid,
    senderUid: adminUid,
    senderUsername: "FRAMEFOLK",
    senderPhotoUrl: "",
    type: "adminAction",
    entityType: "user",
    entityId: targetUid,
    text: "Your registration was not approved. Contact support for more information.",
    isRead: false,
    createdAt: now,
    readAt: null,
  }).catch(() => {});

  await addDoc(collection(db, "auditLogs"), {
    actorUid: adminUid,
    actorRole: "moderator",
    action: "accountRejected",
    targetUid,
    targetEntityType: "user",
    targetEntityId: targetUid,
    previousValue: { status: "pending" },
    newValue: { status: "rejected" },
    reason,
    ipAddress: null,
    createdAt: now,
  }).catch(() => {});
}

export async function callBlockAccount(targetUid: string, reason: string): Promise<void> {
  if (!db) throw new Error("Firebase not configured");
  try {
    const fn = httpsCallable(fns(), "blockAccount");
    await fn({ targetUid, reason });
    return;
  } catch { /* fall through */ }

  const now = serverTimestamp();
  const adminUid = currentUid();
  await updateDoc(doc(db, "users", targetUid), { status: "blocked", updatedAt: now });
  await addDoc(collection(db, "auditLogs"), {
    actorUid: adminUid, actorRole: "moderator", action: "accountBlocked",
    targetUid, targetEntityType: "user", targetEntityId: targetUid,
    previousValue: null, newValue: { status: "blocked" }, reason, ipAddress: null, createdAt: now,
  }).catch(() => {});
}

export async function callUnblockAccount(targetUid: string): Promise<void> {
  if (!db) throw new Error("Firebase not configured");
  try {
    const fn = httpsCallable(fns(), "unblockAccount");
    await fn({ targetUid });
    return;
  } catch { /* fall through */ }

  const now = serverTimestamp();
  const adminUid = currentUid();
  await updateDoc(doc(db, "users", targetUid), { status: "approved", updatedAt: now });
  await addDoc(collection(db, "auditLogs"), {
    actorUid: adminUid, actorRole: "moderator", action: "accountUnblocked",
    targetUid, targetEntityType: "user", targetEntityId: targetUid,
    previousValue: null, newValue: { status: "approved" }, reason: null, ipAddress: null, createdAt: now,
  }).catch(() => {});
}

export async function callSuspendAccount(targetUid: string, reason: string, durationDays?: number): Promise<void> {
  if (!db) throw new Error("Firebase not configured");
  try {
    const fn = httpsCallable(fns(), "suspendAccount");
    await fn({ targetUid, reason, durationDays });
    return;
  } catch { /* fall through */ }

  const now = serverTimestamp();
  const adminUid = currentUid();
  await updateDoc(doc(db, "users", targetUid), { status: "suspended", updatedAt: now });
  await addDoc(collection(db, "auditLogs"), {
    actorUid: adminUid, actorRole: "moderator", action: "accountSuspended",
    targetUid, targetEntityType: "user", targetEntityId: targetUid,
    previousValue: null, newValue: { status: "suspended", durationDays: durationDays ?? null }, reason, ipAddress: null, createdAt: now,
  }).catch(() => {});
}

export async function callDeleteCloudinaryAsset(deletionRequestId: string): Promise<void> {
  if (!db) throw new Error("Firebase not configured");
  try {
    const fn = httpsCallable(fns(), "deleteCloudinaryAsset");
    await fn({ deletionRequestId });
    return;
  } catch {
    // Cloud Function not available — just mark as failed with a note
    await updateDoc(doc(db, "deletionRequests", deletionRequestId), {
      status: "failed",
      adminNote: "Cloud Functions not deployed. Manual Cloudinary deletion required.",
      updatedAt: serverTimestamp(),
    }).catch(() => {});
    throw new Error("Cloud Functions not deployed. Mark deletion as requiring manual action.");
  }
}

// ─────────────────────────────────────────────
// Dashboard stats
// ─────────────────────────────────────────────

export interface AdminStats {
  totalUsers: number;
  approvedUsers: number;
  pendingUsers: number;
  blockedUsers: number;
  suspendedUsers: number;
  totalPosts: number;
  pendingReports: number;
  pendingDeletionRequests: number;
  mediaStorageBytes: number;
}

/** Loads approximate platform stats via lightweight Firestore counts */
export async function loadAdminStats(): Promise<AdminStats> {
  if (!db) {
    return { totalUsers: 0, approvedUsers: 0, pendingUsers: 0, blockedUsers: 0, suspendedUsers: 0, totalPosts: 0, pendingReports: 0, pendingDeletionRequests: 0, mediaStorageBytes: 0 };
  }

  const [
    usersSnap, pendingSnap, blockedSnap, suspendedSnap,
    postsSnap, reportsSnap, delReqSnap, mediaSnap,
  ] = await Promise.all([
    getDocs(query(collection(db, "users"), limit(1000))),
    getDocs(query(collection(db, "users"), where("status", "==", "pending"), limit(500))),
    getDocs(query(collection(db, "users"), where("status", "==", "blocked"), limit(500))),
    getDocs(query(collection(db, "users"), where("status", "==", "suspended"), limit(500))),
    getDocs(query(collection(db, "posts"), limit(1000))),
    getDocs(query(collection(db, "reports"), where("status", "==", "pending"), limit(500))),
    getDocs(query(collection(db, "deletionRequests"), where("status", "==", "pending"), limit(500))),
    getDocs(query(collection(db, "media"), limit(1000))),
  ]);

  const approvedCount = usersSnap.docs.filter((d) => d.data().status === "approved").length;
  let storageBytes = 0;
  mediaSnap.docs.forEach((d) => { storageBytes += (d.data().bytes as number) ?? 0; });

  return {
    totalUsers: usersSnap.size,
    approvedUsers: approvedCount,
    pendingUsers: pendingSnap.size,
    blockedUsers: blockedSnap.size,
    suspendedUsers: suspendedSnap.size,
    totalPosts: postsSnap.size,
    pendingReports: reportsSnap.size,
    pendingDeletionRequests: delReqSnap.size,
    mediaStorageBytes: storageBytes,
  };
}

// ─────────────────────────────────────────────
// Pending registrations
// ─────────────────────────────────────────────

export function subscribeToPendingRegistrations(
  callback: (users: PendingRegistration[]) => void,
  pageSize = 50
): Unsubscribe {
  if (!db) return () => {};
  const q = query(
    collection(db, "users"),
    where("status", "==", "pending"),
    orderBy("createdAt", "desc"),
    limit(pageSize)
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({
      uid: d.id,
      displayName: (d.data().displayName as string) ?? "",
      email: (d.data().email as string) ?? "",
      username: (d.data().username as string) ?? "",
      bio: (d.data().bio as string) ?? "",
      profilePhotoUrl: (d.data().profilePhotoUrl as string) ?? "",
      createdAt: d.data().createdAt?.toDate() ?? new Date(),
    })));
  });
}

export interface PendingRegistration {
  uid: string;
  displayName: string;
  email: string;
  username: string;
  bio: string;
  profilePhotoUrl: string;
  createdAt: Date;
}

// ─────────────────────────────────────────────
// All users (for user management)
// ─────────────────────────────────────────────

export function subscribeToAllUsers(
  callback: (users: AdminUserRow[]) => void,
  pageSize = 100
): Unsubscribe {
  if (!db) return () => {};
  const q = query(
    collection(db, "users"),
    orderBy("createdAt", "desc"),
    limit(pageSize)
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({
      uid: d.id,
      displayName: (d.data().displayName as string) ?? "",
      email: (d.data().email as string) ?? "",
      username: (d.data().username as string) ?? "",
      status: (d.data().status as string) ?? "pending",
      profilePhotoUrl: (d.data().profilePhotoUrl as string) ?? "",
      followersCount: (d.data().followersCount as number) ?? 0,
      postsCount: (d.data().postsCount as number) ?? 0,
      createdAt: d.data().createdAt?.toDate() ?? new Date(),
    })));
  });
}

export interface AdminUserRow {
  uid: string;
  displayName: string;
  email: string;
  username: string;
  status: string;
  profilePhotoUrl: string;
  followersCount: number;
  postsCount: number;
  createdAt: Date;
}

// ─────────────────────────────────────────────
// Reports
// ─────────────────────────────────────────────

export function subscribeToReports(
  callback: (reports: AdminReportRow[]) => void,
  pageSize = 50
): Unsubscribe {
  if (!db) return () => {};
  const q = query(
    collection(db, "reports"),
    where("status", "==", "pending"),
    orderBy("createdAt", "desc"),
    limit(pageSize)
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({
      id: d.id,
      reporterUid: (d.data().reporterUid as string) ?? "",
      entityType: (d.data().entityType as string) ?? "",
      entityId: (d.data().entityId as string) ?? "",
      reason: (d.data().reason as string) ?? "",
      details: (d.data().details as string) ?? "",
      status: (d.data().status as string) ?? "pending",
      createdAt: d.data().createdAt?.toDate() ?? new Date(),
    })));
  });
}

export interface AdminReportRow {
  id: string;
  reporterUid: string;
  entityType: string;
  entityId: string;
  reason: string;
  details: string;
  status: string;
  createdAt: Date;
}

// ─────────────────────────────────────────────
// Deletion requests
// ─────────────────────────────────────────────

export function subscribeToDeletionRequests(
  callback: (requests: AdminDeletionRequest[]) => void,
  pageSize = 50
): Unsubscribe {
  if (!db) return () => {};
  const q = query(
    collection(db, "deletionRequests"),
    where("status", "==", "pending"),
    orderBy("createdAt", "desc"),
    limit(pageSize)
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({
      id: d.id,
      requesterUid: (d.data().requesterUid as string) ?? "",
      entityType: (d.data().entityType as string) ?? "",
      entityId: (d.data().entityId as string) ?? "",
      reason: (d.data().reason as string) ?? "",
      status: (d.data().status as string) ?? "pending",
      createdAt: d.data().createdAt?.toDate() ?? new Date(),
    })));
  });
}

export interface AdminDeletionRequest {
  id: string;
  requesterUid: string;
  entityType: string;
  entityId: string;
  reason: string;
  status: string;
  createdAt: Date;
}

// ─────────────────────────────────────────────
// Audit logs
// ─────────────────────────────────────────────

export function subscribeToAuditLogs(
  callback: (logs: AuditLogRow[]) => void,
  pageSize = 100
): Unsubscribe {
  if (!db) return () => {};
  const q = query(
    collection(db, "auditLogs"),
    orderBy("createdAt", "desc"),
    limit(pageSize)
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({
      id: d.id,
      actorUid: (d.data().actorUid as string) ?? "",
      actorRole: (d.data().actorRole as string) ?? "",
      action: (d.data().action as string) ?? "",
      targetUid: (d.data().targetUid as string) ?? null,
      targetEntityType: (d.data().targetEntityType as string) ?? null,
      targetEntityId: (d.data().targetEntityId as string) ?? null,
      reason: (d.data().reason as string) ?? null,
      createdAt: d.data().createdAt?.toDate() ?? new Date(),
    })));
  });
}

export interface AuditLogRow {
  id: string;
  actorUid: string;
  actorRole: string;
  action: string;
  targetUid: string | null;
  targetEntityType: string | null;
  targetEntityId: string | null;
  reason: string | null;
  createdAt: Date;
}
