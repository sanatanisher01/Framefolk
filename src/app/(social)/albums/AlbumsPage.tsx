"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Plus, BookImage, Users, Lock, UserCheck, UserX } from "lucide-react";
import { motion } from "framer-motion";
import { useAuth } from "@/lib/auth/AuthContext";
import { subscribeToMyAlbums, createAlbum, respondToAlbumInvite } from "@/services/album.service";
import {
  collection, query, where, getDocs, limit, getDoc, doc,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { MobileHeader } from "@/components/layout/MobileHeader";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/Dialog";
import { VisibilitySelector } from "@/components/upload/VisibilitySelector";
import { formatRelativeTime } from "@/utils/format";
import type { Album, PostVisibility } from "@/types";

interface PendingInvite {
  id: string;
  albumId: string;
  albumTitle: string;
  inviterUsername: string;
  role: string;
}

const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? "";
void CLOUD_NAME; // may be used later for cover thumbnails

export function AlbumsPage() {
  const { user } = useAuth();
  const [albums, setAlbums] = useState<Album[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newType, setNewType] = useState<"personal" | "collaborative">("personal");
  const [newVisibility, setNewVisibility] = useState<PostVisibility>("followers");

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    const unsub = subscribeToMyAlbums(user.uid, (a) => {
      setAlbums(a);
      setLoading(false);
    });
    return unsub;
  }, [user]);

  // Load pending album invites for this user
  useEffect(() => {
    if (!user || !db) return;
    const q = query(
      collection(db, "albumMembers"),
      where("uid", "==", user.uid),
      where("status", "==", "pending"),
      limit(20)
    );
    getDocs(q).then(async (snap) => {
      const invites: PendingInvite[] = [];
      for (const d of snap.docs) {
        const data = d.data();
        let albumTitle = "Album";
        let inviterUsername = "";
        try {
          const albumSnap = await getDoc(doc(db!, "albums", data.albumId as string));
          if (albumSnap.exists()) albumTitle = (albumSnap.data().title as string) ?? "Album";
          const inviterSnap = await getDoc(doc(db!, "users", data.invitedBy as string));
          if (inviterSnap.exists()) inviterUsername = (inviterSnap.data().username as string) ?? "";
        } catch { /* ignore */ }
        invites.push({ id: d.id, albumId: data.albumId as string, albumTitle, inviterUsername, role: (data.role as string) ?? "viewer" });
      }
      setPendingInvites(invites);
    }).catch(() => {});
  }, [user]);

  async function handleRespond(invite: PendingInvite, accept: boolean) {
    if (!user) return;
    setRespondingId(invite.id);
    try {
      await respondToAlbumInvite(invite.albumId, user.uid, accept);
      setPendingInvites((prev) => prev.filter((i) => i.id !== invite.id));
    } catch { /* ignore */ } finally {
      setRespondingId(null);
    }
  }

  async function handleCreate() {
    if (!user || !newTitle.trim()) return;
    setCreating(true);
    try {
      await createAlbum({
        ownerUid: user.uid,
        title: newTitle.trim(),
        description: newDesc.trim(),
        type: newType,
        visibility: newVisibility,
      });
      setCreateOpen(false);
      setNewTitle("");
      setNewDesc("");
    } catch { /* ignore */ }
    finally { setCreating(false); }
  }

  return (
    <>
      <MobileHeader title="Albums" showBack={false} />
      <div className="max-w-4xl mx-auto px-4 py-6">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="font-display font-bold text-2xl text-text-primary hidden lg:block">Albums</h1>
          <Button
            variant="primary"
            size="sm"
            className="gap-1.5 ml-auto"
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="h-4 w-4" />
            New Album
          </Button>
        </div>

        {/* Pending invites */}
        {pendingInvites.length > 0 && (
          <div className="flex flex-col gap-2 mb-4">
            <p className="text-xs font-medium text-text-muted uppercase tracking-wider px-1">
              Album invitations
            </p>
            <div className="bg-bg-card border border-border rounded-2xl overflow-hidden divide-y divide-border/50">
              {pendingInvites.map((invite) => (
                <div key={invite.id} className="flex items-center gap-3 px-4 py-3.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text-primary truncate">
                      {invite.albumTitle}
                    </p>
                    <p className="text-xs text-text-muted">
                      @{invite.inviterUsername} · {invite.role}
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
            </div>
          </div>
        )}

        {/* Grid */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="aspect-square rounded-2xl" />
            ))}
          </div>
        ) : albums.length === 0 ? (
          <EmptyState
            icon={BookImage}
            title="No albums yet"
            description="Create your first album to organise your photos and memories."
            actionLabel="Create album"
            onAction={() => setCreateOpen(true)}
          />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {albums.map((album, i) => (
              <motion.div
                key={album.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: i * 0.04 }}
              >
                <Link href={`/albums/${album.id}`} className="group block">
                  <div className="relative aspect-square rounded-2xl overflow-hidden bg-bg-secondary">
                    {/* Cover photo placeholder */}
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-bg-secondary to-bg-card group-hover:scale-105 transition-transform duration-300">
                      <BookImage className="h-12 w-12 text-text-muted" />
                    </div>

                    {/* Gradient overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-bg-primary/80 via-transparent to-transparent" />

                    {/* Meta badges */}
                    <div className="absolute top-2 left-2 flex gap-1">
                      {album.type === "collaborative" && (
                        <span className="bg-bg-primary/70 rounded-full px-2 py-0.5 flex items-center gap-1">
                          <Users className="h-2.5 w-2.5 text-accent" />
                          <span className="text-[10px] text-accent font-medium">Collab</span>
                        </span>
                      )}
                      {album.visibility === "private" && (
                        <span className="bg-bg-primary/70 rounded-full p-1">
                          <Lock className="h-2.5 w-2.5 text-text-secondary" />
                        </span>
                      )}
                    </div>

                    {/* Title at bottom */}
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
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Create album dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Album</DialogTitle>
          </DialogHeader>
          <div className="px-5 pb-0 flex flex-col gap-4">
            <Input
              label="Album name"
              placeholder="My album…"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              autoFocus
            />
            <Textarea
              label="Description (optional)"
              placeholder="What's this album about?"
              maxLength={200}
              showCount
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
            />

            {/* Type */}
            <div className="flex gap-2">
              {(["personal", "collaborative"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setNewType(t)}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-medium transition-colors ${
                    newType === t
                      ? "bg-accent/10 border-accent text-accent"
                      : "border-border text-text-secondary hover:border-accent/50"
                  }`}
                >
                  {t === "personal" ? <BookImage className="h-4 w-4" /> : <Users className="h-4 w-4" />}
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-3">
              <span className="text-sm text-text-secondary">Visibility:</span>
              <VisibilitySelector value={newVisibility} onChange={setNewVisibility} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button
              variant="primary"
              loading={creating}
              disabled={!newTitle.trim()}
              onClick={handleCreate}
            >
              Create album
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
