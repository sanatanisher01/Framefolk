"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, Play, Volume2, VolumeX } from "lucide-react";
import { cn } from "@/utils/cn";
import { useMediaDelivery } from "@/hooks/useMediaDelivery";
import type { Media } from "@/types";

interface Props {
  mediaItems: Partial<Media>[];
  className?: string;
}

export function PostMedia({ mediaItems, className }: Props) {
  const [index, setIndex] = useState(0);
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? "";

  if (mediaItems.length === 0) return null;

  const current = mediaItems[Math.min(index, mediaItems.length - 1)];
  const isVideo = current?.resourceType === "video";

  return (
    <div className={cn("relative bg-bg-secondary overflow-hidden", className)}>
      {isVideo ? (
        <VideoPlayer item={current ?? {}} cloudName={cloudName} />
      ) : (
        <ImageItem item={current ?? {}} cloudName={cloudName} />
      )}

      {/* Multi navigation */}
      {mediaItems.length > 1 && (
        <>
          {index > 0 && (
            <button
              type="button"
              onClick={() => setIndex((i) => i - 1)}
              className="absolute left-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-bg-primary/70 flex items-center justify-center hover:bg-bg-primary transition-colors z-10"
              aria-label="Previous"
            >
              <ChevronLeft className="h-4 w-4 text-text-primary" />
            </button>
          )}
          {index < mediaItems.length - 1 && (
            <button
              type="button"
              onClick={() => setIndex((i) => i + 1)}
              className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-bg-primary/70 flex items-center justify-center hover:bg-bg-primary transition-colors z-10"
              aria-label="Next"
            >
              <ChevronRight className="h-4 w-4 text-text-primary" />
            </button>
          )}
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1 z-10">
            {mediaItems.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setIndex(i)}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  i === index ? "w-4 bg-white" : "w-1.5 bg-white/50"
                )}
                aria-label={`Media ${i + 1}`}
              />
            ))}
          </div>
          <span className="absolute top-2 right-2 bg-bg-primary/70 text-text-primary text-xs px-2 py-0.5 rounded-full font-medium z-10">
            {index + 1}/{mediaItems.length}
          </span>
        </>
      )}
    </div>
  );
}

function ImageItem({ item, cloudName }: { item: Partial<Media>; cloudName: string }) {
  const url = useMediaDelivery(item.id);
  if (!url) {
    return (
      <div className="aspect-square bg-bg-secondary flex items-center justify-center">
        <span className="text-text-muted text-sm">No preview</span>
      </div>
    );
  }

  return (
    <div className="relative w-full" style={{ aspectRatio: getAspectRatio(item) }}>
      <Image
        unoptimized
        src={url}
        alt="Post image"
        fill
        className="object-cover"
        sizes="(max-width: 640px) 100vw, 600px"
        loading="lazy"
      />
    </div>
  );
}

function VideoPlayer({ item, cloudName }: { item: Partial<Media>; cloudName: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);

  const videoUrl = useMediaDelivery(item.id);
  const posterUrl = useMediaDelivery(item.id, true);

  function togglePlay() {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play().then(() => setPlaying(true)).catch(() => {});
    } else {
      v.pause();
      setPlaying(false);
    }
  }

  function toggleMute() {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
  }

  if (!videoUrl) {
    return (
      <div className="aspect-video bg-bg-secondary flex items-center justify-center">
        <span className="text-text-muted text-sm">Video unavailable</span>
      </div>
    );
  }

  return (
    <div
      className="relative w-full cursor-pointer group"
      style={{ aspectRatio: getAspectRatio(item) }}
      onClick={togglePlay}
    >
      <video
        ref={videoRef}
        src={videoUrl}
        poster={posterUrl}
        muted={muted}
        playsInline
        preload="metadata"
        loop
        className="w-full h-full object-cover"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
      />

      {/* Play/pause overlay */}
      {!playing && (
        <div className="absolute inset-0 flex items-center justify-center bg-bg-primary/20">
          <div className="h-14 w-14 rounded-full bg-bg-primary/80 flex items-center justify-center shadow-lg">
            <Play className="h-6 w-6 text-white fill-white ml-1" />
          </div>
        </div>
      )}

      {/* Controls bar */}
      <div className="absolute bottom-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); toggleMute(); }}
          className="h-8 w-8 rounded-full bg-bg-primary/80 flex items-center justify-center hover:bg-bg-primary transition-colors"
          aria-label={muted ? "Unmute" : "Mute"}
        >
          {muted
            ? <VolumeX className="h-4 w-4 text-white" />
            : <Volume2 className="h-4 w-4 text-white" />
          }
        </button>
      </div>
    </div>
  );
}

function getAspectRatio(item?: Partial<Media>): string {
  if (!item?.width || !item?.height) return "1 / 1";
  const ratio = item.width / item.height;
  const clamped = Math.max(0.8, Math.min(ratio, 1.91));
  return `${clamped} / 1`;
}
