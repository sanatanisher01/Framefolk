/**
 * FRAMEFOLK — Media Service
 *
 * Handles saving Cloudinary upload results as Firestore media documents,
 * creating posts, and loading media for display.
 */
"use client";
import { getSignedDeliveryUrl } from "./upload.service";
import { platformRequest } from "./platform.service";

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
  const cloudName = payload.result.cloudName ?? process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? "";

  await setDoc(mediaRef, {
    id: mediaRef.id,
    ownerUid: payload.ownerUid,
    postId: payload.postId ?? null,
    storyId: payload.storyId ?? null,
    albumId: payload.albumId ?? null,
    storageProvider: payload.result.accountId && payload.result.accountId !== "central" ? "personal" : "central",
    cloudinaryAccountId: payload.result.accountId ?? "central",
    cloudName, deliveryType: payload.result.deliveryType ?? "upload",
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
  customAudienceUids?: string[];
}

export async function createPost(payload: CreatePostPayload): Promise<string> {
 return platformRequest<string>("createPost", { ...payload });
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

  const cloudName = payload.result.cloudName ?? process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? "";
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

export async function loadFeedPosts(followingUids: string[], afterDoc?: unknown, pageSize = 10) {
 return platformRequest<{ posts: Record<string, unknown>[]; cursor: string | null }>("posts", { mode: "feed", cursor: typeof afterDoc === "string" ? afterDoc : undefined, pageSize });
}

// ─────────────────────────────────────────────
// Get media delivery URL (checks privacy)
// ─────────────────────────────────────────────

export async function getMediaDeliveryUrl(mediaId: string, cloudName: string): Promise<string | null> {
 return getSignedDeliveryUrl(mediaId).catch(() => null);
}
