"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useAuth } from "@/lib/auth/AuthContext";
import { PostCard } from "@/components/feed/PostCard";
import { MobileHeader } from "@/components/layout/MobileHeader";
import { FullPageSpinner, Spinner } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { FileWarning } from "lucide-react";
import type { Post, Media } from "@/types";

export function PostDetailPage() {
  const { postId } = useParams<{ postId: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const [post, setPost] = useState<Post | null>(null);
  const [mediaItems, setMediaItems] = useState<Partial<Media>[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!postId || !db) { setLoading(false); return; }

    async function load() {
      if (!db) return;
      try {
        // Fetch post
        const postSnap = await getDoc(doc(db, "posts", postId));
        if (!postSnap.exists()) {
          setNotFound(true);
          setLoading(false);
          return;
        }

        const data = postSnap.data();
        const loadedPost: Post = {
          id: postSnap.id,
          ...data,
          createdAt: data.createdAt?.toDate?.() ?? new Date(),
          updatedAt: data.updatedAt?.toDate?.() ?? new Date(),
          publishedAt: data.publishedAt?.toDate?.() ?? null,
          scheduledFor: data.scheduledFor?.toDate?.() ?? null,
        } as Post;

        setPost(loadedPost);

        // Fetch media
        if (loadedPost.mediaIds?.length) {
          const mItems = await Promise.all(
            loadedPost.mediaIds.map(async (mid) => {
              const snap = await getDoc(doc(db!, "media", mid));
              return snap.exists() ? { id: snap.id, ...snap.data() } as Partial<Media> : null;
            })
          );
          setMediaItems(mItems.filter(Boolean) as Partial<Media>[]);
        }
      } catch (err) {
        console.error("[PostDetailPage] failed to load post:", err);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [postId]);

  if (loading) return <FullPageSpinner />;

  if (notFound) {
    return (
      <>
        <MobileHeader title="Post" showBack />
        <div className="max-w-xl mx-auto px-4 py-12">
          <EmptyState
            icon={FileWarning}
            title="Post not found"
            description="This post may have been deleted or you don't have permission to view it."
            actionLabel="Go back"
            onAction={() => router.back()}
          />
        </div>
      </>
    );
  }

  if (!post) return null;

  return (
    <>
      <MobileHeader title="Post" showBack />
      <div className="max-w-xl mx-auto px-4 py-4">
        <PostCard
          post={post}
          mediaItems={mediaItems}
          currentUid={user?.uid}
          currentUsername={user?.username ?? ""}
          currentPhotoUrl={user?.profilePhotoUrl ?? ""}
        />
      </div>
    </>
  );
}
