"use client";

import { formatRelativeTime } from "@/utils/format";
import { Avatar } from "@/components/ui/Avatar";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/utils/cn";
import type { Conversation } from "@/types";

interface ConvWithPartner {
  conv: Conversation;
  partnerUid: string;
  partnerUsername: string;
  partnerDisplayName: string;
  partnerPhotoUrl: string;
  unreadCount: number;
}

interface Props {
  items: ConvWithPartner[];
  loading: boolean;
  activeConvId?: string;
  currentUid: string;
  onSelect: (convId: string) => void;
}

export function ConversationList({ items, loading, activeConvId, onSelect }: Props) {
  if (loading) {
    return (
      <div className="flex flex-col gap-1 p-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 p-2">
            <Skeleton circle className="h-11 w-11 shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-2.5 w-40" />
            </div>
            <Skeleton className="h-2.5 w-8" />
          </div>
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 p-6 text-center">
        <p className="text-sm font-medium text-text-primary">No conversations yet</p>
        <p className="text-xs text-text-secondary">
          Visit someone&apos;s profile and tap Message to start a conversation.
        </p>
      </div>
    );
  }

  return (
    <ul className="flex flex-col divide-y divide-border/40">
      {items.map(({ conv, partnerDisplayName, partnerPhotoUrl, unreadCount }) => {
        const isActive = conv.id === activeConvId;
        const lastMsg = conv.lastMessage;
        const preview = lastMsg?.text
          ? lastMsg.text.length > 50 ? lastMsg.text.slice(0, 50) + "…" : lastMsg.text
          : "No messages yet";

        return (
          <li key={conv.id}>
            <button
              type="button"
              onClick={() => onSelect(conv.id)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors",
                isActive ? "bg-accent/10" : "hover:bg-bg-secondary"
              )}
            >
              <Avatar
                src={partnerPhotoUrl}
                fallback={partnerDisplayName}
                size="md"
                className="shrink-0"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className={cn(
                    "text-sm truncate",
                    unreadCount > 0 ? "font-bold text-text-primary" : "font-medium text-text-primary"
                  )}>
                    {partnerDisplayName}
                  </p>
                  {conv.lastMessageAt && (
                    <span className="text-[10px] text-text-muted shrink-0">
                      {formatRelativeTime(conv.lastMessageAt)}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between gap-2 mt-0.5">
                  <p className={cn(
                    "text-xs truncate",
                    unreadCount > 0 ? "text-text-primary font-medium" : "text-text-muted"
                  )}>
                    {preview}
                  </p>
                  {unreadCount > 0 && (
                    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-bg-primary px-1.5 shrink-0">
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  )}
                </div>
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
