"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Send, Reply, Trash2 } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Spinner } from "@/components/ui/Spinner";
import {
  subscribeToComments,
  addComment,
  deleteComment,
  addReply,
} from "@/services/social.service";
import { formatRelativeTime } from "@/utils/format";
import { cn } from "@/utils/cn";
import type { Comment } from "@/types";

interface Props {
  postId: string;
  currentUid?: string;
  currentUsername: string;
  currentPhotoUrl: string;
}

export function CommentSection({ postId, currentUid, currentUsername, currentPhotoUrl }: Props) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [replyTo, setReplyTo] = useState<{ id: string; username: string } | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setLoading(true);
    const unsub = subscribeToComments(postId, (c) => {
      setComments(c);
      setLoading(false);
    });
    return unsub;
  }, [postId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!currentUid || !commentText.trim() || submitting) return;
    setSubmitting(true);
    try {
      if (replyTo) {
        await addReply(
          currentUid, currentUsername, currentPhotoUrl,
          postId, replyTo.id, commentText.trim()
        );
      } else {
        await addComment(
          currentUid, currentUsername, currentPhotoUrl,
          postId, commentText.trim()
        );
      }
      setCommentText("");
      setReplyTo(null);
    } catch {
      // silently ignore — UI stays intact
    } finally {
      setSubmitting(false);
    }
  }

  function handleReplyClick(commentId: string, username: string) {
    setReplyTo({ id: commentId, username });
    setCommentText(`@${username} `);
    inputRef.current?.focus();
  }

  if (loading) {
    return (
      <div className="flex justify-center py-4">
        <Spinner size="sm" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Comment list */}
      {comments.length === 0 ? (
        <p className="text-xs text-text-muted text-center py-2">
          No comments yet. Be the first.
        </p>
      ) : (
        <ul className="flex flex-col gap-3 max-h-72 overflow-y-auto no-scrollbar">
          {comments.map((comment) => (
            <CommentRow
              key={comment.id}
              comment={comment}
              currentUid={currentUid}
              postId={postId}
              onReply={handleReplyClick}
            />
          ))}
        </ul>
      )}

      {/* Input */}
      {currentUid && (
        <form onSubmit={handleSubmit} className="flex items-end gap-2 pt-2 border-t border-border/50">
          <Avatar src={currentPhotoUrl} fallback={currentUsername} size="xs" />
          <div className="flex-1 relative">
            {replyTo && (
              <div className="flex items-center justify-between text-xs text-text-muted bg-bg-secondary rounded-t-lg px-2 py-1">
                <span>Replying to <span className="text-accent">@{replyTo.username}</span></span>
                <button
                  type="button"
                  onClick={() => { setReplyTo(null); setCommentText(""); }}
                  className="hover:text-text-primary"
                  aria-label="Cancel reply"
                >
                  ×
                </button>
              </div>
            )}
            <textarea
              ref={inputRef}
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Add a comment…"
              rows={1}
              className={cn(
                "w-full bg-bg-secondary text-sm text-text-primary placeholder:text-text-muted",
                "px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-accent",
                "border border-border transition-colors",
                replyTo ? "rounded-b-xl rounded-tr-xl" : "rounded-xl"
              )}
              maxLength={500}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
            />
          </div>
          <button
            type="submit"
            disabled={!commentText.trim() || submitting}
            className="p-2 rounded-xl bg-accent text-bg-primary disabled:opacity-40 hover:bg-accent-hover transition-colors shrink-0"
            aria-label="Post comment"
          >
            {submitting ? <Spinner size="sm" className="border-bg-primary border-t-transparent" /> : <Send className="h-4 w-4" />}
          </button>
        </form>
      )}
    </div>
  );
}

function CommentRow({
  comment, currentUid, postId, onReply,
}: {
  comment: Comment;
  currentUid?: string;
  postId: string;
  onReply: (id: string, username: string) => void;
}) {
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!currentUid || currentUid !== comment.authorUid) return;
    setDeleting(true);
    await deleteComment(postId, comment.id).catch(() => {});
    setDeleting(false);
  }

  return (
    <li className="flex gap-2">
      <Link href={`/@${comment.authorUsername}`} className="shrink-0">
        <Avatar src={comment.authorPhotoUrl} fallback={comment.authorUsername} size="xs" />
      </Link>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <span className="font-semibold text-xs text-text-primary mr-1.5">
              <Link href={`/@${comment.authorUsername}`} className="hover:underline">
                {comment.authorUsername}
              </Link>
            </span>
            <span className="text-xs text-text-primary break-words">{comment.text}</span>
          </div>
          {currentUid === comment.authorUid && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="shrink-0 p-0.5 text-text-muted hover:text-red-400 transition-colors"
              aria-label="Delete comment"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-3 mt-0.5">
          <span className="text-[10px] text-text-muted">
            {formatRelativeTime(comment.createdAt)}
          </span>
          {comment.repliesCount > 0 && (
            <span className="text-[10px] text-text-muted">
              {comment.repliesCount} {comment.repliesCount === 1 ? "reply" : "replies"}
            </span>
          )}
          {currentUid && (
            <button
              type="button"
              onClick={() => onReply(comment.id, comment.authorUsername)}
              className="flex items-center gap-0.5 text-[10px] text-text-muted hover:text-accent transition-colors"
            >
              <Reply className="h-2.5 w-2.5" />
              Reply
            </button>
          )}
        </div>
      </div>
    </li>
  );
}
