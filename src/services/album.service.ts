/**
 * FRAMEFOLK — Album Service
 * Personal and collaborative albums.
 */
"use client";

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
  const albumRef = doc(collection(db, "albums"));
  await setDoc(albumRef, {
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
  await setDoc(doc(db, "albumMembers", `${albumRef.id}_${payload.ownerUid}`), {
    albumId: albumRef.id,
    uid: payload.ownerUid,
    role: "owner",
    invitedBy: payload.ownerUid,
    status: "accepted",
    joinedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
  });
  return albumRef.id;
}

// ─────────────────────────────────────────────
// Load albums for a user
// ─────────────────────────────────────────────

export function subscribeToMyAlbums(
  uid: string,
  callback: (albums: Album[]) => void
): Unsubscribe {
  if (!db) return () => {};
  const q = query(
    collection(db, "albums"),
    where("ownerUid", "==", uid),
    orderBy("updatedAt", "desc"),
    limit(50)
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
      createdAt: d.data().createdAt?.toDate() ?? new Date(),
      updatedAt: d.data().updatedAt?.toDate() ?? new Date(),
    } as Album)));
  });
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

export async function addMediaToAlbum(
  albumId: string,
  mediaId: string,
  setCover = false
): Promise<void> {
  if (!db) return;
  const albumRef = doc(db, "albums", albumId);
  const mediaRef = doc(db, "media", mediaId);

  const batch = writeBatch(db);
  batch.update(albumRef, {
    mediaCount: increment(1),
    ...(setCover && { coverMediaId: mediaId }),
    updatedAt: serverTimestamp(),
  });
  batch.update(mediaRef, { albumId, updatedAt: serverTimestamp() });
  await batch.commit();
}

export async function removeMediaFromAlbum(
  albumId: string,
  mediaId: string
): Promise<void> {
  if (!db) return;
  const batch = writeBatch(db);
  batch.update(doc(db, "albums", albumId), {
    mediaCount: increment(-1),
    updatedAt: serverTimestamp(),
  });
  batch.update(doc(db, "media", mediaId), {
    albumId: null,
    updatedAt: serverTimestamp(),
  });
  await batch.commit();
}

// ─────────────────────────────────────────────
// Load media in an album
// ─────────────────────────────────────────────

export async function getAlbumMedia(albumId: string) {
  if (!db) return [];
  const q = query(
    collection(db, "media"),
    where("albumId", "==", albumId),
    orderBy("createdAt", "desc"),
    limit(100)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// ─────────────────────────────────────────────
// Collaborative: invite member
// ─────────────────────────────────────────────

export async function inviteToAlbum(
  albumId: string,
  inviterUid: string,
  inviteeUid: string,
  role: "contributor" | "viewer"
): Promise<void> {
  if (!db) return;
  const memberId = `${albumId}_${inviteeUid}`;
  await setDoc(doc(db, "albumMembers", memberId), {
    albumId,
    uid: inviteeUid,
    role,
    invitedBy: inviterUid,
    status: "pending",
    joinedAt: null,
    createdAt: serverTimestamp(),
  });
  // Also create an invitation notification
  await setDoc(doc(collection(db, "invitations")), {
    type: "album",
    entityId: albumId,
    inviterUid,
    inviteeUid,
    role,
    status: "pending",
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function respondToAlbumInvite(
  albumId: string,
  uid: string,
  accept: boolean
): Promise<void> {
  if (!db) return;
  const memberId = `${albumId}_${uid}`;
  await updateDoc(doc(db, "albumMembers", memberId), {
    status: accept ? "accepted" : "rejected",
    joinedAt: accept ? serverTimestamp() : null,
  });
  if (accept) {
    await updateDoc(doc(db, "albums", albumId), {
      memberCount: increment(1),
    });
  }
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
  if (!db) return;
  // Unlink media from album (don't delete media)
  const mediaSnap = await getDocs(
    query(collection(db, "media"), where("albumId", "==", albumId), limit(200))
  );
  const batch = writeBatch(db);
  mediaSnap.docs.forEach((d) => batch.update(d.ref, { albumId: null }));
  batch.delete(doc(db, "albums", albumId));
  batch.delete(doc(db, "albumMembers", `${albumId}_${ownerUid}`));
  await batch.commit();
}
