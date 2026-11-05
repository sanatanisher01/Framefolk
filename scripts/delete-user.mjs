/**
 * FRAMEFOLK — Delete a user account and all related Firestore data.
 *
 * Usage:
 *   node scripts/delete-user.mjs gauri.khandelwal_cs.h24@gla.ac.in
 *
 * What this deletes:
 *   - Firebase Auth account
 *   - users/{uid}
 *   - usernames/{username}
 *   - posts/{postId} where authorUid == uid
 *   - media/{mediaId} where ownerUid == uid
 *   - stories/{storyId} where authorUid == uid
 *   - notifications where recipientUid or senderUid == uid
 *   - followers/{uid} subcollections (following + followers)
 *   - reverse follower edges from other users
 *   - bookmarks/{uid}/saved/*
 *   - followRequests where fromUid or toUid == uid
 *   - blocks where blockerUid or blockedUid == uid
 *   - conversations where uid is a participant
 *   - deletionRequests where requesterUid == uid
 *   - reports where reporterUid == uid
 *   - albums where ownerUid == uid
 *   - albumMembers where uid == uid
 */

import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

// ── Load .env.local ────────────────────────────────────────────────────────
const envPath = join(__dirname, "..", ".env.local");
if (existsSync(envPath)) {
  const lines = readFileSync(envPath, "utf8").split("\n");
  for (const line of lines) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const idx = t.indexOf("=");
    if (idx === -1) continue;
    const key = t.slice(0, idx).trim();
    const val = t.slice(idx + 1).trim().replace(/^"(.*)"$/, "$1");
    if (!process.env[key]) process.env[key] = val;
  }
}

const TARGET_EMAIL = process.argv[2] || "gauri.khandelwal_cs.h24@gla.ac.in";
const PROJECT_ID = process.env.FIREBASE_PROJECT_ID
  || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  || "framefolk";
const API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "";

// ── Get OAuth token ────────────────────────────────────────────────────────
async function getCliToken() {
  const os = require("os");
  const configPath = join(os.homedir(), ".config", "configstore", "firebase-tools.json");
  if (!existsSync(configPath)) throw new Error("Run: firebase login");
  const config = JSON.parse(readFileSync(configPath, "utf8"));
  const refreshToken = config?.tokens?.refresh_token;
  if (!refreshToken) throw new Error("No refresh token — run: firebase login");

  // Try gcloud ADC first
  const adcPath = join(os.homedir(), ".config", "gcloud", "application_default_credentials.json");
  if (existsSync(adcPath)) {
    const adc = JSON.parse(readFileSync(adcPath, "utf8"));
    if (adc.access_token) return adc.access_token;
  }

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: "563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com",
      client_secret: "j9iVZfS8sFxUw3S0qbj1bJCG",
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const data = await res.json();
  if (!data.access_token) {
    // Fallback: try Identity Toolkit token exchange
    const res2 = await fetch(`https://securetoken.googleapis.com/v1/token?key=${API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `grant_type=refresh_token&refresh_token=${refreshToken}`,
    });
    const d2 = await res2.json();
    if (!d2.access_token) throw new Error("Could not get access token. Try: firebase login --reauth");
    return d2.access_token;
  }
  return data.access_token;
}

// ── Get UID by email ────────────────────────────────────────────────────────
async function getUidByEmail(token, email) {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/projects/${PROJECT_ID}/accounts:lookup`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ email: [email] }),
    }
  );
  const data = await res.json();
  if (data.error) throw new Error("Lookup failed: " + JSON.stringify(data.error));
  if (!data.users?.length) throw new Error(`No Firebase Auth account found for: ${email}`);
  return data.users[0].localId;
}

// ── Delete Firebase Auth account ────────────────────────────────────────────
async function deleteAuthUser(token, uid) {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/projects/${PROJECT_ID}/accounts:delete`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ localId: uid }),
    }
  );
  const data = await res.json();
  if (data.error) throw new Error("Auth delete failed: " + JSON.stringify(data.error));
}

// ── Firestore REST helpers ──────────────────────────────────────────────────
const FS_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

async function fsDelete(token, path) {
  const res = await fetch(`${FS_BASE}/${path}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  // 404 is fine — doc didn't exist
  if (!res.ok && res.status !== 404) {
    const t = await res.text();
    console.warn(`  ⚠  DELETE ${path} → ${res.status}: ${t.slice(0, 120)}`);
  }
}

async function fsGet(token, path) {
  const res = await fetch(`${FS_BASE}/${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 404) return null;
  const data = await res.json();
  if (data.error) return null;
  return data;
}

async function fsQuery(token, collectionPath, field, op, value) {
  // Use Firestore structured query REST endpoint
  const dbPath = `projects/${PROJECT_ID}/databases/(default)`;
  const url = `https://firestore.googleapis.com/v1/${dbPath}/documents:runQuery`;

  const fieldFilter = {
    fieldFilter: {
      field: { fieldPath: field },
      op: op, // "EQUAL", "ARRAY_CONTAINS"
      value: { stringValue: value },
    },
  };

  const body = {
    structuredQuery: {
      from: [{ collectionId: collectionPath }],
      where: fieldFilter,
      limit: 500,
    },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const results = await res.json();
  if (!Array.isArray(results)) return [];
  return results
    .filter((r) => r.document)
    .map((r) => {
      // Extract doc ID from full path like projects/.../documents/col/docId
      const parts = r.document.name.split("/");
      return parts[parts.length - 1];
    });
}

async function fsListSubcollection(token, docPath) {
  const res = await fetch(`${FS_BASE}/${docPath}?pageSize=500`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return [];
  const data = await res.json();
  const docs = data.documents ?? [];
  return docs.map((d) => {
    const parts = d.name.split("/");
    return parts[parts.length - 1];
  });
}

// ── Main ──────────────────────────────────────────────────────────────────
async function main() {
  console.log("\n FRAMEFOLK — Delete User Account");
  console.log(`  Email:   ${TARGET_EMAIL}`);
  console.log(`  Project: ${PROJECT_ID}\n`);

  console.log("→ Getting access token…");
  const token = await getCliToken();
  console.log("✓ Token obtained\n");

  // 1. Get UID
  console.log("→ Looking up Firebase Auth user…");
  const uid = await getUidByEmail(token, TARGET_EMAIL);
  console.log(`✓ UID: ${uid}\n`);

  // 2. Get username from Firestore before deleting
  console.log("→ Reading user document…");
  const userDoc = await fsGet(token, `users/${uid}`);
  const username = userDoc?.fields?.username?.stringValue ?? "";
  console.log(`  Username: ${username || "(none set)"}`);
  console.log(`  Status:   ${userDoc?.fields?.status?.stringValue ?? "(unknown)"}\n`);

  // 3. Delete posts by this user
  console.log("→ Querying posts by this user…");
  const postIds = await fsQuery(token, "posts", "authorUid", "EQUAL", uid);
  console.log(`  Found ${postIds.length} post(s)`);
  for (const id of postIds) {
    // Delete likes, comments subcollections first
    const likeIds = await fsListSubcollection(token, `posts/${id}/likes`);
    for (const lid of likeIds) await fsDelete(token, `posts/${id}/likes/${lid}`);
    const commentIds = await fsListSubcollection(token, `posts/${id}/comments`);
    for (const cid of commentIds) {
      const replyIds = await fsListSubcollection(token, `posts/${id}/comments/${cid}/replies`);
      for (const rid of replyIds) await fsDelete(token, `posts/${id}/comments/${cid}/replies/${rid}`);
      await fsDelete(token, `posts/${id}/comments/${cid}`);
    }
    await fsDelete(token, `posts/${id}`);
    process.stdout.write(".");
  }
  if (postIds.length) console.log(" done");

  // 4. Delete media
  console.log("→ Querying media by this user…");
  const mediaIds = await fsQuery(token, "media", "ownerUid", "EQUAL", uid);
  console.log(`  Found ${mediaIds.length} media doc(s)`);
  for (const id of mediaIds) { await fsDelete(token, `media/${id}`); process.stdout.write("."); }
  if (mediaIds.length) console.log(" done");

  // 5. Delete stories
  console.log("→ Querying stories by this user…");
  const storyIds = await fsQuery(token, "stories", "authorUid", "EQUAL", uid);
  console.log(`  Found ${storyIds.length} story/stories`);
  for (const id of storyIds) { await fsDelete(token, `stories/${id}`); process.stdout.write("."); }
  if (storyIds.length) console.log(" done");

  // 6. Delete notifications sent to or from this user
  console.log("→ Deleting notifications…");
  const notifTo = await fsQuery(token, "notifications", "recipientUid", "EQUAL", uid);
  const notifFrom = await fsQuery(token, "notifications", "senderUid", "EQUAL", uid);
  const notifIds = [...new Set([...notifTo, ...notifFrom])];
  console.log(`  Found ${notifIds.length} notification(s)`);
  for (const id of notifIds) { await fsDelete(token, `notifications/${id}`); process.stdout.write("."); }
  if (notifIds.length) console.log(" done");

  // 7. Delete followers subcollections
  console.log("→ Deleting follower relationships…");
  const followingIds = await fsListSubcollection(token, `followers/${uid}/following`);
  const followersIds = await fsListSubcollection(token, `followers/${uid}/followers`);
  for (const id of followingIds) {
    await fsDelete(token, `followers/${uid}/following/${id}`);
    await fsDelete(token, `followers/${id}/followers/${uid}`); // remove from their followers list
  }
  for (const id of followersIds) {
    await fsDelete(token, `followers/${uid}/followers/${id}`);
    await fsDelete(token, `followers/${id}/following/${uid}`); // remove from their following list
  }
  console.log(`  Cleaned ${followingIds.length} following, ${followersIds.length} followers`);

  // 8. Delete bookmarks
  console.log("→ Deleting bookmarks…");
  const bookmarkIds = await fsListSubcollection(token, `bookmarks/${uid}/saved`);
  for (const id of bookmarkIds) await fsDelete(token, `bookmarks/${uid}/saved/${id}`);
  await fsDelete(token, `bookmarks/${uid}`);
  console.log(`  Cleaned ${bookmarkIds.length} bookmark(s)`);

  // 9. Delete follow requests
  console.log("→ Deleting follow requests…");
  const frFrom = await fsQuery(token, "followRequests", "fromUid", "EQUAL", uid);
  const frTo = await fsQuery(token, "followRequests", "toUid", "EQUAL", uid);
  const frIds = [...new Set([...frFrom, ...frTo])];
  for (const id of frIds) await fsDelete(token, `followRequests/${id}`);
  console.log(`  Cleaned ${frIds.length} follow request(s)`);

  // 10. Delete blocks
  console.log("→ Deleting blocks…");
  const blockBy = await fsQuery(token, "blocks", "blockerUid", "EQUAL", uid);
  const blockOf = await fsQuery(token, "blocks", "blockedUid", "EQUAL", uid);
  for (const id of [...new Set([...blockBy, ...blockOf])]) await fsDelete(token, `blocks/${id}`);
  console.log(`  Cleaned ${blockBy.length + blockOf.length} block(s)`);

  // 11. Delete conversations
  console.log("→ Deleting conversations…");
  const convIds = await fsQuery(token, "conversations", "participants", "ARRAY_CONTAINS", uid);
  console.log(`  Found ${convIds.length} conversation(s)`);
  for (const id of convIds) {
    const msgIds = await fsListSubcollection(token, `conversations/${id}/messages`);
    for (const mid of msgIds) await fsDelete(token, `conversations/${id}/messages/${mid}`);
    await fsDelete(token, `conversations/${id}`);
    process.stdout.write(".");
  }
  if (convIds.length) console.log(" done");

  // 12. Delete deletion requests
  const delReqIds = await fsQuery(token, "deletionRequests", "requesterUid", "EQUAL", uid);
  for (const id of delReqIds) await fsDelete(token, `deletionRequests/${id}`);
  console.log(`  Cleaned ${delReqIds.length} deletion request(s)`);

  // 13. Delete reports by this user
  const reportIds = await fsQuery(token, "reports", "reporterUid", "EQUAL", uid);
  for (const id of reportIds) await fsDelete(token, `reports/${id}`);
  console.log(`  Cleaned ${reportIds.length} report(s)`);

  // 14. Delete albums owned by this user
  console.log("→ Deleting albums…");
  const albumIds = await fsQuery(token, "albums", "ownerUid", "EQUAL", uid);
  for (const id of albumIds) await fsDelete(token, `albums/${id}`);
  const albumMemberIds = await fsQuery(token, "albumMembers", "uid", "EQUAL", uid);
  for (const id of albumMemberIds) await fsDelete(token, `albumMembers/${id}`);
  console.log(`  Cleaned ${albumIds.length} album(s), ${albumMemberIds.length} memberships`);

  // 15. Delete username reservation
  if (username) {
    console.log(`→ Deleting username reservation "usernames/${username}"…`);
    await fsDelete(token, `usernames/${username}`);
    console.log("✓ Username freed");
  }

  // 16. Delete user document
  console.log("→ Deleting user document…");
  await fsDelete(token, `users/${uid}`);
  console.log("✓ Firestore user document deleted");

  // 17. Delete Firebase Auth account (last step)
  console.log("→ Deleting Firebase Auth account…");
  await deleteAuthUser(token, uid);
  console.log("✓ Firebase Auth account deleted\n");

  console.log("✅ Account fully deleted.");
  console.log(`   ${TARGET_EMAIL} (uid: ${uid}) has been removed from the platform.\n`);
}

main().catch((err) => {
  console.error("\n❌ Error:", err.message || err);
  process.exit(1);
});
