"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { PlusCircle } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  collection, query, where, orderBy, limit, getDocs,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";

interface StoryAuthor {
  uid: string;
  username: string;
  displayName: string;
  photoUrl: string;
  hasStory: boolean;
}

interface Props {
  currentUid?: string;
  currentUsername?: string;
  currentPhotoUrl?: string;
}

export function StoriesCarousel({ currentUid, currentUsername, currentPhotoUrl }: Props) {
  const [authors, setAuthors] = useState<StoryAuthor[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!db || !currentUid) { setLoading(false); return; }
    let cancelled = false;

    async function load() {
      if (!db) return;
      try {
        const now = new Date();
        const q = query(
          collection(db, "stories"),
          where("visibility", "in", ["public", "followers"]),
          where("isExpired", "==", false),
          where("expiresAt", ">", now),
          orderBy("expiresAt"),
          limit(20)
        );
        const snap = await getDocs(q);

        // Deduplicate by authorUid
        const seen = new Set<string>();
        const result: StoryAuthor[] = [];
        snap.docs.forEach((d) => {
          const data = d.data();
          const uid = data.authorUid as string;
          if (!seen.has(uid) && uid !== currentUid) {
            seen.add(uid);
            result.push({
              uid,
              username: (data.authorUsername as string) ?? "",
              displayName: (data.authorUsername as string) ?? "",
              photoUrl: (data.authorPhotoUrl as string) ?? "",
              hasStory: true,
            });
          }
        });

        if (!cancelled) setAuthors(result);
      } catch {
        if (!cancelled) setAuthors([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [currentUid]);

  return (
    <div className="flex gap-3 overflow-x-auto no-scrollbar py-1 px-1">
      {/* Add story */}
      {currentUid && (
        <Link href="/stories/create" className="flex flex-col items-center gap-1.5 shrink-0 group">
          <div className="relative h-14 w-14">
            <Avatar
              src={currentPhotoUrl}
              fallback={currentUsername ?? ""}
              size="lg"
              className="ring-2 ring-border group-hover:ring-accent transition-colors"
            />
            <div className="absolute bottom-0 right-0 h-5 w-5 rounded-full bg-accent border-2 border-bg-primary flex items-center justify-center">
              <PlusCircle className="h-3.5 w-3.5 text-bg-primary" />
            </div>
          </div>
          <span className="text-[10px] text-text-secondary w-14 text-center truncate">
            Your story
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

      {/* Story authors */}
      {!loading &&
        authors.map((author) => (
          <Link
            key={author.uid}
            href={`/stories?uid=${author.uid}`}
            className="flex flex-col items-center gap-1.5 shrink-0 group"
          >
            <Avatar
              src={author.photoUrl}
              fallback={author.username}
              size="lg"
              hasStory={author.hasStory}
              className="group-hover:scale-105 transition-transform"
            />
            <span className="text-[10px] text-text-secondary w-14 text-center truncate">
              {author.username}
            </span>
          </Link>
        ))}

      {/* Empty state if no stories */}
      {!loading && authors.length === 0 && (
        <p className="text-xs text-text-muted self-center pl-2">
          No stories yet — follow people to see theirs.
        </p>
      )}
    </div>
  );
}
