import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

if (!admin.apps.length) admin.initializeApp();

const db = admin.firestore();

/**
 * Scheduled function: expireStories
 *
 * Runs every hour and marks stories older than 24 hours as expired.
 * Sets isExpired: true — stories are NOT deleted immediately so
 * highlights can still reference them. A separate cleanup job
 * (or manual admin action) handles permanent deletion after 7 days.
 *
 * Schedule: every 1 hour
 */
export const expireStories = functions.pubsub
  .schedule("every 1 hours")
  .timeZone("UTC")
  .onRun(async () => {
    const now = admin.firestore.Timestamp.now();

    // Find all stories that have passed their expiresAt but aren't marked yet
    const q = db
      .collection("stories")
      .where("isExpired", "==", false)
      .where("isDeleted", "==", false)
      .where("expiresAt", "<=", now)
      .limit(500);

    const snap = await q.get();
    if (snap.empty) {
      functions.logger.info("expireStories: nothing to expire");
      return null;
    }

    // Batch-update in groups of 500 (Firestore batch limit)
    const chunks: admin.firestore.QueryDocumentSnapshot[][] = [];
    for (let i = 0; i < snap.docs.length; i += 500) {
      chunks.push(snap.docs.slice(i, i + 500));
    }

    for (const chunk of chunks) {
      const batch = db.batch();
      chunk.forEach((doc) => {
        batch.update(doc.ref, {
          isExpired: true,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      });
      await batch.commit();
    }

    functions.logger.info(`expireStories: expired ${snap.docs.length} stories`);
    return null;
  });

/**
 * Scheduled function: cleanupExpiredStories
 *
 * Runs daily and permanently deletes stories expired more than 7 days ago
 * that are NOT referenced by any highlight.
 *
 * Schedule: every 24 hours
 */
export const cleanupExpiredStories = functions.pubsub
  .schedule("every 24 hours")
  .timeZone("UTC")
  .onRun(async () => {
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const cutoffTs = admin.firestore.Timestamp.fromDate(cutoff);

    const q = db
      .collection("stories")
      .where("isExpired", "==", true)
      .where("isDeleted", "==", false)
      .where("expiresAt", "<=", cutoffTs)
      .limit(200);

    const snap = await q.get();
    if (snap.empty) return null;

    let deleted = 0;
    for (const storyDoc of snap.docs) {
      const storyId = storyDoc.id;

      // Check if referenced by a highlight
      const highlightQuery = await db
        .collection("storyHighlights")
        .where("storyIds", "array-contains", storyId)
        .limit(1)
        .get();

      if (!highlightQuery.empty) continue; // keep if in a highlight

      const batch = db.batch();
      batch.update(storyDoc.ref, { isDeleted: true });

      // Also clean up storyViews for this story
      const viewsSnap = await db
        .collection("storyViews")
        .where("storyId", "==", storyId)
        .limit(100)
        .get();
      viewsSnap.docs.forEach((v) => batch.delete(v.ref));

      await batch.commit();
      deleted++;
    }

    functions.logger.info(`cleanupExpiredStories: soft-deleted ${deleted} stories`);
    return null;
  });
