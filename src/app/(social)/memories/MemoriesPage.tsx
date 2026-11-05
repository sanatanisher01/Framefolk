"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  collection, query, where, orderBy, limit,
  getDocs, doc, getDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useAuth } from "@/lib/auth/AuthContext";
import { MobileHeader } from "@/components/layout/MobileHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/Tabs";
import { buildImageUrl, buildVideoThumbnail } from "@/lib/cloudinary/config";
import { Clock, CalendarDays, Calendar, Sparkles, Play } from "lucide-react";
import type { Post, Media } from "@/types";

const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? "";

interface PostWithThumb {
  post: Post;
  thumbUrl: string;
  isVideo: boolean;
}

interface DayGroup { label: string; date: Date; posts: PostWithThumb[] }
interface MonthGroup { label: string; year: number; month: number; posts: PostWithThumb[] }
interface YearGroup { label: string; year: number; posts: PostWithThumb[] }

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────

async function fetchThumb(post: Post): Promise<string> {
  if (!db || !post.coverMediaId) return "";
  try {
    const snap = await getDoc(doc(db, "media", post.coverMediaId));
    if (!snap.exists()) return "";
    const m = snap.data() as Partial<Media>;
    const pid = m.cloudinaryPublicId ?? "";
    return m.resourceType === "video"
      ? buildVideoThumbnail(pid, CLOUD_NAME)
      : buildImageUrl(pid, CLOUD_NAME, { width: 300 });
  } catch { return ""; }
}

async function loadMyPosts(uid: string, pageSize = 200): Promise<PostWithThumb[]> {
  if (!db) return [];
  const q = query(
    collection(db, "posts"),
    where("authorUid", "==", uid),
    where("isHidden", "==", false),
    orderBy("createdAt", "desc"),
    limit(pageSize)
  );
  const snap = await getDocs(q);
  const posts: Post[] = snap.docs.map((d) => ({
    id: d.id,
    ...d.data(),
    createdAt: d.data().createdAt?.toDate?.() ?? new Date(),
    updatedAt: d.data().updatedAt?.toDate?.() ?? new Date(),
  } as Post));

  return Promise.all(posts.map(async (post) => ({
    post,
    thumbUrl: await fetchThumb(post),
    isVideo: post.type === "video",
  })));
}

function groupByDay(items: PostWithThumb[]): DayGroup[] {
  const map = new Map<string, DayGroup>();
  for (const item of items) {
    const d = item.post.createdAt instanceof Date ? item.post.createdAt : new Date();
    const label = d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
    const key = d.toISOString().slice(0, 10);
    if (!map.has(key)) map.set(key, { label, date: d, posts: [] });
    map.get(key)!.posts.push(item);
  }
  return Array.from(map.values());
}

function groupByMonth(items: PostWithThumb[]): MonthGroup[] {
  const map = new Map<string, MonthGroup>();
  for (const item of items) {
    const d = item.post.createdAt instanceof Date ? item.post.createdAt : new Date();
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    const label = d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    if (!map.has(key)) map.set(key, { label, year: d.getFullYear(), month: d.getMonth(), posts: [] });
    map.get(key)!.posts.push(item);
  }
  return Array.from(map.values());
}

function groupByYear(items: PostWithThumb[]): YearGroup[] {
  const map = new Map<number, YearGroup>();
  for (const item of items) {
    const d = item.post.createdAt instanceof Date ? item.post.createdAt : new Date();
    const yr = d.getFullYear();
    if (!map.has(yr)) map.set(yr, { label: String(yr), year: yr, posts: [] });
    map.get(yr)!.posts.push(item);
  }
  return Array.from(map.values()).sort((a, b) => b.year - a.year);
}

// ─────────────────────────────────────────────────────────────────
// Thumb cell
// ─────────────────────────────────────────────────────────────────

function ThumbCell({ item }: { item: PostWithThumb }) {
  return (
    <Link
      href={`/@${item.post.authorUsername}`}
      className="relative aspect-square bg-bg-secondary overflow-hidden rounded-lg group block"
    >
      {item.thumbUrl ? (
        <Image
          src={item.thumbUrl}
          alt={item.post.caption?.slice(0, 40) || "Memory"}
          fill
          className="object-cover group-hover:scale-105 transition-transform duration-300"
          sizes="(max-width: 640px) 30vw, 150px"
          loading="lazy"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-bg-card">
          <Clock className="h-5 w-5 text-text-muted" />
        </div>
      )}
      {item.isVideo && (
        <div className="absolute top-1 right-1 bg-bg-primary/70 rounded p-0.5">
          <Play className="h-2.5 w-2.5 text-white fill-white" />
        </div>
      )}
      {/* Hover overlay */}
      <div className="absolute inset-0 bg-bg-primary/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
        <span className="text-[10px] text-white font-medium text-center px-1 line-clamp-2">
          {item.post.caption?.slice(0, 30) || "View"}
        </span>
      </div>
    </Link>
  );
}

// ─────────────────────────────────────────────────────────────────
// Day view
// ─────────────────────────────────────────────────────────────────

function DayView({ groups }: { groups: DayGroup[] }) {
  if (groups.length === 0) return (
    <EmptyState icon={CalendarDays} title="No memories yet" description="Your day-by-day visual diary will appear here." />
  );
  return (
    <div className="flex flex-col gap-8">
      {groups.map((g, gi) => (
        <motion.div
          key={g.label}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: gi * 0.05 }}
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="h-8 w-8 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center shrink-0">
              <CalendarDays className="h-4 w-4 text-accent" />
            </div>
            <p className="font-display font-semibold text-sm text-text-primary">{g.label}</p>
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-text-muted">{g.posts.length} {g.posts.length === 1 ? "post" : "posts"}</span>
          </div>
          <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5">
            {g.posts.map((item) => <ThumbCell key={item.post.id} item={item} />)}
          </div>
        </motion.div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Month view
// ─────────────────────────────────────────────────────────────────

function MonthView({ groups }: { groups: MonthGroup[] }) {
  if (groups.length === 0) return (
    <EmptyState icon={Calendar} title="No memories yet" description="Your monthly visual diary will appear here." />
  );
  return (
    <div className="flex flex-col gap-10">
      {groups.map((g, gi) => (
        <motion.div
          key={`${g.year}-${g.month}`}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: gi * 0.05 }}
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="flex flex-col items-center justify-center h-10 w-10 rounded-xl bg-bg-card border border-border shrink-0">
              <span className="text-[10px] font-medium text-text-secondary leading-none">
                {new Date(g.year, g.month).toLocaleDateString("en-US", { month: "short" }).toUpperCase()}
              </span>
              <span className="text-xs font-bold text-text-primary leading-none mt-0.5">{g.year}</span>
            </div>
            <h2 className="font-display font-bold text-lg text-text-primary">{g.label}</h2>
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-text-muted">{g.posts.length} posts</span>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-1.5">
            {g.posts.slice(0, 12).map((item) => <ThumbCell key={item.post.id} item={item} />)}
          </div>
          {g.posts.length > 12 && (
            <p className="text-xs text-text-muted mt-2 text-right">+{g.posts.length - 12} more</p>
          )}
        </motion.div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Year view
// ─────────────────────────────────────────────────────────────────

function YearView({ groups }: { groups: YearGroup[] }) {
  if (groups.length === 0) return (
    <EmptyState icon={Sparkles} title="No memories yet" description="Your yearly recap will appear here." />
  );
  return (
    <div className="flex flex-col gap-12">
      {groups.map((g, gi) => (
        <motion.div
          key={g.year}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: gi * 0.07 }}
        >
          {/* Year header */}
          <div className="relative mb-5">
            <div className="absolute inset-0 flex items-center">
              <div className="flex-1 h-px bg-border" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-bg-primary px-4 font-display font-bold text-3xl text-accent">{g.year}</span>
            </div>
          </div>

          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-text-secondary">{g.posts.length} memories this year</p>
          </div>

          {/* Featured 3 + grid */}
          <div className="grid grid-cols-2 gap-2 mb-2">
            {/* Hero shot */}
            {g.posts[0] && (
              <div className="row-span-2 relative rounded-2xl overflow-hidden aspect-[2/3] bg-bg-secondary group">
                {g.posts[0].thumbUrl ? (
                  <Image src={g.posts[0].thumbUrl} alt="Year memory" fill className="object-cover group-hover:scale-105 transition-transform duration-500" sizes="200px" loading="lazy" />
                ) : <div className="w-full h-full bg-bg-card flex items-center justify-center"><Sparkles className="h-8 w-8 text-text-muted" /></div>}
              </div>
            )}
            {/* Two smaller */}
            {g.posts.slice(1, 3).map((item) => (
              <div key={item.post.id} className="relative rounded-xl overflow-hidden aspect-square bg-bg-secondary group">
                {item.thumbUrl ? (
                  <Image src={item.thumbUrl} alt="Memory" fill className="object-cover group-hover:scale-105 transition-transform duration-300" sizes="150px" loading="lazy" />
                ) : <div className="w-full h-full bg-bg-card" />}
              </div>
            ))}
          </div>

          {/* Thumbnail strip */}
          {g.posts.length > 3 && (
            <div className="grid grid-cols-5 sm:grid-cols-8 gap-1 mt-1">
              {g.posts.slice(3, 11).map((item) => (
                <div key={item.post.id} className="relative aspect-square bg-bg-secondary rounded-lg overflow-hidden group">
                  {item.thumbUrl ? (
                    <Image src={item.thumbUrl} alt="" fill className="object-cover" sizes="80px" loading="lazy" />
                  ) : <div className="w-full h-full bg-bg-card" />}
                </div>
              ))}
              {g.posts.length > 11 && (
                <div className="aspect-square bg-bg-card border border-border rounded-lg flex items-center justify-center">
                  <span className="text-xs font-medium text-text-muted">+{g.posts.length - 11}</span>
                </div>
              )}
            </div>
          )}
        </motion.div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────

export function MemoriesPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<PostWithThumb[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    loadMyPosts(user.uid)
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [user]);

  const dayGroups = groupByDay(items);
  const monthGroups = groupByMonth(items);
  const yearGroups = groupByYear(items);

  return (
    <>
      <MobileHeader title="Memories" showBack={false} />
      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6 hidden lg:block">
          <h1 className="font-display font-bold text-3xl text-text-primary">Memories</h1>
          <p className="text-text-secondary text-sm mt-1">
            {items.length} {items.length === 1 ? "memory" : "memories"} · Every frame has a story.
          </p>
        </div>

        {loading ? (
          <div className="flex flex-col gap-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i}>
                <Skeleton className="h-5 w-48 mb-3" />
                <div className="grid grid-cols-4 gap-1.5">
                  {Array.from({ length: 8 }).map((_, j) => (
                    <Skeleton key={j} className="aspect-square rounded-lg" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <Tabs defaultValue="day">
            <TabsList className="w-full mb-6">
              <TabsTrigger value="day" className="flex-1 gap-1.5">
                <CalendarDays className="h-4 w-4" />
                <span className="hidden sm:inline">Day</span>
              </TabsTrigger>
              <TabsTrigger value="month" className="flex-1 gap-1.5">
                <Calendar className="h-4 w-4" />
                <span className="hidden sm:inline">Month</span>
              </TabsTrigger>
              <TabsTrigger value="year" className="flex-1 gap-1.5">
                <Sparkles className="h-4 w-4" />
                <span className="hidden sm:inline">Year</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="day">
              <DayView groups={dayGroups} />
            </TabsContent>
            <TabsContent value="month">
              <MonthView groups={monthGroups} />
            </TabsContent>
            <TabsContent value="year">
              <YearView groups={yearGroups} />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </>
  );
}
