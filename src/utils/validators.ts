/**
 * Input validation utilities for FRAMEFOLK.
 * These are pure functions — not Zod schemas.
 * Use for quick checks outside of form contexts.
 */

/** Username: 3–30 chars, letters/numbers/periods/underscores */
export const USERNAME_REGEX = /^[a-zA-Z0-9._]{3,30}$/;

/** Reserved usernames that cannot be registered */
export const RESERVED_USERNAMES = new Set([
  "admin",
  "administrator",
  "framefolk",
  "support",
  "help",
  "api",
  "www",
  "mail",
  "static",
  "cdn",
  "media",
  "login",
  "logout",
  "register",
  "signup",
  "settings",
  "home",
  "explore",
  "notifications",
  "messages",
  "upload",
  "stories",
  "albums",
  "memories",
  "about",
  "privacy",
  "terms",
  "null",
  "undefined",
  "me",
  "root",
  "mod",
  "moderator",
]);

export function isValidUsername(username: string): boolean {
  return (
    USERNAME_REGEX.test(username) &&
    !RESERVED_USERNAMES.has(username.toLowerCase())
  );
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/** Allowed image MIME types */
export const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

/** Allowed video MIME types */
export const ALLOWED_VIDEO_TYPES = new Set([
  "video/mp4",
  "video/quicktime", // .mov
  "video/webm",
]);

export function isAllowedImageType(mimeType: string): boolean {
  return ALLOWED_IMAGE_TYPES.has(mimeType.toLowerCase());
}

export function isAllowedVideoType(mimeType: string): boolean {
  return ALLOWED_VIDEO_TYPES.has(mimeType.toLowerCase());
}

/** Max file sizes in bytes */
export const MAX_IMAGE_SIZE = 20 * 1024 * 1024; // 20 MB
export const MAX_VIDEO_SIZE = 500 * 1024 * 1024; // 500 MB
export const MAX_PROFILE_PHOTO_SIZE = 5 * 1024 * 1024; // 5 MB

export function isWithinSizeLimit(
  bytes: number,
  type: "image" | "video" | "profile"
): boolean {
  if (type === "image") return bytes <= MAX_IMAGE_SIZE;
  if (type === "video") return bytes <= MAX_VIDEO_SIZE;
  return bytes <= MAX_PROFILE_PHOTO_SIZE;
}

/** Validates a Cloudinary cloud name (letters, numbers, hyphens) */
export function isValidCloudinaryCloudName(name: string): boolean {
  return /^[a-z0-9-]{3,50}$/.test(name);
}

/** Sanitises a string for use in a Firestore document ID */
export function sanitiseForId(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "_")
    .slice(0, 100);
}
