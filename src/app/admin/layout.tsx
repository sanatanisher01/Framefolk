"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Users, UserCheck, FileWarning,
  Trash2, Flag, ShieldCheck, ScrollText, Settings,
} from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { cn } from "@/utils/cn";

const adminNav = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/registrations", label: "Registrations", icon: UserCheck },
  { href: "/admin/content", label: "Content", icon: FileWarning },
  { href: "/admin/deletion-requests", label: "Deletion Requests", icon: Trash2 },
  { href: "/admin/reports", label: "Reports", icon: Flag },
  { href: "/admin/permissions", label: "Permissions", icon: ShieldCheck },
  { href: "/admin/audit-logs", label: "Audit Logs", icon: ScrollText },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  function isActive(item: typeof adminNav[0]) {
    if (item.exact) return pathname === item.href;
    return pathname.startsWith(item.href);
  }

  return (
    <div className="min-h-dvh bg-bg-primary flex">
      {/* Admin sidebar */}
      <aside className="hidden md:flex flex-col w-56 shrink-0 bg-bg-secondary border-r border-border">
        <div className="flex items-center h-16 px-4 border-b border-border gap-2">
          <Link href="/admin">
            <Logo size="sm" />
          </Link>
          <span className="text-xs font-medium text-accent bg-accent/10 px-2 py-0.5 rounded-full border border-accent/30">
            Admin
          </span>
        </div>
        <nav className="flex-1 flex flex-col gap-0.5 p-2 overflow-y-auto">
          {adminNav.map((item) => {
            const Icon = item.icon;
            const active = isActive(item);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-accent/10 text-accent border border-accent/20"
                    : "text-text-secondary hover:bg-bg-card hover:text-text-primary"
                )}
                aria-current={active ? "page" : undefined}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-border">
          <Link
            href="/home"
            className="flex items-center gap-2 text-xs text-text-secondary hover:text-text-primary transition-colors px-2 py-1.5"
          >
            ← Back to app
          </Link>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-bg-secondary border-b border-border flex items-center gap-3 px-4 h-14">
        <Logo size="sm" />
        <span className="text-xs font-medium text-accent bg-accent/10 px-2 py-0.5 rounded-full border border-accent/20">Admin</span>
        <div className="flex-1 overflow-x-auto no-scrollbar">
          <div className="flex gap-1 pl-2">
            {adminNav.map((item) => {
              const active = isActive(item);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                    active
                      ? "bg-accent/10 text-accent"
                      : "text-text-secondary hover:text-text-primary"
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      {/* Admin content */}
      <main className="flex-1 min-w-0 overflow-auto md:pt-0 pt-14">
        {children}
      </main>
    </div>
  );
}
