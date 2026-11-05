/**
 * Firebase CLIENT-side SDK initialisation.
 * Uses a singleton pattern — safe to import from any client component.
 * Must NOT be imported from Server Components or API Routes
 * (use src/lib/firebase/admin.ts there instead).
 */
import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  type Auth,
  connectAuthEmulator,
} from "firebase/auth";
import {
  getFirestore,
  type Firestore,
  connectFirestoreEmulator,
} from "firebase/firestore";
import { firebaseConfig, isFirebaseConfigured } from "./config";

let app: FirebaseApp;
let auth: Auth;
let db: Firestore;

function initFirebase() {
  if (!isFirebaseConfigured) {
    // Return mock-safe stubs during build/test without real credentials
    return;
  }

  app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
  auth = getAuth(app);
  db = getFirestore(app);

  // Connect to local emulators in development
  if (
    process.env.NODE_ENV === "development" &&
    process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === "true"
  ) {
    try {
      connectAuthEmulator(auth, "http://127.0.0.1:9099", {
        disableWarnings: true,
      });
      connectFirestoreEmulator(db, "127.0.0.1", 8080);
    } catch {
      // Emulators already connected (hot reload)
    }
  }
}

initFirebase();

export { app, auth, db };
