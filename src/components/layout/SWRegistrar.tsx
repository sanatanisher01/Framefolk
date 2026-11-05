import { useEffect } from "react";
import { registerServiceWorker } from "@/lib/pwa/registerSW";

/**
 * Registers the service worker and listens for RELOAD messages
 * triggered by the admin "Clear all caches" button.
 */
export function SWRegistrar() {
  useEffect(() => {
    if (process.env.NODE_ENV === "production") {
      registerServiceWorker();
    }

    // Listen for reload message from SW (after admin cache clear)
    if ("serviceWorker" in navigator) {
      const handler = (event: MessageEvent) => {
        if (event.data?.type === "RELOAD") {
          window.location.reload();
        }
      };
      navigator.serviceWorker.addEventListener("message", handler);
      return () => navigator.serviceWorker.removeEventListener("message", handler);
    }
  }, []);

  return null;
}
