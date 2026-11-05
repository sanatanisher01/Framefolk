/**
 * Bootstrap superAdmin — sets custom claim + Firestore roles doc.
 * Uses Firebase CLI's cached credentials (no service account JSON needed).
 * 
 * Run: node scripts/set-admin.mjs
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

const TARGET_UID  = "RYwaBzlWD9MXcyp0bzyxfxdjFUi1"; // glaprojects01@gmail.com
const PROJECT_ID  = process.env.FIREBASE_PROJECT_ID
                  || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
                  || "framefolk";

// ── Get OAuth token from Firebase CLI credential store ──────────────────────
async function getCliToken() {
  // Firebase CLI stores tokens at ~/.config/configstore/firebase-tools.json
  const os = require("os");
  const configPath = join(os.homedir(), ".config", "configstore", "firebase-tools.json");
  if (!existsSync(configPath)) throw new Error("Firebase CLI config not found. Run: firebase login");

  const config = JSON.parse(readFileSync(configPath, "utf8"));
  const tokens = config?.tokens;
  if (!tokens?.refresh_token) throw new Error("No refresh token. Run: firebase login");

  // Exchange refresh token for access token
  const res = await fetch(
    "https://securetoken.googleapis.com/v1/token?key=" + (process.env.NEXT_PUBLIC_FIREBASE_API_KEY || ""),
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `grant_type=refresh_token&refresh_token=${tokens.refresh_token}`,
    }
  );

  if (!res.ok) {
    // Try Google OAuth token endpoint instead
    const res2 = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: "563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com",
        client_secret: "j9iVZfS8sFxUw3S0qbj1bJCG",
        refresh_token: tokens.refresh_token,
        grant_type: "refresh_token",
      }),
    });
    const d2 = await res2.json();
    if (!d2.access_token) throw new Error("Could not get access token: " + JSON.stringify(d2));
    return d2.access_token;
  }

  const data = await res.json();
  return data.access_token;
}

// ── Set custom claim via Identity Toolkit REST API ──────────────────────────
async function setCustomClaim(accessToken, uid, claims) {
  const url = `https://identitytoolkit.googleapis.com/v1/projects/${PROJECT_ID}/accounts:update`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      localId: uid,
      customAttributes: JSON.stringify(claims),
    }),
  });
  const data = await res.json();
  if (!res.ok || data.error) throw new Error("setCustomClaim failed: " + JSON.stringify(data.error));
  return data;
}

// ── Write Firestore document via REST API ────────────────────────────────────
async function firestoreSet(accessToken, collection, docId, fields) {
  const base = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
  const url = `${base}/${collection}/${docId}`;

  // Convert plain JS object to Firestore REST format
  function toValue(v) {
    if (v === null) return { nullValue: null };
    if (typeof v === "boolean") return { booleanValue: v };
    if (typeof v === "number") return { integerValue: String(Math.floor(v)) };
    if (typeof v === "string") return { stringValue: v };
    if (v && typeof v === "object" && v.__type === "serverTimestamp") {
      return { stringValue: new Date().toISOString() };
    }
    return { stringValue: String(v) };
  }

  const firestoreFields = {};
  for (const [k, v] of Object.entries(fields)) {
    firestoreFields[k] = toValue(v);
  }

  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ fields: firestoreFields }),
  });

  const data = await res.json();
  if (!res.ok || data.error) throw new Error("Firestore write failed: " + JSON.stringify(data.error));
  return data;
}

async function firestoreGet(accessToken, collection, docId) {
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${collection}/${docId}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (res.status === 404) return null;
  const data = await res.json();
  if (data.error) return null;
  return data;
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log("\n🔑 FRAMEFOLK — Bootstrap SuperAdmin");
  console.log("   Target: glaprojects01@gmail.com");
  console.log("   UID:    " + TARGET_UID);
  console.log("   Project:", PROJECT_ID);
  console.log("");

  console.log("→ Getting CLI access token…");
  const token = await getCliToken();
  console.log("✓ Access token obtained");

  console.log("→ Setting custom claim { role: 'superAdmin' }…");
  await setCustomClaim(token, TARGET_UID, { role: "superAdmin" });
  console.log("✓ Custom claim set");

  console.log("→ Writing roles document…");
  await firestoreSet(token, "roles", TARGET_UID, {
    uid: TARGET_UID,
    role: "superAdmin",
    assignedBy: "system-bootstrap",
    assignedAt: { __type: "serverTimestamp" },
    updatedAt: { __type: "serverTimestamp" },
  });
  console.log("✓ roles/" + TARGET_UID + " written");

  console.log("→ Checking/creating user document…");
  const existing = await firestoreGet(token, "users", TARGET_UID);
  if (existing) {
    await firestoreSet(token, "users", TARGET_UID, {
      status: "approved",
      updatedAt: { __type: "serverTimestamp" },
      approvedAt: { __type: "serverTimestamp" },
    });
    console.log("✓ User document: status → approved");
  } else {
    await firestoreSet(token, "users", TARGET_UID, {
      uid: TARGET_UID,
      email: "glaprojects01@gmail.com",
      displayName: "Admin",
      username: "",
      bio: "",
      profilePhotoUrl: "",
      profilePhotoPublicId: "",
      coverPhotoUrl: "",
      coverPhotoPublicId: "",
      status: "approved",
      isPrivate: false,
      isEmailVerified: true,
      storageProvider: "central",
      followersCount: 0,
      followingCount: 0,
      postsCount: 0,
      theme: "default",
      onboardingComplete: false,
      createdAt: { __type: "serverTimestamp" },
      updatedAt: { __type: "serverTimestamp" },
      approvedAt: { __type: "serverTimestamp" },
    });
    console.log("✓ User document created with approved status");
  }

  console.log("\n✅ Done!");
  console.log("   glaprojects01@gmail.com is now superAdmin.");
  console.log("   Sign out and sign back in to activate the new token.\n");
}

main().catch((err) => {
  console.error("\n❌ Error:", err.message || err);
  console.error("\nIf the error is about credentials, download a service account key:");
  console.error("  Firebase Console → Project Settings → Service Accounts → Generate new private key");
  console.error("  Then set FIREBASE_SERVICE_ACCOUNT_JSON in .env.local\n");
  process.exit(1);
});
