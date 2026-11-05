import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

if (!admin.apps.length) admin.initializeApp();

const db = admin.firestore();

export const suspendAccount = functions.https.onCall(
  async (data: { targetUid: string; reason: string; durationDays?: number }, context) => {
    if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "Sign in required.");
    const isAdmin = context.auth.token.role === "superAdmin" || context.auth.token.role === "moderator";
    if (!isAdmin) throw new functions.https.HttpsError("permission-denied", "Admins only.");

    const { targetUid, reason, durationDays } = data;
    const now = admin.firestore.FieldValue.serverTimestamp();

    const updateData: Record<string, unknown> = {
      status: "suspended",
      updatedAt: now,
    };

    if (durationDays) {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + durationDays);
      updateData.suspensionExpiresAt = admin.firestore.Timestamp.fromDate(expiresAt);
    }

    await db.collection("users").doc(targetUid).update(updateData);

    await db.collection("auditLogs").add({
      actorUid: context.auth.uid,
      actorRole: context.auth.token.role,
      action: "accountSuspended",
      targetUid,
      targetEntityType: "user",
      targetEntityId: targetUid,
      previousValue: null,
      newValue: { status: "suspended" },
      reason: reason ?? null,
      ipAddress: null,
      createdAt: now,
    });

    return { success: true };
  }
);
