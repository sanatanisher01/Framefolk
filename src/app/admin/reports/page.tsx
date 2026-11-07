"use client";

import { Skeleton } from "@/components/ui/Skeleton";
import { useState, useEffect } from "react";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useAuth } from "@/lib/auth/AuthContext";
import { callHandleReport, subscribeToReports, type AdminReportRow } from "@/services/admin.service";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Flag, Check, X, ExternalLink } from "lucide-react";
import { formatRelativeTime } from "@/utils/format";
import { useToast } from "@/hooks/useToast";
import Link from "next/link";

const REASON_LABELS: Record<string, string> = {
  spam: "Spam",
  nudity: "Inappropriate content",
  harassment: "Harassment",
  misinformation: "Misinformation",
  other: "Other",
};

function getEntityLink(entityType: string, entityId: string): string | null {
  if (entityType === "post") return `/@unknown`; // best effort — postId doesn't encode username
  if (entityType === "user") return `/@${entityId}`;
  return null;
}

export default function ReportsPage() {
  const { firebaseUser } = useAuth();
  const { toast } = useToast();
  const [reports, setReports] = useState<AdminReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    const unsub = subscribeToReports((r) => {
      setReports(r);
      setLoading(false);
    });
    return unsub;
  }, []);

  async function updateReportStatus(id: string, status: "actioned" | "dismissed") {
    if (!db || !firebaseUser) return;
    setBusy(id);
    try {
      await callHandleReport(id, status);
      toast({
        title: status === "actioned" ? "Report actioned" : "Report dismissed",
        variant: status === "actioned" ? "success" : "default",
      });
    } catch (err: unknown) {
      toast({ title: "Failed to update report", description: (err as Error).message, variant: "error" });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <AdminPageHeader
        title="Reports"
        description="User-submitted reports of posts, stories and accounts"
        badge={reports.length > 0 ? `${reports.length} pending` : undefined}
      />

      {loading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="p-4 bg-bg-card border border-border rounded-2xl space-y-2">
              <Skeleton className="h-3.5 w-40" />
              <Skeleton className="h-3 w-60" />
              <Skeleton className="h-8 w-32 rounded-lg" />
            </div>
          ))}
        </div>
      ) : reports.length === 0 ? (
        <EmptyState icon={Flag} title="No pending reports" description="All reports have been reviewed." />
      ) : (
        <div className="flex flex-col gap-3">
          {reports.map((r) => {
            const entityLink = getEntityLink(r.entityType, r.entityId);
            return (
              <div key={r.id} className="p-4 bg-bg-card border border-border rounded-2xl hover:shadow-card-hover transition-shadow">
                <div className="flex items-start gap-3 mb-3">
                  <div className="h-9 w-9 rounded-lg bg-red-500/10 flex items-center justify-center shrink-0">
                    <Flag className="h-4 w-4 text-red-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="destructive">{REASON_LABELS[r.reason] ?? r.reason}</Badge>
                      <span className="text-xs text-text-muted capitalize">{r.entityType}</span>
                      <span className="text-xs text-text-muted">· {formatRelativeTime(r.createdAt)}</span>
                    </div>
                    {r.details && (
                      <p className="text-sm text-text-secondary mt-1.5">{r.details}</p>
                    )}
                    <p className="text-xs text-text-muted mt-1 font-mono">
                      ID: {r.entityId}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* View content — link to profile for user reports, content page for post reports */}
                  {r.entityType === "user" ? (
                    <Link href={`/admin/users?uid=${r.entityId}`} target="_blank">
                      <Button variant="secondary" size="sm" className="gap-1.5">
                        <ExternalLink className="h-3.5 w-3.5" />
                        View profile
                      </Button>
                    </Link>
                  ) : (
                    <Link href={r.entityType === "post" ? `/post/${r.entityId}` : "/admin/content"} target="_blank">
                      <Button variant="secondary" size="sm" className="gap-1.5">
                        <ExternalLink className="h-3.5 w-3.5" />
                        View content
                      </Button>
                    </Link>
                  )}

                  <div className="flex-1" />

                  <Button
                    variant="secondary"
                    size="sm"
                    className="gap-1.5 text-text-secondary"
                    loading={busy === r.id}
                    onClick={() => updateReportStatus(r.id, "dismissed")}
                  >
                    <X className="h-3.5 w-3.5" />
                    Dismiss
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="gap-1.5"
                    loading={busy === r.id}
                    onClick={() => updateReportStatus(r.id, "actioned")}
                  >
                    <Check className="h-3.5 w-3.5" />
                    Take action
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
