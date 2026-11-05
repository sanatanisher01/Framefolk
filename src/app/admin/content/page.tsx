"use client";


import { Skeleton } from "@/components/ui/Skeleton";import { useState, useEffect } from "react";
import { collection, query, orderBy, limit, onSnapshot, doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { FileWarning, Eye, EyeOff } from "lucide-react";
import { formatRelativeTime } from "@/utils/format";
import { useToast } from "@/hooks/useToast";

interface ContentRow {
  id: string;
  authorUid: string;
  authorUsername: string;
  caption: string;
  type: string;
  visibility: string;
  isHidden: boolean;
  likesCount: number;
  commentsCount: number;
  createdAt: Date;
}

export default function ContentPage() {
  const { toast } = useToast();
  const [posts, setPosts] = useState<ContentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!db) { setLoading(false); return; }
    const q = query(
      collection(db, "posts"),
      orderBy("createdAt", "desc"),
      limit(50)
    );
    const unsub = onSnapshot(q, (snap) => {
      setPosts(snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          authorUid: (data.authorUid as string) ?? "",
          authorUsername: (data.authorUsername as string) ?? "",
          caption: (data.caption as string) ?? "",
          type: (data.type as string) ?? "photo",
          visibility: (data.visibility as string) ?? "public",
          isHidden: (data.isHidden as boolean) ?? false,
          likesCount: (data.likesCount as number) ?? 0,
          commentsCount: (data.commentsCount as number) ?? 0,
          createdAt: data.createdAt?.toDate() ?? new Date(),
        };
      }));
      setLoading(false);
    });
    return unsub;
  }, []);

  async function toggleHidden(post: ContentRow) {
    if (!db) return;
    setBusy(post.id);
    try {
      await updateDoc(doc(db, "posts", post.id), {
        isHidden: !post.isHidden,
        updatedAt: serverTimestamp(),
      });
      toast({
        title: post.isHidden ? "Content restored" : "Content hidden",
        variant: post.isHidden ? "success" : "warning",
      });
    } catch (err: unknown) {
      toast({ title: "Failed to update", description: (err as Error).message, variant: "error" });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <AdminPageHeader title="Content Moderation" description="Review and moderate published posts" />

      {loading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="p-3 bg-bg-card border border-border rounded-xl space-y-1.5">
              <Skeleton className="h-3 w-40" />
              <Skeleton className="h-2.5 w-56" />
            </div>
          ))}
        </div>
      ) : posts.length === 0 ? (
        <EmptyState icon={FileWarning} title="No content" description="Published posts will appear here for review." />
      ) : (
        <div className="flex flex-col gap-2">
          {posts.map((post) => (
            <div
              key={post.id}
              className="p-3 bg-bg-card border border-border rounded-xl hover:shadow-card-hover transition-shadow"
            >
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-text-primary">@{post.authorUsername}</span>
                    <Badge variant={post.isHidden ? "blocked" : "default"}>
                      {post.visibility}
                    </Badge>
                    {post.isHidden && <Badge variant="blocked">Hidden</Badge>}
                  </div>
                  <p className="text-sm text-text-secondary mt-1 line-clamp-2">
                    {post.caption || "(no caption)"}
                  </p>
                  <p className="text-xs text-text-muted mt-1">
                    {post.likesCount} likes · {post.commentsCount} comments · {formatRelativeTime(post.createdAt)}
                  </p>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  className="gap-1.5 shrink-0"
                  loading={busy === post.id}
                  onClick={() => toggleHidden(post)}
                >
                  {post.isHidden
                    ? <><Eye className="h-3.5 w-3.5" /> Restore</>
                    : <><EyeOff className="h-3.5 w-3.5" /> Hide</>}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
