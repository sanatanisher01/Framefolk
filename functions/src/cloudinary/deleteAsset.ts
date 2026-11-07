import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { requirePermission } from "../lib/security";
import { deleteMediaAsset } from "../lib/cloudinary";
if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();
export const deleteCloudinaryAsset = functions.runWith({ timeoutSeconds: 300 }).https.onCall(async (data: { deletionRequestId: string }, context) => {
 const actor = await requirePermission(context, "canApproveDeleteRequests");
 const id = data.deletionRequestId;
 if (typeof id !== "string" || !id || id.includes("/")) throw new functions.https.HttpsError("invalid-argument", "Invalid deletion request.");
 const ref = db.doc(`deletionRequests/${id}`);
 const request = await db.runTransaction(async tx => {
  const d = (await tx.get(ref)).data();
  if (!d) throw new functions.https.HttpsError("not-found", "Request not found.");
  if (d.status === "completed") return null;
  if (!["approved", "failed", "processing"].includes(d.status) || (d.status === "processing" && d.processingAt?.toMillis() > Date.now() - 5 * 60 * 1000)) throw new functions.https.HttpsError("failed-precondition", "Request is not ready for deletion.");
  if (d.entityType !== "post") throw new functions.https.HttpsError("invalid-argument", "Unsupported deletion target.");
  const post = await tx.get(db.doc(`posts/${d.entityId}`));
  if (!post.exists || post.data()?.authorUid !== d.requesterUid) throw new functions.https.HttpsError("permission-denied", "Deletion ownership mismatch.");
  tx.update(ref, { status: "processing", processingAt: admin.firestore.Timestamp.now(), updatedAt: admin.firestore.FieldValue.serverTimestamp() });
  tx.update(post.ref, { isHidden: true });
  return { ...d, requesterUid: d.requesterUid as string, entityId: d.entityId as string, mediaIds: (post.data()?.mediaIds ?? []) as string[] };
 });
 if (!request) return { success: true };
 try {
  for (const mediaId of request.mediaIds) {
   const media = await db.doc(`media/${mediaId}`).get();
   if (!media.exists) continue;
   if (media.data()?.ownerUid !== request.requesterUid || media.data()?.postId !== request.entityId) throw new Error("Media ownership mismatch.");
   await deleteMediaAsset(media.data()!);
   await media.ref.delete();
  }
  await db.runTransaction(async tx => {
   const postRef = db.doc(`posts/${request.entityId}`), post = await tx.get(postRef);
   const userRef = db.doc(`users/${request.requesterUid}`), user = await tx.get(userRef);
   if (!post.data()?.deletionCompleted) {
    tx.update(postRef, { mediaIds: [], coverMediaId: null, isHidden: true, deletionCompleted: true, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
    if (user.exists) tx.update(userRef, { postsCount: Math.max(0, (user.data()?.postsCount ?? 0) - 1) });
   }
   tx.update(ref, { status: "completed", updatedAt: admin.firestore.FieldValue.serverTimestamp() });
   tx.set(db.collection("auditLogs").doc(), { actorUid: actor.uid, actorRole: actor.role, action: "deletionCompleted", targetEntityId: request.entityId, targetEntityType: "post", createdAt: admin.firestore.FieldValue.serverTimestamp() });
  });
  return { success: true };
 } catch (error) {
  await ref.update({ status: "failed", adminNote: "Deletion failed; retry after checking storage credentials.", updatedAt: admin.firestore.FieldValue.serverTimestamp() });
  functions.logger.error("Deletion failed", error);
  throw new functions.https.HttpsError("internal", "Deletion failed. The request can be retried safely.");
 }
});
