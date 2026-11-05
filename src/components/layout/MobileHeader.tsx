"use client";

import Link from "next/link";
import { Bell, ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/utils/cn";
import { Logo } from "@/components/ui/Logo";
import { Button } from "@/components/ui/Button";

interface MobileHeaderProps {
  /** Show back button instead of logo */
  showBack?: boolean;
  /** Title for back-button mode */
  title?: string;
  /** Notification badge count */
  unreadNotifications?: number;
  /** Extra actions rendered on the right */
  actions?: React.ReactNode;
  className?: string;
}

export function MobileHeader({
  showBack,
  title,
  unreadNotifications = 0,
  actions,
  className,
}: MobileHeaderProps) {
  const router = useRouter();

  return (
    <header
      className={cn(
        "sticky top-0 z-40 lg:hidden flex items-center h-14 px-4 gap-3",
        "bg-bg-primary/95 backdrop-blur-md border-b border-border",
        className
      )}
    >
      {showBack ? (
        <>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => router.back()}
            aria-label="Go back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          {title && (
            <h1 className="font-display font-semibold text-text-primary truncate flex-1">
              {title}
            </h1>
          )}
        </>
      ) : (
        <>
          <Link href="/home" className="flex-1">
            <Logo size="sm" />
          </Link>
        </>
      )}

      <div className="flex items-center gap-1 ml-auto">
        {actions}
        <Link href="/notifications" aria-label="Notifications">
          <Button variant="ghost" size="icon-sm" className="relative" asChild>
            <span>
              <Bell className="h-5 w-5" />
              {unreadNotifications > 0 && (
                <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-accent text-[9px] font-bold text-bg-primary leading-none">
                  {unreadNotifications > 9 ? "9+" : unreadNotifications}
                </span>
              )}
            </span>
          </Button>
        </Link>
      </div>
    </header>
  );
}
