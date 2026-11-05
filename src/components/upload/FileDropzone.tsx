"use client";

import { useRef, useState, useCallback } from "react";
import { Upload, ImageIcon, Video, X, ChevronLeft, ChevronRight, AlertCircle } from "lucide-react";
import Image from "next/image";
import { cn } from "@/utils/cn";
import { LIMITS } from "@/lib/cloudinary/config";
import { formatFileSize } from "@/utils/format";

const ALLOWED_IMAGE = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/heic", "image/heif"];
const ALLOWED_VIDEO = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/heic", "image/heif", "video/mp4", "video/quicktime", "video/webm"];
const MAX_FILES = 10;

export interface FileWithPreview {
  file: File;
  preview: string;
  type: "image" | "video";
  error?: string;
}

interface Props {
  files: FileWithPreview[];
  onChange: (files: FileWithPreview[]) => void;
  maxFiles?: number;
  acceptVideo?: boolean;
}

export function FileDropzone({ files, onChange, maxFiles = MAX_FILES, acceptVideo = false }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const validateFile = useCallback((f: File): string | null => {
    const allowed = acceptVideo ? ALLOWED_VIDEO : ALLOWED_IMAGE;
    if (!allowed.includes(f.type)) {
      return `${f.name}: unsupported format`;
    }
    const isVideo = f.type.startsWith("video/");
    const limit = isVideo ? LIMITS.video : LIMITS.image;
    if (f.size > limit) {
      return `${f.name}: exceeds ${formatFileSize(limit)} limit`;
    }
    return null;
  }, [acceptVideo]);

  function processFiles(newFiles: File[]) {
    const remaining = maxFiles - files.length;
    if (remaining <= 0) return;

    const toAdd: FileWithPreview[] = [];
    for (const f of newFiles.slice(0, remaining)) {
      const err = validateFile(f);
      const isVideo = f.type.startsWith("video/");
      const preview = err ? "" : URL.createObjectURL(f);
      toAdd.push({ file: f, preview, type: isVideo ? "video" : "image", error: err ?? undefined });
    }

    onChange([...files, ...toAdd]);
    setActiveIndex(files.length); // focus first new file
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []);
    processFiles(picked);
    e.target.value = "";
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    processFiles(Array.from(e.dataTransfer.files));
  }

  function removeFile(idx: number) {
    const updated = files.filter((_, i) => i !== idx);
    URL.revokeObjectURL(files[idx].preview);
    onChange(updated);
    setActiveIndex(Math.max(0, Math.min(activeIndex, updated.length - 1)));
  }

  const accept = acceptVideo
    ? "image/jpeg,image/jpg,image/png,image/webp,image/heic,video/mp4,video/quicktime,video/webm"
    : "image/jpeg,image/jpg,image/png,image/webp,image/heic";

  // Empty state
  if (files.length === 0) {
    return (
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload files"
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={cn(
          "flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed cursor-pointer",
          "h-72 transition-all duration-200",
          dragging ? "border-accent bg-accent/5 scale-[1.01]" : "border-border hover:border-accent/50 hover:bg-accent/5"
        )}
      >
        <div className="flex gap-2">
          <div className="h-12 w-12 rounded-2xl bg-bg-secondary border border-border flex items-center justify-center">
            <ImageIcon className="h-6 w-6 text-text-secondary" />
          </div>
          {acceptVideo && (
            <div className="h-12 w-12 rounded-2xl bg-bg-secondary border border-border flex items-center justify-center">
              <Video className="h-6 w-6 text-text-secondary" />
            </div>
          )}
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-text-primary">
            Drop files here or <span className="text-accent">browse</span>
          </p>
          <p className="text-xs text-text-muted mt-1">
            {acceptVideo ? "JPG, PNG, WebP, HEIC, MP4, MOV" : "JPG, PNG, WebP, HEIC"} · Up to {maxFiles} files
          </p>
        </div>
        <input ref={inputRef} type="file" accept={accept} multiple className="hidden" onChange={handleInputChange} />
      </div>
    );
  }

  // Preview carousel
  const current = files[activeIndex];
  const hasErrors = files.some((f) => f.error);

  return (
    <div className="flex flex-col gap-3">
      {/* Main preview */}
      <div className="relative rounded-2xl overflow-hidden bg-bg-secondary aspect-square">
        {current && !current.error ? (
          current.type === "video" ? (
            <video
              src={current.preview}
              className="w-full h-full object-contain"
              controls={false}
              muted
              playsInline
            />
          ) : (
            <Image
              src={current.preview}
              alt={`Preview ${activeIndex + 1}`}
              fill
              className="object-contain"
              sizes="600px"
              unoptimized
            />
          )
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-2">
            <AlertCircle className="h-8 w-8 text-red-400" />
            <p className="text-xs text-red-400 text-center px-4">{current?.error}</p>
          </div>
        )}

        {/* Navigation arrows */}
        {files.length > 1 && (
          <>
            {activeIndex > 0 && (
              <button
                type="button"
                onClick={() => setActiveIndex(activeIndex - 1)}
                className="absolute left-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-bg-primary/70 flex items-center justify-center hover:bg-bg-primary transition-colors"
                aria-label="Previous"
              >
                <ChevronLeft className="h-4 w-4 text-text-primary" />
              </button>
            )}
            {activeIndex < files.length - 1 && (
              <button
                type="button"
                onClick={() => setActiveIndex(activeIndex + 1)}
                className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-bg-primary/70 flex items-center justify-center hover:bg-bg-primary transition-colors"
                aria-label="Next"
              >
                <ChevronRight className="h-4 w-4 text-text-primary" />
              </button>
            )}
            {/* Index indicator */}
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
              {files.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setActiveIndex(i)}
                  className={cn(
                    "h-1.5 rounded-full transition-all",
                    i === activeIndex ? "w-4 bg-white" : "w-1.5 bg-white/50"
                  )}
                  aria-label={`Go to image ${i + 1}`}
                />
              ))}
            </div>
          </>
        )}

        {/* Remove current */}
        <button
          type="button"
          onClick={() => removeFile(activeIndex)}
          className="absolute top-2 right-2 h-7 w-7 rounded-full bg-bg-primary/80 flex items-center justify-center hover:bg-bg-primary transition-colors"
          aria-label="Remove file"
        >
          <X className="h-3.5 w-3.5 text-text-primary" />
        </button>
      </div>

      {/* Thumbnail strip */}
      {files.length > 1 && (
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          {files.map((f, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setActiveIndex(i)}
              className={cn(
                "relative h-16 w-16 shrink-0 rounded-xl overflow-hidden border-2 transition-colors",
                i === activeIndex ? "border-accent" : "border-border hover:border-accent/50"
              )}
            >
              {f.type === "image" && !f.error ? (
                <Image src={f.preview} alt="" fill className="object-cover" sizes="64px" unoptimized />
              ) : (
                <div className="w-full h-full bg-bg-secondary flex items-center justify-center">
                  {f.error ? <AlertCircle className="h-4 w-4 text-red-400" /> : <Video className="h-4 w-4 text-text-muted" />}
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Error summary */}
      {hasErrors && (
        <p className="text-xs text-red-400 flex items-center gap-1">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          Some files have errors and will be skipped
        </p>
      )}

      {/* Add more */}
      {files.length < maxFiles && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="text-xs text-accent hover:underline flex items-center gap-1"
        >
          <Upload className="h-3 w-3" />
          Add more ({files.length}/{maxFiles})
        </button>
      )}
      <input ref={inputRef} type="file" accept={accept} multiple className="hidden" onChange={handleInputChange} />
    </div>
  );
}
