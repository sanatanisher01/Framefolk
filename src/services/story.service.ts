/**
 * FRAMEFOLK — Story Service
 * Create, read, view and expire stories.
 */
"use client";
import { platformRequest, poll } from "./platform.service";

import {
  collection, doc, setDoc, getDoc, getDocs,
  query, where, orderBy, limit, updateDoc,
  serverTimestamp, Timestamp, onSnapshot,
  writeBatch, type Unsubscribe,
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
  onProgress?: (percent: number) => void;
  customAudienceUids?: string[];
}

export async function createStory(payload: CreateStoryPayload): Promise<string> {
  if (!db) throw new Error("Firebase not configured");

  const batch = writeBatch(db);
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // +24h
  const storyRef = doc(collection(db, "stories"));
  const storyId = storyRef.id;

  let mediaId: string | null = null;
  let cloudinaryPublicId: string | null = null;

  // Upload media if present
  if ((payload.type === "photo" || payload.type === "video") && payload.file) {
    const result = await uploadFile(payload.file, {
      onProgress: payload.onProgress,
      context: "story",
      isPrivate: payload.visibility !== "public",
    });

    // Save media document
    const mediaRef = doc(collection(db, "media"));
    mediaId = mediaRef.id;
    cloudinaryPublicId = result.publicId;

    batch.set(mediaRef, {
      id: mediaRef.id,
      ownerUid: payload.authorUid,
      postId: null,
      storyId,
      albumId: null,
      storageProvider: result.accountId && result.accountId !== "central" ? "personal" : "central",
      cloudinaryAccountId: result.accountId ?? "central",
      cloudName: result.cloudName ?? process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
      deliveryType: result.deliveryType ?? "upload",
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

  batch.set(storyRef, {
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
    customAudienceUids: payload.customAudienceUids ?? [],
    viewsCount: 0,
    reactionsCount: 0,
    expiresAt: Timestamp.fromDate(expiresAt),
    isExpired: false,
    isDeleted: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  await batch.commit();
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

export async function loadStoriesGrouped(currentUid: string): Promise<StoryAuthorGroup[]> {
 const stories = await platformRequest<Story[]>("stories");
 const groups = new Map<string, StoryAuthorGroup>();
 for (const story of stories) {
  let group = groups.get(story.authorUid);
  if (!group) { group = { authorUid: story.authorUid, authorUsername: story.authorUsername, authorPhotoUrl: story.authorPhotoUrl, stories: [], hasUnviewed: false }; groups.set(story.authorUid, group); }
  group.stories.push(story);
 }
 // Read exact active-story view IDs, so historical views cannot displace current ones.
 await Promise.all(Array.from(groups.values()).map(async group => {
  const views = await Promise.all(group.stories.map(story => getDoc(doc(db, "storyViews", `${story.id}_${currentUid}`)).catch(() => null)));
  group.hasUnviewed = views.some(view => !view?.exists());
  group.stories.sort((a,b) => a.createdAt.getTime() - b.createdAt.getTime());
 }));
 return Array.from(groups.values()).sort((a,b) => Number(b.authorUid === currentUid) - Number(a.authorUid === currentUid) || Number(b.hasUnviewed) - Number(a.hasUnviewed));
}

// ─────────────────────────────────────────────
// Load stories for a single user
// ─────────────────────────────────────────────

export async function loadUserStories(authorUid: string): Promise<Story[]> {
 return platformRequest<Story[]>("stories", { authorUid });
}

// ─────────────────────────────────────────────
// Mark a story as viewed
// ─────────────────────────────────────────────

export async function markStoryViewed(storyId: string, viewerUid: string): Promise<void> {
 await platformRequest("viewStory", { storyId });
}

// ─────────────────────────────────────────────
// React to a story
// ─────────────────────────────────────────────

export async function reactToStory(storyId: string, viewerUid: string, reaction: string): Promise<void> {
 await platformRequest("reactStory", { storyId, reaction });
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

export function subscribeToMyStories(uid: string, callback: (stories: Story[]) => void): Unsubscribe {
 return poll(() => loadUserStories(uid), callback, () => callback([]));
}
