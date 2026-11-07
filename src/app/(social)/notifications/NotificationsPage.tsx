"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Heart, MessageCircle, UserPlus, Bell, BookImage,
  Shield, Clock, CheckCheck,
} from "lucide-react";
import { useAuth } from "@/lib/auth/AuthContext";
import { MobileHeader } from "@/components/layout/MobileHeader";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  subscribeToNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from "@/services/social.service";
import { formatRelativeTime } from "@/utils/format";
import { cn } from "@/utils/cn";
import type { NotificationType } from "@/types";

interface NotificationItem {
  id: string;
  type: NotificationType;
  senderUid: string;
  senderUsername: string;
  senderPhotoUrl: string;
  entityType: string;
  entityId: string;
  text: string;
  isRead: boolean;
  createdAt: Date;
}

const NOTIF_ICONS: Record<NotificationType, React.ElementType> = {
  like: Heart,
  comment: MessageCircle,
  follow: UserPlus,
  followRequest: UserPlus,
  followAccepted: UserPlus,
  storyReply: MessageCircle,
  message: MessageCircle,
  albumInvite: BookImage,
  adminAction: Shield,
  deletionUpdate: Clock,
};

const NOTIF_ICON_COLORS: Record<NotificationType, string> = {
  like: "text-red-400 bg-red-500/10",
  comment: "text-blue-400 bg-blue-500/10",
  follow: "text-green-400 bg-green-500/10",
  followRequest: "text-yellow-400 bg-yellow-500/10",
  followAccepted: "text-green-400 bg-green-500/10",
  storyReply: "text-purple-400 bg-purple-500/10",
  message: "text-accent bg-accent/10",
  albumInvite: "text-orange-400 bg-orange-500/10",
  adminAction: "text-accent bg-accent/10",
  deletionUpdate: "text-text-secondary bg-bg-secondary",
};

function getEntityLink(type: NotificationType, entityType: string, entityId: string, senderUsername: string): string {
  if (type === "like" || type === "comment") return `/post/${entityId}`;
  if (type === "followRequest") return "/settings/follow-requests";
  if (type === "followAccepted") return `/@${senderUsername}`;
  if (type === "follow") return `/@${senderUsername}`;
  if (type === "albumInvite") return `/albums`;
  if (type === "message") return `/messages`;
  if (type === "adminAction" || type === "deletionUpdate") return "/settings/account";
  return `/@${senderUsername}`;
}

export function NotificationsPage() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    const unsub = subscribeToNotifications(user.uid, (raw) => {
      setNotifications(
        raw.map((n) => ({
          id: n.id as string,
          type: (n.type as NotificationType) ?? "adminAction",
          senderUid: (n.senderUid as string) ?? "",
          senderUsername: (n.senderUsername as string) ?? "",
          senderPhotoUrl: (n.senderPhotoUrl as string) ?? "",
          entityType: (n.entityType as string) ?? "",
          entityId: (n.entityId as string) ?? "",
          text: (n.text as string) ?? "",
          isRead: (n.isRead as boolean) ?? false,
          createdAt: (n.createdAt as Date) ?? new Date(),
        }))
      );
      setLoading(false);
    });
    return unsub;
  }, [user]);

  async function handleMarkAllRead() {
    if (!user || markingAll) return;
    setMarkingAll(true);
    await markAllNotificationsRead(user.uid).catch(() => {});
    setMarkingAll(false);
  }

  async function handleNotificationClick(notif: NotificationItem) {
    if (!notif.isRead) {
      await markNotificationRead(notif.id).catch(() => {});
    }
  }

  // Group notifications by date
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);

  const groups: { label: string; items: NotificationItem[] }[] = [
    { label: "Today", items: notifications.filter((n) => n.createdAt >= today) },
    {
      label: "This week",
      items: notifications.filter((n) => n.createdAt >= weekAgo && n.createdAt < today),
    },
    { label: "Earlier", items: notifications.filter((n) => n.createdAt < weekAgo) },
  ].filter((g) => g.items.length > 0);

  return (
    <>
      <MobileHeader title="Notifications" showBack={false} />
      <div className="max-w-xl mx-auto px-4 py-4 flex flex-col gap-4">
        {/* Header row */}
        <div className="flex items-center justify-between">
          <h1 className="font-display font-bold text-xl text-text-primary hidden lg:block">
            Notifications
          </h1>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleMarkAllRead}
              loading={markingAll}
              className="gap-1.5 text-accent ml-auto"
            >
              <CheckCheck className="h-4 w-4" />
              Mark all read
            </Button>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Spinner size="lg" />
          </div>
        ) : notifications.length === 0 ? (
          <EmptyState
            icon={Bell}
            title="No notifications yet"
            description="When people like your posts, follow you or comment, you'll see it here."
          />
        ) : (
          <div className="flex flex-col gap-6">
            {groups.map((group) => (
              <div key={group.label} className="flex flex-col gap-1">
                <p className="text-xs font-semibold text-text-muted uppercase tracking-wider px-1 mb-1">
                  {group.label}
                </p>
                <div className="bg-bg-card border border-border rounded-2xl overflow-hidden divide-y divide-border/50">
                  {group.items.map((notif) => (
                    <NotificationRow
                      key={notif.id}
                      notif={notif}
                      onClick={handleNotificationClick}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function NotificationRow({
  notif,
  onClick,
}: {
  notif: NotificationItem;
  onClick: (n: NotificationItem) => void;
}) {
  const Icon = NOTIF_ICONS[notif.type] ?? Bell;
  const iconStyle = NOTIF_ICON_COLORS[notif.type] ?? "text-text-secondary bg-bg-secondary";
  const href = getEntityLink(notif.type, notif.entityType, notif.entityId, notif.senderUsername);

  return (
    <Link
      href={href}
      onClick={() => onClick(notif)}
      className={cn(
        "flex items-start gap-3 px-4 py-3.5 transition-colors",
        "hover:bg-bg-secondary",
        !notif.isRead && "bg-accent/5"
      )}
      aria-label={notif.text}
    >
      {/* Type icon */}
      <div className={cn("h-9 w-9 rounded-full flex items-center justify-center shrink-0 mt-0.5", iconStyle)}>
        <Icon className="h-4 w-4" />
      </div>

      {/* Sender avatar */}
      {notif.senderUsername && (
        <Avatar
          src={notif.senderPhotoUrl}
          fallback={notif.senderUsername}
          size="sm"
          className="shrink-0"
        />
      )}

      {/* Text */}
      <div className="flex-1 min-w-0">
        <p className={cn(
          "text-sm leading-snug",
          !notif.isRead ? "text-text-primary" : "text-text-secondary"
        )}>
          {notif.text}
        </p>
        <p className="text-xs text-text-muted mt-0.5">
          {formatRelativeTime(notif.createdAt)}
        </p>
      </div>

      {/* Unread dot */}
      {!notif.isRead && (
        <span className="h-2 w-2 rounded-full bg-accent shrink-0 mt-1.5" aria-label="Unread" />
      )}
    </Link>
  );
}
