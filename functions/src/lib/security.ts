import * as admin from "firebase-admin";
import * as functions from "firebase-functions";

export async function requirePermission(context: functions.https.CallableContext, permission: string, targetUid?: string) {
  if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "Sign in required.");
  const db = admin.firestore();
  const [authUser, profile] = await Promise.all([admin.auth().getUser(context.auth.uid), db.doc(`users/${context.auth.uid}`).get()]);
  const role = authUser.customClaims?.role;
  if (authUser.disabled || profile.data()?.status !== "approved" || !["superAdmin", "moderator"].includes(role)) {
    throw new functions.https.HttpsError("permission-denied", "Active administrator required.");
  }
  if (role !== "superAdmin") {
    const permissions = (await db.doc(`permissions/${context.auth.uid}`).get()).data();
    if (!permissions?.[permission]) throw new functions.https.HttpsError("permission-denied", "This action is not permitted for your role.");
    if (targetUid) {
      const target = await admin.auth().getUser(targetUid);
      if (["superAdmin", "moderator"].includes(target.customClaims?.role)) throw new functions.https.HttpsError("permission-denied", "Only a super administrator can manage other administrators.");
    }
  }
  return { uid: context.auth.uid, role: role as string };
}
