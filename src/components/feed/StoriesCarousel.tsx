"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { PlusCircle } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Skeleton } from "@/components/ui/Skeleton";
import { loadStoriesGrouped } from "@/services/story.service";
import { useAuth } from "@/lib/auth/AuthContext";

interface Props {
  currentUid?: string;
  currentUsername?: string;
  currentPhotoUrl?: string;
}

export function StoriesCarousel({ currentUid, currentUsername, currentPhotoUrl }: Props) {
  const { user } = useAuth();
  const [groups, setGroups] = useState<Array<{
    authorUid: string;
    authorUsername: string;
    authorPhotoUrl: string;
    hasUnviewed: boolean;
    hasStory: boolean;
  }>>([]);
  const [loading, setLoading] = useState(true);
  const [hasOwnStory, setHasOwnStory] = useState(false);

  useEffect(() => {
    const uid = currentUid ?? user?.uid;
    if (!uid) { setLoading(false); return; }
    let cancelled = false;

    loadStoriesGrouped(uid)
      .then((result) => {
        if (cancelled) return;

        // Separate own story from others
        const ownGroup = result.find((g) => g.authorUid === uid);
        const othersGroups = result.filter((g) => g.authorUid !== uid);

        setHasOwnStory(!!ownGroup);
        setGroups(
          othersGroups.map((g) => ({
            authorUid: g.authorUid,
            authorUsername: g.authorUsername,
            authorPhotoUrl: g.authorPhotoUrl,
            hasUnviewed: g.hasUnviewed,
            hasStory: g.stories.length > 0,
          }))
        );
      })
      .catch(() => { if (!cancelled) setGroups([]); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [currentUid, user?.uid]);

  const myUid = currentUid ?? user?.uid;

  return (
    <div className="flex gap-3 overflow-x-auto no-scrollbar py-1 px-1">
      {/* Own story bubble — view if exists, create if not */}
      {myUid && (
        <Link
          href={hasOwnStory ? `/stories?uid=${myUid}` : "/stories/create"}
          className="flex flex-col items-center gap-1.5 shrink-0 group"
        >
          <div className="relative h-14 w-14">
            <Avatar
              src={currentPhotoUrl ?? user?.profilePhotoUrl}
              fallback={currentUsername ?? user?.username ?? ""}
              size="lg"
              hasStory={hasOwnStory}
              className="group-hover:scale-105 transition-transform"
            />
            {!hasOwnStory && (
              <div className="absolute bottom-0 right-0 h-5 w-5 rounded-full bg-accent border-2 border-bg-primary flex items-center justify-center">
                <PlusCircle className="h-3.5 w-3.5 text-bg-primary" />
              </div>
            )}
          </div>
          <span className="text-[10px] text-text-secondary w-14 text-center truncate">
            {hasOwnStory ? "Your story" : "Add story"}
          </span>
        </Link>
      )}

      {/* Loading skeletons */}
      {loading &&
        Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex flex-col items-center gap-1.5 shrink-0">
            <Skeleton circle className="h-14 w-14" />
            <Skeleton className="h-2.5 w-10 rounded" />
          </div>
        ))}

      {/* Other users' stories */}
      {!loading &&
        groups.map((g) => (
          <Link
            key={g.authorUid}
            href={`/stories?uid=${g.authorUid}`}
            className="flex flex-col items-center gap-1.5 shrink-0 group"
          >
            <Avatar
              src={g.authorPhotoUrl}
              fallback={g.authorUsername}
              size="lg"
              hasStory={g.hasStory}
              hasUnviewedStory={g.hasUnviewed}
              className="group-hover:scale-105 transition-transform"
            />
            <span className="text-[10px] text-text-secondary w-14 text-center truncate">
              {g.authorUsername}
            </span>
          </Link>
        ))}

      {/* Empty state */}
      {!loading && groups.length === 0 && !myUid && (
        <p className="text-xs text-text-muted self-center pl-2">
          No stories yet — follow people to see theirs.
        </p>
      )}
    </div>
  );
}
