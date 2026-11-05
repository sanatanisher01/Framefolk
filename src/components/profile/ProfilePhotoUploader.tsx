"use client";

import { useRef, useState } from "react";
import { Camera, Loader2 } from "lucide-react";
import Image from "next/image";
import { uploadFile } from "@/services/upload.service";
import { updateProfilePhoto } from "@/services/media.service";
import { LIMITS } from "@/lib/cloudinary/config";
import { formatFileSize } from "@/utils/format";
import { cn } from "@/utils/cn";

interface Props {
  uid: string;
  currentUrl: string;
  displayName: string;
  type: "profile" | "cover";
  onUpdated: (newUrl: string) => void;
}

export function ProfilePhotoUploader({ uid, currentUrl, displayName, type, onUpdated }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [localPreview, setLocalPreview] = useState<string | null>(null);

  async function handleFile(f: File) {
    setError(null);
    const allowed = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!allowed.includes(f.type)) { setError("Please upload JPG, PNG or WebP."); return; }
    if (f.size > LIMITS.profilePhoto) { setError(`Max ${formatFileSize(LIMITS.profilePhoto)}.`); return; }

    // Show instant preview
    const reader = new FileReader();
    reader.onload = (e) => setLocalPreview(e.target?.result as string);
    reader.readAsDataURL(f);

    setUploading(true);
    setProgress(0);
    try {
      const result = await uploadFile(f, { context: type, isPrivate: false, onProgress: setProgress });
      await updateProfilePhoto({ uid, result, type });
      onUpdated(result.secureUrl);
      setLocalPreview(null);
    } catch (err: unknown) {
      setError((err as Error).message ?? "Upload failed.");
      setLocalPreview(null);
    } finally {
      setUploading(false);
    }
  }

  const displayUrl = localPreview ?? currentUrl;

  if (type === "cover") {
    return (
      <div className="relative h-36 sm:h-48 w-full bg-bg-secondary overflow-hidden rounded-b-none">
        {displayUrl ? (
          <Image src={displayUrl} alt="Cover photo" fill className="object-cover" sizes="100vw" priority unoptimized={!!localPreview} />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-bg-secondary via-bg-card to-accent/10" />
        )}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="absolute bottom-2 right-2 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-bg-primary/80 text-xs text-text-primary hover:bg-bg-primary transition-colors disabled:opacity-60"
          aria-label="Change cover photo"
        >
          {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
          {uploading ? `${progress}%` : "Change cover"}
        </button>
        <input ref={inputRef} type="file" accept="image/jpeg,image/jpg,image/png,image/webp" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }} />
        {error && <p className="absolute bottom-2 left-2 text-xs text-red-400 bg-bg-primary/80 px-2 py-1 rounded">{error}</p>}
      </div>
    );
  }

  return (
    <div className="relative inline-flex">
      <div className={cn("h-24 w-24 rounded-full overflow-hidden border-4 border-bg-primary bg-bg-secondary", uploading && "opacity-75")}>
        {displayUrl ? (
          <Image src={displayUrl} alt={displayName} width={96} height={96} className="object-cover w-full h-full" unoptimized={!!localPreview} />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-accent/20 text-2xl font-display font-bold text-accent">
            {displayName.charAt(0).toUpperCase()}
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="absolute bottom-0 right-0 h-8 w-8 rounded-full bg-accent flex items-center justify-center shadow-md hover:bg-accent-hover transition-colors disabled:opacity-60"
        aria-label="Change profile photo"
      >
        {uploading ? <Loader2 className="h-4 w-4 text-bg-primary animate-spin" /> : <Camera className="h-4 w-4 text-bg-primary" />}
      </button>
      <input ref={inputRef} type="file" accept="image/jpeg,image/jpg,image/png,image/webp" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }} />
      {error && <p className="absolute -bottom-5 left-0 right-0 text-[10px] text-red-400 text-center whitespace-nowrap">{error}</p>}
    </div>
  );
}
