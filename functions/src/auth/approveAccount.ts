import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

if (!admin.apps.length) admin.initializeApp();

const db = admin.firestore();
const auth = admin.auth();

/**
 * Callable: approveAccount
 *
 * Called by admin dashboard to approve a pending user.
 * Sets status → "approved", sets custom claim role → "user",
 * sends a notification to the user, writes an audit log.
 *
 * Security: verifies the caller has superAdmin or moderator custom claim.
 */
export const approveAccount = functions.https.onCall(
  async (data: { targetUid: string; note?: string }, context) => {
    // ── Auth check ───────────────────────────────────────────────────────
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "Must be signed in.");
    }

    const callerClaims = context.auth.token;
    const isAdmin =
      callerClaims.role === "superAdmin" || callerClaims.role === "moderator";

    if (!isAdmin) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "Only admins can approve registrations."
      );
    }

    const { targetUid, note } = data;
    if (!targetUid) {
      throw new functions.https.HttpsError("invalid-argument", "targetUid required.");
    }

    const now = admin.firestore.FieldValue.serverTimestamp();
    const callerUid = context.auth.uid;

    try {
      // ── 1. Update Firestore user document ───────────────────────────────
      await db.collection("users").doc(targetUid).update({
        status: "approved",
        approvedAt: now,
        updatedAt: now,
      });

      // ── 2. Set Firebase custom claim ────────────────────────────────────
      await auth.setCustomUserClaims(targetUid, { role: "user" });

      // ── 3. Notify the user ──────────────────────────────────────────────
      await db.collection("notifications").add({
        recipientUid: targetUid,
        senderUid: callerUid,
        senderUsername: "FRAMEFOLK",
        senderPhotoUrl: "",
        type: "adminAction",
        entityType: "user",
        entityId: targetUid,
        text: "Your account has been approved! Welcome to FRAMEFOLK.",
        isRead: false,
        createdAt: now,
        readAt: null,
      });

      // ── 4. Audit log ────────────────────────────────────────────────────
      await db.collection("auditLogs").add({
        actorUid: callerUid,
        actorRole: callerClaims.role,
        action: "accountApproved",
        targetUid,
        targetEntityType: "user",
        targetEntityId: targetUid,
        previousValue: { status: "pending" },
        newValue: { status: "approved" },
        reason: note ?? null,
        ipAddress: null,
        createdAt: now,
      });

      functions.logger.info(`Account approved: ${targetUid} by ${callerUid}`);
      return { success: true };
    } catch (err) {
      functions.logger.error("approveAccount error", err);
      throw new functions.https.HttpsError("internal", "Failed to approve account.");
    }
  }
);
