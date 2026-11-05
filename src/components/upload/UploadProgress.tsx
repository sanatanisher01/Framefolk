"use client";

import { CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { cn } from "@/utils/cn";

export type FileUploadStatus = "waiting" | "uploading" | "done" | "error";

export interface FileUploadState {
  name: string;
  progress: number;
  status: FileUploadStatus;
  error?: string;
}

interface Props {
  files: FileUploadState[];
}

export function UploadProgress({ files }: Props) {
  if (files.length === 0) return null;

  const total = files.length;
  const done = files.filter((f) => f.status === "done").length;
  const overallProgress = total === 0 ? 0 : Math.round(
    files.reduce((sum, f) => sum + f.progress, 0) / total
  );

  return (
    <div className="flex flex-col gap-3">
      {/* Overall bar */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-text-secondary font-medium">
            Uploading {done}/{total}
          </span>
          <span className="text-text-muted tabular-nums">{overallProgress}%</span>
        </div>
        <div className="h-1.5 bg-bg-secondary rounded-full overflow-hidden">
          <div
            className="h-full bg-accent rounded-full transition-all duration-300"
            style={{ width: `${overallProgress}%` }}
          />
        </div>
      </div>

      {/* Per-file rows */}
      {files.map((f, i) => (
        <div key={i} className="flex items-center gap-2.5">
          {/* Status icon */}
          <div className="shrink-0">
            {f.status === "done" ? (
              <CheckCircle className="h-4 w-4 text-green-400" />
            ) : f.status === "error" ? (
              <AlertCircle className="h-4 w-4 text-red-400" />
            ) : f.status === "uploading" ? (
              <Loader2 className="h-4 w-4 text-accent animate-spin" />
            ) : (
              <div className="h-4 w-4 rounded-full border-2 border-border" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-xs text-text-primary truncate">{f.name}</p>
            {f.status === "uploading" && (
              <div className="h-1 mt-1 bg-bg-secondary rounded-full overflow-hidden">
                <div
                  className="h-full bg-accent rounded-full transition-all duration-200"
                  style={{ width: `${f.progress}%` }}
                />
              </div>
            )}
            {f.error && (
              <p className="text-[10px] text-red-400 mt-0.5">{f.error}</p>
            )}
          </div>

          <span className={cn(
            "text-[10px] tabular-nums shrink-0",
            f.status === "done" ? "text-green-400" :
            f.status === "error" ? "text-red-400" :
            "text-text-muted"
          )}>
            {f.status === "done" ? "Done" :
             f.status === "error" ? "Failed" :
             f.status === "uploading" ? `${f.progress}%` : "Waiting"}
          </span>
        </div>
      ))}
    </div>
  );
}
