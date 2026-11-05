"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  ImageIcon, Video, Type, X, Loader2, AlertCircle, CheckCircle,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/lib/auth/AuthContext";
import { createStory } from "@/services/story.service";
import { uploadFile } from "@/services/upload.service";
import { MobileHeader } from "@/components/layout/MobileHeader";
import { VisibilitySelector } from "@/components/upload/VisibilitySelector";
import { Button } from "@/components/ui/Button";
import { cn } from "@/utils/cn";
import { LIMITS } from "@/lib/cloudinary/config";
import { formatFileSize } from "@/utils/format";
import type { PostVisibility } from "@/types";

type StoryType = "photo" | "video" | "text";

const TEXT_BACKGROUNDS = [
  { label: "Dark", bg: "#101114", color: "#F4F0E8" },
  { label: "Accent", bg: "#FF765E", color: "#FFFFFF" },
  { label: "Ocean", bg: "#1a3a5c", color: "#E8F4F8" },
  { label: "Forest", bg: "#1a3a2c", color: "#E8F8EC" },
  { label: "Blush", bg: "#3a1a2c", color: "#F8E8F0" },
  { label: "Warm", bg: "#3a2a1a", color: "#F8F0E8" },
];

export function StoryCreator() {
  const router = useRouter();
  const { user } = useAuth();

  const [storyType, setStoryType] = useState<StoryType>("photo");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [textContent, setTextContent] = useState("");
  const [selectedBg, setSelectedBg] = useState(TEXT_BACKGROUNDS[0]);
  const [visibility, setVisibility] = useState<PostVisibility>("followers");
  const [caption, setCaption] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((f: File) => {
    setError(null);
    const isVideo = f.type.startsWith("video/");
    const maxSize = isVideo ? LIMITS.video : LIMITS.image;
    const allowed = isVideo
      ? ["video/mp4", "video/quicktime", "video/webm"]
      : ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/heic"];

    if (!allowed.includes(f.type)) {
      setError("Unsupported file format.");
      return;
    }
    if (f.size > maxSize) {
      setError(`File too large. Max ${formatFileSize(maxSize)}.`);
      return;
    }

    setFile(f);
    setStoryType(isVideo ? "video" : "photo");
    const url = URL.createObjectURL(f);
    setPreview(url);
  }, []);

  async function handleShare() {
    if (!user) return;
    if (storyType !== "text" && !file) { setError("Please add a photo or video."); return; }
    if (storyType === "text" && !textContent.trim()) { setError("Please enter some text."); return; }

    setUploading(true);
    setError(null);
    setUploadProgress(0);

    try {
      // For media stories, upload separately so we can track progress
      if ((storyType === "photo" || storyType === "video") && file) {
        await uploadFile(file, {
          context: "story",
          isPrivate: visibility !== "public",
          onProgress: (pct) => setUploadProgress(pct),
        });
      }

      await createStory({
        authorUid: user.uid,
        authorUsername: user.username,
        authorPhotoUrl: user.profilePhotoUrl,
        type: storyType,
        visibility,
        file: file ?? undefined,
        textContent: storyType === "text" ? textContent : undefined,
        textStyle: storyType === "text"
          ? { color: selectedBg.color, fontSize: 32, fontFamily: "Manrope", background: selectedBg.bg }
          : undefined,
        caption: caption || undefined,
      });

      if (preview) URL.revokeObjectURL(preview);
      setDone(true);
      setTimeout(() => router.replace("/home"), 1500);
    } catch (err: unknown) {
      setError((err as Error).message ?? "Failed to post story.");
    } finally {
      setUploading(false);
    }
  }

  if (done) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 min-h-screen text-center px-4">
        <div className="h-16 w-16 rounded-full bg-green-500/10 border border-green-500/30 flex items-center justify-center">
          <CheckCircle className="h-8 w-8 text-green-400" />
        </div>
        <div>
          <p className="font-display font-semibold text-text-primary">Story shared!</p>
          <p className="text-sm text-text-secondary mt-1">Redirecting to your feed…</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <MobileHeader title="New Story" showBack />
      <div className="max-w-md mx-auto px-4 py-6 flex flex-col gap-5">

        {/* Type selector */}
        <div className="flex gap-2 p-1 bg-bg-secondary rounded-2xl">
          {(["photo", "video", "text"] as StoryType[]).map((t) => {
            const icons = { photo: ImageIcon, video: Video, text: Type };
            const Icon = icons[t];
            return (
              <button
                key={t}
                type="button"
                onClick={() => { setStoryType(t); setFile(null); setPreview(null); }}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-medium transition-all",
                  storyType === t
                    ? "bg-bg-card text-text-primary shadow-card"
                    : "text-text-muted hover:text-text-secondary"
                )}
              >
                <Icon className="h-4 w-4" />
                <span className="capitalize">{t}</span>
              </button>
            );
          })}
        </div>

        {/* Content area */}
        <AnimatePresence mode="wait">
          {storyType === "text" ? (
            <motion.div
              key="text"
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              className="flex flex-col gap-3"
            >
              {/* Text preview */}
              <div
                className="relative rounded-2xl flex items-center justify-center p-8 min-h-[280px]"
                style={{ background: selectedBg.bg }}
              >
                <p
                  className="text-center font-display font-bold leading-tight break-words w-full"
                  style={{ color: selectedBg.color, fontSize: 28 }}
                >
                  {textContent || (
                    <span style={{ opacity: 0.4, fontSize: 16, fontWeight: 400 }}>
                      What&apos;s on your mind?
                    </span>
                  )}
                </p>
              </div>

              {/* Text input */}
              <textarea
                value={textContent}
                onChange={(e) => setTextContent(e.target.value)}
                placeholder="Write something…"
                maxLength={200}
                rows={3}
                className="w-full bg-bg-secondary border border-border rounded-xl px-4 py-3 text-sm text-text-primary placeholder:text-text-muted resize-none focus:outline-none focus:ring-1 focus:ring-accent"
              />

              {/* Background colour picker */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-text-secondary shrink-0">Background:</span>
                <div className="flex gap-2 flex-wrap">
                  {TEXT_BACKGROUNDS.map((bg) => (
                    <button
                      key={bg.label}
                      type="button"
                      title={bg.label}
                      onClick={() => setSelectedBg(bg)}
                      className={cn(
                        "h-7 w-7 rounded-full transition-transform hover:scale-110",
                        selectedBg.bg === bg.bg && "ring-2 ring-accent ring-offset-2 ring-offset-bg-primary scale-110"
                      )}
                      style={{ background: bg.bg, border: "1px solid rgba(255,255,255,0.1)" }}
                      aria-label={bg.label}
                    />
                  ))}
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="media"
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              className="flex flex-col gap-3"
            >
              {preview ? (
                <div className="relative rounded-2xl overflow-hidden aspect-[9/16] max-h-96 bg-bg-secondary">
                  <Image src={preview} alt="Story preview" fill className="object-cover" sizes="400px" unoptimized />
                  <button
                    type="button"
                    onClick={() => { setFile(null); setPreview(null); }}
                    className="absolute top-2 right-2 h-8 w-8 rounded-full bg-bg-primary/80 flex items-center justify-center"
                    aria-label="Remove"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  className="flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-border hover:border-accent/50 aspect-[9/16] max-h-96 bg-bg-secondary transition-colors"
                >
                  {storyType === "photo"
                    ? <ImageIcon className="h-10 w-10 text-text-muted" />
                    : <Video className="h-10 w-10 text-text-muted" />}
                  <p className="text-sm text-text-secondary">
                    Tap to add a {storyType}
                  </p>
                </button>
              )}
              <input
                ref={inputRef}
                type="file"
                accept={storyType === "video"
                  ? "video/mp4,video/quicktime,video/webm"
                  : "image/jpeg,image/jpg,image/png,image/webp"}
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Caption (optional for media stories) */}
        {storyType !== "text" && (file || preview) && (
          <input
            type="text"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Add a caption… (optional)"
            maxLength={150}
            className="w-full bg-bg-secondary border border-border rounded-xl px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent"
          />
        )}

        {/* Visibility */}
        <div className="flex items-center gap-3">
          <span className="text-sm text-text-secondary">Audience:</span>
          <VisibilitySelector value={visibility} onChange={setVisibility} />
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/30">
            <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {/* Upload progress */}
        {uploading && (
          <div className="flex items-center gap-2.5">
            <Loader2 className="h-4 w-4 text-accent animate-spin shrink-0" />
            <div className="flex-1 h-1.5 bg-bg-secondary rounded-full overflow-hidden">
              <div className="h-full bg-accent rounded-full transition-all" style={{ width: `${uploadProgress}%` }} />
            </div>
            <span className="text-xs text-text-muted tabular-nums">{uploadProgress}%</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button
            variant="primary"
            className="flex-1"
            loading={uploading}
            onClick={handleShare}
          >
            Share story
          </Button>
        </div>
      </div>
    </>
  );
}
