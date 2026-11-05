// Client SDK exports — safe in browser and Server Components that don't need admin
export { auth, db } from "./client";
export { firebaseConfig, isFirebaseConfigured } from "./config";

// Admin SDK exports — server-side only
export { getAdminAuth, getAdminDb } from "./admin";
