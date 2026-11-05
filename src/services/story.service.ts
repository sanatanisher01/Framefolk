/**
 * FRAMEFOLK — Story Service
 * Create, read, view and expire stories.
 */
"use client";

import {
  collection, doc, setDoc, getDoc, getDocs,
  query, where, orderBy, limit, updateDoc,
  serverTimestamp, Timestamp, onSnapshot,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import type { Story, StoryView, PostVisibility } from "@/types";
import { uploadFile } from "./upload.service";

// ─────────────────────────────────────────────
// Create a story
// ─────────────────────────────────────────────

export interface CreateStoryPayload {
  authorUid: string;
  authorUsername: string;
  authorPhotoUrl: string;
  type: "photo" | "video" | "text";
  visibility: PostVisibility;
  // For photo/video:
  file?: File;
  // For text:
  textContent?: string;
  textStyle?: { color: string; fontSize: number; fontFamily: string; background: string };
  caption?: string;
}

export async function createStory(payload: CreateStoryPayload): Promise<string> {
  if (!db) throw new Error("Firebase not configured");

  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // +24h
  const storyRef = doc(collection(db, "stories"));
  const storyId = storyRef.id;

  let mediaId: string | null = null;
  let cloudinaryPublicId: string | null = null;

  // Upload media if present
  if ((payload.type === "photo" || payload.type === "video") && payload.file) {
    const result = await uploadFile(payload.file, {
      context: "story",
      isPrivate: payload.visibility !== "public",
    });

    // Save media document
    const mediaRef = doc(collection(db, "media"));
    mediaId = mediaRef.id;
    cloudinaryPublicId = result.publicId;

    await setDoc(mediaRef, {
      id: mediaRef.id,
      ownerUid: payload.authorUid,
      postId: null,
      storyId,
      albumId: null,
      storageProvider: "central",
      cloudinaryAccountId: "central",
      cloudinaryPublicId: result.publicId,
      assetId: result.assetId,
      resourceType: result.resourceType,
      format: result.format,
      width: result.width,
      height: result.height,
      duration: result.duration ?? null,
      bytes: result.bytes,
      visibility: payload.visibility,
      isPrivate: payload.visibility !== "public",
      thumbnailPublicId: result.thumbnailUrl ? result.publicId : null,
      altText: "",
      deliveryUrl: result.secureUrl,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  await setDoc(storyRef, {
    id: storyId,
    authorUid: payload.authorUid,
    authorUsername: payload.authorUsername,
    authorPhotoUrl: payload.authorPhotoUrl,
    type: payload.type,
    mediaId,
    cloudinaryPublicId,
    textContent: payload.textContent ?? null,
    textStyle: payload.textStyle ?? null,
    caption: payload.caption ?? null,
    visibility: payload.visibility,
    customAudienceUids: [],
    viewsCount: 0,
    reactionsCount: 0,
    expiresAt: Timestamp.fromDate(expiresAt),
    isExpired: false,
    isDeleted: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return storyId;
}

// ─────────────────────────────────────────────
// Load stories for carousel (grouped by author)
// ─────────────────────────────────────────────

export interface StoryAuthorGroup {
  authorUid: string;
  authorUsername: string;
  authorPhotoUrl: string;
  stories: Story[];
  hasUnviewed: boolean;
}

export async function loadStoriesGrouped(
  currentUid: string
): Promise<StoryAuthorGroup[]> {
  if (!db) return [];

  const now = new Date();
  const q = query(
    collection(db, "stories"),
    where("isExpired", "==", false),
    where("isDeleted", "==", false),
    where("expiresAt", ">", Timestamp.fromDate(now)),
    orderBy("expiresAt"),
    limit(100)
  );

  const snap = await getDocs(q);
  const groups = new Map<string, StoryAuthorGroup>();

  for (const d of snap.docs) {
    const data = d.data();
    const uid = data.authorUid as string;
    const story = {
      id: d.id,
      ...data,
      expiresAt: data.expiresAt?.toDate() ?? new Date(),
      createdAt: data.createdAt?.toDate() ?? new Date(),
      updatedAt: data.updatedAt?.toDate() ?? new Date(),
    } as Story;

    if (!groups.has(uid)) {
      groups.set(uid, {
        authorUid: uid,
        authorUsername: (data.authorUsername as string) ?? "",
        authorPhotoUrl: (data.authorPhotoUrl as string) ?? "",
        stories: [],
        hasUnviewed: false,
      });
    }
    groups.get(uid)!.stories.push(story);
  }

  // Check which stories current user has viewed
  if (groups.size > 0) {
    const viewedQuery = query(
      collection(db, "storyViews"),
      where("viewerUid", "==", currentUid),
      limit(200)
    );
    const viewedSnap = await getDocs(viewedQuery);
    const viewedStoryIds = new Set(viewedSnap.docs.map((d) => d.data().storyId as string));

    for (const group of groups.values()) {
      group.hasUnviewed = group.stories.some((s) => !viewedStoryIds.has(s.id));
    }
  }

  // Put current user's own stories first
  const result = Array.from(groups.values());
  result.sort((a, b) => {
    if (a.authorUid === currentUid) return -1;
    if (b.authorUid === currentUid) return 1;
    return b.hasUnviewed ? 1 : -1;
  });

  return result;
}

// ─────────────────────────────────────────────
// Load stories for a single user
// ─────────────────────────────────────────────

export async function loadUserStories(authorUid: string): Promise<Story[]> {
  if (!db) return [];
  const now = new Date();
  const q = query(
    collection(db, "stories"),
    where("authorUid", "==", authorUid),
    where("isExpired", "==", false),
    where("isDeleted", "==", false),
    where("expiresAt", ">", Timestamp.fromDate(now)),
    orderBy("expiresAt"),
    limit(20)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({
    id: d.id,
    ...d.data(),
    expiresAt: d.data().expiresAt?.toDate() ?? new Date(),
    createdAt: d.data().createdAt?.toDate() ?? new Date(),
    updatedAt: d.data().updatedAt?.toDate() ?? new Date(),
  } as Story));
}

// ─────────────────────────────────────────────
// Mark a story as viewed
// ─────────────────────────────────────────────

export async function markStoryViewed(
  storyId: string,
  viewerUid: string
): Promise<void> {
  if (!db) return;

  const viewId = `${storyId}_${viewerUid}`;
  const viewRef = doc(db, "storyViews", viewId);
  const existing = await getDoc(viewRef);
  if (existing.exists()) return; // already viewed

  await setDoc(viewRef, {
    storyId,
    viewerUid,
    reaction: null,
    reply: null,
    viewedAt: serverTimestamp(),
  });

  await updateDoc(doc(db, "stories", storyId), {
    viewsCount: ((await getDoc(doc(db, "stories", storyId))).data()?.viewsCount ?? 0) + 1,
  });
}

// ─────────────────────────────────────────────
// React to a story
// ─────────────────────────────────────────────

export async function reactToStory(
  storyId: string,
  viewerUid: string,
  reaction: string
): Promise<void> {
  if (!db) return;
  const viewId = `${storyId}_${viewerUid}`;
  await setDoc(
    doc(db, "storyViews", viewId),
    { reaction, viewedAt: serverTimestamp() },
    { merge: true }
  );
  await updateDoc(doc(db, "stories", storyId), {
    reactionsCount: ((await getDoc(doc(db, "stories", storyId))).data()?.reactionsCount ?? 0) + 1,
  });
}

// ─────────────────────────────────────────────
// Get story viewers (for author)
// ─────────────────────────────────────────────

export async function getStoryViewers(storyId: string): Promise<StoryView[]> {
  if (!db) return [];
  const q = query(
    collection(db, "storyViews"),
    where("storyId", "==", storyId),
    orderBy("viewedAt", "desc"),
    limit(50)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({
    id: d.id,
    ...d.data(),
    viewedAt: d.data().viewedAt?.toDate() ?? new Date(),
  } as StoryView));
}

// ─────────────────────────────────────────────
// Subscribe to own stories (for highlights)
// ─────────────────────────────────────────────

export function subscribeToMyStories(
  uid: string,
  callback: (stories: Story[]) => void
): Unsubscribe {
  if (!db) return () => {};
  const now = new Date();
  const q = query(
    collection(db, "stories"),
    where("authorUid", "==", uid),
    where("isExpired", "==", false),
    where("expiresAt", ">", Timestamp.fromDate(now)),
    orderBy("expiresAt"),
    limit(20)
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
      expiresAt: d.data().expiresAt?.toDate() ?? new Date(),
      createdAt: d.data().createdAt?.toDate() ?? new Date(),
      updatedAt: d.data().updatedAt?.toDate() ?? new Date(),
    } as Story)));
  });
}
