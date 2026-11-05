/**
 * POST /api/cloudinary/connect
 *
 * Validates personal Cloudinary credentials and stores them securely.
 * API Key is stored in Firestore (cloudinaryConnections).
 * API Secret is stored in Firebase Secret Manager via a stub reference.
 *
 * Body: { cloudName: string, apiKey: string, apiSecret: string }
 *
 * Note: In production, the API Secret should be stored in Firebase Secret Manager.
 * This route tests the credentials first before persisting anything.
 */

import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("Authorization");
  const idToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!idToken) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  let uid: string;
  try {
    const { getAdminAuth, getAdminDb } = await import("@/lib/firebase/admin");
    const decoded = await getAdminAuth().verifyIdToken(idToken);
    uid = decoded.uid;

    // Check approved status
    const userDoc = await getAdminDb().collection("users").doc(uid).get();
    if (!userDoc.exists || userDoc.data()?.status !== "approved") {
      return NextResponse.json({ error: "Account not approved." }, { status: 403 });
    }
  } catch {
    return NextResponse.json({ error: "Invalid token." }, { status: 401 });
  }

  let body: { cloudName?: string; apiKey?: string; apiSecret?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { cloudName, apiKey, apiSecret } = body;
  if (!cloudName || !apiKey || !apiSecret) {
    return NextResponse.json(
      { error: "cloudName, apiKey and apiSecret are required." },
      { status: 400 }
    );
  }

  // ── Test credentials against Cloudinary ping endpoint ─────────────────
  try {
    const timestamp = Math.round(Date.now() / 1000);
    const { createHash } = await import("crypto");
    const sig = createHash("sha1")
      .update(`timestamp=${timestamp}${apiSecret}`)
      .digest("hex");

    const testRes = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          file: "data:image/gif;base64,R0lGODlhAQABAIAAAAUEBAAAACwAAAAAAQABAAACAkQBADs=",
          api_key: apiKey,
          timestamp,
          signature: sig,
          folder: "framefolk_test",
          tags: "connection_test",
        }),
      }
    );

    if (!testRes.ok) {
      const errData = await testRes.json().catch(() => ({})) as { error?: { message?: string } };
      return NextResponse.json(
        { error: errData?.error?.message ?? "Invalid Cloudinary credentials." },
        { status: 400 }
      );
    }

    // Clean up the test upload
    const uploadData = await testRes.json() as { public_id?: string };
    if (uploadData?.public_id) {
      // Fire-and-forget cleanup
      const delSig = createHash("sha1")
        .update(`public_id=${uploadData.public_id}&timestamp=${timestamp}${apiSecret}`)
        .digest("hex");
      fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/destroy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          public_id: uploadData.public_id,
          api_key: apiKey,
          timestamp,
          signature: delSig,
        }),
      }).catch(() => {});
    }
  } catch {
    return NextResponse.json(
      { error: "Could not reach Cloudinary. Check your credentials and try again." },
      { status: 400 }
    );
  }

  // ── Save connection to Firestore ────────────────────────────────────────
  try {
    const { getAdminDb } = await import("@/lib/firebase/admin");
    const { FieldValue } = await import("firebase-admin/firestore");
    const db = getAdminDb();
    const now = FieldValue.serverTimestamp();

    // Store connection metadata (NOT the secret — that goes to Secret Manager in production)
    // For now, we store a reference path as secretRef placeholder
    const connRef = db.collection("cloudinaryConnections").doc(uid);
    await connRef.set({
      ownerUid: uid,
      cloudName,
      apiKey, // API key is semi-public, safe to store
      // secretRef points to where the secret WILL be stored in Secret Manager
      secretRef: `projects/${process.env.FIREBASE_PROJECT_ID ?? "framefolk"}/secrets/cloudinary_${uid}_apisecret/versions/latest`,
      status: "connected",
      usageBytes: 0,
      lastSyncedAt: now,
      createdAt: now,
      updatedAt: now,
    }, { merge: true });

    // Update user's storageProvider
    await db.collection("users").doc(uid).update({
      storageProvider: "personal",
      updatedAt: now,
    });

    return NextResponse.json({ success: true, cloudName });
  } catch (err) {
    console.error("Failed to save Cloudinary connection:", err);
    return NextResponse.json({ error: "Failed to save connection." }, { status: 500 });
  }
}
