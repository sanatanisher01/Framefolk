"use client";

import { useState, useEffect } from "react";
import { Heart, MessageCircle, Bookmark, Share2, MoreHorizontal, Flag, Trash2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator,
} from "@/components/ui/DropdownMenu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { likePost, unlikePost, savePost, unsavePost, isPostLiked, isPostSaved, reportPost } from "@/services/social.service";
import { submitDeletionRequest } from "@/services/auth.service";
import { formatCount } from "@/utils/format";
import { cn } from "@/utils/cn";

interface Props {
  postId: string;
  currentUid: string | undefined;
  authorUid: string;
  mediaIds: string[];
  likesCount: number;
  commentsCount: number;
  onCommentClick: () => void;
}

export function PostActions({
  postId,
  currentUid,
  authorUid,
  mediaIds,
  likesCount: initialLikes,
  commentsCount,
  onCommentClick,
}: Props) {
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const [likesCount, setLikesCount] = useState(initialLikes);
  const [likeLoading, setLikeLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteReason, setDeleteReason] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteSuccess, setDeleteSuccess] = useState(false);

  useEffect(() => {
    if (!currentUid) return;
    Promise.all([
      isPostLiked(currentUid, postId),
      isPostSaved(currentUid, postId),
    ]).then(([l, s]) => {
      setLiked(l);
      setSaved(s);
    }).catch(() => {});
  }, [currentUid, postId]);

  async function handleLike() {
    if (!currentUid || likeLoading) return;
    setLikeLoading(true);
    const wasLiked = liked;
    // Optimistic update
    setLiked(!wasLiked);
    setLikesCount((c) => wasLiked ? Math.max(0, c - 1) : c + 1);
    try {
      if (wasLiked) await unlikePost(currentUid, postId);
      else await likePost(currentUid, postId);
    } catch {
      // Revert on error
      setLiked(wasLiked);
      setLikesCount((c) => wasLiked ? c + 1 : Math.max(0, c - 1));
    } finally {
      setLikeLoading(false);
    }
  }

  async function handleSave() {
    if (!currentUid || saveLoading) return;
    setSaveLoading(true);
    const wasSaved = saved;
    setSaved(!wasSaved);
    try {
      if (wasSaved) await unsavePost(currentUid, postId);
      else await savePost(currentUid, postId);
    } catch {
      setSaved(wasSaved);
    } finally {
      setSaveLoading(false);
    }
  }

  async function handleReport() {
    if (!currentUid) return;
    await reportPost(currentUid, postId, "inappropriate").catch(() => {});
  }

  async function handleDeletionRequest() {
    if (!currentUid || deleteLoading) return;
    setDeleteLoading(true);
    try {
      await submitDeletionRequest(currentUid, postId, mediaIds, deleteReason.trim() || "No reason provided");
      setDeleteSuccess(true);
      setTimeout(() => {
        setShowDeleteDialog(false);
        setDeleteSuccess(false);
        setDeleteReason("");
      }, 2000);
    } catch {
      // keep dialog open on error
    } finally {
      setDeleteLoading(false);
    }
  }

  return (
    <div className="flex items-center px-3 py-2">
      {/* Like */}
      <button
        type="button"
        onClick={handleLike}
        disabled={!currentUid}
        aria-label={liked ? "Unlike" : "Like"}
        aria-pressed={liked}
        className={cn(
          "flex items-center gap-1.5 p-1.5 rounded-lg transition-colors group",
          "hover:bg-accent/10 disabled:opacity-40"
        )}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={liked ? "liked" : "not-liked"}
            initial={{ scale: 0.7 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 400, damping: 15 }}
          >
            <Heart
              className={cn(
                "h-5 w-5 transition-colors",
                liked ? "fill-red-500 text-red-500" : "text-text-secondary group-hover:text-red-400"
              )}
            />
          </motion.div>
        </AnimatePresence>
        <span className={cn("text-sm tabular-nums", liked ? "text-red-500" : "text-text-secondary")}>
          {formatCount(likesCount)}
        </span>
      </button>

      {/* Comment */}
      <button
        type="button"
        onClick={onCommentClick}
        aria-label="Toggle comments"
        className="flex items-center gap-1.5 p-1.5 rounded-lg hover:bg-accent/10 transition-colors group"
      >
        <MessageCircle className="h-5 w-5 text-text-secondary group-hover:text-accent transition-colors" />
        <span className="text-sm tabular-nums text-text-secondary group-hover:text-accent transition-colors">
          {formatCount(commentsCount)}
        </span>
      </button>

      {/* Share stub */}
      <button
        type="button"
        aria-label="Share"
        className="flex items-center gap-1.5 p-1.5 rounded-lg hover:bg-bg-secondary transition-colors group"
        onClick={() => {
          if (navigator.share) {
            navigator.share({ title: "Check this out on FRAMEFOLK", url: window.location.href }).catch(() => {});
          }
        }}
      >
        <Share2 className="h-5 w-5 text-text-secondary group-hover:text-text-primary transition-colors" />
      </button>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Save */}
      <button
        type="button"
        onClick={handleSave}
        disabled={!currentUid}
        aria-label={saved ? "Unsave" : "Save"}
        aria-pressed={saved}
        className="p-1.5 rounded-lg hover:bg-bg-secondary transition-colors group disabled:opacity-40"
      >
        <Bookmark
          className={cn(
            "h-5 w-5 transition-colors",
            saved ? "fill-text-primary text-text-primary" : "text-text-secondary group-hover:text-text-primary"
          )}
        />
      </button>

      {/* More options */}
      {currentUid && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label="More options">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handleReport}>
              <Flag className="h-4 w-4 mr-2" />
              Report post
            </DropdownMenuItem>
            {currentUid === authorUid && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem destructive onClick={() => setShowDeleteDialog(true)}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Request deletion
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {/* Deletion request dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request post deletion</DialogTitle>
            <DialogDescription>
              This sends a deletion request to the moderation team. Your post will remain
              visible until approved. Provide a reason to help us process it faster.
            </DialogDescription>
          </DialogHeader>
          {deleteSuccess ? (
            <div className="px-5 pb-5 text-center">
              <p className="text-sm text-green-400 font-medium">Request submitted successfully.</p>
              <p className="text-xs text-text-muted mt-1">We&apos;ll review it soon.</p>
            </div>
          ) : (
            <>
              <div className="px-5 pb-2">
                <textarea
                  value={deleteReason}
                  onChange={(e) => setDeleteReason(e.target.value)}
                  placeholder="Reason for deletion (optional)…"
                  maxLength={500}
                  rows={3}
                  className="w-full bg-bg-secondary border border-border rounded-xl px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted resize-none focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </div>
              <DialogFooter>
                <Button variant="secondary" onClick={() => setShowDeleteDialog(false)}>
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  loading={deleteLoading}
                  onClick={handleDeletionRequest}
                >
                  Submit request
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
