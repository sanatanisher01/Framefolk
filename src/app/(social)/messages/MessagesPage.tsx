"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthContext";
import { MobileHeader } from "@/components/layout/MobileHeader";
import { ConversationList } from "@/components/messaging/ConversationList";
import { ChatWindow } from "@/components/messaging/ChatWindow";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  subscribeToConversations,
  getOrCreateConversation,
  getConversationPartner,
} from "@/services/messaging.service";
import type { Conversation } from "@/types";

interface ConvWithPartner {
  conv: Conversation;
  partnerUid: string;
  partnerUsername: string;
  partnerDisplayName: string;
  partnerPhotoUrl: string;
  unreadCount: number;
}

export function MessagesPage() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const withUid = searchParams.get("with");

  const [convItems, setConvItems] = useState<ConvWithPartner[]>([]);
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [showChat, setShowChat] = useState(false);

  // Subscribe to all conversations and enrich with partner info
  useEffect(() => {
    if (!user) { setLoadingConvs(false); return; }
    setLoadingConvs(true);

    const unsub = subscribeToConversations(user.uid, async (convs) => {
      const enriched = await Promise.all(
        convs.map(async (conv) => {
          const partnerUid = conv.participants.find((p) => p !== user.uid) ?? "";
          let partnerUsername = "";
          let partnerDisplayName = "";
          let partnerPhotoUrl = "";
          try {
            const profile = await getConversationPartner(conv.id, user.uid);
            partnerUsername = profile?.username ?? "";
            partnerDisplayName = profile?.displayName ?? "";
            partnerPhotoUrl = profile?.photoUrl ?? "";
          } catch { /* ignore */ }
          return {
            conv,
            partnerUid,
            partnerUsername,
            partnerDisplayName,
            partnerPhotoUrl,
            unreadCount: (conv.unreadCounts as Record<string, number>)?.[user.uid] ?? 0,
          };
        })
      );
      setConvItems(enriched);
      setLoadingConvs(false);
    });

    return unsub;
  }, [user]);

  // Handle ?with=uid query param (start or open a conversation)
  useEffect(() => {
    if (!user || !withUid) return;
    getOrCreateConversation(user.uid, withUid)
      .then((convId) => {
        setActiveConvId(convId);
        setShowChat(true);
      })
      .catch(() => {});
  }, [user, withUid]);

  function handleSelectConversation(convId: string) {
    setActiveConvId(convId);
    setShowChat(true);
  }

  if (!user) return null;

  return (
    <>
      {/* Mobile: show header only on conversation list */}
      {!showChat && <MobileHeader title="Messages" showBack={false} />}

      <div className="flex h-[calc(100dvh-4rem)] lg:h-[calc(100dvh-1rem)]">
        {/* ── Conversation list ── */}
        <div className={`
          w-full lg:w-80 shrink-0 border-r border-border flex flex-col
          ${showChat ? "hidden lg:flex" : "flex"}
        `}>
          <div className="px-4 py-3 border-b border-border hidden lg:block">
            <h1 className="font-display font-bold text-xl text-text-primary">Messages</h1>
          </div>
          <div className="flex-1 overflow-y-auto no-scrollbar">
            <ConversationList
              items={convItems}
              loading={loadingConvs}
              activeConvId={activeConvId ?? undefined}
              currentUid={user.uid}
              onSelect={handleSelectConversation}
            />
          </div>
        </div>

        {/* ── Chat window ── */}
        <div className={`
          flex-1 min-w-0 flex flex-col
          ${showChat ? "flex" : "hidden lg:flex"}
        `}>
          {activeConvId ? (
            <ChatWindow
              key={activeConvId}
              conversationId={activeConvId}
              currentUid={user.uid}
              onBack={() => setShowChat(false)}
            />
          ) : (
            <EmptyState
              icon={MessageCircle}
              title="Select a conversation"
              description="Choose a conversation from the list or start a new one by visiting someone's profile."
            />
          )}
        </div>
      </div>
    </>
  );
}
