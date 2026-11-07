import { initializeApp, getApps, cert, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
function getAdminApp(): App {
 const existing = getApps()[0];
 if (existing) return existing;
 const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
 const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
 if (json) return initializeApp({ credential: cert(JSON.parse(json)) });
 if (!projectId) throw new Error("Firebase Admin SDK is not configured.");
 return initializeApp({ projectId });
}
export function getAdminAuth() { return getAuth(getAdminApp()); }
export function getAdminDb() { return getFirestore(getAdminApp()); }
