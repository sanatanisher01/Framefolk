/**
 * Bootstrap script — sets superAdmin custom claim on a Firebase Auth user
 * and writes the corresponding Firestore roles document.
 *
 * Usage: node scripts/set-admin.js
 * Requires: FIREBASE_SERVICE_ACCOUNT_JSON in .env.local OR a service account
 *           file at the path in GOOGLE_APPLICATION_CREDENTIALS
 */

const path = require("path");
const fs = require("fs");

// Load .env.local
function loadEnv() {
  const envPath = path.join(__dirname, "..", ".env.local");
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, "utf8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim().replace(/^"(.*)"$/, "$1");
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnv();

const admin = require("firebase-admin");

// Initialize Admin SDK
const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

if (!admin.apps.length) {
  if (serviceAccountJson && serviceAccountJson.trim().startsWith("{")) {
    const serviceAccount = JSON.parse(serviceAccountJson);
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  } else {
    admin.initializeApp({ projectId });
  }
}

const TARGET_UID = "RYwaBzlWD9MXcyp0bzyxfxdjFUi1"; // glaprojects01@gmail.com
const TARGET_ROLE = "superAdmin";

async function main() {
  const auth = admin.auth();
  const db = admin.firestore();

  console.log(`\n🔑 Setting ${TARGET_ROLE} for UID: ${TARGET_UID}`);

  // 1. Set Firebase custom claim
  await auth.setCustomUserClaims(TARGET_UID, { role: TARGET_ROLE });
  console.log("✓ Custom claim set: { role: 'superAdmin' }");

  // 2. Write roles document in Firestore
  await db.collection("roles").doc(TARGET_UID).set({
    uid: TARGET_UID,
    role: TARGET_ROLE,
    assignedBy: "system-bootstrap",
    assignedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  console.log("✓ Firestore roles document written");

  // 3. Ensure user document status = approved
  const userRef = db.collection("users").doc(TARGET_UID);
  const userSnap = await userRef.get();
  if (userSnap.exists) {
    await userRef.update({
      status: "approved",
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    console.log("✓ User status set to approved");
  } else {
    // Create the user doc if it doesn't exist yet (in case onUserCreate hasn't run)
    await userRef.set({
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
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      approvedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    console.log("✓ User document created with approved status");
  }

  // 4. Write audit log
  await db.collection("auditLogs").add({
    actorUid: "system-bootstrap",
    actorRole: "superAdmin",
    action: "roleAssigned",
    targetUid: TARGET_UID,
    targetEntityType: "user",
    targetEntityId: TARGET_UID,
    previousValue: { role: "none" },
    newValue: { role: TARGET_ROLE },
    reason: "Bootstrap — initial superAdmin assignment",
    ipAddress: null,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  console.log("✓ Audit log written");

  console.log("\n✅ Done! glaprojects01@gmail.com is now superAdmin.");
  console.log("   Sign out and back in to refresh the token.\n");
}

main().catch((err) => {
  console.error("❌ Error:", err.message || err);
  process.exit(1);
});
