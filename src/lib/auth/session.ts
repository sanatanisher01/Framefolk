"use client";

import { onIdTokenChanged } from "firebase/auth";
import { auth } from "@/lib/firebase/client";

/**
 * Keeps the `ff_session` cookie in sync with the Firebase ID token.
 *
 * Call `startSessionSync()` once at app startup (inside AuthProvider).
 * The cookie is read by Next.js middleware for edge-side auth checks.
 *
 * Security notes:
 * - The cookie is NOT HttpOnly (middleware runs at edge, can't set HttpOnly from client).
 * - Full server-side verification uses the Admin SDK in API routes / Cloud Functions.
 * - The middleware only decodes (not verifies) the JWT for fast routing decisions.
 */
export function startSessionSync(): () => void {
  if (!auth) return () => {};

  const unsub = onIdTokenChanged(auth, async (user) => {
    if (user) {
      try {
        const token = await user.getIdToken();
        // 1 hour expiry — Firebase tokens are valid for 1 hour
        document.cookie = `ff_session=${token}; path=/; max-age=3600; SameSite=Strict`;
      } catch {
        clearSessionCookie();
      }
    } else {
      clearSessionCookie();
    }
  });

  return unsub;
}

export function clearSessionCookie() {
  document.cookie = "ff_session=; path=/; max-age=0; SameSite=Strict";
}
