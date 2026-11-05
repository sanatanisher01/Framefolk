import { LogoMark } from "@/components/ui/Logo";
import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh flex flex-col bg-bg-primary">
      {/* Minimal auth header */}
      <header className="flex items-center justify-center h-16 border-b border-border/40">
        <Link href="/" aria-label="FRAMEFOLK Home">
          <div className="flex items-center gap-2">
            <LogoMark size={28} />
            <span className="font-display font-bold text-lg tracking-tight text-text-primary">
              FRAME<span className="text-accent">FOLK</span>
            </span>
          </div>
        </Link>
      </header>
      <main className="flex-1 flex items-center justify-center px-4 py-10">
        {children}
      </main>
      <footer className="py-4 text-center text-xs text-text-muted">
        © {new Date().getFullYear()} FRAMEFOLK · Every frame has a story.
      </footer>
    </div>
  );
}
