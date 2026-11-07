import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { getAdminDb } from "@/lib/firebase/admin";
import { RequestError } from "./access";

export interface CloudCredentials { cloudName: string; apiKey: string; apiSecret: string; accountId: string }
function encryptionKey() {
  const value = process.env.CLOUDINARY_CREDENTIAL_KEY || process.env.CLOUDINARY_API_SECRET;
  if (!value) throw new RequestError("Cloudinary credential encryption is not configured.", 503);
  return createHash("sha256").update(value).digest();
}
export function encryptSecret(secret: string, uid: string) {
  const iv = randomBytes(12), cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  cipher.setAAD(Buffer.from(uid));
  const value = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  return { iv: iv.toString("base64"), value: value.toString("base64"), tag: cipher.getAuthTag().toString("base64") };
}
export function decryptSecret(secret: { iv: string; value: string; tag: string }, uid: string) {
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(secret.iv, "base64"));
  decipher.setAAD(Buffer.from(uid)); decipher.setAuthTag(Buffer.from(secret.tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(secret.value, "base64")), decipher.final()]).toString("utf8");
}
export async function credentialsFor(accountId = "central"): Promise<CloudCredentials> {
  if (accountId === "central") {
    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? "", apiKey = process.env.CLOUDINARY_API_KEY ?? "", apiSecret = process.env.CLOUDINARY_API_SECRET ?? "";
    if (!cloudName || !apiKey || !apiSecret) throw new RequestError("Cloudinary is not configured.", 503);
    return { cloudName, apiKey, apiSecret, accountId };
  }
  const secret = (await getAdminDb().doc(`cloudinarySecrets/${accountId}`).get()).data();
  if (!secret) throw new RequestError("Storage credentials unavailable. Reconnect your account.", 503);
  return { cloudName: secret.cloudName, apiKey: secret.apiKey, apiSecret: decryptSecret(secret.encrypted, accountId), accountId };
}
export async function uploadCredentials(uid: string) {
  const db = getAdminDb();
  const [user, connection] = await Promise.all([db.doc(`users/${uid}`).get(), db.doc(`cloudinaryConnections/${uid}`).get()]);
  return credentialsFor(user.data()?.storageProvider === "personal" && connection.data()?.status === "connected" ? uid : "central");
}
export function signParams(params: Record<string, string | number | boolean>, secret: string) {
  return createHash("sha1").update(Object.keys(params).sort().map(k => `${k}=${params[k]}`).join("&") + secret).digest("hex");
}

export function downloadUrl(media: Record<string, unknown>, credentials: CloudCredentials, thumbnail = false) {
  const resourceType = media.resourceType === "video" ? "video" : "image";
  const publicId = String(media.cloudinaryPublicId);
  const type = String(media.deliveryType ?? (media.isPrivate ? "private" : "upload"));
  const params: Record<string, string | number | boolean> = { public_id: publicId,
    // Normalize HEIC/MOV and other accepted uploads to browser-supported formats.
    format: thumbnail ? "jpg" : resourceType === "video" ? "mp4" : "webp",
    type, timestamp: Math.floor(Date.now() / 1000), expires_at: Math.floor(Date.now() / 1000) + 3600,
    attachment: false };
  if (thumbnail) params.transformation = resourceType === "video" ? "so_0,w_400,c_limit" : "w_400,c_limit";
  const search = new URLSearchParams(Object.fromEntries(Object.entries(params).map(([k,v]) => [k,String(v)])));
  search.set("api_key", credentials.apiKey); search.set("signature", signParams(params, credentials.apiSecret));
  return `https://api.cloudinary.com/v1_1/${credentials.cloudName}/${resourceType}/download?${search}`;
}
