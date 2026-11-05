"use client";

import { useState, useEffect, useCallback } from "react";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
  prompt(): Promise<void>;
}

export interface PWAInstallState {
  /** True when the browser has a deferred install prompt ready */
  canInstall: boolean;
  /** True when app is already running as installed PWA */
  isInstalled: boolean;
  /** True after user dismisses the install prompt */
  isDismissed: boolean;
  /** Trigger the native install prompt */
  install: () => Promise<"accepted" | "dismissed" | "unavailable">;
  /** Dismiss permanently (stored in localStorage) */
  dismiss: () => void;
}

const DISMISSED_KEY = "framefolk-pwa-dismissed";

export function usePWAInstall(): PWAInstallState {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    // Already installed (standalone mode)
    if (
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as { standalone?: boolean }).standalone === true
    ) {
      setIsInstalled(true);
      return;
    }

    // Check dismissed flag
    if (localStorage.getItem(DISMISSED_KEY) === "1") {
      setIsDismissed(true);
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const installedHandler = () => setIsInstalled(true);

    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", installedHandler);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", installedHandler);
    };
  }, []);

  const install = useCallback(async (): Promise<"accepted" | "dismissed" | "unavailable"> => {
    if (!deferredPrompt) return "unavailable";
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    if (outcome === "accepted") setIsInstalled(true);
    return outcome;
  }, [deferredPrompt]);

  const dismiss = useCallback(() => {
    localStorage.setItem(DISMISSED_KEY, "1");
    setIsDismissed(true);
    setDeferredPrompt(null);
  }, []);

  return {
    canInstall: !!deferredPrompt && !isInstalled,
    isInstalled,
    isDismissed,
    install,
    dismiss,
  };
}
