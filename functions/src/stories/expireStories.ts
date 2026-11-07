import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { deleteMediaAsset } from "../lib/cloudinary";
if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();
export const expireStories = functions.pubsub.schedule("every 1 hours").timeZone("UTC").onRun(async () => {
 const cutoff = admin.firestore.Timestamp.now();
 for (;;) {
  const page = await db.collection("stories").where("isExpired", "==", false).where("isDeleted", "==", false).where("expiresAt", "<=", cutoff).limit(400).get();
  if (page.empty) break;
  const batch = db.batch();
  page.docs.forEach(doc => batch.update(doc.ref, { isExpired: true, updatedAt: admin.firestore.FieldValue.serverTimestamp() }));
  await batch.commit();
 }
 return null;
});
export const cleanupExpiredStories = functions.runWith({ timeoutSeconds: 540 }).pubsub.schedule("every 24 hours").timeZone("UTC").onRun(async () => {
 const cutoff = admin.firestore.Timestamp.fromMillis(Date.now() - 7 * 24 * 60 * 60 * 1000);
 let cursor: admin.firestore.QueryDocumentSnapshot | undefined;
 for (;;) {
  let q = db.collection("stories").where("isExpired", "==", true).where("isDeleted", "==", false).where("expiresAt", "<=", cutoff).orderBy("expiresAt").limit(100);
  if (cursor) q = q.startAfter(cursor);
  const page = await q.get();
  if (page.empty) break;
  for (const story of page.docs) {
   const highlights = await db.collection("storyHighlights").where("storyIds", "array-contains", story.id).limit(1).get();
   if (!highlights.empty) continue;
   try {
    const media = await db.collection("media").where("storyId", "==", story.id).get();
    for (const item of media.docs) {
     await deleteMediaAsset(item.data());
     await item.ref.delete();
    }
    for (;;) {
     const views = await db.collection("storyViews").where("storyId", "==", story.id).limit(400).get();
     if (views.empty) break;
     const batch = db.batch(); views.docs.forEach(d => batch.delete(d.ref)); await batch.commit();
    }
    await story.ref.update({ isDeleted: true, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
   } catch (error) { functions.logger.error(`Story cleanup failed for ${story.id}; will retry`, error); }
  }
  cursor = page.docs[page.docs.length - 1];
 }
 return null;
});
