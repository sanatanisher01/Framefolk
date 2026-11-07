"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { X, ChevronLeft, ChevronRight, Eye, Send, Heart, MoreHorizontal } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Avatar } from "@/components/ui/Avatar";
import { markStoryViewed, reactToStory } from "@/services/story.service";
import { useMediaDelivery } from "@/hooks/useMediaDelivery";
import { formatRelativeTime } from "@/utils/format";
import type { Story } from "@/types";

const STORY_DURATION_MS = 5000; // 5s per story
const REACTIONS = ["❤️", "😮", "😂", "😢", "🔥", "👏"];
const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? "";

export interface StoryGroup {
  authorUid: string;
  authorUsername: string;
  authorPhotoUrl: string;
  stories: Story[];
}

interface Props {
  groups: StoryGroup[];
  initialGroupIndex?: number;
  currentUid?: string;
  onClose: () => void;
}

export function StoryViewer({ groups, initialGroupIndex = 0, currentUid, onClose }: Props) {
  const [groupIdx, setGroupIdx] = useState(initialGroupIndex);
  const [storyIdx, setStoryIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [showReactions, setShowReactions] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const TICK_MS = 50;

  const currentGroup = groups[groupIdx];
  const currentStory = currentGroup?.stories[storyIdx];
  const mediaUrl = useMediaDelivery(currentStory?.mediaId);
  const posterUrl = useMediaDelivery(currentStory?.mediaId, true);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Mark viewed
  useEffect(() => {
    if (!currentStory || !currentUid) return;
    markStoryViewed(currentStory.id, currentUid).catch(() => {});
  }, [currentStory, currentUid]);

  const goNext = useCallback(() => {
    if (!currentGroup) return;
    if (storyIdx < currentGroup.stories.length - 1) {
      setStoryIdx((i) => i + 1);
      setProgress(0);
    } else if (groupIdx < groups.length - 1) {
      setGroupIdx((i) => i + 1);
      setStoryIdx(0);
      setProgress(0);
    } else {
      onClose();
    }
  }, [currentGroup, storyIdx, groupIdx, groups.length, onClose]);

  const goPrev = useCallback(() => {
    if (storyIdx > 0) {
      setStoryIdx((i) => i - 1);
      setProgress(0);
    } else if (groupIdx > 0) {
      setGroupIdx((i) => i - 1);
      setStoryIdx(0);
      setProgress(0);
    }
  }, [storyIdx, groupIdx]);

  // Progress timer
  useEffect(() => {
    if (paused || showReactions || currentStory?.type === "video") return;
    if (intervalRef.current) clearInterval(intervalRef.current);

    intervalRef.current = setInterval(() => {
      setProgress((p) => {
        const next = p + (TICK_MS / STORY_DURATION_MS) * 100;
        if (next >= 100) {
          clearInterval(intervalRef.current!);
          queueMicrotask(goNext);
          return 0;
        }
        return next;
      });
    }, TICK_MS);

    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [paused, showReactions, groupIdx, storyIdx, goNext, currentStory?.type]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (paused || showReactions) video.pause(); else video.play().catch(() => {});
  }, [paused, showReactions, mediaUrl]);

  async function handleReaction(emoji: string) {
    if (!currentStory || !currentUid) return;
    setShowReactions(false);
    await reactToStory(currentStory.id, currentUid, emoji).catch(() => {});
  }

  async function handleReply() {
    if (!replyText.trim() || !currentStory || !currentUid) return;
    setSending(true);
    try {
      const { getOrCreateConversation, sendMessage } = await import("@/services/messaging.service");
      const convId = await getOrCreateConversation(currentUid, currentStory.authorUid);
      await sendMessage(convId, currentUid, currentStory.authorUid, replyText.trim());
    } catch { /* silent fail */ } finally {
      setReplyText("");
      setSending(false);
    }
  }

  if (!currentGroup || !currentStory) return null;

  const isOwnStory = currentStory.authorUid === currentUid;
  const publicId = currentStory.cloudinaryPublicId ?? null;
  const isVideoStory = currentStory.type === "video";


  return (
    <div
      className="fixed inset-0 z-50 bg-bg-primary flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label={`${currentGroup.authorUsername}'s story`}
    >
      {/* Container */}
      <div className="relative w-full max-w-sm h-full max-h-screen flex flex-col">

        {/* Progress bars */}
        <div className="absolute top-0 left-0 right-0 z-10 flex gap-1 px-3 pt-3">
          {currentGroup.stories.map((_, i) => (
            <div key={i} className="flex-1 h-0.5 rounded-full bg-white/30 overflow-hidden">
              <div
                className="h-full bg-white rounded-full transition-none"
                style={{
                  width: i < storyIdx ? "100%" : i === storyIdx ? `${progress}%` : "0%",
                }}
              />
            </div>
          ))}
        </div>

        {/* Header */}
        <div className="absolute top-5 left-0 right-0 z-10 flex items-center gap-3 px-3 pt-3">
          <Link href={`/@${currentGroup.authorUsername}`} onClick={onClose}>
            <Avatar
              src={currentGroup.authorPhotoUrl}
              fallback={currentGroup.authorUsername}
              size="sm"
              className="ring-2 ring-white/50"
            />
          </Link>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white drop-shadow">
              {currentGroup.authorUsername}
            </p>
            <p className="text-xs text-white/70">
              {formatRelativeTime(currentStory.createdAt)}
            </p>
          </div>
          {isOwnStory && (
            <button type="button" className="text-white/80 hover:text-white p-1" aria-label="More options">
              <MoreHorizontal className="h-5 w-5" />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="text-white/80 hover:text-white p-1"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Media / Text */}
        <div
          className="flex-1 relative select-none overflow-hidden"
          onPointerDown={() => setPaused(true)}
          onPointerUp={() => setPaused(false)}
          onPointerLeave={() => setPaused(false)}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={`${groupIdx}-${storyIdx}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0"
            >
              {currentStory.type === "text" ? (
                <div
                  className="w-full h-full flex items-center justify-center p-10"
                  style={{ background: currentStory.textStyle?.background ?? "#101114" }}
                >
                  <p
                    className="text-center font-display font-bold leading-tight break-words"
                    style={{
                      color: currentStory.textStyle?.color ?? "#F4F0E8",
                      fontSize: (currentStory.textStyle?.fontSize ?? 28) + "px",
                    }}
                  >
                    {currentStory.textContent}
                  </p>
                </div>
              ) : isVideoStory && mediaUrl ? (
                <video
                  key={mediaUrl}
                  src={mediaUrl}
                  poster={posterUrl ?? undefined}
                  autoPlay
                  playsInline
                  muted
                  ref={videoRef}
                  onEnded={goNext}
                  onTimeUpdate={e => { const v = e.currentTarget; if (v.duration) setProgress(v.currentTime / v.duration * 100); }}
                  className="w-full h-full object-cover"
                />
              ) : mediaUrl ? (
                <Image
                  unoptimized
                  src={mediaUrl}
                  alt="Story"
                  fill
                  className="object-cover"
                  sizes="400px"
                  priority
                />
              ) : (
                <div className="w-full h-full bg-bg-secondary" />
              )}
            </motion.div>
          </AnimatePresence>

          {/* Caption */}
          {currentStory.caption && (
            <div className="absolute bottom-20 left-4 right-4 z-10">
              <p className="text-sm text-white drop-shadow text-center bg-bg-primary/40 px-3 py-2 rounded-xl backdrop-blur-sm">
                {currentStory.caption}
              </p>
            </div>
          )}

          {/* Tap zones for navigation */}
          <button
            type="button"
            onClick={goPrev}
            className="absolute left-0 top-0 h-full w-1/3 z-10"
            aria-label="Previous story"
          />
          <button
            type="button"
            onClick={goNext}
            className="absolute right-0 top-0 h-full w-1/3 z-10"
            aria-label="Next story"
          />
        </div>

        {/* Group navigation arrows (desktop) */}
        {groupIdx > 0 && (
          <button
            type="button"
            onClick={() => { setGroupIdx((i) => i - 1); setStoryIdx(0); setProgress(0); }}
            className="absolute left-[-48px] top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-bg-card border border-border flex items-center justify-center hover:bg-bg-secondary transition-colors"
            aria-label="Previous user's story"
          >
            <ChevronLeft className="h-5 w-5 text-text-primary" />
          </button>
        )}
        {groupIdx < groups.length - 1 && (
          <button
            type="button"
            onClick={() => { setGroupIdx((i) => i + 1); setStoryIdx(0); setProgress(0); }}
            className="absolute right-[-48px] top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-bg-card border border-border flex items-center justify-center hover:bg-bg-secondary transition-colors"
            aria-label="Next user's story"
          >
            <ChevronRight className="h-5 w-5 text-text-primary" />
          </button>
        )}

        {/* Bottom bar */}
        <div className="absolute bottom-0 left-0 right-0 z-10 px-3 pb-6 pt-3 flex items-center gap-2">
          {isOwnStory ? (
            <div className="flex items-center gap-1.5 text-white/80 text-xs">
              <Eye className="h-4 w-4" />
              <span>{currentStory.viewsCount} views</span>
            </div>
          ) : currentUid ? (
            <>
              <input
                type="text"
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder={`Reply to ${currentGroup.authorUsername}…`}
                className="flex-1 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-4 py-2 text-sm text-white placeholder:text-white/50 focus:outline-none focus:border-white/50"
                onFocus={() => setPaused(true)}
                onBlur={() => setPaused(false)}
                onKeyDown={(e) => { if (e.key === "Enter") handleReply(); }}
              />
              <button
                type="button"
                onClick={() => setShowReactions((v) => !v)}
                className="h-9 w-9 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center hover:bg-white/20 transition-colors"
                aria-label="React"
              >
                <Heart className="h-4 w-4 text-white" />
              </button>
              {replyText.trim() && (
                <button
                  type="button"
                  onClick={handleReply}
                  disabled={sending}
                  className="h-9 w-9 rounded-full bg-accent flex items-center justify-center hover:bg-accent-hover transition-colors"
                  aria-label="Send reply"
                >
                  <Send className="h-4 w-4 text-bg-primary" />
                </button>
              )}
            </>
          ) : null}
        </div>

        {/* Reaction picker */}
        <AnimatePresence>
          {showReactions && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="absolute bottom-16 left-4 right-4 z-20 flex justify-center gap-2 bg-bg-card/90 backdrop-blur-sm border border-border rounded-2xl p-3"
            >
              {REACTIONS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => handleReaction(emoji)}
                  className="text-2xl hover:scale-125 transition-transform"
                  aria-label={`React with ${emoji}`}
                >
                  {emoji}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
