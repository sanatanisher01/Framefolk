import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { requestUser, RequestError } from "@/lib/server/access";
import { encryptSecret } from "@/lib/server/cloudinary";

export async function POST(request: Request) {
 try {
  const { uid, db } = await requestUser(request);
  const { cloudName, apiKey, apiSecret } = await request.json();
  if (typeof cloudName !== "string" || !/^[a-zA-Z0-9_-]+$/.test(cloudName) || typeof apiKey !== "string" || !/^\d+$/.test(apiKey) || typeof apiSecret !== "string" || !apiSecret || apiSecret.length > 256) throw new RequestError("Invalid credentials.");
  const ping = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/ping`, { headers: { Authorization: `Basic ${Buffer.from(`${apiKey}:${apiSecret}`).toString("base64")}` }, signal: AbortSignal.timeout(15000), cache: "no-store" });
  if (!ping.ok) throw new RequestError("Cloudinary rejected these credentials.");
  const previous = (await db.doc(`cloudinarySecrets/${uid}`).get()).data();
  if (previous && previous.cloudName !== cloudName) throw new RequestError("Reconnect the same Cloudinary cloud to preserve access to existing media.");
  const batch = db.batch(), now = FieldValue.serverTimestamp();
  batch.set(db.doc(`cloudinarySecrets/${uid}`), { cloudName, apiKey, encrypted: encryptSecret(apiSecret, uid), updatedAt: now });
  batch.set(db.doc(`cloudinaryConnections/${uid}`), { ownerUid: uid, cloudName, apiKey, status: "connected", lastSyncedAt: now, updatedAt: now, createdAt: now }, { merge: true });
  batch.update(db.doc(`users/${uid}`), { storageProvider: "personal", updatedAt: now });
  await batch.commit();
  return NextResponse.json({ success: true, cloudName });
 } catch (error) {
  return NextResponse.json({ error: error instanceof RequestError ? error.message : "Could not connect Cloudinary." }, { status: error instanceof RequestError ? error.status : 500 });
 }
}
