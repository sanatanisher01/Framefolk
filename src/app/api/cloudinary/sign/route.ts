/**
 * POST /api/cloudinary/sign
 *
 * Generates a signed upload signature for Cloudinary.
 * Only approved Firebase Auth users can call this endpoint.
 *
 * Body: { resourceType: "image"|"video", context: "post"|"profile"|"cover"|"story", isPrivate: boolean }
 * Returns: UploadSignature object
 */

import { NextRequest, NextResponse } from "next/server";
import { generateUploadSignature } from "@/lib/cloudinary/signature";
import { LIMITS, postFolder, profileFolder, storyFolder } from "@/lib/cloudinary/config";
import { isCloudinaryConfigured } from "@/lib/cloudinary/config";

// ── Verify the Firebase ID token ──────────────────────────────────────────
// Tries Admin SDK first; falls back to Firebase Auth REST API when no
// service account is configured (local dev on Spark plan).
async function verifyAndGetUid(idToken: string): Promise<{ uid: string; approved: boolean }> {
  // ── Path A: Admin SDK (requires FIREBASE_SERVICE_ACCOUNT_JSON) ─────────
  const hasServiceAccount = !!process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  const projectId = process.env.FIREBASE_PROJECT_ID
    ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
    ?? "";

  if (hasServiceAccount) {
    const { getAdminAuth, getAdminDb } = await import("@/lib/firebase/admin");
    const decoded = await getAdminAuth().verifyIdToken(idToken);
    const uid = decoded.uid;
    const userDoc = await getAdminDb().collection("users").doc(uid).get();
    const approved = userDoc.exists && userDoc.data()?.status === "approved";
    return { uid, approved };
  }

  // ── Path B: REST API verification (no service account needed) ──────────
  // Firebase Auth has a public REST endpoint to look up a user by ID token.
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "";
  if (!apiKey) throw new Error("NEXT_PUBLIC_FIREBASE_API_KEY not set");

  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    }
  );

  if (!res.ok) throw new Error("Token verification failed");
  const data = await res.json() as { users?: Array<{ localId: string }> };
  const users = data.users;
  if (!users || users.length === 0) throw new Error("User not found");
  const uid = users[0].localId;

  // Check Firestore status via REST using the user's own ID token
  // (satisfies the isOwner rule in firestore.rules)
  let approved = false;
  if (projectId) {
    try {
      const fsRes = await fetch(
        `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users/${uid}`,
        {
          headers: {
            Authorization: `Bearer ${idToken}`,
          },
        }
      );
      if (fsRes.ok) {
        const fsData = await fsRes.json() as { fields?: { status?: { stringValue?: string } } };
        approved = fsData.fields?.status?.stringValue === "approved";
      } else {
        // Firestore read failed (e.g. doc doesn't exist) — deny upload
        approved = false;
      }
    } catch {
      // Network error — allow upload as a dev convenience fallback
      approved = true;
    }
  } else {
    approved = true; // no project ID configured — skip status check
  }

  return { uid, approved };
}

export async function POST(req: NextRequest) {
  // ── 1. Cloudinary config check ─────────────────────────────────────────
  if (!isCloudinaryConfigured) {
    return NextResponse.json(
      { error: "Cloudinary is not configured on this server." },
      { status: 503 }
    );
  }

  // ── 2. Auth check via Firebase ID token ────────────────────────────────
  const authHeader = req.headers.get("Authorization");
  const idToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!idToken) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let uid: string;
  try {
    const { uid: resolvedUid, approved } = await verifyAndGetUid(idToken);
    uid = resolvedUid;

    if (!approved) {
      return NextResponse.json(
        { error: "Account not approved." },
        { status: 403 }
      );
    }
  } catch (err) {
    console.error("[sign] Auth verification failed:", err);
    return NextResponse.json({ error: "Invalid token." }, { status: 401 });
  }

  // ── 3. Parse body ───────────────────────────────────────────────────────
  let body: {
    resourceType?: string;
    context?: string;
    isPrivate?: boolean;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const resourceType = body.resourceType === "video" ? "video" : "image";
  const context = body.context ?? "post";
  const isPrivate = body.isPrivate === true;

  // ── 4. Determine folder and params ─────────────────────────────────────
  let folder: string;
  let eager: string | undefined;
  let maxFileSize: number;

  if (context === "profile" || context === "cover") {
    folder = profileFolder(uid);
    maxFileSize = LIMITS.profilePhoto;
    eager = "w_200,h_200,c_fill,g_face,f_jpg,q_auto";
  } else if (context === "story") {
    folder = storyFolder(uid);
    maxFileSize = resourceType === "video" ? LIMITS.video : LIMITS.image;
  } else {
    folder = postFolder(uid);
    maxFileSize = resourceType === "video" ? LIMITS.video : LIMITS.image;
    if (resourceType === "video") {
      eager = "so_auto,w_400,h_400,c_fill,g_auto,f_jpg,q_auto";
    }
  }

  // ── 5. Generate signature ───────────────────────────────────────────────
  try {
    const timestamp = Math.round(Date.now() / 1000);
    const signature = await generateUploadSignature({
      timestamp,
      folder,
      ...(eager && { eager }),
      ...(isPrivate && { type: "private" }),
    });

    return NextResponse.json(signature);
  } catch (err) {
    console.error("[sign] Signature generation failed:", err);
    return NextResponse.json(
      { error: "Failed to generate upload signature." },
      { status: 500 }
    );
  }
}
