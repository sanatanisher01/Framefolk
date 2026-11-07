"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { MapPin, AlertCircle } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthContext";
import { uploadFiles } from "@/services/upload.service";
import { createPost } from "@/services/media.service";
import { createPostSchema, type CreatePostFormValues } from "@/lib/validations/post";
import { FileDropzone, type FileWithPreview } from "./FileDropzone";
import { AudienceEditor } from "./AudienceEditor";
import { VisibilitySelector } from "./VisibilitySelector";
import { UploadProgress, type FileUploadState } from "./UploadProgress";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { Avatar } from "@/components/ui/Avatar";
import { Card, CardContent } from "@/components/ui/Card";
import { Separator } from "@/components/ui/Separator";
import type { PostVisibility } from "@/types";

type ComposerStep = "compose" | "uploading" | "done";

export function UploadComposer() {
  const router = useRouter();
  const { user } = useAuth();

  const [files, setFiles] = useState<FileWithPreview[]>([]);
  const [customAudienceUids, setCustomAudienceUids] = useState<string[]>([]);
  const [visibility, setVisibility] = useState<PostVisibility>("public");
  const [step, setStep] = useState<ComposerStep>("compose");
  const [uploadStates, setUploadStates] = useState<FileUploadState[]>([]);
  const [globalError, setGlobalError] = useState<string | null>(null);

  const { register, handleSubmit, watch } = useForm<CreatePostFormValues>({
    resolver: zodResolver(createPostSchema),
    defaultValues: { caption: "", visibility: "public" },
  });

  const captionValue = watch("caption", "");

  // Extract hashtag/mention highlights from caption
  const highlightedCaption = captionValue.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
    .replace(/(#\w+)/g, '<span class="text-accent">$1</span>')
    .replace(/(@\w+)/g, '<span class="text-blue-400">$1</span>');

  async function onSubmit(data: CreatePostFormValues) {
    if (!user) return;
    if (files.length === 0) {
      setGlobalError("Please add at least one photo or video.");
      return;
    }

    const validFiles = files.filter((f) => !f.error);
    if (validFiles.length === 0) {
      setGlobalError("All selected files have errors. Please try different files.");
      return;
    }

    if (visibility === "custom" && !customAudienceUids.length) { setGlobalError("Choose at least one person for this post."); return; }
    setGlobalError(null);
    setStep("uploading");

    // Init upload states
    const states: FileUploadState[] = validFiles.map((f) => ({
      name: f.file.name,
      progress: 0,
      status: "waiting",
    }));
    setUploadStates([...states]);

    // Upload all files
    const { results, failed } = await uploadFiles(
      validFiles.map((f) => f.file),
      {
        context: "post",
        isPrivate: visibility === "private",
      },
      (fileIndex, percent) => {
        setUploadStates((prev) => {
          const updated = [...prev];
          updated[fileIndex] = {
            ...updated[fileIndex],
            progress: percent,
            status: percent < 100 ? "uploading" : "done",
          };
          return updated;
        });
      }
    );

    // Mark any failed ones
    if (failed.length > 0) {
      setUploadStates((prev) => {
        const updated = [...prev];
        failed.forEach((f) => {
          const idx = validFiles.findIndex((vf) => vf.file === f.file);
          if (idx >= 0) {
            updated[idx] = { ...updated[idx], status: "error", error: f.error };
          }
        });
        return updated;
      });
    }

    if (failed.length > 0) {
      setGlobalError(`${failed.length} file(s) failed. Retry those files; successful files were saved in a separate post.`);
    }

    if (results.length === 0) {
      setGlobalError("All uploads failed. Please check your connection and try again.");
      setStep("compose");
      return;
    }

    // Create post in Firestore
    try {
      await createPost({
        authorUid: user.uid,
        authorUsername: user.username,
        authorDisplayName: user.displayName,
        authorPhotoUrl: user.profilePhotoUrl,
        caption: data.caption ?? "",
        visibility, customAudienceUids,
        mediaResults: results,
        location: data.location,
      });

      if (failed.length > 0) {
        files.filter(f => !failed.some(item => item.file === f.file)).forEach(f => URL.revokeObjectURL(f.preview));
        setFiles(files.filter(f => failed.some(item => item.file === f.file))); setStep("compose"); return;
      }
      setStep("done");
      // Cleanup previews
      files.forEach((f) => URL.revokeObjectURL(f.preview));
      setTimeout(() => router.replace("/home"), 1500);
    } catch {
      setGlobalError("Could not save the post. Please try again.");
      setStep("compose");
    }
  }

  if (step === "done") {
    return (
      <div className="flex flex-col items-center justify-center gap-4 min-h-[300px] text-center">
        <div className="h-16 w-16 rounded-full bg-green-500/10 border border-green-500/30 flex items-center justify-center">
          <span className="text-2xl">✓</span>
        </div>
        <div>
          <p className="font-display font-semibold text-text-primary">Post shared!</p>
          <p className="text-sm text-text-secondary mt-1">Redirecting to your feed…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-6 flex flex-col gap-5">
      <h1 className="font-display font-bold text-xl text-text-primary">
        {step === "uploading" ? "Uploading…" : "New Post"}
      </h1>

      {step === "uploading" ? (
        <Card>
          <CardContent className="pt-5">
            <UploadProgress files={uploadStates} />
          </CardContent>
        </Card>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5" noValidate>
          {/* File drop zone */}
          <FileDropzone files={files} onChange={setFiles} acceptVideo />

          {/* Caption + author row */}
          {files.length > 0 && (
            <Card>
              <CardContent className="pt-4 pb-3 flex flex-col gap-3">
                {/* Author row */}
                <div className="flex items-center gap-2.5">
                  <Avatar
                    src={user?.profilePhotoUrl}
                    fallback={user?.displayName ?? ""}
                    size="sm"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text-primary truncate">
                      {user?.displayName}
                    </p>
                    <VisibilitySelector value={visibility} onChange={setVisibility} allowAudiences />
                  </div>
                </div>

                <Separator />

                {["custom", "closeFriends"].includes(visibility) && <AudienceEditor closeFriends={visibility === "closeFriends"} value={customAudienceUids} onChange={setCustomAudienceUids} />}
                {/* Caption */}
                <div className="relative">
                  <Textarea
                    placeholder="Write a caption… #hashtags @mentions"
                    maxLength={2200}
                    showCount
                    value={captionValue}
                    className="min-h-[80px] border-transparent bg-transparent px-0 focus:ring-0 focus:border-transparent resize-none"
                    {...register("caption")}
                  />
                </div>

                {/* Hashtag/mention preview */}
                {(captionValue.includes("#") || captionValue.includes("@")) && (
                  <div
                    className="text-sm leading-relaxed px-1 py-1 rounded-lg bg-bg-secondary text-text-secondary"
                    dangerouslySetInnerHTML={{ __html: highlightedCaption }}
                  />
                )}

                <Separator />

                <label className="flex items-center gap-2 text-sm text-text-secondary">
                  <MapPin className="h-4 w-4" /><input aria-label="Location" placeholder="Add location (optional)" maxLength={100} className="flex-1 bg-transparent focus:outline-none" {...register("location.name")} />
                </label>
              </CardContent>
            </Card>
          )}

          {/* Error */}
          {globalError && (
            <div className="flex items-start gap-2.5 rounded-xl bg-red-500/10 border border-red-500/30 px-3 py-2.5">
              <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
              <p className="text-sm text-red-400">{globalError}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <Button
              type="button"
              variant="secondary"
              className="flex-1"
              onClick={() => router.back()}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              className="flex-1"
              disabled={files.length === 0}
            >
              Share post
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
