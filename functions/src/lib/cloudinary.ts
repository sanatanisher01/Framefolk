import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import { createHash, createDecipheriv } from "crypto";

export async function deleteMediaAsset(media: admin.firestore.DocumentData): Promise<void> {
  const config = functions.config().cloudinary ?? {};
  let cloudName = process.env.CLOUDINARY_CLOUD_NAME ?? config.cloud_name ?? "";
  let apiKey = process.env.CLOUDINARY_API_KEY ?? config.api_key ?? "";
  let apiSecret = process.env.CLOUDINARY_API_SECRET ?? config.api_secret ?? "";
  const accountId = media.cloudinaryAccountId ?? "central";
  if (accountId !== "central") {
    const stored = (await admin.firestore().doc(`cloudinarySecrets/${accountId}`).get()).data();
    if (!stored) throw new Error("Personal storage credentials unavailable.");
    const master = process.env.CLOUDINARY_CREDENTIAL_KEY || apiSecret;
    if (!master) throw new Error("Credential encryption is not configured.");
    const key = createHash("sha256").update(master).digest();
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(stored.encrypted.iv, "base64"));
    decipher.setAAD(Buffer.from(accountId)); decipher.setAuthTag(Buffer.from(stored.encrypted.tag, "base64"));
    apiSecret = Buffer.concat([decipher.update(Buffer.from(stored.encrypted.value, "base64")), decipher.final()]).toString("utf8");
    cloudName = stored.cloudName; apiKey = stored.apiKey;
  }
  if (!cloudName || !apiKey || !apiSecret) throw new Error("Cloudinary is not configured.");
  if (typeof media.cloudinaryPublicId !== "string" || !media.cloudinaryPublicId.startsWith(`framefolk/users/${media.ownerUid}/`)) throw new Error("Invalid media ownership.");
  // Older documents omitted deliveryType. Try each namespace before accepting not-found.
  const types: string[] = media.deliveryType ? [media.deliveryType] : ["upload", "private", "authenticated"];
  for (const type of types) {
    const params = { invalidate: "true", public_id: media.cloudinaryPublicId, timestamp: String(Math.floor(Date.now() / 1000)), type };
    const signature = createHash("sha1").update(Object.entries(params).sort(([a],[b]) => a.localeCompare(b)).map(([k,v]) => `${k}=${v}`).join("&") + apiSecret).digest("hex");
    const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/${media.resourceType ?? "image"}/destroy`, {
      method: "POST", body: new URLSearchParams({ ...params, signature, api_key: apiKey }), signal: AbortSignal.timeout(20000),
    });
    const result = await response.json() as { result?: string };
    if (!response.ok || !["ok", "not found"].includes(result.result ?? "")) throw new Error("Cloudinary rejected deletion.");
    if (result.result === "ok") return;
  }
}
