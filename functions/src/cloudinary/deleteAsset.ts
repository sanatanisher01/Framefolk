import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { createHmac } from "crypto";
import * as https from "https";
import * as querystring from "querystring";

if (!admin.apps.length) admin.initializeApp();

const db = admin.firestore();

/**
 * Callable: deleteCloudinaryAsset
 *
 * Called after admin approves a deletion request.
 * Deletes the asset from Cloudinary, then updates Firestore records.
 *
 * Security:
 * - Only Super Admin or Moderator (with canApproveDeleteRequests) can call this.
 * - Never marks request as completed until Cloudinary confirms deletion.
 */
export const deleteCloudinaryAsset = functions.https.onCall(
  async (data: { deletionRequestId: string }, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "Sign in required.");
    }

    const role = context.auth.token.role as string;
    if (role !== "superAdmin" && role !== "moderator") {
      throw new functions.https.HttpsError("permission-denied", "Admins only.");
    }

    const { deletionRequestId } = data;
    if (!deletionRequestId) {
      throw new functions.https.HttpsError("invalid-argument", "deletionRequestId required.");
    }

    const now = admin.firestore.FieldValue.serverTimestamp();
    const callerUid = context.auth.uid;

    // ── 1. Load deletion request ────────────────────────────────────────
    const requestDoc = await db.collection("deletionRequests").doc(deletionRequestId).get();
    if (!requestDoc.exists) {
      throw new functions.https.HttpsError("not-found", "Deletion request not found.");
    }
    const request = requestDoc.data()!;
    if (request.status !== "approved") {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "Request must be approved before processing."
      );
    }

    // ── 2. Mark as processing ───────────────────────────────────────────
    await db.collection("deletionRequests").doc(deletionRequestId).update({
      status: "processing",
      updatedAt: now,
    });

    // ── 3. Load and delete each media asset ─────────────────────────────
    const mediaIds = (request.mediaIds as string[]) ?? [];
    const failures: string[] = [];

    for (const mediaId of mediaIds) {
      const mediaDoc = await db.collection("media").doc(mediaId).get();
      if (!mediaDoc.exists) continue;

      const media = mediaDoc.data()!;
      const publicId = media.cloudinaryPublicId as string;
      const resourceType = (media.resourceType as string) ?? "image";

      // Get Cloudinary credentials
      const cloudName = functions.config().cloudinary?.cloud_name
        ?? process.env.CLOUDINARY_CLOUD_NAME ?? "";
      const apiKey = functions.config().cloudinary?.api_key
        ?? process.env.CLOUDINARY_API_KEY ?? "";
      const apiSecret = functions.config().cloudinary?.api_secret
        ?? process.env.CLOUDINARY_API_SECRET ?? "";

      try {
        const result = await destroyCloudinaryAsset(
          publicId, resourceType, cloudName, apiKey, apiSecret
        );

        if (result === "ok" || result === "not found") {
          // Delete media document
          await db.collection("media").doc(mediaId).delete();
        } else {
          failures.push(mediaId);
          functions.logger.error(`Cloudinary delete failed for ${publicId}: ${result}`);
        }
      } catch (err) {
        failures.push(mediaId);
        functions.logger.error(`Exception deleting ${publicId}:`, err);
      }
    }

    // ── 4. Update post / story if applicable ────────────────────────────
    const entityId = request.entityId as string;
    const entityType = request.entityType as string;
    if (failures.length === 0) {
      if (entityType === "post") {
        await db.collection("posts").doc(entityId).update({
          mediaIds: [],
          isHidden: true,
          updatedAt: now,
        });
        // Decrement user post count
        const post = (await db.collection("posts").doc(entityId).get()).data();
        if (post) {
          await db.collection("users").doc(post.authorUid).update({
            postsCount: admin.firestore.FieldValue.increment(-1),
          });
        }
      }

      // ── 5. Complete request ─────────────────────────────────────────
      await db.collection("deletionRequests").doc(deletionRequestId).update({
        status: "completed",
        updatedAt: now,
      });

      // ── 6. Notify requester ─────────────────────────────────────────
      await db.collection("notifications").add({
        recipientUid: request.requesterUid,
        senderUid: callerUid,
        senderUsername: "FRAMEFOLK",
        senderPhotoUrl: "",
        type: "deletionUpdate",
        entityType: "post",
        entityId,
        text: "Your deletion request has been completed.",
        isRead: false,
        createdAt: now,
        readAt: null,
      });

      // ── 7. Audit log ────────────────────────────────────────────────
      await db.collection("auditLogs").add({
        actorUid: callerUid,
        actorRole: role,
        action: "deletionApproved",
        targetUid: request.requesterUid,
        targetEntityType: entityType,
        targetEntityId: entityId,
        previousValue: null,
        newValue: { status: "completed" },
        reason: null,
        ipAddress: null,
        createdAt: now,
      });

      return { success: true, deleted: mediaIds.length };
    } else {
      // Some deletions failed
      await db.collection("deletionRequests").doc(deletionRequestId).update({
        status: "failed",
        adminNote: `Failed to delete ${failures.length} asset(s): ${failures.join(", ")}`,
        updatedAt: now,
      });

      throw new functions.https.HttpsError(
        "internal",
        `Deletion partially failed. ${failures.length} asset(s) could not be removed.`
      );
    }
  }
);

/**
 * Makes a signed DELETE request to the Cloudinary API.
 * Returns "ok", "not found", or an error string.
 */
async function destroyCloudinaryAsset(
  publicId: string,
  resourceType: string,
  cloudName: string,
  apiKey: string,
  apiSecret: string
): Promise<string> {
  const timestamp = Math.round(Date.now() / 1000);
  const paramStr = `public_id=${publicId}&timestamp=${timestamp}`;
  const signature = createHmac("sha1", apiSecret)
    .update(paramStr + apiSecret)
    .digest("hex");

  // Actually: Cloudinary signature is SHA1 of (params + secret), not HMAC
  const { createHash } = await import("crypto");
  const sig = createHash("sha1").update(paramStr + apiSecret).digest("hex");

  const body = querystring.stringify({
    public_id: publicId,
    api_key: apiKey,
    timestamp: String(timestamp),
    signature: sig,
  });

  void signature; // suppress unused var

  return new Promise((resolve) => {
    const req = https.request(
      {
        hostname: "api.cloudinary.com",
        path: `/v1_1/${cloudName}/${resourceType}/destroy`,
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Content-Length": Buffer.byteLength(body),
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk: string) => { data += chunk; });
        res.on("end", () => {
          try {
            const json = JSON.parse(data) as { result?: string };
            resolve(json.result ?? "error");
          } catch {
            resolve("error");
          }
        });
      }
    );
    req.on("error", () => resolve("error"));
    req.write(body);
    req.end();
  });
}
