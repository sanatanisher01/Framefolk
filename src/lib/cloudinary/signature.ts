/**
 * SERVER-SIDE ONLY — generates Cloudinary signed upload params.
 * Never import this from client components.
 *
 * Uses the Web Crypto API (available in Node 20 + Edge runtime)
 * so we don't need to install a separate crypto package.
 */

import { cloudinaryConfig } from "./config";

export interface SignatureParams {
  timestamp: number;
  folder: string;
  /** Optional eager transformation string (e.g. thumbnail generation) */
  eager?: string;
  /** "private" restricts delivery to signed URLs */
  type?: "upload" | "private" | "authenticated";
}

export interface UploadSignature {
  accountId?: string;
  signature: string;
  apiKey: string;
  cloudName: string;
  timestamp: number;
  folder: string;
  eager?: string;
  type?: string;
}

/**
 * Generate a SHA-1 HMAC signature for a Cloudinary signed upload.
 * All non-secret params are sorted alphabetically and concatenated,
 * then signed with the API secret.
 *
 * NOTE: max_file_size is NOT included in the signature string —
 * it is sent in the FormData but Cloudinary excludes it from signing.
 */
export async function generateUploadSignature(
  params: SignatureParams
): Promise<UploadSignature> {
  const { timestamp, folder, eager, type } = params;

  // Build params object — only fields Cloudinary includes in the signature
  // max_file_size is intentionally excluded (Cloudinary does not sign it)
  const sigParams: Record<string, string | number> = {
    folder,
    timestamp,
  };
  if (eager) sigParams.eager = eager;
  if (type) sigParams.type = type;

  // Sort keys alphabetically and build the string to sign
  const stringToSign = Object.keys(sigParams)
    .sort()
    .map((k) => `${k}=${sigParams[k]}`)
    .join("&");

  const signature = await sha1Hash(stringToSign + cloudinaryConfig.apiSecret);

  return {
    signature,
    apiKey: cloudinaryConfig.apiKey,
    cloudName: cloudinaryConfig.cloudName,
    timestamp,
    folder,
    ...(eager && { eager }),
    ...(type && { type }),
  };
}

/** SHA-1 hash — Cloudinary uses plain SHA-1 (not HMAC) for upload signatures */
async function sha1Hash(message: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-1", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}
