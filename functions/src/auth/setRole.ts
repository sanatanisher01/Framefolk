import { requirePermission } from "../lib/security";
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

if (!admin.apps.length) admin.initializeApp();

const db = admin.firestore();
const auth = admin.auth();

/**
 * Callable: setRole
 *
 * Assigns a Firebase custom claim role to a user.
 * Only superAdmin can call this function.
 * Users cannot assign roles to themselves.
 */
export const setRole = functions.https.onCall(
  async (
    data: {
      targetUid: string;
      role: "superAdmin" | "moderator" | "user";
      permissions?: Record<string, boolean>;
    },
    context
  ) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "Must be signed in.");
    }

    // Only superAdmin can assign roles
    if (context.auth.token.role !== "superAdmin") {
      throw new functions.https.HttpsError(
        "permission-denied",
        "Only Super Admins can assign roles."
      );
    }

    await requirePermission(context, "canAssignRoles");
    const { targetUid, role, permissions } = data;
    if (!["superAdmin", "moderator", "user"].includes(role)) throw new functions.https.HttpsError("invalid-argument", "Invalid role.");

    if (!targetUid || !role) {
      throw new functions.https.HttpsError("invalid-argument", "targetUid and role required.");
    }

    // Prevent self-assignment
    if (targetUid === context.auth.uid) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "You cannot change your own role."
      );
    }

    const now = admin.firestore.FieldValue.serverTimestamp();
    const callerUid = context.auth.uid;

    try {
      // Get previous role for audit
      let previousRole = "user";
      try {
        const user = await auth.getUser(targetUid);
        previousRole = (user.customClaims?.role as string) ?? "user";
      } catch {
        // Ignore
      }

      // Set custom claim
      const target = await auth.getUser(targetUid);
      await auth.setCustomUserClaims(targetUid, { ...target.customClaims, role });

      // Update roles collection
      await db.collection("roles").doc(targetUid).set(
        {
          uid: targetUid,
          role,
          assignedBy: callerUid,
          assignedAt: now,
          updatedAt: now,
        },
        { merge: true }
      );

      // Set moderator permissions if provided
      if (role === "moderator" && permissions) {
        await db.collection("permissions").doc(targetUid).set(
          {
            uid: targetUid,
            ...permissions,
            grantedBy: callerUid,
            grantedAt: now,
            updatedAt: now,
          },
          { merge: true }
        );
      }

      // Audit log
      await db.collection("auditLogs").add({
        actorUid: callerUid,
        actorRole: "superAdmin",
        action: "roleAssigned",
        targetUid,
        targetEntityType: "user",
        targetEntityId: targetUid,
        previousValue: { role: previousRole },
        newValue: { role },
        reason: null,
        ipAddress: null,
        createdAt: now,
      });

      return { success: true };
    } catch (err) {
      functions.logger.error("setRole error", err);
      throw new functions.https.HttpsError("internal", "Failed to set role.");
    }
  }
);
