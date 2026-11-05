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
  const [posts, setPosts] = useState<Post[]>([]);
  const [mediaMap, setMediaMap] = useState<Record<string, Partial<Media>[]>>({});
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [cursor, setCursor] = useState<QueryDocumentSnapshot | null>(null);
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

  const loadPosts = useCallback(async (afterCursor?: QueryDocumentSnapshot) => {
    if (!db || followingUids.length === 0) {
      setLoading(false);
      return;
    }

    // Firestore "in" supports max 30 values
    const uids = followingUids.slice(0, 30);

    // NOTE: Firestore does NOT support `where IN` + `where ==` + `orderBy` in a single
    // compound query — it fails at runtime without a very specific index.
    // We fetch by authorUid IN + orderBy, then filter isHidden client-side.
    let q = query(
      collection(db, "posts"),
      where("authorUid", "in", uids),
      orderBy("createdAt", "desc"),
      limit((PAGE_SIZE + 1) * 2) // over-fetch to account for hidden posts filtered out
    );
    if (afterCursor) q = query(q, startAfter(afterCursor));

    const snap = await getDocs(q);

    // Filter hidden posts client-side
    const visible = snap.docs.filter((d) => d.data().isHidden !== true);
    const more = visible.length > PAGE_SIZE;
    const docs = visible.slice(0, PAGE_SIZE);

    const newPosts = docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        ...data,
        createdAt: data.createdAt?.toDate?.() ?? new Date(),
        updatedAt: data.updatedAt?.toDate?.() ?? new Date(),
        publishedAt: data.publishedAt?.toDate?.() ?? null,
        scheduledFor: data.scheduledFor?.toDate?.() ?? null,
      } as Post;
    });

    if (afterCursor) {
      setPosts((prev) => [...prev, ...newPosts]);
    } else {
      setPosts(newPosts);
    }

    // Use the last raw snap doc as cursor (not the filtered one) to avoid skipping docs
    const lastDoc = snap.docs[snap.docs.length - 1] ?? null;
    setHasMore(more || snap.docs.length >= (PAGE_SIZE + 1) * 2);
    setCursor(lastDoc);
    await loadMediaForPosts(newPosts);
  }, [followingUids]); // eslint-disable-line react-hooks/exhaustive-deps

  // Initial load
  useEffect(() => {
    setLoading(true);
    loadPosts().finally(() => setLoading(false));
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
  }, [hasMore, loadingMore, cursor, loadPosts]);

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
