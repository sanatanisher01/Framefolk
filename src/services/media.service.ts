/**
 * FRAMEFOLK — Media Service
 *
 * Handles saving Cloudinary upload results as Firestore media documents,
 * creating posts, and loading media for display.
 */
"use client";

import {
  collection,
  doc,
  setDoc,
  getDocs,
  serverTimestamp,
  getDoc,
  query,
  where,
  orderBy,
  limit,
  updateDoc,
  increment,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { buildImageUrl, buildVideoThumbnail } from "@/lib/cloudinary/config";
import type { CloudinaryUploadResult } from "./upload.service";
import type { PostVisibility, PostType } from "@/types";
import { extractHashtags, extractMentions } from "@/utils/format";

// ─────────────────────────────────────────────
// Save media metadata document
// ─────────────────────────────────────────────

export interface SaveMediaPayload {
  ownerUid: string;
  result: CloudinaryUploadResult;
  visibility: PostVisibility;
  postId?: string;
  storyId?: string;
  albumId?: string;
  altText?: string;
}

export async function saveMediaDocument(
  payload: SaveMediaPayload
): Promise<string> {
  if (!db) throw new Error("Firebase not configured");

  const mediaRef = doc(collection(db, "media"));
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? "";

  await setDoc(mediaRef, {
    id: mediaRef.id,
    ownerUid: payload.ownerUid,
    postId: payload.postId ?? null,
    storyId: payload.storyId ?? null,
    albumId: payload.albumId ?? null,
    storageProvider: "central",
    cloudinaryAccountId: "central",
    cloudinaryPublicId: payload.result.publicId,
    assetId: payload.result.assetId,
    resourceType: payload.result.resourceType,
    format: payload.result.format,
    width: payload.result.width,
    height: payload.result.height,
    duration: payload.result.duration ?? null,
    bytes: payload.result.bytes,
    visibility: payload.visibility,
    isPrivate: payload.visibility !== "public",
    thumbnailPublicId: payload.result.thumbnailUrl
      ? payload.result.publicId
      : null,
    altText: payload.altText ?? "",
    deliveryUrl: buildImageUrl(payload.result.publicId, cloudName, {
      width: 1080,
    }),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return mediaRef.id;
}

// ─────────────────────────────────────────────
// Create a post document with media
// ─────────────────────────────────────────────

export interface CreatePostPayload {
  authorUid: string;
  authorUsername: string;
  authorDisplayName: string;
  authorPhotoUrl: string;
  caption: string;
  visibility: PostVisibility;
  mediaResults: CloudinaryUploadResult[];
  location?: { name: string; lat?: number; lng?: number };
  albumId?: string;
  scheduledFor?: Date;
}

export async function createPost(
  payload: CreatePostPayload
): Promise<string> {
  if (!db) throw new Error("Firebase not configured");

  const hashtags = extractHashtags(payload.caption);
  const mentions = extractMentions(payload.caption);

  // Determine post type
  let type: PostType = "photo";
  if (payload.mediaResults.length > 1) type = "multi";
  else if (payload.mediaResults[0]?.resourceType === "video") type = "video";

  const batch = writeBatch(db);

  // 1. Create post document
  const postRef = doc(collection(db, "posts"));
  const postId = postRef.id;

  // Save media documents first (need IDs for post)
  const mediaIds: string[] = [];
  for (const result of payload.mediaResults) {
    const mediaRef = doc(collection(db, "media"));
    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? "";
    batch.set(mediaRef, {
      id: mediaRef.id,
      ownerUid: payload.authorUid,
      postId,
      storyId: null,
      albumId: payload.albumId ?? null,
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
      deliveryUrl: result.resourceType === "video"
        ? buildVideoThumbnail(result.publicId, cloudName)
        : buildImageUrl(result.publicId, cloudName, { width: 1080 }),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    mediaIds.push(mediaRef.id);
  }

  // 2. Create post
  batch.set(postRef, {
    id: postId,
    authorUid: payload.authorUid,
    authorUsername: payload.authorUsername,
    authorDisplayName: payload.authorDisplayName,
    authorPhotoUrl: payload.authorPhotoUrl,
    type,
    caption: payload.caption,
    hashtags,
    mentions,
    mediaIds,
    coverMediaId: mediaIds[0] ?? null,
    visibility: payload.visibility,
    customAudienceUids: [],
    location: payload.location ?? null,
    likesCount: 0,
    commentsCount: 0,
    isHidden: false,
    isPinned: false,
    scheduledFor: payload.scheduledFor ?? null,
    publishedAt: payload.scheduledFor ? null : serverTimestamp(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  // 3. Increment author's post count
  const userRef = doc(db, "users", payload.authorUid);
  batch.update(userRef, {
    postsCount: increment(1),
    updatedAt: serverTimestamp(),
  });

  await batch.commit();
  return postId;
}

// ─────────────────────────────────────────────
// Update profile photo
// ─────────────────────────────────────────────

export interface UpdateProfilePhotoPayload {
  uid: string;
  result: CloudinaryUploadResult;
  type: "profile" | "cover";
}

export async function updateProfilePhoto(
  payload: UpdateProfilePhotoPayload
): Promise<void> {
  if (!db) throw new Error("Firebase not configured");

  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? "";
  const url = buildImageUrl(payload.result.publicId, cloudName, {
    width: payload.type === "profile" ? 400 : 1200,
  });

  const userRef = doc(db, "users", payload.uid);

  if (payload.type === "profile") {
    await updateDoc(userRef, {
      profilePhotoUrl: url,
      profilePhotoPublicId: payload.result.publicId,
      updatedAt: serverTimestamp(),
    });
  } else {
    await updateDoc(userRef, {
      coverPhotoUrl: url,
      coverPhotoPublicId: payload.result.publicId,
      updatedAt: serverTimestamp(),
    });
  }

  // Save as media document too
  await saveMediaDocument({
    ownerUid: payload.uid,
    result: payload.result,
    visibility: "private", // profile photos are delivered via public URL but not listed
  });
}

// ─────────────────────────────────────────────
// Load posts for feed (following)
// ─────────────────────────────────────────────

export async function loadFeedPosts(
  followingUids: string[],
  afterDoc?: unknown,
  pageSize = 10
) {
  if (!db || followingUids.length === 0) return { posts: [], cursor: null };

  // Firestore "in" query supports max 30 values
  const uids = followingUids.slice(0, 30);

  let q = query(
    collection(db, "posts"),
    where("authorUid", "in", uids),
    where("isHidden", "==", false),
    orderBy("createdAt", "desc"),
    limit(pageSize + 1)
  );

  if (afterDoc) {
    const { startAfter } = await import("firebase/firestore");
    q = query(q, startAfter(afterDoc));
  }

  const snap = await getDocs(q);
  const hasMore = snap.docs.length > pageSize;
  const docs = snap.docs.slice(0, pageSize);

  return {
    posts: docs.map((d) => ({ id: d.id, ...d.data() })),
    cursor: hasMore ? docs[docs.length - 1] : null,
  };
}

// ─────────────────────────────────────────────
// Get media delivery URL (checks privacy)
// ─────────────────────────────────────────────

export async function getMediaDeliveryUrl(
  mediaId: string,
  cloudName: string
): Promise<string | null> {
  if (!db) return null;
  const snap = await getDoc(doc(db, "media", mediaId));
  if (!snap.exists()) return null;

  const data = snap.data();
  const publicId = data.cloudinaryPublicId as string;
  const resourceType = data.resourceType as string;

  if (!data.isPrivate) {
    if (resourceType === "video") {
      return buildVideoThumbnail(publicId, cloudName);
    }
    return buildImageUrl(publicId, cloudName, { width: 1080 });
  }

  // Private — caller must use getSignedDeliveryUrl() from upload.service
  return null;
}
