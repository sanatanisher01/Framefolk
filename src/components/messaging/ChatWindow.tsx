"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { Send, ArrowLeft, MoreHorizontal, Trash2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Avatar } from "@/components/ui/Avatar";
import { Spinner } from "@/components/ui/Spinner";
import {
  subscribeToMessages,
  sendMessage,
  markMessagesRead,
  setTyping,
  unsendMessage,
  getConversationPartner,
} from "@/services/messaging.service";
import { formatRelativeTime } from "@/utils/format";
import { cn } from "@/utils/cn";
import type { Message } from "@/types";

interface Partner {
  uid: string;
  username: string;
  displayName: string;
  photoUrl: string;
}

interface Props {
  conversationId: string;
  currentUid: string;
  onBack?: () => void;
}

export function ChatWindow({ conversationId, currentUid, onBack }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [partner, setPartner] = useState<Partner | null>(null);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [typingTimeout, setTypingTimeout] = useState<ReturnType<typeof setTimeout> | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Load partner info
  useEffect(() => {
    getConversationPartner(conversationId, currentUid)
      .then(setPartner)
      .catch(() => setPartner(null));
  }, [conversationId, currentUid]);

  // Subscribe to messages
  useEffect(() => {
    setLoading(true);
    const unsub = subscribeToMessages(conversationId, (msgs) => {
      setMessages(msgs);
      setLoading(false); // fires even with 0 messages
    });
    // Mark as read
    markMessagesRead(conversationId, currentUid).catch(() => {});
    // Safety timeout — if no snapshot in 3s, stop spinning
    const timeout = setTimeout(() => setLoading(false), 3000);
    return () => { unsub(); clearTimeout(timeout); };
  }, [conversationId, currentUid]);

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleTyping = useCallback(() => {
    setTyping(conversationId, currentUid, true).catch(() => {});
    if (typingTimeout) clearTimeout(typingTimeout);
    const t = setTimeout(() => {
      setTyping(conversationId, currentUid, false).catch(() => {});
    }, 2000);
    setTypingTimeout(t);
  }, [conversationId, currentUid, typingTimeout]);

  async function handleSend() {
    if (!text.trim() || sending) return;
    // Get partner UID from conversation ID (format: uid1_uid2 sorted)
    const partnerUid = partner?.uid ?? conversationId.split("_").find((id) => id !== currentUid) ?? "";
    if (!partnerUid) return;
    setSending(true);
    const msg = text.trim();
    setText("");
    setTyping(conversationId, currentUid, false).catch(() => {});
    try {
      await sendMessage(conversationId, currentUid, partnerUid, msg);
    } catch {
      setText(msg); // restore on failure
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  async function handleUnsend(msg: Message) {
    if (msg.senderUid !== currentUid) return;
    await unsendMessage(conversationId, msg.id, currentUid).catch(() => {});
  }

  // Group messages by date
  function groupMessages() {
    const groups: { date: string; messages: Message[] }[] = [];
    messages.forEach((msg) => {
      const dateStr = msg.createdAt.toLocaleDateString("en-US", {
        month: "short", day: "numeric", year: "numeric",
      });
      const last = groups[groups.length - 1];
      if (last?.date === dateStr) {
        last.messages.push(msg);
      } else {
        groups.push({ date: dateStr, messages: [msg] });
      }
    });
    return groups;
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border shrink-0 bg-bg-secondary">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="lg:hidden p-1.5 rounded-lg hover:bg-bg-card transition-colors"
            aria-label="Back"
          >
            <ArrowLeft className="h-5 w-5 text-text-secondary" />
          </button>
        )}
        {partner ? (
          <Link href={`/@${partner.username}`} className="flex items-center gap-3 flex-1 min-w-0 hover:opacity-80 transition-opacity">
            <Avatar src={partner.photoUrl} fallback={partner.displayName} size="sm" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-text-primary truncate">{partner.displayName}</p>
              <p className="text-xs text-text-secondary">@{partner.username}</p>
            </div>
          </Link>
        ) : (
          <div className="flex-1 h-8 bg-bg-secondary rounded animate-skeleton" />
        )}
        <button type="button" className="p-1.5 rounded-lg hover:bg-bg-card transition-colors" aria-label="More">
          <MoreHorizontal className="h-5 w-5 text-text-secondary" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-1 no-scrollbar">
        {loading ? (
          <div className="flex justify-center py-8">
            <Spinner size="md" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center py-12">
            {partner && (
              <Avatar src={partner.photoUrl} fallback={partner.displayName} size="xl" />
            )}
            <div>
              <p className="font-semibold text-text-primary">{partner?.displayName}</p>
              <p className="text-xs text-text-secondary mt-1">
                Say hello to start the conversation.
              </p>
            </div>
          </div>
        ) : (
          groupMessages().map(({ date, messages: dayMsgs }) => (
            <div key={date}>
              {/* Date separator */}
              <div className="flex items-center gap-3 my-4">
                <div className="flex-1 h-px bg-border" />
                <span className="text-[10px] text-text-muted font-medium">{date}</span>
                <div className="flex-1 h-px bg-border" />
              </div>

              {dayMsgs.map((msg, i) => {
                const isOwn = msg.senderUid === currentUid;
                const nextMsg = dayMsgs[i + 1];
                const isLastInRun = !nextMsg || nextMsg.senderUid !== msg.senderUid;

                return (
                  <AnimatePresence key={msg.id} mode="popLayout">
                    <motion.div
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.15 }}
                      className={cn("flex items-end gap-2 mb-0.5", isOwn ? "flex-row-reverse" : "flex-row")}
                    >
                      {/* Avatar — only on last message in a run */}
                      {!isOwn && (
                        <div className="w-7 shrink-0">
                          {isLastInRun && partner && (
                            <Avatar src={partner.photoUrl} fallback={partner.displayName} size="xs" />
                          )}
                        </div>
                      )}

                      {/* Bubble */}
                      <div className={cn("group relative max-w-[72%]")}>
                        <div className={cn(
                          "px-3.5 py-2 text-sm leading-relaxed break-words",
                          isOwn
                            ? "bg-accent text-bg-primary rounded-2xl rounded-br-md"
                            : "bg-bg-card border border-border text-text-primary rounded-2xl rounded-bl-md"
                        )}>
                          {msg.text}
                        </div>

                        {/* Timestamp + unsend */}
                        {isLastInRun && (
                          <div className={cn(
                            "flex items-center gap-1.5 mt-0.5",
                            isOwn ? "justify-end" : "justify-start"
                          )}>
                            <span className="text-[10px] text-text-muted">
                              {formatRelativeTime(msg.createdAt)}
                            </span>
                            {isOwn && msg.isRead && (
                              <span className="text-[10px] text-accent">✓✓</span>
                            )}
                          </div>
                        )}

                        {/* Unsend button — appears on hover */}
                        {isOwn && (
                          <button
                            type="button"
                            onClick={() => handleUnsend(msg)}
                            className="absolute -left-7 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-lg hover:bg-bg-secondary"
                            aria-label="Unsend"
                          >
                            <Trash2 className="h-3.5 w-3.5 text-text-muted" />
                          </button>
                        )}
                      </div>
                    </motion.div>
                  </AnimatePresence>
                );
              })}
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-border shrink-0 flex items-end gap-2">
        <textarea
          ref={inputRef}
          value={text}
          onChange={(e) => { setText(e.target.value); handleTyping(); }}
          onKeyDown={handleKeyDown}
          placeholder="Message…"
          rows={1}
          className="flex-1 bg-bg-secondary border border-border rounded-2xl px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted resize-none focus:outline-none focus:ring-1 focus:ring-accent max-h-32 overflow-y-auto"
          style={{ fieldSizing: "content" } as React.CSSProperties}
          maxLength={2000}
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={!text.trim() || sending}
          className="h-10 w-10 rounded-full bg-accent flex items-center justify-center hover:bg-accent-hover transition-colors disabled:opacity-40 shrink-0"
          aria-label="Send message"
        >
          {sending ? (
            <Spinner size="sm" className="border-bg-primary border-t-transparent" />
          ) : (
            <Send className="h-4 w-4 text-bg-primary" />
          )}
        </button>
      </div>
    </div>
  );
}
