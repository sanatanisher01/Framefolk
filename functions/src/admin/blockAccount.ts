import { requirePermission } from "../lib/security";
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

if (!admin.apps.length) admin.initializeApp();

const db = admin.firestore();
const auth = admin.auth();

export const blockAccount = functions.https.onCall(
  async (data: { targetUid: string; reason: string }, context) => {
    if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "Sign in required.");
    const isAdmin = context.auth.token.role === "superAdmin" || context.auth.token.role === "moderator";
    if (!isAdmin) throw new functions.https.HttpsError("permission-denied", "Admins only.");

    await requirePermission(context, "canBlockAccounts", data.targetUid);

    const { targetUid, reason } = data;
    if (!targetUid) throw new functions.https.HttpsError("invalid-argument", "targetUid required.");

    const now = admin.firestore.FieldValue.serverTimestamp();
    const callerUid = context.auth.uid;

    // Disable Firebase Auth account
    await auth.updateUser(targetUid, { disabled: true });

    // Update Firestore status
    await db.collection("users").doc(targetUid).update({
      status: "blocked",
      updatedAt: now,
    });

    // Audit log
    await db.collection("auditLogs").add({
      actorUid: callerUid,
      actorRole: context.auth.token.role,
      action: "accountBlocked",
      targetUid,
      targetEntityType: "user",
      targetEntityId: targetUid,
      previousValue: null,
      newValue: { status: "blocked" },
      reason: reason ?? null,
      ipAddress: null,
      createdAt: now,
    });

    return { success: true };
  }
);
