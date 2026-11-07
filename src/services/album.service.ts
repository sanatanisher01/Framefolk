/**
 * FRAMEFOLK — Album Service
 * Personal and collaborative albums.
 */
"use client";
import { getSignedDeliveryUrl } from "./upload.service";
import { platformRequest, poll } from "./platform.service";

import {
  collection, doc, setDoc, getDoc, getDocs, updateDoc, deleteDoc,
  query, where, orderBy, limit, onSnapshot, serverTimestamp,
  increment, writeBatch, type Unsubscribe,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import type { Album, AlbumMember, PostVisibility } from "@/types";

// ─────────────────────────────────────────────
// Create album
// ─────────────────────────────────────────────

export interface CreateAlbumPayload {
  ownerUid: string;
  title: string;
  description: string;
  type: "personal" | "collaborative";
  visibility: PostVisibility;
}

export async function createAlbum(payload: CreateAlbumPayload): Promise<string> {
  if (!db) throw new Error("Firebase not configured");
  const batch = writeBatch(db);
  const albumRef = doc(collection(db, "albums"));
  batch.set(albumRef, {
    id: albumRef.id,
    ownerUid: payload.ownerUid,
    title: payload.title,
    description: payload.description,
    coverMediaId: null,
    mediaCount: 0,
    type: payload.type,
    visibility: payload.visibility,
    memberCount: 1,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  // Add owner as member
  batch.set(doc(db, "albumMembers", `${albumRef.id}_${payload.ownerUid}`), {
    albumId: albumRef.id,
    uid: payload.ownerUid,
    role: "owner",
    invitedBy: payload.ownerUid,
    status: "accepted",
    joinedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
  });
  await batch.commit();
  window.dispatchEvent(new Event("framefolk:updated"));
  return albumRef.id;
}

// ─────────────────────────────────────────────
// Load albums for a user
// ─────────────────────────────────────────────

export function subscribeToMyAlbums(uid: string, callback: (albums: Album[]) => void): Unsubscribe {
 return poll(() => platformRequest<Album[]>("albums", { ownerUid: uid }), callback, () => callback([]));
}

export async function getAlbum(albumId: string): Promise<Album | null> {
  if (!db) return null;
  const snap = await getDoc(doc(db, "albums", albumId));
  if (!snap.exists()) return null;
  return {
    id: snap.id,
    ...snap.data(),
    createdAt: snap.data().createdAt?.toDate() ?? new Date(),
    updatedAt: snap.data().updatedAt?.toDate() ?? new Date(),
  } as Album;
}

// ─────────────────────────────────────────────
// Add media to album
// ─────────────────────────────────────────────

export async function addMediaToAlbum(albumId: string, mediaId: string, setCover = false): Promise<void> {
 await platformRequest("albumMedia", { albumId, mediaId, setCover });
}

export async function removeMediaFromAlbum(albumId: string, mediaId: string): Promise<void> {
 await platformRequest("albumMedia", { albumId, mediaId, remove: true });
}

// ─────────────────────────────────────────────
// Load media in an album
// ─────────────────────────────────────────────

export async function getAlbumMedia(albumId: string): Promise<Record<string, unknown>[]> {
 const media = await platformRequest<Record<string, unknown>[]>("albumMediaPage", { albumId });
 return Promise.all(media.map(async item => ({ ...item, thumbnailUrl: await getSignedDeliveryUrl(item.id as string, true).catch(() => "") })));
}

// ─────────────────────────────────────────────
// Collaborative: invite member
// ─────────────────────────────────────────────

export async function inviteToAlbum(albumId: string, inviterUid: string, inviteeUid: string, role: "contributor" | "viewer"): Promise<void> {
 await platformRequest("albumInvite", { albumId, targetUid: inviteeUid, role });
}

export async function respondToAlbumInvite(albumId: string, uid: string, accept: boolean): Promise<void> {
 await platformRequest("albumRespond", { albumId, accept });
}

export async function getAlbumMembers(albumId: string): Promise<AlbumMember[]> {
  if (!db) return [];
  const q = query(
    collection(db, "albumMembers"),
    where("albumId", "==", albumId),
    where("status", "==", "accepted")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({
    id: d.id,
    ...d.data(),
    joinedAt: d.data().joinedAt?.toDate() ?? null,
    createdAt: d.data().createdAt?.toDate() ?? new Date(),
  } as AlbumMember));
}

// ─────────────────────────────────────────────
// Update album
// ─────────────────────────────────────────────

export async function updateAlbum(
  albumId: string,
  updates: { title?: string; description?: string; visibility?: PostVisibility; coverMediaId?: string }
): Promise<void> {
  if (!db) return;
  await updateDoc(doc(db, "albums", albumId), {
    ...updates,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteAlbum(albumId: string, ownerUid: string): Promise<void> {
 await platformRequest("albumDelete", { albumId });
}
