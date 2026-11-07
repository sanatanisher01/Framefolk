import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { createHash } from "crypto";

if (!admin.apps.length) admin.initializeApp();

/**
 * Callable: generateUploadSignature
 *
 * Alternative to the Next.js API route — used when calling from
 * native mobile clients or other non-browser contexts.
 * The Next.js /api/cloudinary/sign route is preferred for web.
 */
export const generateUploadSignature = functions.https.onCall(
  async (
    data: {
      context: "post" | "profile" | "story" | "cover";
      resourceType: "image" | "video";
      isPrivate?: boolean;
    },
    context
  ) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "Sign in required.");
    }

    const uid = context.auth.uid;

    // Verify approved status
    const userDoc = await admin.firestore().collection("users").doc(uid).get();
    if (!userDoc.exists || userDoc.data()?.status !== "approved") {
      throw new functions.https.HttpsError("permission-denied", "Account not approved.");
    }

    const cloudName = functions.config().cloudinary?.cloud_name
      ?? process.env.CLOUDINARY_CLOUD_NAME ?? "";
    const apiKey = functions.config().cloudinary?.api_key
      ?? process.env.CLOUDINARY_API_KEY ?? "";
    const apiSecret = functions.config().cloudinary?.api_secret
      ?? process.env.CLOUDINARY_API_SECRET ?? "";

    if (!cloudName || !apiKey || !apiSecret) {
      throw new functions.https.HttpsError("internal", "Cloudinary not configured.");
    }

    if (!["post", "profile", "story", "cover"].includes(data.context) || !["image", "video"].includes(data.resourceType)) throw new functions.https.HttpsError("invalid-argument", "Invalid upload request.");
    const folder = `framefolk/users/${uid}/${data.context === "profile" || data.context === "cover" ? "profile" : data.context}`;
    const timestamp = Math.round(Date.now() / 1000);

    const params: Record<string, string | number> = { folder, timestamp };
    params.type = data.context === "profile" || data.context === "cover" ? "upload" : "authenticated";

    const stringToSign = Object.keys(params).sort()
      .map((k) => `${k}=${params[k]}`)
      .join("&");

    const signature = createHash("sha1")
      .update(stringToSign + apiSecret)
      .digest("hex");

    return { signature, apiKey, cloudName, timestamp, folder, type: params.type, accountId: "central" };
  }
);
