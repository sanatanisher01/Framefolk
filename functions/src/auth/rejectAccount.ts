import { requirePermission } from "../lib/security";
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

if (!admin.apps.length) admin.initializeApp();

const db = admin.firestore();

/**
 * Callable: rejectAccount
 *
 * Sets status → "rejected", notifies user, writes audit log.
 * Does NOT delete the Firebase Auth user (admin can reverse decision).
 */
export const rejectAccount = functions.https.onCall(
  async (data: { targetUid: string; reason: string }, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "Must be signed in.");
    }

    const callerClaims = context.auth.token;
    const isAdmin =
      callerClaims.role === "superAdmin" || callerClaims.role === "moderator";

    if (!isAdmin) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "Only admins can reject registrations."
      );
    }

    await requirePermission(context, "canRejectRegistrations", data.targetUid);

    const { targetUid, reason } = data;
    if (!targetUid || !reason) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "targetUid and reason are required."
      );
    }

    const now = admin.firestore.FieldValue.serverTimestamp();
    const callerUid = context.auth.uid;

    try {
      await db.collection("users").doc(targetUid).update({
        status: "rejected",
        updatedAt: now,
      });

      await db.collection("notifications").add({
        recipientUid: targetUid,
        senderUid: callerUid,
        senderUsername: "FRAMEFOLK",
        senderPhotoUrl: "",
        type: "adminAction",
        entityType: "user",
        entityId: targetUid,
        text: "Your registration was not approved. Contact support for more information.",
        isRead: false,
        createdAt: now,
        readAt: null,
      });

      await db.collection("auditLogs").add({
        actorUid: callerUid,
        actorRole: callerClaims.role,
        action: "accountRejected",
        targetUid,
        targetEntityType: "user",
        targetEntityId: targetUid,
        previousValue: { status: "pending" },
        newValue: { status: "rejected" },
        reason,
        ipAddress: null,
        createdAt: now,
      });

      return { success: true };
    } catch (err) {
      functions.logger.error("rejectAccount error", err);
      throw new functions.https.HttpsError("internal", "Failed to reject account.");
    }
  }
);
