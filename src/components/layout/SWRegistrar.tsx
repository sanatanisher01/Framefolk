"use client";

import { useEffect } from "react";
import { registerServiceWorker } from "@/lib/pwa/registerSW";

/**
 * Mounts in the root layout and registers the service worker
 * after the initial hydration. No visible UI.
 */
export function SWRegistrar() {
  useEffect(() => {
    if (process.env.NODE_ENV === "production") {
      registerServiceWorker();
    }
  }, []);
  return null;
}
