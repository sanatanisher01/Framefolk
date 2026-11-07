import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
if (!admin.apps.length) admin.initializeApp();
export const restoreSuspensions = functions.pubsub.schedule("every 5 minutes").onRun(async () => {
 const db = admin.firestore();
 for (;;) {
  const page = await db.collection("users").where("status", "==", "suspended").where("suspensionExpiresAt", "<=", admin.firestore.Timestamp.now()).limit(400).get();
  if (page.empty) break;
  await Promise.all(page.docs.map(doc => db.runTransaction(async tx => {
   const current = (await tx.get(doc.ref)).data();
   if (current?.status === "suspended" && current.suspensionExpiresAt?.toMillis() <= Date.now()) tx.update(doc.ref, { status: "approved", suspensionExpiresAt: null, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
  })));
 }
 return null;
});
