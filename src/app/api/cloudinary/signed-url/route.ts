import { NextResponse } from "next/server";
import { canViewMedia, requestUser, RequestError } from "@/lib/server/access";
import { credentialsFor, downloadUrl } from "@/lib/server/cloudinary";

export async function POST(request: Request) {
 try {
  const { uid, db } = await requestUser(request);
  const { mediaId, thumbnail } = await request.json();
  if (typeof mediaId !== "string" || !mediaId || mediaId.includes("/")) throw new RequestError("Invalid media ID.");
  const media = (await db.doc(`media/${mediaId}`).get()).data();
  if (!media) throw new RequestError("Media not found.", 404);
  if (!await canViewMedia(uid, media)) throw new RequestError("Access denied.", 403);
  const credentials = await credentialsFor(media.cloudinaryAccountId ?? "central");
  return NextResponse.json({ url: downloadUrl(media, credentials, thumbnail === true), expiresAt: Math.floor(Date.now()/1000) + 3600 }, { headers: { "Cache-Control": "no-store" } });
 } catch (error) {
  return NextResponse.json({ error: error instanceof RequestError ? error.message : "Unable to load media." }, { status: error instanceof RequestError ? error.status : 500 });
 }
}
