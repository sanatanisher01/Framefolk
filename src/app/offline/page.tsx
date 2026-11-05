import type { Metadata } from "next";
import Link from "next/link";
import { WifiOff, RefreshCw } from "lucide-react";
import { Logo } from "@/components/ui/Logo";

export const metadata: Metadata = { title: "You're offline — FRAMEFOLK" };

export default function OfflinePage() {
  return (
    <div className="min-h-dvh bg-bg-primary flex flex-col items-center justify-center gap-8 px-6 text-center">
      <Logo size="lg" />

      <div className="flex flex-col items-center gap-4 max-w-sm">
        <div className="h-20 w-20 rounded-full bg-bg-secondary border border-border flex items-center justify-center">
          <WifiOff className="h-10 w-10 text-text-secondary" />
        </div>

        <div className="space-y-2">
          <h1 className="font-display font-bold text-2xl text-text-primary">
            You&apos;re offline
          </h1>
          <p className="text-text-secondary text-sm leading-relaxed">
            FRAMEFOLK needs an internet connection to load new content.
            Previously viewed pages may still be available.
          </p>
        </div>

        {/* Reload button — works without JS via meta refresh */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-accent text-bg-primary text-sm font-medium rounded-xl hover:bg-accent-hover transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
          Try again
        </Link>
      </div>

      <p className="text-xs text-text-muted">Every frame has a story.</p>
    </div>
  );
}
