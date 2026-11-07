import { NextResponse } from "next/server";
import { requestUser, RequestError } from "@/lib/server/access";
import { signParams, uploadCredentials } from "@/lib/server/cloudinary";

export async function POST(request: Request) {
 try {
  const { uid } = await requestUser(request);
  const body = await request.json();
  if (!["post", "profile", "cover", "story"].includes(body.context) || !["image", "video"].includes(body.resourceType)) throw new RequestError("Invalid upload request.");
  if (["profile", "cover"].includes(body.context) && body.resourceType !== "image") throw new RequestError("Choose an image.");
  const credentials = await uploadCredentials(uid);
  const context = ["profile", "cover"].includes(body.context) ? "profile" : body.context === "story" ? "stories" : "posts";
  const timestamp = Math.floor(Date.now() / 1000);
  // Authenticated delivery protects originals and derivatives, including public posts when privacy changes later.
  const type = context === "profile" ? "upload" : "authenticated";
  const params = { timestamp, folder: `framefolk/users/${uid}/${context}`, type };
  return NextResponse.json({ ...params, signature: signParams(params, credentials.apiSecret), apiKey: credentials.apiKey, cloudName: credentials.cloudName, accountId: credentials.accountId }, { headers: { "Cache-Control": "no-store" } });
 } catch (error) {
  return NextResponse.json({ error: error instanceof RequestError ? error.message : "Unable to authorize upload." }, { status: error instanceof RequestError ? error.status : 500 });
 }
}
