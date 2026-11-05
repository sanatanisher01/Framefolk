"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Settings, UserPlus, UserMinus, MessageCircle,
  MoreHorizontal, Lock, Clock, Copy, Flag, ShieldBan, CheckCircle,
  Bell, BookImage, Share2,
} from "lucide-react";
import { motion } from "framer-motion";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator,
} from "@/components/ui/DropdownMenu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from "@/components/ui/Dialog";
import { useToast } from "@/hooks/useToast";
import {
  followUser, unfollowUser, isFollowing, hasPendingFollowRequest,
  blockUser, reportUser,
} from "@/services/auth.service";
import { formatCount, formatMonthYear } from "@/utils/format";
import type { User } from "@/types";

interface Props {
  user: User;
  isOwnProfile: boolean;
  currentUid?: string;
  isApproved: boolean;
}

type FollowState = "idle" | "following" | "requested" | "loading";

export function ProfileHeader({ user, isOwnProfile, currentUid, isApproved }: Props) {
  const { toast } = useToast();
  const [followState, setFollowState] = useState<FollowState>("idle");
  const [optimisticFollowers, setOptimisticFollowers] = useState(user.followersCount);
  const [showBlockDialog, setShowBlockDialog] = useState(false);
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [blockLoading, setBlockLoading] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [blockDone, setBlockDone] = useState(false);
  const [reportDone, setReportDone] = useState(false);
  const [copyDone, setCopyDone] = useState(false);

  // Load follow state
  useEffect(() => {
    if (!currentUid || isOwnProfile) return;
    let cancelled = false;

    async function loadFollowState() {
      if (!currentUid) return;
      try {
        const [following, pending] = await Promise.all([
          isFollowing(currentUid, user.uid),
          hasPendingFollowRequest(currentUid, user.uid),
        ]);
        if (!cancelled) {
          if (following) setFollowState("following");
          else if (pending) setFollowState("requested");
          else setFollowState("idle");
        }
      } catch {
        if (!cancelled) setFollowState("idle");
      }
    }

    loadFollowState();
    return () => { cancelled = true; };
  }, [currentUid, user.uid, isOwnProfile]);

  async function handleFollow() {
    if (!currentUid || !isApproved) return;
    setFollowState("loading");
    try {
      await followUser(currentUid, user.uid);
      if (user.isPrivate) {
        setFollowState("requested");
        toast({ title: "Follow request sent", description: `@${user.username} will be notified.`, variant: "default" });
      } else {
        setFollowState("following");
        setOptimisticFollowers((c) => c + 1);
        toast({ title: `Following @${user.username}`, variant: "success" });
      }
    } catch {
      setFollowState("idle");
      toast({ title: "Could not follow", description: "Please try again.", variant: "error" });
    }
  }

  async function handleUnfollow() {
    if (!currentUid) return;
    setFollowState("loading");
    try {
      await unfollowUser(currentUid, user.uid);
      setFollowState("idle");
      setOptimisticFollowers((c) => Math.max(0, c - 1));
    } catch {
      setFollowState("following");
    }
  }

  function handleCopyLink() {
    const url = `${window.location.origin}/@${user.username}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopyDone(true);
      toast({ title: "Profile link copied!", variant: "default" });
      setTimeout(() => setCopyDone(false), 2000);
    }).catch(() => {});
  }

  function handleShare() {
    const url = `${window.location.origin}/@${user.username}`;
    if (navigator.share) {
      navigator.share({ title: `@${user.username} on FRAMEFOLK`, url }).catch(() => {});
    } else {
      handleCopyLink();
    }
  }

  async function handleBlock() {
    if (!currentUid) return;
    setBlockLoading(true);
    try {
      await blockUser(currentUid, user.uid);
      setBlockDone(true);
      setTimeout(() => { setShowBlockDialog(false); setBlockDone(false); }, 1500);
    } catch {
      setBlockLoading(false);
    }
  }

  async function handleReport() {
    if (!currentUid) return;
    setReportLoading(true);
    try {
      await reportUser(currentUid, user.uid, "inappropriate");
      setReportDone(true);
      setTimeout(() => { setShowReportDialog(false); setReportDone(false); }, 1500);
    } catch {
      setReportLoading(false);
    }
  }

  const followButtonLabel =
    followState === "following" ? "Following" :
    followState === "requested" ? "Requested" :
    followState === "loading" ? "" :
    user.isPrivate ? "Follow" : "Follow";

  const showPrivateLock = user.isPrivate && !isOwnProfile && followState !== "following";

  return (
    <div className="flex flex-col">
      {/* Cover photo */}
      <div className="relative h-36 sm:h-48 w-full bg-bg-secondary overflow-hidden">
        {user.coverPhotoUrl ? (
          <Image
            src={user.coverPhotoUrl}
            alt={`${user.displayName}'s cover photo`}
            fill
            className="object-cover"
            priority
            sizes="100vw"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-bg-secondary via-bg-card to-accent/10" />
        )}
      </div>

      {/* Profile info */}
      <div className="px-4 pb-4">
        {/* Avatar row — avatar overlaps cover, buttons sit BELOW on same row */}
        <div className="flex items-end justify-between -mt-12 mb-3">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="shrink-0"
          >
            <Avatar
              src={user.profilePhotoUrl}
              fallback={user.displayName}
              size="2xl"
              className="ring-4 ring-bg-primary"
            />
          </motion.div>

          {/* Action buttons — pushed down with pt so they don't overlap cover */}
          <div className="flex items-center gap-2 pt-14">
            {isOwnProfile ? (
              <>
                <Link href="/settings/profile">
                  <Button variant="secondary" size="sm" className="gap-1.5">
                    <Settings className="h-4 w-4" />
                    <span className="hidden sm:inline">Edit profile</span>
                    <span className="sm:hidden">Edit</span>
                  </Button>
                </Link>
                <Link href="/settings">
                  <Button variant="secondary" size="icon-sm" aria-label="Settings">
                    <Settings className="h-4 w-4" />
                  </Button>
                </Link>
                <Button variant="secondary" size="icon-sm" aria-label="Share profile" onClick={handleShare}>
                  <Share2 className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <>
                {isApproved && (
                  <Link href={`/messages?with=${user.uid}`}>
                    <Button variant="secondary" size="icon-sm" aria-label="Send message">
                      <MessageCircle className="h-4 w-4" />
                    </Button>
                  </Link>
                )}

                {followState === "following" ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleUnfollow}
                    loading={followState === ("loading" as string)}
                    className="gap-1.5 min-w-[90px]"
                  >
                    <UserMinus className="h-4 w-4" />
                    Following
                  </Button>
                ) : followState === "requested" ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled
                    className="gap-1.5 min-w-[90px] opacity-70"
                  >
                    <Clock className="h-4 w-4" />
                    Requested
                  </Button>
                ) : (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleFollow}
                    loading={followState === "loading"}
                    className="gap-1.5 min-w-[90px]"
                  >
                    <UserPlus className="h-4 w-4" />
                    Follow
                  </Button>
                )}

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="secondary" size="icon-sm" aria-label="More options">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={handleCopyLink}>
                      {copyDone
                        ? <><CheckCircle className="h-4 w-4 mr-2 text-green-400" />Copied!</>
                        : <><Copy className="h-4 w-4 mr-2" />Copy profile link</>
                      }
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleShare}>
                      <Share2 className="h-4 w-4 mr-2" />
                      Share profile
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem destructive onClick={() => setShowReportDialog(true)}>
                      <Flag className="h-4 w-4 mr-2" />
                      Report user
                    </DropdownMenuItem>
                    <DropdownMenuItem destructive onClick={() => setShowBlockDialog(true)}>
                      <ShieldBan className="h-4 w-4 mr-2" />
                      Block user
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            )}
          </div>
        </div>

        {/* Name + username */}
        <div className="flex flex-col gap-0.5 mb-2">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="font-display font-bold text-xl text-text-primary">
              {user.displayName}
            </h1>
            {user.isPrivate && (
              <Lock className="h-3.5 w-3.5 text-text-secondary shrink-0" aria-label="Private account" />
            )}
          </div>
          <p className="text-sm text-text-secondary">@{user.username}</p>
        </div>

        {/* Bio */}
        {user.bio && (
          <p className="text-sm text-text-primary leading-relaxed mb-3 whitespace-pre-line">
            {user.bio}
          </p>
        )}

        {/* Meta row */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-secondary mb-3">
          {user.createdAt && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Joined {formatMonthYear(user.createdAt)}
            </span>
          )}
        </div>

        {/* Stats */}
        <div className="flex items-center gap-5 mb-3">
          <StatItem count={user.postsCount} label="Posts" />
          <button className="hover:opacity-80 transition-opacity">
            <StatItem count={optimisticFollowers} label="Followers" />
          </button>
          <button className="hover:opacity-80 transition-opacity">
            <StatItem count={user.followingCount} label="Following" />
          </button>
        </div>

        {/* Own profile quick links */}
        {isOwnProfile && (
          <div className="flex flex-wrap gap-2 mb-2">
            <Link href="/settings">
              <Button variant="secondary" size="sm" className="gap-1.5 text-xs">
                <Settings className="h-3.5 w-3.5" />
                Settings
              </Button>
            </Link>
            <Link href="/settings/follow-requests">
              <Button variant="secondary" size="sm" className="gap-1.5 text-xs">
                <Bell className="h-3.5 w-3.5" />
                Follow requests
              </Button>
            </Link>
            <Link href="/albums">
              <Button variant="secondary" size="sm" className="gap-1.5 text-xs">
                <BookImage className="h-3.5 w-3.5" />
                Albums
              </Button>
            </Link>
          </div>
        )}

        {/* Private account notice */}
        {showPrivateLock && (
          <div className="mt-4 flex flex-col items-center gap-2 py-5 border border-border rounded-2xl bg-bg-card text-center">
            <Lock className="h-8 w-8 text-text-secondary" />
            <p className="text-sm font-medium text-text-primary">This account is private</p>
            <p className="text-xs text-text-secondary">Follow to see their photos and videos.</p>
          </div>
        )}
      </div>

      {/* Block dialog */}
      <Dialog open={showBlockDialog} onOpenChange={setShowBlockDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Block @{user.username}?</DialogTitle>
            <DialogDescription>
              They won&apos;t be able to see your profile or posts. You can unblock them from Account &amp; Privacy settings.
            </DialogDescription>
          </DialogHeader>
          {blockDone ? (
            <div className="px-5 pb-5 text-center">
              <p className="text-sm text-green-400 font-medium">@{user.username} has been blocked.</p>
            </div>
          ) : (
            <DialogFooter>
              <Button variant="secondary" onClick={() => setShowBlockDialog(false)}>Cancel</Button>
              <Button variant="destructive" loading={blockLoading} onClick={handleBlock}>
                Block
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* Report dialog */}
      <Dialog open={showReportDialog} onOpenChange={setShowReportDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Report @{user.username}?</DialogTitle>
            <DialogDescription>
              Your report is anonymous. We&apos;ll review it and take action if this account violates our guidelines.
            </DialogDescription>
          </DialogHeader>
          {reportDone ? (
            <div className="px-5 pb-5 text-center">
              <p className="text-sm text-green-400 font-medium">Report submitted. Thank you.</p>
            </div>
          ) : (
            <DialogFooter>
              <Button variant="secondary" onClick={() => setShowReportDialog(false)}>Cancel</Button>
              <Button variant="destructive" loading={reportLoading} onClick={handleReport}>
                Report
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatItem({ count, label }: { count: number; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <span className="font-display font-bold text-base text-text-primary">
        {formatCount(count)}
      </span>
      <span className="text-xs text-text-secondary">{label}</span>
    </div>
  );
}
