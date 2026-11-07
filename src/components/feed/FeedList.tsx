"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  collection, query, where, orderBy, limit,
  getDocs, startAfter, doc, getDoc,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { PostCard } from "./PostCard";
import { PostSkeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { Spinner } from "@/components/ui/Spinner";
import { Home } from "lucide-react";
import { platformRequest } from "@/services/platform.service";
import type { Post, Media } from "@/types";

interface Props {
  currentUid: string;
  currentUsername: string;
  currentPhotoUrl: string;
  /** UIDs of followed users — empty means show nothing */
  followingUids: string[];
}
const PAGE_SIZE = 10;

export function FeedList({ currentUid, currentUsername, currentPhotoUrl, followingUids }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [mediaMap, setMediaMap] = useState<Record<string, Partial<Media>[]>>({});
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Load media docs for a batch of posts
  async function loadMediaForPosts(postsToLoad: Post[]) {
    if (!db) return;
    const updates: Record<string, Partial<Media>[]> = {};
    await Promise.all(
      postsToLoad.map(async (post) => {
        if (!post.mediaIds?.length) return;
        const mediaItems = await Promise.all(
          post.mediaIds.slice(0, 10).map(async (mid) => {
            const snap = await getDoc(doc(db!, "media", mid));
            return snap.exists() ? { id: snap.id, ...snap.data() } as Partial<Media> : null;
          })
        );
        updates[post.id] = mediaItems.filter(Boolean) as Partial<Media>[];
      })
    );
    setMediaMap((prev) => ({ ...prev, ...updates }));
  }

  const loadPosts = useCallback(async (afterCursor?: string) => {
    if (!db || followingUids.length === 0) {
      setLoading(false);
      return;
    }

    const page = await platformRequest<{ posts: Post[]; cursor: string | null }>("posts", { mode: "feed", cursor: afterCursor, pageSize: PAGE_SIZE });
    const newPosts = page.posts;

    if (afterCursor) {
      setPosts((prev) => [...prev, ...newPosts]);
    } else {
      setPosts(newPosts);
    }

    setHasMore(!!page.cursor);
    setCursor(page.cursor);
    await loadMediaForPosts(newPosts);
  }, [followingUids]); // eslint-disable-line react-hooks/exhaustive-deps

  // Initial load
  useEffect(() => {
    setLoading(true);
    loadPosts().catch(error => { console.error(error); setError("Could not load your feed. Please retry."); }).finally(() => setLoading(false));
  }, [loadPosts]);

  // Intersection observer for infinite scroll
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      async (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore && cursor) {
          setLoadingMore(true);
          await loadPosts(cursor).catch(() => {});
          setLoadingMore(false);
        }
      },
      { rootMargin: "200px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [loading, hasMore, loadingMore, cursor, loadPosts]);

  if (error) return <EmptyState title={error} actionLabel="Retry" onAction={() => { setError(null); setLoading(true); loadPosts().catch(() => setError("Could not load your feed. Please retry.")).finally(() => setLoading(false)); }} />;

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        {Array.from({ length: 3 }).map((_, i) => <PostSkeleton key={i} />)}
      </div>
    );
  }

  if (followingUids.length === 0) {
    return (
      <EmptyState
        icon={Home}
        title="Your feed is empty"
        description="Follow people to see their photos and videos here."
        actionLabel="Explore FRAMEFOLK"
        onAction={() => { window.location.href = "/explore"; }}
      />
    );
  }

  if (posts.length === 0) {
    return (
      <EmptyState
        icon={Home}
        title="Nothing new yet"
        actionLabel={cursor ? "Check older posts" : undefined}
        onAction={cursor ? () => { loadPosts(cursor).catch(() => setError("Could not load older posts.")); } : undefined}
        description="The people you follow haven't posted recently."
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {posts.map((post) => (
        <PostCard
          key={post.id}
          post={post}
          mediaItems={mediaMap[post.id] ?? []}
          currentUid={currentUid}
          currentUsername={currentUsername}
          currentPhotoUrl={currentPhotoUrl}
        />
      ))}

      {/* Infinite scroll sentinel */}
      <div ref={sentinelRef} className="h-4" />

      {loadingMore && (
        <div className="flex justify-center py-4">
          <Spinner size="md" />
        </div>
      )}

      {!hasMore && posts.length > 0 && (
        <p className="text-center text-xs text-text-muted py-6">
          You&apos;re all caught up ✓
        </p>
      )}
    </div>
  );
}
