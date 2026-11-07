/** Dry run by default. --apply converts legacy content assets to authenticated delivery. */
import { createRequire } from "node:module";
import { createHash, createDecipheriv } from "node:crypto";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, FieldPath } from "firebase-admin/firestore";
const require = createRequire(import.meta.url);
require("@next/env").loadEnvConfig(process.cwd());
const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
initializeApp(serviceAccount ? { credential: cert(JSON.parse(serviceAccount)) } : { projectId });
const db = getFirestore();
const apply = process.argv.includes("--apply");
function signature(params, secret) { return createHash("sha1").update(Object.keys(params).sort().map(k => `${k}=${params[k]}`).join("&") + secret).digest("hex"); }
async function credentials(accountId = "central") {
  const central = { cloudName: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME, apiKey: process.env.CLOUDINARY_API_KEY, apiSecret: process.env.CLOUDINARY_API_SECRET };
  if (accountId === "central") return central;
  const data = (await db.doc(`cloudinarySecrets/${accountId}`).get()).data();
  if (!data) throw new Error("Missing personal storage credentials.");
  const master = process.env.CLOUDINARY_CREDENTIAL_KEY || central.apiSecret;
  const decipher = createDecipheriv("aes-256-gcm", createHash("sha256").update(master).digest(), Buffer.from(data.encrypted.iv, "base64"));
  decipher.setAAD(Buffer.from(accountId)); decipher.setAuthTag(Buffer.from(data.encrypted.tag, "base64"));
  return { cloudName: data.cloudName, apiKey: data.apiKey, apiSecret: Buffer.concat([decipher.update(Buffer.from(data.encrypted.value, "base64")), decipher.final()]).toString("utf8") };
}
let cursor, scanned = 0, migrated = 0, failed = 0;
try {
  console.log(`${apply ? "APPLY" : "DRY RUN"}: legacy media privacy migration in ${projectId}`);
  for (;;) {
    let q = db.collection("media").orderBy(FieldPath.documentId()).limit(100);
    if (cursor) q = q.startAfter(cursor);
    const page = await q.get();
    if (page.empty) break;
    for (const doc of page.docs) {
      const media = doc.data();
      if ((!media.postId && !media.storyId) || media.deliveryType === "authenticated") continue;
      scanned++;
      if (!apply) { console.log(`Would secure media ${doc.id}`); continue; }
      try {
        if (!media.cloudinaryPublicId?.startsWith(`framefolk/users/${media.ownerUid}/`)) throw new Error("Unexpected asset ownership.");
        const creds = await credentials(media.cloudinaryAccountId);
        if (!creds.cloudName || !creds.apiKey || !creds.apiSecret) throw new Error("Missing storage credentials.");
        let actualType;
        for (const type of ["authenticated", "private", "upload"]) {
          const result = await fetch(`https://api.cloudinary.com/v1_1/${creds.cloudName}/resources/${media.resourceType}/${type}/${encodeURIComponent(media.cloudinaryPublicId)}`, {
            headers: { Authorization: `Basic ${Buffer.from(`${creds.apiKey}:${creds.apiSecret}`).toString("base64")}` }, signal: AbortSignal.timeout(20000),
          });
          if (result.ok) { actualType = type; break; }
          if (result.status !== 404) throw new Error(`Storage lookup failed (${result.status}).`);
        }
        if (!actualType) throw new Error("Asset not found in storage.");
        if (actualType !== "authenticated") {
          const params = { from_public_id: media.cloudinaryPublicId, to_public_id: media.cloudinaryPublicId, type: actualType, to_type: "authenticated", invalidate: "true", timestamp: String(Math.floor(Date.now() / 1000)) };
          const response = await fetch(`https://api.cloudinary.com/v1_1/${creds.cloudName}/${media.resourceType}/rename`, {
            method: "POST", body: new URLSearchParams({ ...params, api_key: creds.apiKey, signature: signature(params, creds.apiSecret) }), signal: AbortSignal.timeout(20000),
          });
          if (!response.ok) throw new Error(`Storage migration failed (${response.status}).`);
        }
        await doc.ref.update({ deliveryType: "authenticated", isPrivate: true, cloudName: creds.cloudName });
        migrated++;
        console.log(`Secured media ${doc.id}`);
      } catch (error) { failed++; console.error(`Media ${doc.id}: ${error.message}`); }
    }
    cursor = page.docs[page.docs.length - 1];
  }
  console.log(JSON.stringify({ scanned, migrated, failed, dryRun: !apply }));
  if (failed) process.exitCode = 1;
} finally { await db.terminate(); }
