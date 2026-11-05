"use client";

import { usePWAInstall } from "@/hooks/usePWAInstall";
import { LogoMark } from "@/components/ui/Logo";
import { Button } from "@/components/ui/Button";
import { X, Download } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";

/**
 * Shown at the bottom of the screen when the app is installable.
 * Dismisses permanently when user taps ✕.
 * Only shown on mobile-sized screens (handled via CSS).
 */
export function PWAInstallBanner() {
  const { canInstall, isInstalled, isDismissed, install, dismiss } = usePWAInstall();
  const [installing, setInstalling] = useState(false);

  const visible = canInstall && !isInstalled && !isDismissed;

  async function handleInstall() {
    setInstalling(true);
    await install();
    setInstalling(false);
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="fixed bottom-20 lg:bottom-4 left-4 right-4 z-50 max-w-md mx-auto"
          role="banner"
          aria-label="Install FRAMEFOLK"
        >
          <div className="flex items-center gap-3 bg-bg-card border border-border rounded-2xl px-4 py-3.5 shadow-modal">
            <LogoMark size={36} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-text-primary leading-tight">
                Install FRAMEFOLK
              </p>
              <p className="text-xs text-text-secondary mt-0.5">
                Add to home screen for a native app experience.
              </p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <Button
                variant="primary"
                size="sm"
                className="gap-1.5"
                loading={installing}
                onClick={handleInstall}
              >
                <Download className="h-3.5 w-3.5" />
                Install
              </Button>
              <button
                type="button"
                onClick={dismiss}
                className="p-1.5 rounded-lg text-text-muted hover:text-text-secondary hover:bg-bg-secondary transition-colors"
                aria-label="Dismiss"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
