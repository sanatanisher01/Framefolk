import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

if (!admin.apps.length) admin.initializeApp();

const db = admin.firestore();
const auth = admin.auth();

export const unblockAccount = functions.https.onCall(
  async (data: { targetUid: string }, context) => {
    if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "Sign in required.");
    if (context.auth.token.role !== "superAdmin") {
      throw new functions.https.HttpsError("permission-denied", "Super Admins only.");
    }

    const { targetUid } = data;
    const now = admin.firestore.FieldValue.serverTimestamp();

    await auth.updateUser(targetUid, { disabled: false });
    await db.collection("users").doc(targetUid).update({
      status: "approved",
      updatedAt: now,
    });

    await db.collection("auditLogs").add({
      actorUid: context.auth.uid,
      actorRole: "superAdmin",
      action: "accountUnblocked",
      targetUid,
      targetEntityType: "user",
      targetEntityId: targetUid,
      previousValue: { status: "blocked" },
      newValue: { status: "approved" },
      reason: null,
      ipAddress: null,
      createdAt: now,
    });

    return { success: true };
  }
);
