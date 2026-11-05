"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  collection, query, where, orderBy, limit,
  getDocs, startAfter, getDoc, doc,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useAuth } from "@/lib/auth/AuthContext";
import { MobileHeader } from "@/components/layout/MobileHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { Spinner } from "@/components/ui/Spinner";
import { Input } from "@/components/ui/Input";
import { buildImageUrl, buildVideoThumbnail } from "@/lib/cloudinary/config";
import { Search, Grid3x3, Play, Images } from "lucide-react";
import { useDebounce } from "@/hooks/useDebounce";
import type { Post, Media } from "@/types";

const PAGE_SIZE = 24;
const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? "";

interface PostWithThumb {
  post: Post;
  thumbUrl: string;
  isVideo: boolean;
  isMulti: boolean;
}

export function ExplorePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  useAuth(); // ensures auth context is initialised

  const [search, setSearch] = useState(searchParams.get("tag") ? `#${searchParams.get("tag")}` : "");
  const debouncedSearch = useDebounce(search, 400);
  const [items, setItems] = useState<PostWithThumb[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [cursor, setCursor] = useState<QueryDocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const sentinelRef = useRef<HTMLDivElement>(null);

  async function resolveThumb(post: Post): Promise<PostWithThumb> {
    const isVideo = post.type === "video";
    const isMulti = post.type === "multi";
    let thumbUrl = "";

    if (post.coverMediaId && db) {
      try {
        const snap = await getDoc(doc(db, "media", post.coverMediaId));
        if (snap.exists()) {
          const m = snap.data() as Partial<Media>;
          const pid = m.cloudinaryPublicId ?? "";
          thumbUrl = isVideo
            ? buildVideoThumbnail(pid, CLOUD_NAME)
            : buildImageUrl(pid, CLOUD_NAME, { width: 400 });
        }
      } catch { /* no thumbnail */ }
    }

    return { post, thumbUrl, isVideo, isMulti };
  }

  const loadPosts = useCallback(
    async (afterCursor?: QueryDocumentSnapshot) => {
      if (!db) return;

      const tag = debouncedSearch.startsWith("#")
        ? debouncedSearch.slice(1).toLowerCase().trim()
        : null;
      const username = debouncedSearch.startsWith("@")
        ? debouncedSearch.slice(1).toLowerCase().trim()
        : null;

      let q = query(
        collection(db, "posts"),
        where("visibility", "==", "public"),
        orderBy("createdAt", "desc"),
        limit(PAGE_SIZE + 1)
      );

      if (tag) {
        q = query(
          collection(db, "posts"),
          where("visibility", "==", "public"),
          where("hashtags", "array-contains", tag),
          orderBy("createdAt", "desc"),
          limit(PAGE_SIZE + 1)
        );
      }

      if (username) {
        q = query(
          collection(db, "posts"),
          where("authorUsername", "==", username),
          where("visibility", "==", "public"),
          orderBy("createdAt", "desc"),
          limit(PAGE_SIZE + 1)
        );
      }

      if (afterCursor) q = query(q, startAfter(afterCursor));

      const snap = await getDocs(q);
      // Filter hidden posts client-side
      const visibleDocs = snap.docs.filter((d) => d.data().isHidden !== true);
      const more = visibleDocs.length > PAGE_SIZE;
      const docs = visibleDocs.slice(0, PAGE_SIZE);

      const rawPosts: Post[] = docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          ...data,
          createdAt: data.createdAt?.toDate?.() ?? new Date(),
          updatedAt: data.updatedAt?.toDate?.() ?? new Date(),
        } as Post;
      });

      const resolved = await Promise.all(rawPosts.map(resolveThumb));

      if (afterCursor) {
        setItems((prev) => [...prev, ...resolved]);
      } else {
        setItems(resolved);
      }

      setHasMore(more);
      setCursor(more ? docs[docs.length - 1] : null);
    },
    [debouncedSearch] // eslint-disable-line react-hooks/exhaustive-deps
  );

  useEffect(() => {
    setLoading(true);
    setCursor(null);
    loadPosts().finally(() => setLoading(false));
  }, [loadPosts]);

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
      { rootMargin: "300px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [hasMore, loadingMore, cursor, loadPosts]);

  useEffect(() => {
    const tag = searchParams.get("tag");
    if (tag) setSearch(`#${tag}`);
  }, [searchParams]);

  function handleSearchChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setSearch(val);
    if (!val) router.replace("/explore");
  }

  return (
    <>
      <MobileHeader title="Explore" showBack={false} />
      <div className="max-w-5xl mx-auto px-4 py-4 flex flex-col gap-5">
        {/* Search bar */}
        <div className="max-w-lg">
          <Input
            type="search"
            placeholder="Search #hashtags, @users or keywords"
            value={search}
            onChange={handleSearchChange}
            leftIcon={<Search className="h-4 w-4" />}
            aria-label="Search"
          />
          {search && (
            <p className="text-xs text-text-muted mt-1.5 px-1">
              {search.startsWith("#")
                ? `Posts tagged ${search}`
                : search.startsWith("@")
                  ? `Posts by ${search}`
                  : "Searching public posts"}
            </p>
          )}
        </div>

        {/* Hashtag chips */}
        {!search && (
          <div className="flex flex-wrap gap-2">
            {["photography", "travel", "portraits", "nature", "street", "architecture"].map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => setSearch(`#${tag}`)}
                className="px-3 py-1.5 rounded-full bg-bg-card border border-border text-xs text-text-secondary hover:border-accent hover:text-accent transition-colors"
              >
                #{tag}
              </button>
            ))}
          </div>
        )}

        {/* Grid */}
        {loading ? (
          <div className="grid grid-cols-3 gap-0.5">
            {Array.from({ length: 12 }).map((_, i) => (
              <Skeleton key={i} className="aspect-square rounded-none" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={Grid3x3}
            title="No posts found"
            description={search ? `No public posts match "${search}".` : "No public posts yet."}
          />
        ) : (
          <div className="grid grid-cols-3 gap-0.5">
            {items.map(({ post, thumbUrl, isVideo, isMulti }) => (
              <ExploreCell
                key={post.id}
                postId={post.id}
                authorUsername={post.authorUsername}
                thumbUrl={thumbUrl}
                isVideo={isVideo}
                isMulti={isMulti}
                likesCount={post.likesCount}
                commentsCount={post.commentsCount}
              />
            ))}
          </div>
        )}

        <div ref={sentinelRef} className="h-4" />
        {loadingMore && (
          <div className="flex justify-center py-4">
            <Spinner size="md" />
          </div>
        )}
      </div>
    </>
  );
}

function ExploreCell({
  postId, authorUsername, thumbUrl, isVideo, isMulti, likesCount, commentsCount,
}: {
  postId: string;
  authorUsername: string;
  thumbUrl: string;
  isVideo: boolean;
  isMulti: boolean;
  likesCount: number;
  commentsCount: number;
}) {
  return (
    <Link
      href={`/post/${postId}`}
      className="relative aspect-square bg-bg-secondary overflow-hidden group block"
      aria-label={`Post by @${authorUsername}`}
    >
      {thumbUrl ? (
        <Image
          src={thumbUrl}
          alt=""
          fill
          className="object-cover group-hover:scale-105 transition-transform duration-300"
          sizes="(max-width: 640px) 33vw, (max-width: 1024px) 25vw, 200px"
          loading="lazy"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-bg-card">
          <Grid3x3 className="h-6 w-6 text-text-muted" />
        </div>
      )}

      <div className="absolute top-1.5 right-1.5 flex gap-1">
        {isVideo && (
          <span className="bg-bg-primary/70 rounded p-0.5">
            <Play className="h-3 w-3 text-text-primary fill-text-primary" />
          </span>
        )}
        {isMulti && !isVideo && (
          <span className="bg-bg-primary/70 rounded p-0.5">
            <Images className="h-3 w-3 text-text-primary" />
          </span>
        )}
      </div>

      <div className="absolute inset-0 bg-bg-primary/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-5">
        <span className="text-xs font-bold text-white">♥ {likesCount}</span>
        <span className="text-xs font-bold text-white">💬 {commentsCount}</span>
      </div>
    </Link>
  );
}
