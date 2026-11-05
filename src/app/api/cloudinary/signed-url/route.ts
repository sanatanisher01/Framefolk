/**
 * POST /api/cloudinary/signed-url
 *
 * Returns a short-lived signed delivery URL for private/restricted media.
 * Client must provide the media document ID; this route verifies access.
 *
 * Body: { mediaId: string }
 * Returns: { url: string, expiresAt: number }
 */

import { NextRequest, NextResponse } from "next/server";
import { cloudinaryConfig } from "@/lib/cloudinary/config";

export async function POST(req: NextRequest) {
  // ── Auth ────────────────────────────────────────────────────────────────
  const authHeader = req.headers.get("Authorization");
  const idToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!idToken) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let uid: string;
  try {
    const { getAdminAuth } = await import("@/lib/firebase/admin");
    const decoded = await getAdminAuth().verifyIdToken(idToken);
    uid = decoded.uid;
  } catch {
    return NextResponse.json({ error: "Invalid token." }, { status: 401 });
  }

  // ── Parse body ──────────────────────────────────────────────────────────
  let mediaId: string;
  try {
    const body = await req.json();
    mediaId = body.mediaId;
    if (!mediaId) throw new Error("missing mediaId");
  } catch {
    return NextResponse.json({ error: "mediaId required." }, { status: 400 });
  }

  // ── Verify access ───────────────────────────────────────────────────────
  try {
    const { getAdminDb } = await import("@/lib/firebase/admin");
    const db = getAdminDb();

    const mediaDoc = await db.collection("media").doc(mediaId).get();
    if (!mediaDoc.exists) {
      return NextResponse.json({ error: "Media not found." }, { status: 404 });
    }

    const media = mediaDoc.data()!;
    const visibility = media.visibility as string;
    const ownerUid = media.ownerUid as string;

    // Owner always has access
    if (ownerUid !== uid) {
      // Check post visibility rules
      if (visibility === "private") {
        return NextResponse.json({ error: "Access denied." }, { status: 403 });
      }
      if (visibility === "followers") {
        const followDoc = await db
          .collection("followers")
          .doc(uid)
          .collection("following")
          .doc(ownerUid)
          .get();
        if (!followDoc.exists) {
          return NextResponse.json({ error: "Access denied." }, { status: 403 });
        }
      }
    }

    // ── Generate signed URL ─────────────────────────────────────────────
    const publicId = media.cloudinaryPublicId as string;
    const resourceType = (media.resourceType as string) ?? "image";
    const expiresAt = Math.round(Date.now() / 1000) + 3600; // 1 hour

    // Build Cloudinary signed URL
    const paramStr = `expires_at=${expiresAt}&public_id=${encodeURIComponent(publicId)}${cloudinaryConfig.apiSecret}`;
    const encoder = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest("SHA-1", encoder.encode(paramStr));
    const hashHex = Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    const signedUrl = `https://res.cloudinary.com/${cloudinaryConfig.cloudName}/${resourceType}/upload/s--${hashHex.slice(0, 8)}--/f_auto,q_auto/${publicId}?expires_at=${expiresAt}`;

    return NextResponse.json({ url: signedUrl, expiresAt });
  } catch (err) {
    console.error("signed-url error:", err);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}
