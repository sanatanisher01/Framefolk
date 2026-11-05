"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Compass, PlusSquare, MessageCircle, User } from "lucide-react";
import { cn } from "@/utils/cn";

interface BottomNavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  exact?: boolean;
  badge?: number;
}

interface BottomNavProps {
  username?: string;
  unreadMessages?: number;
}

export function BottomNav({ username = "me", unreadMessages = 0 }: BottomNavProps) {
  const pathname = usePathname();

  const items: BottomNavItem[] = [
    { href: "/home", label: "Home", icon: Home, exact: true },
    { href: "/explore", label: "Explore", icon: Compass },
    { href: "/upload", label: "Upload", icon: PlusSquare },
    {
      href: "/messages",
      label: "Messages",
      icon: MessageCircle,
      badge: unreadMessages,
    },
    { href: `/@${username}`, label: "Profile", icon: User },
  ];

  function isActive(item: BottomNavItem) {
    if (item.exact) return pathname === item.href;
    if (item.href.startsWith("/@")) return pathname.startsWith("/@");
    return pathname.startsWith(item.href);
  }

  return (
    <nav
      className={cn(
        "fixed bottom-0 left-0 right-0 z-40 lg:hidden",
        "bg-bg-secondary/95 backdrop-blur-md border-t border-border",
        "safe-bottom"
      )}
      aria-label="Mobile navigation"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div className="flex items-center justify-around h-16 px-2">
        {items.map((item) => {
          const active = isActive(item);
          const Icon = item.icon;
          const isUpload = item.href === "/upload";

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-label={item.label}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex flex-col items-center justify-center gap-0.5",
                "min-w-[44px] min-h-[44px] rounded-xl transition-all duration-150",
                isUpload
                  ? "bg-accent text-bg-primary rounded-xl p-2.5 shadow-accent-glow/40 active:scale-95"
                  : active
                    ? "text-accent"
                    : "text-text-secondary hover:text-text-primary"
              )}
            >
              <div className="relative">
                <Icon className={cn("h-6 w-6", isUpload && "h-5 w-5")} />
                {!!item.badge && item.badge > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-accent text-[9px] font-bold text-bg-primary">
                    {item.badge > 9 ? "9+" : item.badge}
                  </span>
                )}
              </div>
              {!isUpload && (
                <span className="text-[10px] font-medium leading-none">
                  {item.label}
                </span>
              )}
              {active && !isUpload && (
                <span className="absolute bottom-1 h-1 w-1 rounded-full bg-accent" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
