"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthContext";
import { loadStoriesGrouped, type StoryAuthorGroup } from "@/services/story.service";
import { StoryViewer } from "@/components/stories/StoryViewer";
import { FullPageSpinner } from "@/components/ui/Spinner";

function StoriesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();

  const [groups, setGroups] = useState<StoryAuthorGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [initialGroupIndex, setInitialGroupIndex] = useState(0);

  const targetUid = searchParams.get("uid");

  useEffect(() => {
    if (!user) return;
    loadStoriesGrouped(user.uid)
      .then((result) => {
        setGroups(result);
        // Compute initial index AFTER groups are loaded — fixes the race condition
        if (targetUid) {
          const idx = result.findIndex((g) => g.authorUid === targetUid);
          setInitialGroupIndex(idx >= 0 ? idx : 0);
        } else {
          setInitialGroupIndex(0);
        }
      })
      .catch(() => setGroups([]))
      .finally(() => setLoading(false));
  }, [user, targetUid]);

  if (loading) return <FullPageSpinner />;

  if (groups.length === 0) {
    router.replace("/home");
    return null;
  }

  return (
    <StoryViewer
      groups={groups}
      initialGroupIndex={initialGroupIndex}
      currentUid={user?.uid}
      onClose={() => router.replace("/home")}
    />
  );
}

export default function StoriesPage() {
  return (
    <Suspense fallback={<FullPageSpinner />}>
      <StoriesContent />
    </Suspense>
  );
}
