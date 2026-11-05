"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Suspense } from "react";
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

  const targetUid = searchParams.get("uid");
  const initialIdx = targetUid
    ? groups.findIndex((g) => g.authorUid === targetUid)
    : 0;

  useEffect(() => {
    if (!user) return;
    loadStoriesGrouped(user.uid)
      .then(setGroups)
      .catch(() => setGroups([]))
      .finally(() => setLoading(false));
  }, [user]);

  if (loading) return <FullPageSpinner />;

  if (groups.length === 0) {
    router.replace("/home");
    return null;
  }

  return (
    <StoryViewer
      groups={groups}
      initialGroupIndex={Math.max(0, initialIdx)}
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
