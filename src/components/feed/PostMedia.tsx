"use client";

import { useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, Play } from "lucide-react";
import { cn } from "@/utils/cn";
import { buildImageUrl } from "@/lib/cloudinary/config";
import type { Media } from "@/types";

interface Props {
  mediaItems: Partial<Media>[];
  className?: string;
}

export function PostMedia({ mediaItems, className }: Props) {
  const [index, setIndex] = useState(0);
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? "";

  if (mediaItems.length === 0) return null;

  const current = mediaItems[index];
  const isVideo = current?.resourceType === "video";

  function getDisplayUrl(item: Partial<Media>): string {
    if (!item.cloudinaryPublicId) return "";
    if (item.resourceType === "video") {
      return item.thumbnailPublicId
        ? buildImageUrl(item.thumbnailPublicId, cloudName, { width: 800 })
        : buildImageUrl(item.cloudinaryPublicId, cloudName, { width: 800 });
    }
    return buildImageUrl(item.cloudinaryPublicId, cloudName, { width: 800 });
  }

  const url = getDisplayUrl(current ?? {});

  return (
    <div className={cn("relative bg-bg-secondary overflow-hidden", className)}>
      {/* Media */}
      {url ? (
        <div className="relative w-full" style={{ aspectRatio: getAspectRatio(current) }}>
          <Image
            src={url}
            alt="Post media"
            fill
            className="object-cover"
            sizes="(max-width: 640px) 100vw, 600px"
            loading="lazy"
          />
          {isVideo && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="h-12 w-12 rounded-full bg-bg-primary/70 flex items-center justify-center">
                <Play className="h-5 w-5 text-text-primary fill-text-primary ml-0.5" />
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="aspect-square bg-bg-secondary flex items-center justify-center">
          <span className="text-text-muted text-sm">No preview</span>
        </div>
      )}

      {/* Multi-image navigation */}
      {mediaItems.length > 1 && (
        <>
          {index > 0 && (
            <button
              type="button"
              onClick={() => setIndex((i) => i - 1)}
              className="absolute left-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-bg-primary/70 flex items-center justify-center hover:bg-bg-primary transition-colors"
              aria-label="Previous"
            >
              <ChevronLeft className="h-4 w-4 text-text-primary" />
            </button>
          )}
          {index < mediaItems.length - 1 && (
            <button
              type="button"
              onClick={() => setIndex((i) => i + 1)}
              className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-bg-primary/70 flex items-center justify-center hover:bg-bg-primary transition-colors"
              aria-label="Next"
            >
              <ChevronRight className="h-4 w-4 text-text-primary" />
            </button>
          )}
          {/* Dots */}
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
            {mediaItems.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setIndex(i)}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  i === index ? "w-4 bg-white" : "w-1.5 bg-white/50"
                )}
                aria-label={`Image ${i + 1}`}
              />
            ))}
          </div>
          {/* Count badge */}
          <span className="absolute top-2 right-2 bg-bg-primary/70 text-text-primary text-xs px-2 py-0.5 rounded-full font-medium">
            {index + 1}/{mediaItems.length}
          </span>
        </>
      )}
    </div>
  );
}

function getAspectRatio(item?: Partial<Media>): string {
  if (!item?.width || !item?.height) return "1 / 1";
  const ratio = item.width / item.height;
  // Clamp between 4:5 portrait and 16:9 landscape
  const clamped = Math.max(0.8, Math.min(ratio, 1.91));
  return `${clamped} / 1`;
}
