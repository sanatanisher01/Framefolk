"use client";

import { useState } from "react";
import Link from "next/link";
import { formatRelativeTime } from "@/utils/format";
import { Avatar } from "@/components/ui/Avatar";
import { PostMedia } from "./PostMedia";
import { PostCaption } from "./PostCaption";
import { PostActions } from "./PostActions";
import { CommentSection } from "./CommentSection";
import type { Post, Media } from "@/types";

interface Props {
  post: Post;
  mediaItems?: Partial<Media>[];
  currentUid?: string;
  currentUsername?: string;
  currentPhotoUrl?: string;
  /** If true, show in compact grid mode (no actions) */
  compact?: boolean;
}

export function PostCard({ post, mediaItems = [], currentUid, currentUsername = "", currentPhotoUrl = "", compact = false }: Props) {
  const [showComments, setShowComments] = useState(false);

  if (compact) {
    return (
      <Link href={`/post/${post.id}`} className="block">
        <PostMedia mediaItems={mediaItems} className="rounded-xl" />
      </Link>
    );
  }

  return (
    <article
      className="bg-bg-card border border-border rounded-2xl overflow-hidden shadow-card hover:shadow-card-hover transition-shadow"
      aria-label={`Post by ${post.authorUsername}`}
    >
      {/* Author row */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-2">
        <Link href={`/@${post.authorUsername}`} aria-label={`View ${post.authorUsername}'s profile`}>
          <Avatar
            src={post.authorPhotoUrl}
            fallback={post.authorDisplayName}
            size="sm"
            hasStory={false}
          />
        </Link>
        <div className="flex-1 min-w-0">
          <Link
            href={`/@${post.authorUsername}`}
            className="font-semibold text-sm text-text-primary hover:underline truncate block"
          >
            {post.authorDisplayName}
          </Link>
          <div className="flex items-center gap-1.5 text-xs text-text-muted">
            <span>@{post.authorUsername}</span>
            <span>·</span>
            <time dateTime={post.createdAt instanceof Date ? post.createdAt.toISOString() : undefined}>
              {post.createdAt
                ? formatRelativeTime(
                    post.createdAt instanceof Date
                      ? post.createdAt
                      : (post.createdAt as unknown as { toDate: () => Date }).toDate?.() ?? new Date()
                  )
                : ""}
            </time>
            {post.location && (
              <>
                <span>·</span>
                <span className="truncate max-w-[80px]">{post.location.name}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Media */}
      {mediaItems.length > 0 && (
        <PostMedia mediaItems={mediaItems} />
      )}

      {/* Actions */}
      <PostActions
        postId={post.id}
        currentUid={currentUid}
        authorUid={post.authorUid}
        mediaIds={post.mediaIds ?? []}
        likesCount={post.likesCount}
        commentsCount={post.commentsCount}
        onCommentClick={() => setShowComments((v) => !v)}
      />

      {/* Caption */}
      {post.caption && (
        <div className="px-4 pb-2">
          <PostCaption
            authorUsername={post.authorUsername}
            caption={post.caption}
            hashtags={post.hashtags}
          />
        </div>
      )}

      {/* View comments toggle */}
      {post.commentsCount > 0 && !showComments && (
        <button
          onClick={() => setShowComments(true)}
          className="w-full text-left px-4 pb-3 text-xs text-text-muted hover:text-accent transition-colors"
        >
          View all {post.commentsCount} comment{post.commentsCount !== 1 ? "s" : ""}
        </button>
      )}

      {/* Comments section */}
      {showComments && (
        <div className="px-4 pb-4 border-t border-border/50 pt-3">
          <CommentSection
            postId={post.id}
            currentUid={currentUid}
            currentUsername={currentUsername}
            currentPhotoUrl={currentPhotoUrl}
          />
        </div>
      )}
    </article>
  );
}
