"use client";

import { Skeleton } from "@/components/ui/Skeleton";
import { useState, useEffect } from "react";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useAuth } from "@/lib/auth/AuthContext";
import {
  subscribeToDeletionRequests, callDeleteCloudinaryAsset,
  type AdminDeletionRequest,
} from "@/services/admin.service";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Trash2, Check, X } from "lucide-react";
import { formatRelativeTime } from "@/utils/format";
import { useToast } from "@/hooks/useToast";

export default function DeletionRequestsPage() {
  const { firebaseUser } = useAuth();
  const { toast } = useToast();
  const [requests, setRequests] = useState<AdminDeletionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    const unsub = subscribeToDeletionRequests((r) => {
      setRequests(r);
      setLoading(false);
    });
    return unsub;
  }, []);

  async function handleApprove(req: AdminDeletionRequest) {
    if (!db || !firebaseUser) return;
    setBusy(req.id);
    try {
      // Update status to approved (moderator rule now allows this)
      await updateDoc(doc(db, "deletionRequests", req.id), {
        status: "approved",
        adminUid: firebaseUser.uid,
        updatedAt: serverTimestamp(),
      });
      // Then call the Cloud Function to execute the Cloudinary deletion
      await callDeleteCloudinaryAsset(req.id);
      toast({ title: "Deletion completed", description: "Media removed from Cloudinary.", variant: "success" });
    } catch (err: unknown) {
      toast({ title: "Deletion failed", description: (err as Error).message, variant: "error" });
    } finally {
      setBusy(null);
    }
  }

  async function handleReject(req: AdminDeletionRequest) {
    if (!db || !firebaseUser) return;
    setBusy(req.id);
    try {
      await updateDoc(doc(db, "deletionRequests", req.id), {
        status: "rejected",
        adminUid: firebaseUser.uid,
        updatedAt: serverTimestamp(),
      });
      toast({ title: "Deletion request rejected", variant: "default" });
    } catch (err: unknown) {
      toast({ title: "Failed to update", description: (err as Error).message, variant: "error" });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <AdminPageHeader
        title="Deletion Requests"
        description="Users cannot delete photos directly. Review and approve here."
        badge={requests.length > 0 ? `${requests.length} pending` : undefined}
      />

      {loading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="p-4 bg-bg-card border border-border rounded-2xl space-y-2">
              <Skeleton className="h-3.5 w-32" />
              <Skeleton className="h-3 w-48" />
              <Skeleton className="h-8 w-24 rounded-lg" />
            </div>
          ))}
        </div>
      ) : requests.length === 0 ? (
        <EmptyState icon={Trash2} title="No deletion requests" description="Users' deletion requests will appear here." />
      ) : (
        <div className="flex flex-col gap-3">
          {requests.map((req) => (
            <div key={req.id} className="p-4 bg-bg-card border border-border rounded-2xl hover:shadow-card-hover transition-shadow">
              <div className="flex items-start gap-3 mb-3">
                <div className="h-9 w-9 rounded-lg bg-yellow-500/10 flex items-center justify-center shrink-0">
                  <Trash2 className="h-4 w-4 text-yellow-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="pending">Pending</Badge>
                    <span className="text-xs text-text-muted capitalize">{req.entityType}</span>
                    <span className="text-xs text-text-muted">· {formatRelativeTime(req.createdAt)}</span>
                  </div>
                  <p className="text-sm text-text-secondary mt-1.5">
                    <span className="font-medium text-text-primary">Reason:</span> {req.reason}
                  </p>
                  <p className="text-xs text-text-muted mt-1 font-mono">
                    ID: {req.entityId}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 mt-2">
                <Button
                  variant="secondary"
                  size="sm"
                  className="gap-1.5 text-text-secondary"
                  loading={busy === req.id}
                  onClick={() => handleReject(req)}
                >
                  <X className="h-3.5 w-3.5" />
                  Reject
                </Button>
                <div className="flex-1" />
                <Button
                  variant="destructive"
                  size="sm"
                  className="gap-1.5"
                  loading={busy === req.id}
                  onClick={() => handleApprove(req)}
                >
                  <Check className="h-3.5 w-3.5" />
                  Approve &amp; delete
                </Button>
              </div>

              <p className="text-[10px] text-text-muted mt-2">
                ⚠ Approving will permanently delete the media from Cloudinary.
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
