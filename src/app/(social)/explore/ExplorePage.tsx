"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { useAuth } from "@/lib/auth/AuthContext";
import { MobileHeader } from "@/components/layout/MobileHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { Spinner } from "@/components/ui/Spinner";
import { Input } from "@/components/ui/Input";
import { Avatar } from "@/components/ui/Avatar";
import { Search, Grid3x3, Play, Images } from "lucide-react";
import { useDebounce } from "@/hooks/useDebounce";
import { getSignedDeliveryUrl } from "@/services/upload.service";
import { platformRequest } from "@/services/platform.service";
import type { Post, User } from "@/types";

const PAGE_SIZE = 24;

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
  const [userResults, setUserResults] = useState<Partial<User>[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [peopleError, setPeopleError] = useState<string | null>(null);
  const [peopleLoading, setPeopleLoading] = useState(false);
  const [retry, setRetry] = useState(0);
  const generation = useRef(0);
  const sentinelRef = useRef<HTMLDivElement>(null);

  async function resolveThumb(post: Post): Promise<PostWithThumb> {
    const isVideo = post.type === "video";
    const isMulti = post.type === "multi";
    let thumbUrl = "";

    if (post.coverMediaId) thumbUrl = await getSignedDeliveryUrl(post.coverMediaId, true).catch(() => "");

    return { post, thumbUrl, isVideo, isMulti };
  }

  const loadPosts = useCallback(
    async (afterCursor?: string) => {
      const requestGeneration = generation.current;
      const page = await platformRequest<{ posts: Post[]; cursor: string | null }>("posts", { mode: "explore", search: debouncedSearch, cursor: afterCursor, pageSize: PAGE_SIZE });
      const rawPosts = page.posts;
      const resolved = await Promise.all(rawPosts.map(resolveThumb));

      if (requestGeneration !== generation.current) return;
      if (afterCursor) {
        setItems((prev) => [...prev, ...resolved]);
      } else {
        setItems(resolved);
      }

      setHasMore(!!page.cursor);
      setCursor(page.cursor);
    },
    [debouncedSearch] // eslint-disable-line react-hooks/exhaustive-deps
  );

  useEffect(() => {
    const current = ++generation.current;
    setLoading(true);
    setError(null);
    setItems([]);
    setCursor(null);
    setHasMore(false);
    loadPosts().catch(error => {
      if (current === generation.current) setError(error instanceof Error ? error.message : "Could not load posts.");
    }).finally(() => { if (current === generation.current) setLoading(false); });
    return () => { generation.current = current + 1; };
  }, [loadPosts, retry]);

  useEffect(() => {
    let active = true;
    const term = debouncedSearch.trim();
    setUserResults([]);
    setPeopleError(null);
    setPeopleLoading(false);
    if (!term || term.startsWith("#")) return;
    setPeopleLoading(true);
    platformRequest<Partial<User>[]>("searchUsers", { search: term, count: 30 })
      .then(users => { if (active) setUserResults(users); })
      .catch(error => { if (active) setPeopleError(error instanceof Error ? error.message : "Could not search people."); })
      .finally(() => { if (active) setPeopleLoading(false); });
    return () => { active = false; };
  }, [debouncedSearch, retry]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      async (entries) => {
        if (entries[0].isIntersecting && !loading && hasMore && !loadingMore && cursor) {
          setLoadingMore(true);
          await loadPosts(cursor).catch(() => {});
          setLoadingMore(false);
        }
      },
      { rootMargin: "300px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [loading, hasMore, loadingMore, cursor, loadPosts]);

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
            placeholder="Search people, @usernames or #hashtags"
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
                  ? `Searching people and posts for ${search}`
                  : `Searching people and posts for "${search}"`}
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

        {peopleLoading && <p className="text-sm text-text-muted">Searching people…</p>}
        {peopleError && <EmptyState title={peopleError} actionLabel="Retry" onAction={() => setRetry(n => n + 1)} />}
        {!peopleLoading && !peopleError && debouncedSearch.trim() && !debouncedSearch.trim().startsWith("#") && !userResults.length && (
          <p className="text-sm text-text-muted">No people found.</p>
        )}
        {/* People load independently of posts. */}
        {userResults.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium text-text-muted uppercase tracking-wider">People</p>
            <div className="bg-bg-card border border-border rounded-2xl overflow-hidden divide-y divide-border/50">
              {userResults.map((u) => (
                <Link
                  key={u.uid}
                  href={`/@${u.username}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-bg-secondary transition-colors"
                >
                  <Avatar
                    src={(u as { profilePhotoUrl?: string }).profilePhotoUrl}
                    fallback={(u.displayName ?? u.username) as string}
                    size="sm"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-text-primary truncate">{u.displayName}</p>
                    <p className="text-xs text-text-muted">@{u.username}</p>
                  </div>
                  <span className="text-xs text-text-muted shrink-0">
                    {(u as { followersCount?: number }).followersCount ?? 0} followers
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Grid */}
        {error ? (
          <EmptyState title={error} actionLabel="Retry" onAction={() => setRetry(n => n + 1)} />
        ) : loading ? (
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
          unoptimized
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
