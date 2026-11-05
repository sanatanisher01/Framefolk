"use client";

/**
 * Registers the FRAMEFOLK service worker.
 * Called once from a client component after hydration.
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined") return null;
  if (!("serviceWorker" in navigator)) return null;

  try {
    const reg = await navigator.serviceWorker.register("/sw.js", {
      scope: "/",
      updateViaCache: "none",
    });

    // Check for updates every hour
    setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000);

    reg.addEventListener("updatefound", () => {
      const newWorker = reg.installing;
      if (!newWorker) return;
      newWorker.addEventListener("statechange", () => {
        if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
          // New version available — could show a toast here
          console.info("[SW] New version available. Refresh to update.");
        }
      });
    });

    return reg;
  } catch (err) {
    console.warn("[SW] Registration failed:", err);
    return null;
  }
}

/**
 * Requests notification permission and returns the result.
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!("Notification" in window)) return "denied";
  if (Notification.permission === "granted") return "granted";
  return Notification.requestPermission();
}
