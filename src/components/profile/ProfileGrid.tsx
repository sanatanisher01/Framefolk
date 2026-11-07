"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  collection, query, where, orderBy, limit, startAfter,
  getDocs, getDoc, doc, onSnapshot, type QueryDocumentSnapshot,
} from "firebase/firestore";
import { db, auth } from "@/lib/firebase/client";
import { Grid3x3, Video, Play, Images } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { cn } from "@/utils/cn";
import { buildImageUrl, buildVideoThumbnail } from "@/lib/cloudinary/config";
import { getSignedDeliveryUrl } from "@/services/upload.service";
import { platformRequest } from "@/services/platform.service";
import type { Post, Media } from "@/types";

const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? "";

interface Props {
  uid: string;
  type: "photo" | "video";
  isPrivate: boolean;
  isOwnProfile: boolean;
}

const PAGE_SIZE = 12;

/** Fetch the coverMediaId's publicId from the media collection */
async function fetchThumbnailUrl(post: Post): Promise<string | null> {
  if (!post.coverMediaId) return null;
  return getSignedDeliveryUrl(post.coverMediaId, true).catch(() => null);
}

export function ProfileGrid({ uid, type, isPrivate, isOwnProfile }: Props) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);

  const load = useCallback(async (after?: string) => {
    if (!db) return;
    if (!after) setLoading(true); else setLoadingMore(true);
    try {
      const page = await platformRequest<{ posts: Post[]; cursor: string | null }>("posts", { authorUid: uid, type, cursor: after, pageSize: PAGE_SIZE });
      const newPosts = page.posts;
      if (!after) setPosts(newPosts); else setPosts(prev => [...prev, ...newPosts]);
      setCursor(page.cursor);
      setHasMore(!!page.cursor);

      // Fetch thumbnails for newly loaded posts
      const thumbPromises = newPosts.map(async (p) => {
        const url = await fetchThumbnailUrl(p);
        return { id: p.id, url };
      });
      const thumbResults = await Promise.all(thumbPromises);
      setThumbnails((prev) => {
        const next = { ...prev };
        thumbResults.forEach(({ id, url }) => { if (url) next[id] = url; });
        return next;
      });
    } catch (err) {
      console.error("[ProfileGrid] query failed:", err);
      if (!after) setPosts([]);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [uid, type]);

  useEffect(() => {
    const currentUid = auth?.currentUser?.uid;
    if (!currentUid || currentUid === uid || !db) return;
    return onSnapshot(doc(db, "followers", currentUid, "following", uid), () => { void load(); }, () => {});
  }, [uid, load]);

  useEffect(() => {
    if (!db) { setLoading(false); return; }
    load();
  }, [uid, type, isPrivate, isOwnProfile, load]);

  if (loading) {
    return (
      <div className="grid grid-cols-3 gap-0.5 mt-0.5">
        {Array.from({ length: 9 }).map((_, i) => (
          <Skeleton key={i} className="aspect-square rounded-none" />
        ))}
      </div>
    );
  }


  if (posts.length === 0) {
    return (
      <EmptyState
        icon={type === "photo" ? Grid3x3 : Video}
        title={`No ${type === "photo" ? "photos" : "videos"} yet`}
        actionLabel={cursor ? "Check older posts" : undefined}
        onAction={cursor ? () => { void load(cursor); } : undefined}
        description={
          isOwnProfile
            ? `Upload your first ${type === "photo" ? "photo" : "video"} to get started.`
            : `${type === "photo" ? "Photos" : "Videos"} will appear here.`
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-0">
      {/* Grid */}
      <div className="grid grid-cols-3 gap-0.5 mt-0.5">
        {posts.map((post) => (
          <PostThumbnail key={post.id} post={post} thumbnailUrl={thumbnails[post.id]} />
        ))}
      </div>

      {hasMore && (
        <button
          className="w-full py-3 text-xs text-accent hover:text-accent/80 transition-colors font-medium disabled:opacity-50"
          onClick={() => { if (cursor && !loadingMore) load(cursor); }}
          disabled={loadingMore}
        >
          {loadingMore ? "Loading…" : "Load more"}
        </button>
      )}
    </div>
  );
}

function PostThumbnail({ post, thumbnailUrl }: { post: Post; thumbnailUrl?: string }) {
  const isVideo = post.type === "video";
  const isMulti = post.type === "multi";

  return (
    <Link
      href={`/post/${post.id}`}
      className={cn(
        "relative aspect-square bg-bg-secondary overflow-hidden cursor-pointer group",
        "hover:opacity-90 transition-opacity"
      )}
      aria-label={post.caption ? post.caption.slice(0, 60) : "View post"}
    >
      {thumbnailUrl ? (
        <Image
          unoptimized
          src={thumbnailUrl}
          alt={post.caption ? post.caption.slice(0, 60) : "Post"}
          fill
          className="object-cover"
          sizes="(max-width: 768px) 33vw, 200px"
          loading="lazy"
        />
      ) : (
        /* Fallback while thumbnail loads or is unavailable */
        <div className="w-full h-full bg-gradient-to-br from-bg-secondary to-bg-card flex items-center justify-center">
          {isVideo ? (
            <Video className="h-8 w-8 text-text-muted" />
          ) : isMulti ? (
            <Images className="h-6 w-6 text-text-muted" />
          ) : (
            <Grid3x3 className="h-6 w-6 text-text-muted" />
          )}
        </div>
      )}

      {/* Indicators */}
      <div className="absolute top-1.5 right-1.5 flex gap-1">
        {isVideo && (
          <span className="bg-bg-primary/70 rounded p-0.5">
            <Play className="h-3 w-3 text-text-primary fill-text-primary" />
          </span>
        )}
        {isMulti && (
          <span className="bg-bg-primary/70 rounded p-0.5">
            <Images className="h-3 w-3 text-text-primary" />
          </span>
        )}
      </div>

      {/* Hover overlay with stats */}
      <div className="absolute inset-0 bg-bg-primary/60 flex items-center justify-center gap-4 opacity-0 group-hover:opacity-100 transition-opacity">
        <span className="text-xs font-bold text-text-primary">
          ♥ {post.likesCount ?? 0}
        </span>
        <span className="text-xs font-bold text-text-primary">
          💬 {post.commentsCount ?? 0}
        </span>
      </div>
    </Link>
  );
}
