"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft, Users, Trash2, Grid3x3, UserPlus,
  UserCheck, UserX, Search, CheckCircle, AlertCircle,
} from "lucide-react";
import { useAuth } from "@/lib/auth/AuthContext";
import {
  getAlbum, getAlbumMedia, deleteAlbum,
  inviteToAlbum, respondToAlbumInvite, getAlbumMembers,
} from "@/services/album.service";
import {
  collection, query, where, getDocs, limit, getDoc, doc,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { Avatar } from "@/components/ui/Avatar";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/Tabs";
import { buildImageUrl, buildVideoThumbnail } from "@/lib/cloudinary/config";
import { formatFullDate, formatRelativeTime } from "@/utils/format";
import type { Album, AlbumMember } from "@/types";

const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? "";

// ─── Pending invites for the logged-in user ───────────────────────────────────

interface PendingInvite {
  id: string;     // albumMembers doc id: `{albumId}_{uid}`
  albumId: string;
  albumTitle: string;
  inviterUid: string;
  inviterUsername: string;
  role: string;
}

async function loadPendingInvitesForUser(uid: string): Promise<PendingInvite[]> {
  if (!db) return [];
  const q = query(
    collection(db, "albumMembers"),
    where("uid", "==", uid),
    where("status", "==", "pending"),
    limit(20)
  );
  const snap = await getDocs(q);
  const invites: PendingInvite[] = [];
  for (const d of snap.docs) {
    const data = d.data();
    let albumTitle = "Album";
    let inviterUsername = "";
    try {
      const albumSnap = await getDoc(doc(db, "albums", data.albumId as string));
      if (albumSnap.exists()) albumTitle = (albumSnap.data().title as string) ?? "Album";
      const inviterSnap = await getDoc(doc(db, "users", data.invitedBy as string));
      if (inviterSnap.exists()) inviterUsername = (inviterSnap.data().username as string) ?? "";
    } catch { /* ignore */ }
    invites.push({
      id: d.id,
      albumId: data.albumId as string,
      albumTitle,
      inviterUid: data.invitedBy as string,
      inviterUsername,
      role: (data.role as string) ?? "viewer",
    });
  }
  return invites;
}

// ─── Member row ───────────────────────────────────────────────────────────────

interface MemberWithProfile extends AlbumMember {
  username: string;
  displayName: string;
  photoUrl: string;
}

async function loadMembersWithProfiles(albumId: string): Promise<MemberWithProfile[]> {
  if (!db) return [];
  const members = await getAlbumMembers(albumId);
  return Promise.all(members.map(async (m) => {
    let username = "";
    let displayName = "";
    let photoUrl = "";
    try {
      const snap = await getDoc(doc(db, "users", m.uid));
      if (snap.exists()) {
        username = (snap.data().username as string) ?? "";
        displayName = (snap.data().displayName as string) ?? "";
        photoUrl = (snap.data().profilePhotoUrl as string) ?? "";
      }
    } catch { /* ignore */ }
    return { ...m, username, displayName, photoUrl };
  }));
}

// ─── Invite search ────────────────────────────────────────────────────────────

interface UserSearchResult {
  uid: string;
  username: string;
  displayName: string;
  photoUrl: string;
}

async function searchUsers(term: string, excludeUids: string[]): Promise<UserSearchResult[]> {
  if (!db || term.trim().length < 2) return [];
  const q = query(
    collection(db, "users"),
    where("status", "==", "approved"),
    where("username", ">=", term.toLowerCase()),
    where("username", "<=", term.toLowerCase() + "\uf8ff"),
    limit(8)
  );
  const snap = await getDocs(q);
  return snap.docs
    .filter((d) => !excludeUids.includes(d.id))
    .map((d) => ({
      uid: d.id,
      username: (d.data().username as string) ?? "",
      displayName: (d.data().displayName as string) ?? "",
      photoUrl: (d.data().profilePhotoUrl as string) ?? "",
    }));
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AlbumDetailPage() {
  const { albumId } = useParams<{ albumId: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const [album, setAlbum] = useState<Album | null>(null);
  const [media, setMedia] = useState<Record<string, unknown>[]>([]);
  const [members, setMembers] = useState<MemberWithProfile[]>([]);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  // Invite dialog state
  const [inviteOpen, setInviteOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [inviteRole, setInviteRole] = useState<"contributor" | "viewer">("contributor");
  const [inviting, setInviting] = useState<string | null>(null);
  const [invitedUids, setInvitedUids] = useState<Set<string>>(new Set());

  // Respond to invite state
  const [respondingId, setRespondingId] = useState<string | null>(null);

  const isOwner = user?.uid === album?.ownerUid;
  const isMember = members.some((m) => m.uid === user?.uid);

  const load = useCallback(async () => {
    if (!albumId) return;
    const [a, m, mems] = await Promise.all([
      getAlbum(albumId),
      getAlbumMedia(albumId),
      loadMembersWithProfiles(albumId),
    ]);
    setAlbum(a);
    setMedia(m);
    setMembers(mems);
    setLoading(false);
  }, [albumId]);

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, [load]);

  // Load pending invites for current user
  useEffect(() => {
    if (!user) return;
    loadPendingInvitesForUser(user.uid)
      .then(setPendingInvites)
      .catch(() => {});
  }, [user]);

  // Search users as user types
  useEffect(() => {
    if (!searchTerm.trim() || searchTerm.length < 2) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      const existingUids = members.map((m) => m.uid);
      const results = await searchUsers(searchTerm, existingUids);
      setSearchResults(results);
      setSearching(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm, members]);

  async function handleDelete() {
    if (!album || !user || !isOwner) return;
    if (!confirm("Delete this album? Photos will not be deleted.")) return;
    setDeleting(true);
    await deleteAlbum(album.id, user.uid).catch(() => {});
    router.replace("/albums");
  }

  async function handleInvite(targetUid: string) {
    if (!user || !album) return;
    setInviting(targetUid);
    try {
      await inviteToAlbum(album.id, user.uid, targetUid, inviteRole);
      setInvitedUids((prev) => new Set(prev).add(targetUid));
    } catch { /* ignore */ } finally {
      setInviting(null);
    }
  }

  async function handleRespond(invite: PendingInvite, accept: boolean) {
    if (!user) return;
    setRespondingId(invite.id);
    try {
      await respondToAlbumInvite(invite.albumId, user.uid, accept);
      setPendingInvites((prev) => prev.filter((i) => i.id !== invite.id));
      if (accept) load(); // reload members
    } catch { /* ignore */ } finally {
      setRespondingId(null);
    }
  }

  // ─── Pending invites banner (shown at top of own album detail if applicable) ──
  const myPendingForThisAlbum = pendingInvites.filter((i) => i.albumId === albumId);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-6">
        <Skeleton className="h-8 w-48 mb-4" />
        <div className="grid grid-cols-3 gap-1">
          {Array.from({ length: 9 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square rounded-none" />
          ))}
        </div>
      </div>
    );
  }

  if (!album) {
    return (
      <EmptyState
        title="Album not found"
        description="This album doesn't exist or you don't have access."
      />
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-bg-primary/95 backdrop-blur-md border-b border-border px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="icon-sm" onClick={() => router.back()} aria-label="Back">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="font-display font-bold text-lg text-text-primary truncate">{album.title}</h1>
          <p className="text-xs text-text-secondary">
            {media.length} {media.length === 1 ? "item" : "items"} · {formatFullDate(album.createdAt)}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          {album.type === "collaborative" && (
            <Badge variant="default" className="hidden sm:flex gap-1">
              <Users className="h-3 w-3" /> Collab
            </Badge>
          )}
          {/* Invite button — owner of collaborative album only */}
          {isOwner && album.type === "collaborative" && (
            <Button
              variant="secondary"
              size="icon-sm"
              onClick={() => setInviteOpen(true)}
              aria-label="Invite members"
            >
              <UserPlus className="h-4 w-4" />
            </Button>
          )}
          {isOwner && (
            <Button
              variant="secondary"
              size="icon-sm"
              className="text-red-400 border-red-500/30 hover:bg-red-500/10"
              loading={deleting}
              onClick={handleDelete}
              aria-label="Delete album"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Pending invite banner for this album */}
      {myPendingForThisAlbum.map((invite) => (
        <div
          key={invite.id}
          className="mx-4 mt-3 flex items-center gap-3 px-4 py-3 bg-accent/10 border border-accent/30 rounded-2xl"
        >
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-text-primary">
              @{invite.inviterUsername} invited you as a {invite.role}
            </p>
          </div>
          <Button
            size="sm"
            variant="primary"
            loading={respondingId === invite.id}
            onClick={() => handleRespond(invite, true)}
            className="gap-1.5"
          >
            <UserCheck className="h-3.5 w-3.5" />
            Accept
          </Button>
          <Button
            size="sm"
            variant="secondary"
            loading={respondingId === invite.id}
            onClick={() => handleRespond(invite, false)}
            className="gap-1.5"
          >
            <UserX className="h-3.5 w-3.5" />
            Decline
          </Button>
        </div>
      ))}

      {/* Description */}
      {album.description && (
        <div className="px-4 py-3 border-b border-border">
          <p className="text-sm text-text-secondary">{album.description}</p>
        </div>
      )}

      {/* Tabs: Photos | Members (collaborative only) */}
      <div className="px-4 py-4">
        {album.type === "collaborative" ? (
          <Tabs defaultValue="photos">
            <TabsList>
              <TabsTrigger value="photos" className="flex-1">
                <Grid3x3 className="h-4 w-4 mr-1.5" />
                Photos
              </TabsTrigger>
              <TabsTrigger value="members" className="flex-1">
                <Users className="h-4 w-4 mr-1.5" />
                Members ({members.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="photos">
              <MediaGrid media={media} />
            </TabsContent>

            <TabsContent value="members">
              <MembersList
                members={members}
                isOwner={isOwner}
                onInvite={() => setInviteOpen(true)}
              />
            </TabsContent>
          </Tabs>
        ) : (
          <MediaGrid media={media} />
        )}
      </div>

      {/* Invite dialog */}
      <Dialog open={inviteOpen} onOpenChange={(open) => {
        setInviteOpen(open);
        if (!open) { setSearchTerm(""); setSearchResults([]); }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite to album</DialogTitle>
            <DialogDescription>
              Search for users to invite as contributors or viewers.
            </DialogDescription>
          </DialogHeader>

          <div className="px-5 pb-2 flex flex-col gap-4">
            {/* Role selector */}
            <div className="flex gap-2">
              {(["contributor", "viewer"] as const).map((role) => (
                <button
                  key={role}
                  type="button"
                  onClick={() => setInviteRole(role)}
                  className={`flex-1 py-2 rounded-xl border text-sm font-medium transition-colors ${
                    inviteRole === role
                      ? "bg-accent/10 border-accent text-accent"
                      : "border-border text-text-secondary hover:border-accent/50"
                  }`}
                >
                  {role.charAt(0).toUpperCase() + role.slice(1)}
                </button>
              ))}
            </div>

            {/* Search */}
            <Input
              placeholder="Search by username…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              leftIcon={<Search className="h-4 w-4" />}
              autoFocus
            />

            {/* Results */}
            <div className="flex flex-col gap-1 max-h-56 overflow-y-auto">
              {searching && (
                <p className="text-xs text-text-muted text-center py-3">Searching…</p>
              )}
              {!searching && searchTerm.length >= 2 && searchResults.length === 0 && (
                <p className="text-xs text-text-muted text-center py-3">No users found.</p>
              )}
              {searchResults.map((u) => {
                const alreadyInvited = invitedUids.has(u.uid);
                return (
                  <div
                    key={u.uid}
                    className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-bg-secondary transition-colors"
                  >
                    <Avatar src={u.photoUrl} fallback={u.displayName || u.username} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-text-primary truncate">
                        {u.displayName || u.username}
                      </p>
                      <p className="text-xs text-text-muted">@{u.username}</p>
                    </div>
                    {alreadyInvited ? (
                      <span className="flex items-center gap-1 text-xs text-green-400">
                        <CheckCircle className="h-3.5 w-3.5" />
                        Invited
                      </span>
                    ) : (
                      <Button
                        size="sm"
                        variant="primary"
                        loading={inviting === u.uid}
                        onClick={() => handleInvite(u.uid)}
                      >
                        Invite
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <DialogFooter>
            <Button variant="secondary" onClick={() => setInviteOpen(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function MediaGrid({ media }: { media: Record<string, unknown>[] }) {
  if (media.length === 0) {
    return (
      <EmptyState
        icon={Grid3x3}
        title="No photos yet"
        description="Add photos to this album from your posts or the upload page."
      />
    );
  }
  return (
    <div className="grid grid-cols-3 gap-0.5">
      {media.map((item) => {
        const publicId = (item.cloudinaryPublicId as string) ?? "";
        const isVideo = item.resourceType === "video";
        const url = publicId
          ? isVideo
            ? buildVideoThumbnail(publicId, CLOUD_NAME)
            : buildImageUrl(publicId, CLOUD_NAME, { width: 300 })
          : null;
        return (
          <div
            key={item.id as string}
            className="relative aspect-square bg-bg-secondary overflow-hidden group"
          >
            {url && (
              <Image
                src={url}
                alt=""
                fill
                className="object-cover group-hover:scale-105 transition-transform duration-300"
                sizes="(max-width: 640px) 33vw, 200px"
                loading="lazy"
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function MembersList({
  members,
  isOwner,
  onInvite,
}: {
  members: MemberWithProfile[];
  isOwner: boolean;
  onInvite: () => void;
}) {
  if (members.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="No members yet"
        description="Invite collaborators to contribute to this album."
        actionLabel={isOwner ? "Invite people" : undefined}
        onAction={isOwner ? onInvite : undefined}
      />
    );
  }

  return (
    <div className="bg-bg-card border border-border rounded-2xl overflow-hidden divide-y divide-border/50">
      {members.map((m) => (
        <div key={m.id} className="flex items-center gap-3 px-4 py-3.5">
          <Link href={`/@${m.username}`}>
            <Avatar src={m.photoUrl} fallback={m.displayName || m.username} size="sm" />
          </Link>
          <div className="flex-1 min-w-0">
            <Link href={`/@${m.username}`}>
              <p className="text-sm font-medium text-text-primary hover:text-accent transition-colors truncate">
                {m.displayName || m.username}
              </p>
            </Link>
            <p className="text-xs text-text-muted">@{m.username}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              m.role === "owner"
                ? "bg-accent/10 text-accent"
                : m.role === "contributor"
                ? "bg-blue-500/10 text-blue-400"
                : "bg-bg-secondary text-text-muted"
            }`}>
              {m.role}
            </span>
            {m.joinedAt && (
              <span className="text-xs text-text-muted hidden sm:block">
                Joined {formatRelativeTime(m.joinedAt)}
              </span>
            )}
          </div>
        </div>
      ))}
      {isOwner && (
        <button
          type="button"
          onClick={onInvite}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm text-accent hover:bg-bg-secondary transition-colors"
        >
          <UserPlus className="h-4 w-4" />
          Invite more people
        </button>
      )}
    </div>
  );
}
