"use client";

import { useState, useRef, useCallback } from "react";
import { Camera, Upload, X, Loader2 } from "lucide-react";
import Image from "next/image";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { uploadFile } from "@/services/upload.service";
import { updateProfilePhoto } from "@/services/media.service";
import { cn } from "@/utils/cn";
import { LIMITS } from "@/lib/cloudinary/config";
import { formatFileSize } from "@/utils/format";

interface Props {
  uid: string;
  onComplete: () => void;
  onBack: () => void;
  onSkip: () => void;
}

const ALLOWED = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

export function StepPhoto({ uid, onComplete, onBack, onSkip }: Props) {
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((f: File) => {
    setError(null);
    if (!ALLOWED.includes(f.type)) {
      setError("Please upload a JPG, PNG or WebP image.");
      return;
    }
    if (f.size > LIMITS.profilePhoto) {
      setError(`Image must be under ${formatFileSize(LIMITS.profilePhoto)}.`);
      return;
    }
    setFile(f);
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(f);
  }, []);

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  }

  async function handleUpload() {
    if (!file) return;
    setUploading(true);
    setError(null);
    setProgress(0);
    try {
      const result = await uploadFile(file, {
        context: "profile",
        isPrivate: false,
        onProgress: setProgress,
      });

      await updateProfilePhoto({ uid, result, type: "profile" });
      onComplete();
    } catch (err: unknown) {
      setError((err as Error).message ?? "Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <Card className="w-full">
      <CardHeader className="pb-2">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/10 border border-accent/30 mb-2">
          <Camera className="h-6 w-6 text-accent" />
        </div>
        <CardTitle className="text-xl">Add a profile photo</CardTitle>
        <CardDescription>Help people recognise you. You can change this any time.</CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {/* Drop zone */}
        <div
          role="button"
          tabIndex={0}
          aria-label="Upload profile photo"
          onClick={() => !uploading && inputRef.current?.click()}
          onKeyDown={(e) => !uploading && e.key === "Enter" && inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          className={cn(
            "relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed h-48 overflow-hidden",
            uploading ? "cursor-not-allowed opacity-75" : "cursor-pointer",
            dragging ? "border-accent bg-accent/5" : preview ? "border-accent/50" : "border-border hover:border-accent/50 hover:bg-accent/5",
            "transition-all duration-200"
          )}
        >
          {preview ? (
            <>
              <Image src={preview} alt="Profile photo preview" fill className="object-cover" sizes="320px" unoptimized />
              {!uploading && (
                <div className="absolute inset-0 bg-bg-primary/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                  <span className="text-sm font-medium text-text-primary bg-bg-card/80 px-3 py-1.5 rounded-lg">
                    Change photo
                  </span>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="h-14 w-14 rounded-full bg-bg-secondary border border-border flex items-center justify-center mb-3">
                <Upload className="h-6 w-6 text-text-secondary" />
              </div>
              <p className="text-sm font-medium text-text-primary">Drop a photo or click to browse</p>
              <p className="text-xs text-text-muted mt-1">JPG, PNG, WebP · Max {formatFileSize(LIMITS.profilePhoto)}</p>
            </>
          )}
        </div>

        {/* Upload progress bar */}
        {uploading && (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-text-secondary flex items-center gap-1.5">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Uploading…
              </span>
              <span className="tabular-nums text-text-muted">{progress}%</span>
            </div>
            <div className="h-1.5 bg-bg-secondary rounded-full overflow-hidden">
              <div
                className="h-full bg-accent rounded-full transition-all duration-200"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/jpg,image/png,image/webp"
          className="hidden"
          onChange={handleInputChange}
          aria-hidden
        />

        {preview && !uploading && (
          <button
            type="button"
            onClick={() => { setPreview(null); setFile(null); setProgress(0); }}
            className="flex items-center gap-1.5 text-xs text-text-secondary hover:text-text-primary transition-colors justify-center"
          >
            <X className="h-3.5 w-3.5" />
            Remove photo
          </button>
        )}

        {error && <p className="text-xs text-red-400 text-center">{error}</p>}

        <div className="flex gap-2">
          <Button type="button" variant="secondary" className="flex-1" onClick={onBack} disabled={uploading}>
            Back
          </Button>
          {file ? (
            <Button type="button" variant="primary" className="flex-1" loading={uploading} onClick={handleUpload}>
              {uploading ? "Uploading…" : "Save photo"}
            </Button>
          ) : (
            <Button type="button" variant="ghost" className="flex-1 text-text-secondary" onClick={onSkip}>
              Skip for now
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
