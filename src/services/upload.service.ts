/**
 * FRAMEFOLK — Cloudinary Upload Service (Client-side)
 *
 * Orchestrates the full upload flow:
 *  1. Request a signed upload signature from /api/cloudinary/sign
 *  2. POST the file directly to Cloudinary (browser → Cloudinary, no server proxy)
 *  3. Return the Cloudinary response for metadata storage
 */
"use client";

import { auth } from "@/lib/firebase/client";
import { buildImageUrl, buildVideoThumbnail } from "@/lib/cloudinary/config";
import type { UploadSignature } from "@/lib/cloudinary";

export type UploadContext = "post" | "profile" | "cover" | "story";

export interface CloudinaryUploadResult {
  publicId: string;
  assetId: string;
  secureUrl: string;
  resourceType: "image" | "video";
  format: string;
  width: number;
  height: number;
  bytes: number;
  duration?: number;
  thumbnailUrl?: string;
  deliveryUrl: string; // responsive delivery URL
}

export interface UploadOptions {
  context?: UploadContext;
  isPrivate?: boolean;
  onProgress?: (percent: number) => void;
}

// ─────────────────────────────────────────────
// Get an ID token for the API call
// ─────────────────────────────────────────────

async function getIdToken(): Promise<string> {
  const user = auth?.currentUser;
  if (!user) throw new Error("Not authenticated");
  return user.getIdToken();
}

// ─────────────────────────────────────────────
// Request upload signature from our API route
// ─────────────────────────────────────────────

async function getUploadSignature(
  file: File,
  options: UploadOptions
): Promise<UploadSignature> {
  const idToken = await getIdToken();
  const resourceType = file.type.startsWith("video/") ? "video" : "image";

  const res = await fetch("/api/cloudinary/sign", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({
      resourceType,
      context: options.context ?? "post",
      isPrivate: options.isPrivate ?? false,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? "Failed to get upload signature");
  }

  return res.json() as Promise<UploadSignature>;
}

// ─────────────────────────────────────────────
// Upload a single file to Cloudinary
// ─────────────────────────────────────────────

export async function uploadFile(
  file: File,
  options: UploadOptions = {}
): Promise<CloudinaryUploadResult> {
  const sig = await getUploadSignature(file, options);
  const resourceType = file.type.startsWith("video/") ? "video" : "image";

  const formData = new FormData();
  formData.append("file", file);
  formData.append("api_key", sig.apiKey);
  formData.append("timestamp", String(sig.timestamp));
  formData.append("signature", sig.signature);
  formData.append("folder", sig.folder);
  if (sig.eager) formData.append("eager", sig.eager);
  if (sig.type) formData.append("type", sig.type);

  const uploadUrl = `https://api.cloudinary.com/v1_1/${sig.cloudName}/${resourceType}/upload`;

  return new Promise<CloudinaryUploadResult>((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && options.onProgress) {
        options.onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const data = JSON.parse(xhr.responseText);
        const isVideo = resourceType === "video";

        const deliveryUrl = isVideo
          ? buildVideoThumbnail(data.public_id, sig.cloudName)
          : buildImageUrl(data.public_id, sig.cloudName, { width: 1080 });

        resolve({
          publicId: data.public_id as string,
          assetId: data.asset_id as string,
          secureUrl: data.secure_url as string,
          resourceType,
          format: data.format as string,
          width: (data.width as number) ?? 0,
          height: (data.height as number) ?? 0,
          bytes: data.bytes as number,
          duration: isVideo ? (data.duration as number) : undefined,
          thumbnailUrl: isVideo
            ? (data.eager?.[0]?.secure_url as string | undefined)
            : undefined,
          deliveryUrl,
        });
      } else {
        let errMsg = "Upload failed";
        try {
          const e = JSON.parse(xhr.responseText);
          errMsg = (e as { error?: { message?: string } }).error?.message ?? errMsg;
        } catch { /* ignore */ }
        reject(new Error(errMsg));
      }
    };

    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.onabort = () => reject(new Error("Upload cancelled"));

    xhr.open("POST", uploadUrl);
    xhr.send(formData);
  });
}

// ─────────────────────────────────────────────
// Upload multiple files (posts with multiple images)
// ─────────────────────────────────────────────

export interface MultiUploadResult {
  results: CloudinaryUploadResult[];
  failed: Array<{ file: File; error: string }>;
}

export async function uploadFiles(
  files: File[],
  options: UploadOptions = {},
  onFileProgress?: (fileIndex: number, percent: number) => void
): Promise<MultiUploadResult> {
  const results: CloudinaryUploadResult[] = [];
  const failed: Array<{ file: File; error: string }> = [];

  for (let i = 0; i < files.length; i++) {
    try {
      const result = await uploadFile(files[i], {
        ...options,
        onProgress: (p) => onFileProgress?.(i, p),
      });
      results.push(result);
    } catch (err) {
      failed.push({
        file: files[i],
        error: (err as Error).message ?? "Upload failed",
      });
    }
  }

  return { results, failed };
}

// ─────────────────────────────────────────────
// Get a signed delivery URL for private media
// ─────────────────────────────────────────────

export async function getSignedDeliveryUrl(mediaId: string): Promise<string> {
  const idToken = await getIdToken();

  const res = await fetch("/api/cloudinary/signed-url", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ mediaId }),
  });

  if (!res.ok) throw new Error("Failed to get signed URL");
  const data = await res.json() as { url: string };
  return data.url;
}
