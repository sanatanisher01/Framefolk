import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { requirePermission } from "../lib/security";
if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();
export const handleReport = functions.https.onCall(async (data: { reportId: string; action: "actioned" | "dismissed"; adminNote?: string }, context) => {
 const actor = await requirePermission(context, "canViewReports");
 if (!data.reportId || data.reportId.includes("/") || !["actioned", "dismissed"].includes(data.action)) throw new functions.https.HttpsError("invalid-argument", "Invalid report action.");
 if (data.action === "actioned") await requirePermission(context, "canHideContent");
 const ref = db.doc(`reports/${data.reportId}`), now = admin.firestore.FieldValue.serverTimestamp();
 await db.runTransaction(async tx => {
  const report = (await tx.get(ref)).data();
  if (!report || report.status !== "pending") throw new functions.https.HttpsError("failed-precondition", "Report is already reviewed or unavailable.");
  let entity: admin.firestore.DocumentReference | null = null;
  if (data.action === "actioned") {
   if (report.entityType === "post") entity = db.doc(`posts/${report.entityId}`);
   else if (report.entityType === "story") entity = db.doc(`stories/${report.entityId}`);
   else if (report.entityType === "comment" && report.postId) entity = db.doc(`posts/${report.postId}/comments/${report.entityId}`);
   else if (report.entityType === "user") {
    await requirePermission(context, "canBlockAccounts", report.entityId);
    entity = db.doc(`users/${report.entityId}`);
   } else throw new functions.https.HttpsError("invalid-argument", "Unsupported report target.");
   if (!(await tx.get(entity)).exists) throw new functions.https.HttpsError("not-found", "Reported content no longer exists.");
  }
  if (entity) tx.update(entity, { ...(report.entityType === "post" ? { isHidden: true } : report.entityType === "user" ? { status: "suspended", suspensionExpiresAt: null } : { isDeleted: true }), updatedAt: now });
  tx.update(ref, { status: data.action, reviewedBy: actor.uid, reviewedAt: now, adminNote: data.adminNote ?? null, updatedAt: now });
  tx.set(db.collection("auditLogs").doc(), { actorUid: actor.uid, actorRole: actor.role, action: data.action === "actioned" ? "reportActioned" : "reportDismissed", targetEntityId: report.entityId, targetEntityType: report.entityType, createdAt: now });
 });
 return { success: true };
});
