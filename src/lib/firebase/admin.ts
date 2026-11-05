/**
 * Firebase ADMIN SDK initialisation.
 * SERVER-SIDE ONLY — never import this from client components.
 * Used in: Next.js middleware, API routes, Server Components.
 */
import type { App } from "firebase-admin/app";
import type { Auth } from "firebase-admin/auth";
import type { Firestore } from "firebase-admin/firestore";

let adminApp: App;
let adminAuth: Auth;
let adminDb: Firestore;

function getAdminApp(): App {
  if (adminApp) return adminApp;

  // Dynamically import to avoid bundling in client
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { initializeApp, getApps, cert } = require("firebase-admin/app");

  if (getApps().length > 0) {
    adminApp = getApps()[0];
    return adminApp;
  }

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const projectId = process.env.FIREBASE_PROJECT_ID ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

  if (serviceAccountJson) {
    const serviceAccount = JSON.parse(serviceAccountJson);
    adminApp = initializeApp({ credential: cert(serviceAccount) });
  } else if (projectId) {
    // Fallback: Application Default Credentials (Cloud Run / GCE / emulator)
    adminApp = initializeApp({ projectId });
  } else {
    throw new Error(
      "Firebase Admin SDK not configured. " +
        "Set FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_PROJECT_ID in environment variables."
    );
  }

  return adminApp;
}

export function getAdminAuth(): Auth {
  if (adminAuth) return adminAuth;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { getAuth } = require("firebase-admin/auth");
  adminAuth = getAuth(getAdminApp());
  return adminAuth;
}

export function getAdminDb(): Firestore {
  if (adminDb) return adminDb;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { getFirestore } = require("firebase-admin/firestore");
  adminDb = getFirestore(getAdminApp());
  return adminDb;
}
