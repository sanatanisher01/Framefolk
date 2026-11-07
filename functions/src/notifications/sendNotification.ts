import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

if (!admin.apps.length) admin.initializeApp();

const db = admin.firestore();

export interface NotificationPayload {
  recipientUid: string;
  senderUid: string;
  senderUsername: string;
  senderPhotoUrl: string;
  type: string;
  entityType: string;
  entityId: string;
  text: string;
}

/**
 * Internal helper — called by other Cloud Functions to fan out notifications.
 * Not directly callable by clients.
 */
export async function createNotification(payload: NotificationPayload): Promise<void> {
  const now = admin.firestore.FieldValue.serverTimestamp();

  // Don't notify yourself
  if (payload.recipientUid === payload.senderUid) return;

  const prefs = (await db.doc(`notificationPrefs/${payload.recipientUid}`).get()).data();
  const keys: Record<string,string> = { like: "likes", comment: "comments", follow: "follows", followRequest: "followRequests", message: "messages", albumInvite: "albumInvites", adminAction: "adminActions" };
  if (prefs?.[keys[payload.type]] === false) return;
  const notifRef = db.collection("notifications").doc();
  await notifRef.set({
    ...payload,
    isRead: false,
    createdAt: now,
    readAt: null,
  });
}

/**
 * Callable: markNotificationsRead
 * Marks multiple notifications as read for the calling user.
 */
export const markNotificationsRead = functions.https.onCall(
  async (data: { notificationIds: string[] }, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "Sign in required.");
    }

    const { notificationIds } = data;
    if (!Array.isArray(notificationIds) || notificationIds.length === 0) {
      throw new functions.https.HttpsError("invalid-argument", "notificationIds required.");
    }

    const now = admin.firestore.FieldValue.serverTimestamp();
    const batch = db.batch();

    const ids = Array.from(new Set(notificationIds));
    if (ids.length > 500 || ids.some(id => typeof id !== "string" || !id || id.includes("/"))) throw new functions.https.HttpsError("invalid-argument", "Invalid notification IDs.");
    const docs = await db.getAll(...ids.map(id => db.collection("notifications").doc(id)));
    if (docs.some(doc => doc.data()?.recipientUid !== context.auth!.uid)) throw new functions.https.HttpsError("permission-denied", "These notifications do not belong to you.");
    docs.forEach(doc => batch.update(doc.ref, { isRead: true, readAt: now }));

    await batch.commit();
    return { success: true };
  }
);
