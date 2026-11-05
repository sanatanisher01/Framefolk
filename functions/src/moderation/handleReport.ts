/**
 * FRAMEFOLK — handleReport Cloud Function
 *
 * Callable by admins/moderators to action or dismiss a content report.
 * On "actioned": hides the reported entity and notifies the reporter.
 * On "dismissed": marks report as reviewed with no action.
 */
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

if (!admin.apps.length) admin.initializeApp();

const db = admin.firestore();

interface HandleReportData {
  reportId: string;
  action: "actioned" | "dismissed";
  adminNote?: string;
}

export const handleReport = functions.https.onCall(
  async (data: HandleReportData, context) => {
    // ── Auth guard ────────────────────────────────────────────────────────
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "Sign in required.");
    }
    const role = context.auth.token.role as string | undefined;
    if (role !== "superAdmin" && role !== "moderator") {
      throw new functions.https.HttpsError("permission-denied", "Moderators only.");
    }

    const { reportId, action, adminNote } = data;
    if (!reportId || !action) {
      throw new functions.https.HttpsError("invalid-argument", "reportId and action are required.");
    }
    if (action !== "actioned" && action !== "dismissed") {
      throw new functions.https.HttpsError("invalid-argument", "action must be 'actioned' or 'dismissed'.");
    }

    const now = admin.firestore.FieldValue.serverTimestamp();
    const callerUid = context.auth.uid;

    // ── Load report ───────────────────────────────────────────────────────
    const reportRef = db.collection("reports").doc(reportId);
    const reportSnap = await reportRef.get();
    if (!reportSnap.exists) {
      throw new functions.https.HttpsError("not-found", "Report not found.");
    }
    const report = reportSnap.data()!;
    if (report.status === "actioned" || report.status === "dismissed") {
      throw new functions.https.HttpsError("failed-precondition", "Report already reviewed.");
    }

    const entityType = report.entityType as string;
    const entityId = report.entityId as string;

    // ── Update report ─────────────────────────────────────────────────────
    await reportRef.update({
      status: action,
      reviewedBy: callerUid,
      reviewedAt: now,
      adminNote: adminNote ?? null,
      updatedAt: now,
    });

    // ── If actioned: hide the entity ──────────────────────────────────────
    if (action === "actioned") {
      try {
        if (entityType === "post") {
          await db.collection("posts").doc(entityId).update({
            isHidden: true,
            updatedAt: now,
          });
        } else if (entityType === "story") {
          await db.collection("stories").doc(entityId).update({
            isDeleted: true,
            updatedAt: now,
          });
        } else if (entityType === "comment") {
          // Extract postId from report if stored, else skip
          const postId = report.postId as string | undefined;
          if (postId) {
            await db.collection("posts").doc(postId)
              .collection("comments").doc(entityId)
              .update({ isDeleted: true, updatedAt: now });
          }
        }
      } catch (err) {
        functions.logger.warn(`handleReport: could not hide entity ${entityType}/${entityId}`, err);
      }

      // Notify the reporter that action was taken
      await db.collection("notifications").add({
        recipientUid: report.reporterUid,
        senderUid: callerUid,
        senderUsername: "FRAMEFOLK",
        senderPhotoUrl: "",
        type: "adminAction",
        entityType,
        entityId,
        text: "Your report has been reviewed and action has been taken. Thank you.",
        isRead: false,
        createdAt: now,
        readAt: null,
      }).catch(() => {});
    }

    // ── Audit log ─────────────────────────────────────────────────────────
    await db.collection("auditLogs").add({
      actorUid: callerUid,
      actorRole: role,
      action: action === "actioned" ? "reportActioned" : "reportDismissed",
      targetUid: report.reporterUid ?? null,
      targetEntityType: entityType,
      targetEntityId: entityId,
      previousValue: { status: "pending" },
      newValue: { status: action },
      reason: adminNote ?? null,
      ipAddress: null,
      createdAt: now,
    }).catch(() => {});

    return { success: true, action };
  }
);
