"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Compass,
  PlusSquare,
  MessageCircle,
  Bell,
  BookImage,
  Clock,
  Settings,
  Shield,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/utils/cn";
import { Logo, LogoMark } from "@/components/ui/Logo";
import { Avatar } from "@/components/ui/Avatar";
import { useLocalStorage } from "@/hooks/useLocalStorage";

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  badge?: number;
  exact?: boolean;
}

const mainNav: NavItem[] = [
  { href: "/home", label: "Home", icon: Home, exact: true },
  { href: "/explore", label: "Explore", icon: Compass },
  { href: "/upload", label: "Upload", icon: PlusSquare },
  { href: "/messages", label: "Messages", icon: MessageCircle, badge: 0 },
  { href: "/notifications", label: "Notifications", icon: Bell, badge: 0 },
  { href: "/albums", label: "Albums", icon: BookImage },
  { href: "/memories", label: "Memories", icon: Clock },
];

const bottomNav: NavItem[] = [
  { href: "/settings", label: "Settings", icon: Settings },
];

interface SidebarProps {
  /** Unread message count — passed from layout after auth is wired up */
  unreadMessages?: number;
  /** Unread notification count */
  unreadNotifications?: number;
  /** Current user (stub until auth is implemented) */
  user?: {
    displayName: string;
    username: string;
    photoUrl?: string;
  } | null;
  isAdmin?: boolean;
}

export function Sidebar({
  unreadMessages = 0,
  unreadNotifications = 0,
  user,
  isAdmin = false,
}: SidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useLocalStorage("sidebar-collapsed", false);

  const nav = mainNav.map((item) => ({
    ...item,
    badge:
      item.href === "/messages"
        ? unreadMessages
        : item.href === "/notifications"
          ? unreadNotifications
          : item.badge,
  }));

  function isActive(item: NavItem) {
    if (item.exact) return pathname === item.href;
    return pathname.startsWith(item.href);
  }

  return (
    <aside
      className={cn(
        "hidden lg:flex flex-col fixed left-0 top-0 h-full z-40",
        "bg-bg-secondary border-r border-border transition-all duration-300",
        collapsed ? "w-[72px]" : "w-[240px]"
      )}
    >
      {/* Logo */}
      <div className={cn("flex items-center h-16 px-4 shrink-0", collapsed && "justify-center")}>
        {collapsed ? (
          <Link href="/home" aria-label="FRAMEFOLK Home">
            <LogoMark size={32} />
          </Link>
        ) : (
          <Link href="/home">
            <Logo size="md" />
          </Link>
        )}
      </div>

      {/* Main navigation */}
      <nav className="flex-1 flex flex-col gap-0.5 px-2 py-2 overflow-y-auto no-scrollbar">
        {nav.map((item) => (
          <SidebarLink
            key={item.href}
            item={item}
            active={isActive(item)}
            collapsed={collapsed}
          />
        ))}

        {isAdmin && (
          <>
            <div className="my-2 h-px bg-border mx-2" />
            <SidebarLink
              item={{ href: "/admin", label: "Admin", icon: Shield }}
              active={pathname.startsWith("/admin")}
              collapsed={collapsed}
            />
          </>
        )}
      </nav>

      {/* Bottom section */}
      <div className="flex flex-col gap-0.5 px-2 py-2 border-t border-border">
        {bottomNav.map((item) => (
          <SidebarLink
            key={item.href}
            item={item}
            active={isActive(item)}
            collapsed={collapsed}
          />
        ))}

        {/* User profile link */}
        {user && (
          <Link
            href={`/@${user.username}`}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors",
              "hover:bg-bg-card text-text-secondary hover:text-text-primary",
              collapsed && "justify-center px-0"
            )}
          >
            <Avatar
              src={user.photoUrl}
              fallback={user.displayName}
              size="sm"
            />
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text-primary truncate">
                  {user.displayName}
                </p>
                <p className="text-xs text-text-secondary truncate">
                  @{user.username}
                </p>
              </div>
            )}
          </Link>
        )}
      </div>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed((c) => !c)}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        className={cn(
          "absolute -right-3 top-1/2 -translate-y-1/2",
          "flex h-6 w-6 items-center justify-center rounded-full",
          "bg-bg-secondary border border-border text-text-secondary",
          "hover:text-text-primary hover:bg-bg-card transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        )}
      >
        {collapsed ? (
          <ChevronRight className="h-3 w-3" />
        ) : (
          <ChevronLeft className="h-3 w-3" />
        )}
      </button>
    </aside>
  );
}

function SidebarLink({
  item,
  active,
  collapsed,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-label={item.label}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150",
        active
          ? "bg-accent/10 text-accent"
          : "text-text-secondary hover:bg-bg-card hover:text-text-primary",
        collapsed && "justify-center px-0 w-10 h-10 mx-auto"
      )}
    >
      <div className="relative shrink-0">
        <Icon className="h-5 w-5" />
        {!!item.badge && item.badge > 0 && (
          <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-bg-primary leading-none">
            {item.badge > 9 ? "9+" : item.badge}
          </span>
        )}
      </div>
      {!collapsed && <span className="truncate">{item.label}</span>}
      {active && !collapsed && (
        <span className="ml-auto h-1.5 w-1.5 rounded-full bg-accent" />
      )}
    </Link>
  );
}
