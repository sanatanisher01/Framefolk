import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

// Initialise Admin SDK once
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

/**
 * Triggered whenever a new Firebase Auth user is created.
 *
 * Creates the initial Firestore user document with status "pending".
 * The user must then:
 *  1. Verify their email
 *  2. Complete onboarding (username, photo, bio)
 *  3. Wait for admin approval (status → "approved")
 */
export const onUserCreate = functions.auth.user().onCreate(async (user) => {
  const now = admin.firestore.FieldValue.serverTimestamp();

  const userDoc = {
    uid: user.uid,
    email: user.email ?? "",
    displayName: user.displayName ?? "",
    username: "", // Set during onboarding step 2
    bio: "",
    profilePhotoUrl: user.photoURL ?? "",
    profilePhotoPublicId: "",
    coverPhotoUrl: "",
    coverPhotoPublicId: "",
    status: "pending",
    isPrivate: false,
    isEmailVerified: user.emailVerified,
    storageProvider: "central",
    followersCount: 0,
    followingCount: 0,
    postsCount: 0,
    theme: "default",
    onboardingComplete: false,
    createdAt: now,
    updatedAt: now,
    approvedAt: null,
  };

  try {
    await db.collection("users").doc(user.uid).set(userDoc);

    // Notify all super admins about the new registration
    const adminsSnap = await db
      .collection("roles")
      .where("role", "==", "superAdmin")
      .get();

    const notifBatch = db.batch();
    adminsSnap.docs.forEach((adminDoc) => {
      const notifRef = db.collection("notifications").doc();
      notifBatch.set(notifRef, {
        recipientUid: adminDoc.id,
        senderUid: user.uid,
        senderUsername: user.displayName ?? user.email ?? "New user",
        senderPhotoUrl: user.photoURL ?? "",
        type: "adminAction",
        entityType: "user",
        entityId: user.uid,
        text: `New registration: ${user.email}`,
        isRead: false,
        createdAt: now,
        readAt: null,
      });
    });
    await notifBatch.commit();

    functions.logger.info(`User document created for ${user.uid}`);
  } catch (err) {
    functions.logger.error(`Failed to create user document for ${user.uid}`, err);
  }
});
