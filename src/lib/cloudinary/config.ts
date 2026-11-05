/**
 * Cloudinary configuration helpers.
 * NEXT_PUBLIC_ values are safe in the browser.
 * Non-prefixed values (API secret) are server-side only.
 */

export const cloudinaryConfig = {
  cloudName: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? "",
  apiKey: process.env.CLOUDINARY_API_KEY ?? "",
  // NEVER expose this in client bundles
  apiSecret: process.env.CLOUDINARY_API_SECRET ?? "",
  uploadPreset: process.env.CLOUDINARY_UPLOAD_PRESET ?? "framefolk_uploads",
};

export const isCloudinaryConfigured =
  !!process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME &&
  !!process.env.CLOUDINARY_API_KEY &&
  !!process.env.CLOUDINARY_API_SECRET;

// ── Delivery helpers ────────────────────────────────────────────────────────

/** Max file sizes */
export const LIMITS = {
  image: 20 * 1024 * 1024,   // 20 MB
  video: 500 * 1024 * 1024,  // 500 MB
  profilePhoto: 5 * 1024 * 1024, // 5 MB
};

/** Folder paths */
export function userFolder(uid: string) {
  return `framefolk/users/${uid}`;
}
export function postFolder(uid: string) {
  return `${userFolder(uid)}/posts`;
}
export function storyFolder(uid: string) {
  return `${userFolder(uid)}/stories`;
}
export function profileFolder(uid: string) {
  return `${userFolder(uid)}/profile`;
}

/** Responsive image URL via Cloudinary transformations */
export function buildImageUrl(
  publicId: string,
  cloudName: string,
  options: { width?: number; quality?: string; format?: string } = {}
): string {
  const { width = 800, quality = "auto", format = "auto" } = options;
  return `https://res.cloudinary.com/${cloudName}/image/upload/f_${format},q_${quality},w_${width},c_limit/${publicId}`;
}

/** Video thumbnail URL */
export function buildVideoThumbnail(publicId: string, cloudName: string): string {
  return `https://res.cloudinary.com/${cloudName}/video/upload/so_auto,w_400,h_400,c_fill,g_auto,f_jpg,q_auto/${publicId}`;
}
