"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/lib/auth/AuthContext";
import { getUserByUsername, getUserDoc } from "@/services/auth.service";
import { subscribeToMyAlbums } from "@/services/album.service";
import {
  collection, query, where, orderBy, limit, getDocs, getDoc, doc,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { ProfileHeader } from "./ProfileHeader";
import { ProfileGrid } from "./ProfileGrid";
import { ProfileSkeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { MobileHeader } from "@/components/layout/MobileHeader";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/Tabs";
import { Grid3x3, Video, BookImage, Tag, Lock } from "lucide-react";
import { buildImageUrl, buildVideoThumbnail } from "@/lib/cloudinary/config";
import { formatRelativeTime } from "@/utils/format";
import { getSignedDeliveryUrl } from "@/services/upload.service";
import { platformRequest } from "@/services/platform.service";
import type { User, Album, Post } from "@/types";

const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? "";

interface Props {
  username: string;
}

export function ProfilePage({ username }: Props) {
  const { user: currentUser, isApproved } = useAuth();
  const [profileUser, setProfileUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const isOwnProfile = currentUser?.username === username.toLowerCase();

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setNotFound(false);
      try {
        const ref = await getUserByUsername(username);
        if (!ref) {
          if (!cancelled) setNotFound(true);
          return;
        }
        const doc = await getUserDoc(ref.uid);
        if (!doc) {
          if (!cancelled) setNotFound(true);
          return;
        }
        if (!cancelled) {
          setProfileUser({
            uid: doc.uid as string,
            email: (doc.email as string) ?? "",
            displayName: (doc.displayName as string) ?? "",
            username: (doc.username as string) ?? username,
            bio: (doc.bio as string) ?? "",
            profilePhotoUrl: (doc.profilePhotoUrl as string) ?? "",
            profilePhotoPublicId: (doc.profilePhotoPublicId as string) ?? "",
            coverPhotoUrl: (doc.coverPhotoUrl as string) ?? "",
            coverPhotoPublicId: (doc.coverPhotoPublicId as string) ?? "",
            status: (doc.status as User["status"]) ?? "approved",
            isPrivate: (doc.isPrivate as boolean) ?? false,
            isEmailVerified: (doc.isEmailVerified as boolean) ?? false,
            storageProvider: (doc.storageProvider as User["storageProvider"]) ?? "central",
            followersCount: (doc.followersCount as number) ?? 0,
            followingCount: (doc.followingCount as number) ?? 0,
            postsCount: (doc.postsCount as number) ?? 0,
            theme: (doc.theme as string) ?? "default",
            onboardingComplete: (doc.onboardingComplete as boolean) ?? false,
            createdAt: doc.createdAt instanceof Date ? doc.createdAt : new Date(),
            updatedAt: doc.updatedAt instanceof Date ? doc.updatedAt : new Date(),
            approvedAt: null,
          });
        }
      } catch {
        if (!cancelled) setNotFound(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [username]);

  if (loading) {
    return (
      <>
        <MobileHeader title={`@${username}`} showBack />
        <div className="max-w-3xl mx-auto px-4 py-4">
          <ProfileSkeleton />
        </div>
      </>
    );
  }

  if (notFound || !profileUser) {
    return (
      <>
        <MobileHeader title="Profile" showBack />
        <EmptyState
          title="User not found"
          description={`@${username} doesn't exist or their account is private.`}
        />
      </>
    );
  }

  return (
    <>
      <MobileHeader title={`@${profileUser.username}`} showBack />
      <div className="max-w-3xl mx-auto">
        <ProfileHeader
          user={profileUser}
          isOwnProfile={isOwnProfile}
          currentUid={currentUser?.uid}
          isApproved={isApproved}
        />

        {/* Tabs */}
        <div className="px-4 mt-2">
          <Tabs defaultValue="photos">
            <TabsList className="w-full">
              <TabsTrigger value="photos" className="flex-1 gap-1.5">
                <Grid3x3 className="h-4 w-4" />
                <span className="hidden sm:inline">Photos</span>
              </TabsTrigger>
              <TabsTrigger value="videos" className="flex-1 gap-1.5">
                <Video className="h-4 w-4" />
                <span className="hidden sm:inline">Videos</span>
              </TabsTrigger>
              <TabsTrigger value="albums" className="flex-1 gap-1.5">
                <BookImage className="h-4 w-4" />
                <span className="hidden sm:inline">Albums</span>
              </TabsTrigger>
              <TabsTrigger value="tagged" className="flex-1 gap-1.5">
                <Tag className="h-4 w-4" />
                <span className="hidden sm:inline">Tagged</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="photos">
              <ProfileGrid
                uid={profileUser.uid}
                type="photo"
                isPrivate={profileUser.isPrivate}
                isOwnProfile={isOwnProfile}
              />
            </TabsContent>
            <TabsContent value="videos">
              <ProfileGrid
                uid={profileUser.uid}
                type="video"
                isPrivate={profileUser.isPrivate}
                isOwnProfile={isOwnProfile}
              />
            </TabsContent>
            <TabsContent value="albums">
              <ProfileAlbumsTab uid={profileUser.uid} isOwnProfile={isOwnProfile} />
            </TabsContent>
            <TabsContent value="tagged">
              <ProfileTaggedTab uid={profileUser.uid} username={profileUser.username} isPrivate={profileUser.isPrivate} isOwnProfile={isOwnProfile} />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </>
  );
}

// ─── Albums tab ───────────────────────────────────────────────────────────────

function ProfileAlbumsTab({ uid, isOwnProfile }: { uid: string; isOwnProfile: boolean }) {
  const [albums, setAlbums] = useState<Album[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!db) { setLoading(false); return; }
    const unsub = subscribeToMyAlbums(uid, (a) => {
      setAlbums(a);
      setLoading(false);
    });
    return unsub;
  }, [uid]);

  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-3 mt-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="aspect-square rounded-2xl" />
        ))}
      </div>
    );
  }

  if (albums.length === 0) {
    return (
      <EmptyState
        icon={BookImage}
        title="No albums yet"
        description={isOwnProfile
          ? "Create your first album to organise your photos."
          : "No albums to show."}
        actionLabel={isOwnProfile ? "Go to Albums" : undefined}
        onAction={isOwnProfile ? () => { window.location.href = "/albums"; } : undefined}
      />
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 mt-2">
      {albums.map((album) => (
        <Link key={album.id} href={`/albums/${album.id}`} className="group block">
          <div className="relative aspect-square rounded-2xl overflow-hidden bg-bg-secondary border border-border hover:border-accent/50 transition-colors">
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-bg-secondary to-bg-card group-hover:scale-105 transition-transform duration-300">
              <BookImage className="h-10 w-10 text-text-muted" />
            </div>
            <div className="absolute inset-0 bg-gradient-to-t from-bg-primary/80 via-transparent to-transparent" />
            <div className="absolute top-2 left-2 flex gap-1">
              {album.visibility === "private" && (
                <span className="bg-bg-primary/70 rounded-full p-1">
                  <Lock className="h-2.5 w-2.5 text-text-secondary" />
                </span>
              )}
            </div>
            <div className="absolute bottom-0 left-0 right-0 p-3">
              <p className="font-display font-semibold text-sm text-text-primary leading-tight line-clamp-2">
                {album.title}
              </p>
              <p className="text-[10px] text-text-secondary mt-0.5">
                {album.mediaCount} {album.mediaCount === 1 ? "photo" : "photos"} · {formatRelativeTime(album.updatedAt)}
              </p>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}

// ─── Tagged tab ───────────────────────────────────────────────────────────────

interface TaggedPost {
  id: string;
  authorUsername: string;
  mediaUrl: string | null;
}

function ProfileTaggedTab({
  uid,
  username,
  isPrivate,
  isOwnProfile,
}: {
  uid: string;
  username: string;
  isPrivate: boolean;
  isOwnProfile: boolean;
}) {
  const [posts, setPosts] = useState<TaggedPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!db) { setLoading(false); return; }

    async function load() {
      if (!db) return;
      try {
        const page = await platformRequest<{ posts: Post[] }>("posts", { mention: username.toLowerCase(), pageSize: 24 });
        const results: TaggedPost[] = await Promise.all(
          page.posts.map(async (data) => {
            const coverMediaId = data.coverMediaId as string | undefined;
            let mediaUrl: string | null = null;
            if (coverMediaId) mediaUrl = await getSignedDeliveryUrl(coverMediaId, true).catch(() => null);
            return {
              id: data.id,
              authorUsername: (data.authorUsername as string) ?? "",
              mediaUrl,
            };
          })
        );
        setPosts(results);
      } catch {
        setPosts([]);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [uid, username, isPrivate, isOwnProfile]);

  if (loading) {
    return (
      <div className="grid grid-cols-3 gap-0.5 mt-0.5">
        {Array.from({ length: 9 }).map((_, i) => (
          <Skeleton key={i} className="aspect-square rounded-none" />
        ))}
      </div>
    );
  }


  if (posts.length === 0) {
    return (
      <EmptyState
        icon={Tag}
        title="No tagged photos"
        description={isOwnProfile
          ? "When someone mentions @" + username + " in a post, it will appear here."
          : "No tagged photos to show."}
      />
    );
  }

  return (
    <div className="grid grid-cols-3 gap-0.5 mt-0.5">
      {posts.map((post) => (
        <Link
          key={post.id}
          href={`/post/${post.id}`}
          className="relative aspect-square bg-bg-secondary overflow-hidden group hover:opacity-90 transition-opacity"
        >
          {post.mediaUrl ? (
            <Image
              unoptimized
              src={post.mediaUrl}
              alt="Tagged post"
              fill
              className="object-cover"
              sizes="(max-width: 768px) 33vw, 200px"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-bg-secondary to-bg-card">
              <Tag className="h-6 w-6 text-text-muted" />
            </div>
          )}
          <div className="absolute inset-0 bg-bg-primary/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <span className="text-xs font-medium text-white">@{post.authorUsername}</span>
          </div>
        </Link>
      ))}
    </div>
  );
}
