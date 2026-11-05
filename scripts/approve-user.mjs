/**
 * Approve a user by email address.
 * Uses Firebase CLI cached credentials — no service account needed.
 *
 * Usage:
 *   node scripts/approve-user.mjs gauri.khandelwal_cs.h24@gla.ac.in
 *
 * Or hardcode the email below and just run:
 *   node scripts/approve-user.mjs
 */

import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

// ── Config ─────────────────────────────────────────────────────────────────
const TARGET_EMAIL = process.argv[2] || "gauri.khandelwal_cs.h24@gla.ac.in";

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

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID
  || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  || "framefolk";

const API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "";

// ── Get OAuth token from Firebase CLI credential store ─────────────────────
async function getCliToken() {
  const os = require("os");
  const configPath = join(os.homedir(), ".config", "configstore", "firebase-tools.json");
  if (!existsSync(configPath)) throw new Error("Firebase CLI config not found. Run: firebase login");

  const config = JSON.parse(readFileSync(configPath, "utf8"));
  const tokens = config?.tokens;
  if (!tokens?.refresh_token) throw new Error("No refresh token found. Run: firebase login");

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: "563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com",
      client_secret: "j9iVZfS8sFxUw3S0qbj1bJCG",
      refresh_token: tokens.refresh_token,
      grant_type: "refresh_token",
    }),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error("Could not get access token: " + JSON.stringify(data));
  return data.access_token;
}

// ── Look up UID by email via Identity Toolkit ──────────────────────────────
async function getUidByEmail(accessToken, email) {
  const url = `https://identitytoolkit.googleapis.com/v1/projects/${PROJECT_ID}/accounts:lookup`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ email: [email] }),
  });
  const data = await res.json();
  if (!res.ok || data.error) throw new Error("Lookup failed: " + JSON.stringify(data.error ?? data));
  const users = data.users;
  if (!users || users.length === 0) throw new Error(`No Firebase Auth user found for email: ${email}`);
  return { uid: users[0].localId, emailVerified: users[0].emailVerified, displayName: users[0].displayName ?? "" };
}

// ── Get Firestore document ─────────────────────────────────────────────────
async function firestoreGet(accessToken, col, docId) {
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${col}/${docId}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (res.status === 404) return null;
  const data = await res.json();
  if (data.error) return null;
  // Parse fields
  const fields = {};
  for (const [k, v] of Object.entries(data.fields ?? {})) {
    fields[k] = v.stringValue ?? v.integerValue ?? v.booleanValue ?? v.doubleValue ?? null;
  }
  return fields;
}

// ── Patch Firestore document ───────────────────────────────────────────────
async function firestorePatch(accessToken, col, docId, updates) {
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${col}/${docId}`;

  function toValue(v) {
    if (v === null || v === undefined) return { nullValue: null };
    if (typeof v === "boolean") return { booleanValue: v };
    if (typeof v === "number") return Number.isInteger(v)
      ? { integerValue: String(v) }
      : { doubleValue: v };
    if (v === "__serverTimestamp__") return { timestampValue: new Date().toISOString() };
    return { stringValue: String(v) };
  }

  const firestoreFields = {};
  for (const [k, v] of Object.entries(updates)) {
    firestoreFields[k] = toValue(v);
  }

  // Build updateMask
  const mask = Object.keys(updates).join(",");
  const patchUrl = `${url}?updateMask.fieldPaths=${Object.keys(updates).map(encodeURIComponent).join("&updateMask.fieldPaths=")}`;

  const res = await fetch(patchUrl, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ fields: firestoreFields }),
  });
  const data = await res.json();
  if (!res.ok || data.error) throw new Error("Firestore patch failed: " + JSON.stringify(data.error ?? data));
  return data;
}

// ── Create Firestore document (full) ──────────────────────────────────────
async function firestoreCreate(accessToken, col, docId, fields) {
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${col}/${docId}`;

  function toValue(v) {
    if (v === null || v === undefined) return { nullValue: null };
    if (typeof v === "boolean") return { booleanValue: v };
    if (typeof v === "number") return Number.isInteger(v)
      ? { integerValue: String(v) }
      : { doubleValue: v };
    if (v === "__serverTimestamp__") return { timestampValue: new Date().toISOString() };
    return { stringValue: String(v) };
  }

  const firestoreFields = {};
  for (const [k, v] of Object.entries(fields)) {
    firestoreFields[k] = toValue(v);
  }

  const res = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ fields: firestoreFields }),
  });
  const data = await res.json();
  if (!res.ok || data.error) throw new Error("Firestore create failed: " + JSON.stringify(data.error ?? data));
  return data;
}

// ── Main ──────────────────────────────────────────────────────────────────
async function main() {
  console.log("\n FRAMEFOLK — Approve User");
  console.log(`  Email:   ${TARGET_EMAIL}`);
  console.log(`  Project: ${PROJECT_ID}\n`);

  console.log("→ Getting CLI access token…");
  const token = await getCliToken();
  console.log("✓ Token obtained\n");

  console.log("→ Looking up Firebase Auth user by email…");
  const { uid, emailVerified, displayName } = await getUidByEmail(token, TARGET_EMAIL);
  console.log(`✓ Found user — UID: ${uid}`);
  console.log(`  Display name:   ${displayName || "(not set)"}`);
  console.log(`  Email verified: ${emailVerified}\n`);

  console.log("→ Checking Firestore user document…");
  const existing = await firestoreGet(token, "users", uid);

  if (existing) {
    console.log(`  Current status: ${existing.status || "(not set)"}`);
    if (existing.status === "approved") {
      console.log("\n✓ Already approved — nothing to do.\n");
      return;
    }

    console.log("→ Updating status to 'approved'…");
    await firestorePatch(token, "users", uid, {
      status: "approved",
      approvedAt: "__serverTimestamp__",
      updatedAt: "__serverTimestamp__",
    });
    console.log("✓ User document updated\n");
  } else {
    console.log("  Document does not exist — creating it…");
    await firestoreCreate(token, "users", uid, {
      uid,
      email: TARGET_EMAIL,
      displayName: displayName || "",
      username: "",
      bio: "",
      profilePhotoUrl: "",
      profilePhotoPublicId: "",
      coverPhotoUrl: "",
      coverPhotoPublicId: "",
      status: "approved",
      isPrivate: false,
      isEmailVerified: emailVerified,
      storageProvider: "central",
      followersCount: 0,
      followingCount: 0,
      postsCount: 0,
      theme: "default",
      onboardingComplete: false,
      createdAt: "__serverTimestamp__",
      updatedAt: "__serverTimestamp__",
      approvedAt: "__serverTimestamp__",
    });
    console.log("✓ User document created with approved status\n");
  }

  console.log("✅ Done!");
  console.log(`  ${TARGET_EMAIL} is now approved.`);
  console.log("  She will need to sign out and sign back in for the status to take effect.\n");
}

main().catch((err) => {
  console.error("\n❌ Error:", err.message || err);
  process.exit(1);
});
