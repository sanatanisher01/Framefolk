"use client";


import { Skeleton } from "@/components/ui/Skeleton";import { useState, useEffect } from "react";
import {
  subscribeToPendingRegistrations,
  callApproveAccount,
  callRejectAccount,
  type PendingRegistration,
} from "@/services/admin.service";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/Dialog";
import { Textarea } from "@/components/ui/Textarea";
import { Check, X, Clock } from "lucide-react";
import { formatFullDate } from "@/utils/format";
import { useToast } from "@/hooks/useToast";

export default function RegistrationsPage() {
  const { toast } = useToast();
  const [pending, setPending] = useState<PendingRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionUid, setActionUid] = useState<string | null>(null);
  const [actionType, setActionType] = useState<"approve" | "reject">("approve");
  const [rejectReason, setRejectReason] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsub = subscribeToPendingRegistrations((users) => {
      setPending(users);
      setLoading(false);
    });
    return unsub;
  }, []);

  async function handleApprove(uid: string) {
    setActionUid(uid);
    try {
      await callApproveAccount(uid);
      toast({ title: "Account approved", variant: "success" });
    } catch (err: unknown) {
      toast({ title: "Approval failed", description: (err as Error).message, variant: "error" });
    } finally {
      setActionUid(null);
    }
  }

  function openRejectDialog(uid: string) {
    setActionUid(uid);
    setActionType("reject");
    setRejectReason("");
    setError(null);
    setDialogOpen(true);
  }

  async function confirmReject() {
    if (!actionUid || !rejectReason.trim()) {
      setError("Please provide a reason for rejection.");
      return;
    }
    const uid = actionUid;
    try {
      await callRejectAccount(uid, rejectReason.trim());
      toast({ title: "Account rejected", variant: "warning" });
      setDialogOpen(false);
    } catch (err: unknown) {
      setError((err as Error).message ?? "Rejection failed.");
    } finally {
      setActionUid(null);
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <AdminPageHeader
        title="Registrations"
        description="Review and approve new account requests"
        badge={pending.length > 0 ? `${pending.length} pending` : undefined}
      />

      {loading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-4 bg-bg-card border border-border rounded-2xl">
              <Skeleton circle className="h-11 w-11 shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3.5 w-40" />
                <Skeleton className="h-3 w-28" />
              </div>
              <Skeleton className="h-8 w-20 rounded-lg" />
              <Skeleton className="h-8 w-20 rounded-lg" />
            </div>
          ))}
        </div>
      ) : pending.length === 0 ? (
        <EmptyState
          icon={Clock}
          title="No pending registrations"
          description="All caught up. New account requests will appear here."
        />
      ) : (
        <div className="flex flex-col gap-3">
          {pending.map((user) => (
            <div
              key={user.uid}
              className="flex items-center gap-4 p-4 bg-bg-card border border-border rounded-2xl hover:shadow-card-hover transition-shadow"
            >
              <Avatar src={user.profilePhotoUrl} fallback={user.displayName} size="lg" className="shrink-0" />

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-text-primary truncate">{user.displayName}</p>
                  {user.username && (
                    <span className="text-sm text-text-secondary truncate">@{user.username}</span>
                  )}
                </div>
                <p className="text-sm text-text-secondary truncate">{user.email}</p>
                {user.bio && (
                  <p className="text-xs text-text-muted truncate mt-1">{user.bio}</p>
                )}
                <p className="text-[10px] text-text-muted mt-1">
                  Registered {formatFullDate(user.createdAt)}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Button
                  variant="primary"
                  size="sm"
                  className="gap-1.5"
                  loading={actionUid === user.uid && actionType === "approve"}
                  onClick={() => handleApprove(user.uid)}
                >
                  <Check className="h-4 w-4" />
                  Approve
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  className="gap-1.5 text-red-400 border-red-500/30 hover:bg-red-500/10"
                  onClick={() => openRejectDialog(user.uid)}
                >
                  <X className="h-4 w-4" />
                  Reject
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Reject dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject registration</DialogTitle>
            <DialogDescription>
              Provide a reason for rejecting this account. The user will be notified.
            </DialogDescription>
          </DialogHeader>
          <div className="p-5 pt-0">
            <Textarea
              label="Reason"
              placeholder="e.g. Account does not meet community guidelines…"
              maxLength={500}
              showCount
              value={rejectReason}
              error={error ?? undefined}
              onChange={(e) => { setRejectReason(e.target.value); setError(null); }}
            />
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" loading={actionUid !== null} onClick={confirmReject}>
              Confirm rejection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
