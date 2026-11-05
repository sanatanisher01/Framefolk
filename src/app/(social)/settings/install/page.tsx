"use client";

import { MobileHeader } from "@/components/layout/MobileHeader";
import { usePWAInstall } from "@/hooks/usePWAInstall";
import { Button } from "@/components/ui/Button";
import { LogoMark } from "@/components/ui/Logo";
import {
  Download, CheckCircle, Smartphone, Bell, Wifi, Zap,
} from "lucide-react";
import { useState } from "react";

const PWA_FEATURES = [
  { icon: Zap, label: "Instant loading", description: "App-like speed with smart caching" },
  { icon: Bell, label: "Push notifications", description: "Get notified about likes, comments and messages" },
  { icon: Wifi, label: "Offline support", description: "Browse cached content without internet" },
  { icon: Smartphone, label: "Home screen icon", description: "Launch directly like a native app" },
];

export default function InstallPage() {
  const { canInstall, isInstalled, install } = usePWAInstall();
  const [installing, setInstalling] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function handleInstall() {
    setInstalling(true);
    const outcome = await install();
    setResult(outcome);
    setInstalling(false);
  }

  return (
    <>
      <MobileHeader title="Install App" showBack />
      <div className="max-w-md mx-auto px-4 py-8 flex flex-col items-center gap-8">

        {/* Icon + Title */}
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="h-24 w-24 rounded-3xl bg-bg-card border-2 border-border flex items-center justify-center shadow-card">
            <LogoMark size={52} />
          </div>
          <div>
            <h1 className="font-display font-bold text-2xl text-text-primary">
              Install FRAMEFOLK
            </h1>
            <p className="text-sm text-text-secondary mt-1">
              Every frame has a story — now on your home screen.
            </p>
          </div>
        </div>

        {/* Status */}
        {isInstalled ? (
          <div className="flex items-center gap-3 px-5 py-3.5 rounded-2xl bg-green-500/10 border border-green-500/30 w-full">
            <CheckCircle className="h-5 w-5 text-green-400 shrink-0" />
            <div>
              <p className="text-sm font-medium text-green-400">App installed</p>
              <p className="text-xs text-green-400/70 mt-0.5">
                FRAMEFOLK is on your home screen.
              </p>
            </div>
          </div>
        ) : result === "accepted" ? (
          <div className="flex items-center gap-3 px-5 py-3.5 rounded-2xl bg-green-500/10 border border-green-500/30 w-full">
            <CheckCircle className="h-5 w-5 text-green-400 shrink-0" />
            <p className="text-sm font-medium text-green-400">Installation started!</p>
          </div>
        ) : null}

        {/* Features */}
        <div className="w-full flex flex-col gap-3">
          {PWA_FEATURES.map((f) => {
            const Icon = f.icon;
            return (
              <div key={f.label} className="flex items-center gap-4 bg-bg-card border border-border rounded-2xl px-4 py-3.5">
                <div className="h-10 w-10 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center shrink-0">
                  <Icon className="h-5 w-5 text-accent" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-text-primary">{f.label}</p>
                  <p className="text-xs text-text-secondary">{f.description}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Install button */}
        {!isInstalled && result !== "accepted" && (
          canInstall ? (
            <Button
              variant="primary"
              size="lg"
              className="w-full gap-2"
              loading={installing}
              onClick={handleInstall}
            >
              <Download className="h-5 w-5" />
              Install FRAMEFOLK
            </Button>
          ) : (
            <div className="w-full bg-bg-card border border-border rounded-2xl p-5 text-center">
              <p className="text-sm font-medium text-text-primary mb-2">
                How to install manually
              </p>
              <div className="text-xs text-text-secondary space-y-1.5 text-left">
                <p><span className="font-medium text-text-primary">iOS Safari:</span> Tap the Share button → &ldquo;Add to Home Screen&rdquo;</p>
                <p><span className="font-medium text-text-primary">Android Chrome:</span> Tap the menu (⋮) → &ldquo;Add to Home Screen&rdquo; or &ldquo;Install app&rdquo;</p>
                <p><span className="font-medium text-text-primary">Desktop Chrome/Edge:</span> Click the install icon (⊕) in the address bar</p>
              </div>
            </div>
          )
        )}

        <p className="text-xs text-text-muted text-center">
          Free · No app store required · Works on all devices
        </p>
      </div>
    </>
  );
}
