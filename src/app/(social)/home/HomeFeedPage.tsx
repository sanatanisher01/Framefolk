"use client";

import { useState, useEffect } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useAuth } from "@/lib/auth/AuthContext";
import { MobileHeader } from "@/components/layout/MobileHeader";
import { StoriesCarousel } from "@/components/feed/StoriesCarousel";
import { FeedList } from "@/components/feed/FeedList";
import { SuggestedUsers } from "@/components/feed/SuggestedUsers";
import { Separator } from "@/components/ui/Separator";
import { FullPageSpinner } from "@/components/ui/Spinner";

export function HomeFeedPage() {
  const { user, initialized } = useAuth();
  const [followingUids, setFollowingUids] = useState<string[]>([]);
  const [loadingFollowing, setLoadingFollowing] = useState(true);

  // Load who the current user follows
  useEffect(() => {
    if (!user || !db) { setLoadingFollowing(false); return; }
    let cancelled = false;

    async function loadFollowing() {
      if (!db || !user) return;
      try {
        const snap = await getDocs(
          collection(db, "followers", user.uid, "following")
        );
        if (!cancelled) {
          // Include own UID so user sees their own posts in the feed
          const uids = snap.docs.map((d) => d.id);
          if (!uids.includes(user.uid)) uids.push(user.uid);
          setFollowingUids(uids);
        }
      } catch {
        if (!cancelled) {
          // On error still show own posts
          setFollowingUids([user.uid]);
        }
      } finally {
        if (!cancelled) setLoadingFollowing(false);
      }
    }

    loadFollowing();
    return () => { cancelled = true; };
  }, [user]);

  if (!initialized) return <FullPageSpinner />;
  if (!user) return null;

  return (
    <>
      {/* Mobile header */}
      <MobileHeader />

      {/* Desktop 3-column / Mobile single-column layout */}
      <div className="max-w-5xl mx-auto px-4 py-4">
        <div className="flex gap-8">
          {/* ── Main feed column ── */}
          <main className="flex-1 min-w-0 flex flex-col gap-4">
            {/* Stories carousel */}
            <div className="bg-bg-card border border-border rounded-2xl px-4 py-3">
              <StoriesCarousel
                currentUid={user.uid}
                currentUsername={user.username}
                currentPhotoUrl={user.profilePhotoUrl}
              />
            </div>

            <Separator className="hidden sm:block opacity-0 h-0" />

            {/* Feed posts */}
            {loadingFollowing ? (
              <div className="flex flex-col gap-4">
                {Array.from({ length: 2 }).map((_, i) => (
                  <div key={i} className="h-96 bg-bg-card border border-border rounded-2xl animate-skeleton" />
                ))}
              </div>
            ) : (
              <FeedList
                currentUid={user.uid}
                currentUsername={user.username}
                currentPhotoUrl={user.profilePhotoUrl}
                followingUids={followingUids}
              />
            )}
          </main>

          {/* ── Right sidebar — desktop only ── */}
          <aside className="hidden lg:block w-72 shrink-0">
            <div className="sticky top-6">
              <SuggestedUsers
                currentUid={user.uid}
                currentUser={{
                  displayName: user.displayName,
                  username: user.username,
                  profilePhotoUrl: user.profilePhotoUrl,
                }}
              />
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}
