/**
 * FRAMEFOLK — Admin Service
 * Loads platform stats, manages users, reports, deletion requests, audit logs.
 * Privileged mutations use authenticated Cloud Functions and propagate failures.
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
// Authorization failures are never bypassed with direct Firestore writes.
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
 await httpsCallable(fns(), "approveAccount")({ targetUid, ...(note ? { note } : {}) });
}

export async function callRejectAccount(targetUid: string, reason: string): Promise<void> {
 await httpsCallable(fns(), "rejectAccount")({ targetUid, reason });
}

export async function callBlockAccount(targetUid: string, reason: string): Promise<void> {
 await httpsCallable(fns(), "blockAccount")({ targetUid, reason });
}

export async function callUnblockAccount(targetUid: string): Promise<void> {
 await httpsCallable(fns(), "unblockAccount")({ targetUid });
}

export async function callSuspendAccount(targetUid: string, reason: string, durationDays?: number): Promise<void> {
 await httpsCallable(fns(), "suspendAccount")({ targetUid, reason, ...(durationDays ? { durationDays } : {}) });
}

export async function callDeleteCloudinaryAsset(deletionRequestId: string): Promise<void> {
 await httpsCallable(fns(), "deleteCloudinaryAsset")({ deletionRequestId });
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
    where("status", "in", ["pending", "approved", "failed"]),
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

export async function callHandleReport(reportId: string, action: "actioned" | "dismissed") {
 await httpsCallable(fns(), "handleReport")({ reportId, action });
}
export async function callProcessDeletion(requestId: string, decision: "approved" | "rejected") {
 await httpsCallable(fns(), "processDeletionRequest")({ requestId, decision });
}
