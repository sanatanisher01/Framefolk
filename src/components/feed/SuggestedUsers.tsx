"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { UserPlus } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { getSuggestedUsers } from "@/services/social.service";
import { followUser } from "@/services/auth.service";
import { cn } from "@/utils/cn";

interface SuggestedUser {
  uid: string;
  username: string;
  displayName: string;
  profilePhotoUrl: string;
  followersCount: number;
}

interface Props {
  currentUid?: string;
  currentUser?: { displayName: string; username: string; profilePhotoUrl?: string } | null;
}

export function SuggestedUsers({ currentUid, currentUser }: Props) {
  const [users, setUsers] = useState<SuggestedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [followed, setFollowed] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!currentUid) { setLoading(false); return; }

    let active = true;
    setLoading(true);
    setError(null);
    async function load() {
      try {
        const filtered = await getSuggestedUsers(currentUid!, 5);
        if (!active) return;
        setUsers(
          filtered.map((u) => ({
            uid: u.uid as string,
            username: (u.username as string) ?? "",
            displayName: (u.displayName as string) ?? "",
            profilePhotoUrl: (u.profilePhotoUrl as string) ?? "",
            followersCount: (u.followersCount as number) ?? 0,
          }))
        );
      } catch (error) {
        if (!active) return;
        setError(error instanceof Error ? error.message : "Could not load suggestions.");
        setUsers([]);
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => { active = false; };
  }, [currentUid, retry]);

  async function handleFollow(uid: string) {
    if (!currentUid) return;
    setFollowed((prev) => new Set([...prev, uid]));
    await followUser(currentUid, uid).catch(() => {
      setFollowed((prev) => { const n = new Set(prev); n.delete(uid); return n; });
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Current user summary */}
      {currentUser && (
        <div className="flex items-center gap-3">
          <Avatar
            src={currentUser.profilePhotoUrl}
            fallback={currentUser.displayName}
            size="md"
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-text-primary truncate">
              {currentUser.displayName}
            </p>
            <p className="text-xs text-text-secondary truncate">@{currentUser.username}</p>
          </div>
          <Link href="/settings/profile" className="text-xs text-accent hover:underline font-medium shrink-0">
            Edit
          </Link>
        </div>
      )}

      {error && <div role="alert" className="text-xs text-text-secondary"><p>{error}</p><button className="text-accent mt-2" onClick={() => setRetry(n => n + 1)}>Retry suggestions</button></div>}

      {users.length > 0 || loading ? (
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">
              Suggested for you
            </p>
            <Link href="/explore" className="text-xs font-semibold text-text-primary hover:text-text-secondary">
              See all
            </Link>
          </div>

          {loading
            ? Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 py-1.5">
                  <Skeleton circle className="h-9 w-9 shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-2.5 w-24" />
                    <Skeleton className="h-2 w-16" />
                  </div>
                  <Skeleton className="h-7 w-16 rounded-lg" />
                </div>
              ))
            : users.map((user) => (
                <div key={user.uid} className="flex items-center gap-3 py-1.5">
                  <Link href={`/@${user.username}`} className="shrink-0">
                    <Avatar src={user.profilePhotoUrl} fallback={user.displayName} size="sm" />
                  </Link>
                  <div className="flex-1 min-w-0">
                    <Link href={`/@${user.username}`} className="text-xs font-semibold text-text-primary hover:underline truncate block">
                      {user.username}
                    </Link>
                    <p className="text-[10px] text-text-muted">{user.displayName}</p>
                  </div>
                  <Button
                    variant={followed.has(user.uid) ? "secondary" : "primary"}
                    size="sm"
                    className={cn("text-xs h-7 px-3 shrink-0", followed.has(user.uid) && "text-text-secondary")}
                    onClick={() => handleFollow(user.uid)}
                    disabled={followed.has(user.uid)}
                  >
                    {followed.has(user.uid) ? "Following" : (
                      <><UserPlus className="h-3 w-3 mr-1" />Follow</>
                    )}
                  </Button>
                </div>
              ))}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-x-2 gap-y-1 text-[10px] text-text-muted pt-2 border-t border-border/50">
        {["About", "Privacy", "Terms", "Help"].map((l) => (
          <a key={l} href="#" className="hover:underline">{l}</a>
        ))}
        <span>© {new Date().getFullYear()} FRAMEFOLK</span>
      </div>
    </div>
  );
}
