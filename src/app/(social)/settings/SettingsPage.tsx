"use client";

import Link from "next/link";
import {
  User, Lock, Bell, Cloud, Shield, LogOut,
  ChevronRight, Smartphone, Users,
} from "lucide-react";
import { MobileHeader } from "@/components/layout/MobileHeader";
import { Card } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { Separator } from "@/components/ui/Separator";
import { useAuth } from "@/lib/auth/AuthContext";
import { useLogout } from "@/hooks/useLogout";
import { Button } from "@/components/ui/Button";
import { cn } from "@/utils/cn";

interface SettingsGroup {
  title: string;
  items: SettingsItem[];
}

interface SettingsItem {
  icon: React.ElementType;
  label: string;
  description?: string;
  href?: string;
  danger?: boolean;
  badge?: string;
}

const SETTINGS_GROUPS: SettingsGroup[] = [
  {
    title: "Account",
    items: [
      { icon: User, label: "Edit profile", description: "Name, bio, photo, links", href: "/settings/profile" },
      { icon: Lock, label: "Account & privacy", description: "Password, privacy, blocked users", href: "/settings/account" },
      { icon: Users, label: "Follow requests", description: "Manage who can follow you", href: "/settings/follow-requests" },
      { icon: Bell, label: "Notifications", description: "Push, email and in-app alerts", href: "/settings/notifications" },
    ],
  },
  {
    title: "Media & Storage",
    items: [
      { icon: Cloud, label: "Storage settings", description: "Cloudinary account, usage", href: "/settings/storage", badge: "Phase 3" },
      { icon: Smartphone, label: "Install app", description: "Add FRAMEFOLK to your home screen", href: "/settings/install" },
    ],
  },
  {
    title: "Security",
    items: [
      { icon: Shield, label: "Security", description: "Active sessions, connected apps", href: "/settings/security", badge: "Phase 8" },
    ],
  },
];

export function SettingsPage() {
  const { user } = useAuth();
  const { logout, loading: logoutLoading } = useLogout();

  return (
    <>
      <MobileHeader title="Settings" showBack />
      <div className="max-w-xl mx-auto px-4 py-6 flex flex-col gap-6">

        {/* Profile summary card */}
        {user && (
          <Link href="/settings/profile">
            <Card className="p-4 hover:shadow-card-hover transition-shadow cursor-pointer">
              <div className="flex items-center gap-3">
                <Avatar
                  src={user.profilePhotoUrl}
                  fallback={user.displayName}
                  size="lg"
                />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-text-primary truncate">{user.displayName}</p>
                  <p className="text-sm text-text-secondary truncate">@{user.username}</p>
                  <p className="text-xs text-accent mt-0.5">Edit profile →</p>
                </div>
              </div>
            </Card>
          </Link>
        )}

        {/* Settings groups */}
        {SETTINGS_GROUPS.map((group) => (
          <div key={group.title} className="flex flex-col gap-1">
            <p className="text-xs font-medium text-text-muted uppercase tracking-wider px-1 mb-1">
              {group.title}
            </p>
            <Card>
              {group.items.map((item, idx) => {
                const Icon = item.icon;
                const content = (
                  <div
                    className={cn(
                      "flex items-center gap-3 px-4 py-3.5 transition-colors",
                      "hover:bg-bg-secondary",
                      item.danger && "hover:bg-red-500/5"
                    )}
                  >
                    <div className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-xl shrink-0",
                      item.danger ? "bg-red-500/10" : "bg-bg-secondary"
                    )}>
                      <Icon className={cn(
                        "h-4 w-4",
                        item.danger ? "text-red-400" : "text-text-secondary"
                      )} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn(
                        "text-sm font-medium",
                        item.danger ? "text-red-400" : "text-text-primary"
                      )}>
                        {item.label}
                      </p>
                      {item.description && (
                        <p className="text-xs text-text-muted truncate">{item.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {item.badge && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-accent/10 text-accent border border-accent/20 font-medium">
                          {item.badge}
                        </span>
                      )}
                      <ChevronRight className="h-4 w-4 text-text-muted" />
                    </div>
                  </div>
                );

                return (
                  <div key={item.label}>
                    {item.href ? (
                      <Link href={item.href}>{content}</Link>
                    ) : (
                      <div>{content}</div>
                    )}
                    {idx < group.items.length - 1 && (
                      <Separator className="mx-4" />
                    )}
                  </div>
                );
              })}
            </Card>
          </div>
        ))}

        {/* Logout */}
        <Button
          variant="secondary"
          className="w-full gap-2 text-red-400 border-red-500/30 hover:bg-red-500/10"
          onClick={logout}
          loading={logoutLoading}
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </Button>

        <p className="text-center text-xs text-text-muted pb-2">
          FRAMEFOLK · Every frame has a story.
        </p>
      </div>
    </>
  );
}
