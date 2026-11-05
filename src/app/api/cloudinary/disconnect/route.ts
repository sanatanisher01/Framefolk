/**
 * POST /api/cloudinary/disconnect
 *
 * Removes the personal Cloudinary connection for the authenticated user.
 * Reverts storageProvider to "central".
 * Does NOT delete the user's media — they retain it in their own account.
 */

import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("Authorization");
  const idToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!idToken) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  let uid: string;
  try {
    const { getAdminAuth } = await import("@/lib/firebase/admin");
    const decoded = await getAdminAuth().verifyIdToken(idToken);
    uid = decoded.uid;
  } catch {
    return NextResponse.json({ error: "Invalid token." }, { status: 401 });
  }

  try {
    const { getAdminDb } = await import("@/lib/firebase/admin");
    const { FieldValue } = await import("firebase-admin/firestore");
    const db = getAdminDb();
    const now = FieldValue.serverTimestamp();

    // Update connection status
    await db.collection("cloudinaryConnections").doc(uid).set(
      { status: "disconnected", updatedAt: now },
      { merge: true }
    );

    // Revert storage provider
    await db.collection("users").doc(uid).update({
      storageProvider: "central",
      updatedAt: now,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Failed to disconnect Cloudinary:", err);
    return NextResponse.json({ error: "Failed to disconnect." }, { status: 500 });
  }
}
