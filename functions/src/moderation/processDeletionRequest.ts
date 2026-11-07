import { requirePermission } from "../lib/security";
/**
 * FRAMEFOLK — processDeletionRequest Cloud Function
 *
 * Callable by admins. Approves or rejects a user-submitted media deletion request.
 * On approval: delegates actual Cloudinary deletion to deleteCloudinaryAsset.
 * On rejection: notifies the requester and closes the request.
 */
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

if (!admin.apps.length) admin.initializeApp();

const db = admin.firestore();

interface ProcessDeletionData {
  requestId: string;
  decision: "approved" | "rejected";
  adminNote?: string;
}

export const processDeletionRequest = functions.https.onCall(
  async (data: ProcessDeletionData, context) => {
    // ── Auth guard ────────────────────────────────────────────────────────
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "Sign in required.");
    }
    const role = context.auth.token.role as string | undefined;
    if (role !== "superAdmin" && role !== "moderator") {
      throw new functions.https.HttpsError("permission-denied", "Admins only.");
    }

    await requirePermission(context, "canApproveDeleteRequests");

    const { requestId, decision, adminNote } = data;
    if (!requestId || !decision) {
      throw new functions.https.HttpsError("invalid-argument", "requestId and decision are required.");
    }
    if (decision !== "approved" && decision !== "rejected") {
      throw new functions.https.HttpsError("invalid-argument", "decision must be 'approved' or 'rejected'.");
    }

    const now = admin.firestore.FieldValue.serverTimestamp();
    const callerUid = context.auth.uid;

    // ── Load request ──────────────────────────────────────────────────────
    const requestRef = db.collection("deletionRequests").doc(requestId);
    const requestSnap = await requestRef.get();
    if (!requestSnap.exists) {
      throw new functions.https.HttpsError("not-found", "Deletion request not found.");
    }
    const request = requestSnap.data()!;

    if (!["pending", "failed", "approved"].includes(request.status)) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        `Request is already ${request.status as string}.`
      );
    }

    const post = (await db.doc(`posts/${request.entityId}`).get()).data();
    if (request.entityType !== "post" || !post || post.authorUid !== request.requesterUid) throw new functions.https.HttpsError("permission-denied", "Deletion ownership mismatch.");

    // ── Update request status ─────────────────────────────────────────────
    await requestRef.update({
      status: decision,
      adminUid: callerUid,
      adminNote: adminNote ?? null,
      updatedAt: now,
    });

    const requesterUid = request.requesterUid as string;
    const entityType = request.entityType as string;
    const entityId = request.entityId as string;

    if (decision === "rejected") {
      // ── Notify requester of rejection ─────────────────────────────────
      await db.collection("notifications").add({
        recipientUid: requesterUid,
        senderUid: callerUid,
        senderUsername: "FRAMEFOLK",
        senderPhotoUrl: "",
        type: "deletionUpdate",
        entityType,
        entityId,
        text: adminNote
          ? `Your deletion request was not approved: ${adminNote}`
          : "Your deletion request was reviewed but could not be approved at this time.",
        isRead: false,
        createdAt: now,
        readAt: null,
      }).catch(() => {});

      // ── Audit log ──────────────────────────────────────────────────────
      await db.collection("auditLogs").add({
        actorUid: callerUid,
        actorRole: role,
        action: "deletionRejected",
        targetUid: requesterUid,
        targetEntityType: entityType,
        targetEntityId: entityId,
        previousValue: { status: "pending" },
        newValue: { status: "rejected" },
        reason: adminNote ?? null,
        ipAddress: null,
        createdAt: now,
      }).catch(() => {});

      return { success: true, decision: "rejected" };
    }

    // ── Approved: the actual Cloudinary deletion is handled by
    //    deleteCloudinaryAsset (which the admin UI calls next).
    //    This function just gates the approval and sets up the audit trail.

    // ── Audit log ─────────────────────────────────────────────────────────
    await db.collection("auditLogs").add({
      actorUid: callerUid,
      actorRole: role,
      action: "deletionApproved",
      targetUid: requesterUid,
      targetEntityType: entityType,
      targetEntityId: entityId,
      previousValue: { status: "pending" },
      newValue: { status: "approved" },
      reason: adminNote ?? null,
      ipAddress: null,
      createdAt: now,
    }).catch(() => {});

    // ── Notify requester that it was approved (deletion pending) ──────────
    await db.collection("notifications").add({
      recipientUid: requesterUid,
      senderUid: callerUid,
      senderUsername: "FRAMEFOLK",
      senderPhotoUrl: "",
      type: "deletionUpdate",
      entityType,
      entityId,
      text: "Your deletion request has been approved and is being processed.",
      isRead: false,
      createdAt: now,
      readAt: null,
    }).catch(() => {});

    return { success: true, decision: "approved" };
  }
);
