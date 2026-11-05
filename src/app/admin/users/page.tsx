"use client";

import { useState, useEffect, useMemo } from "react";
import {
  subscribeToAllUsers,
  callBlockAccount,
  callUnblockAccount,
  callSuspendAccount,
  type AdminUserRow,
} from "@/services/admin.service";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/Dialog";
import { Textarea } from "@/components/ui/Textarea";
import {
  Search, Ban, UserCheck, Pause, Play,
} from "lucide-react";
import { formatCount } from "@/utils/format";
import { useToast } from "@/hooks/useToast";

const STATUS_VARIANTS: Record<string, "approved" | "pending" | "rejected" | "blocked" | "suspended"> = {
  approved: "approved",
  pending: "pending",
  rejected: "rejected",
  blocked: "blocked",
  suspended: "suspended",
};

export default function UsersPage() {
  const { toast } = useToast();
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [actionUser, setActionUser] = useState<AdminUserRow | null>(null);
  const [actionType, setActionType] = useState<"block" | "unblock" | "suspend">("block");
  const [reason, setReason] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const unsub = subscribeToAllUsers((u) => {
      setUsers(u);
      setLoading(false);
    });
    return unsub;
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return users;
    const q = search.toLowerCase().trim();
    return users.filter((u) =>
      u.displayName.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.username.toLowerCase().includes(q)
    );
  }, [users, search]);

  function openDialog(user: AdminUserRow, type: "block" | "unblock" | "suspend") {
    setActionUser(user);
    setActionType(type);
    setReason("");
    setDialogOpen(true);
  }

  async function confirmAction() {
    if (!actionUser) return;
    setBusy(true);
    try {
      if (actionType === "block") {
        await callBlockAccount(actionUser.uid, reason || "Violating community guidelines");
        toast({ title: "Account blocked", variant: "warning" });
      } else if (actionType === "unblock") {
        await callUnblockAccount(actionUser.uid);
        toast({ title: "Account restored", variant: "success" });
      } else if (actionType === "suspend") {
        await callSuspendAccount(actionUser.uid, reason || "Temporary suspension", 7);
        toast({ title: "Account suspended", variant: "warning" });
      }
      setDialogOpen(false);
    } catch (err: unknown) {
      toast({ title: "Action failed", description: (err as Error).message, variant: "error" });
    } finally {
      setBusy(false);
    }
  }

  const needsReason = actionType === "block" || actionType === "suspend";

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <AdminPageHeader
        title="User Management"
        description="Search, block, suspend and restore accounts"
        badge={`${users.length} total`}
      />

      {/* Search */}
      <div className="mb-5 max-w-md">
        <Input
          type="search"
          placeholder="Search by name, email or username…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          leftIcon={<Search className="h-4 w-4" />}
        />
      </div>

      {/* User list */}
      {loading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-3 bg-bg-card border border-border rounded-xl">
              <Skeleton circle className="h-10 w-10 shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3 w-32" />
                <Skeleton className="h-2.5 w-24" />
              </div>
              <Skeleton className="h-7 w-16 rounded-lg" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No users found"
          description={search ? `No users match "${search}"` : "No users have registered yet."}
        />
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((user) => (
            <div
              key={user.uid}
              className="flex items-center gap-3 p-3 bg-bg-card border border-border rounded-xl hover:shadow-card-hover transition-shadow"
            >
              <Avatar src={user.profilePhotoUrl} fallback={user.displayName} size="md" className="shrink-0" />

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-sm text-text-primary truncate">{user.displayName}</p>
                  <Badge variant={STATUS_VARIANTS[user.status] ?? "pending"}>{user.status}</Badge>
                </div>
                <div className="flex items-center gap-2 text-xs text-text-secondary mt-0.5">
                  <span className="truncate">{user.email}</span>
                  {user.username && <span>· @{user.username}</span>}
                </div>
              </div>

              {/* Stats */}
              <div className="hidden sm:flex items-center gap-4 text-xs text-text-muted shrink-0">
                <span>{formatCount(user.postsCount)} posts</span>
                <span>{formatCount(user.followersCount)} followers</span>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1.5 shrink-0">
                {user.status === "approved" && (
                  <>
                    <Button
                      variant="secondary"
                      size="icon-sm"
                      className="text-yellow-400 border-yellow-500/30 hover:bg-yellow-500/10"
                      onClick={() => openDialog(user, "suspend")}
                      aria-label="Suspend"
                    >
                      <Pause className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="secondary"
                      size="icon-sm"
                      className="text-red-400 border-red-500/30 hover:bg-red-500/10"
                      onClick={() => openDialog(user, "block")}
                      aria-label="Block"
                    >
                      <Ban className="h-3.5 w-3.5" />
                    </Button>
                  </>
                )}
                {user.status === "blocked" && (
                  <Button
                    variant="secondary"
                    size="sm"
                    className="text-green-400 border-green-500/30 hover:bg-green-500/10 gap-1.5"
                    onClick={() => openDialog(user, "unblock")}
                  >
                    <UserCheck className="h-3.5 w-3.5" />
                    Restore
                  </Button>
                )}
                {user.status === "suspended" && (
                  <Button
                    variant="secondary"
                    size="sm"
                    className="text-green-400 border-green-500/30 hover:bg-green-500/10 gap-1.5"
                    onClick={() => openDialog(user, "unblock")}
                  >
                    <Play className="h-3.5 w-3.5" />
                    Unsuspend
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Action dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="capitalize">
              {actionType === "block" ? "Block account" : actionType === "suspend" ? "Suspend account" : "Restore account"}
            </DialogTitle>
            <DialogDescription>
              {actionType === "block" && "This will disable the user's Firebase Auth account and block all access."}
              {actionType === "suspend" && "This will temporarily suspend the account for 7 days."}
              {actionType === "unblock" && "This will restore the account to approved status."}
              {actionUser && (
                <span className="block mt-2 font-medium text-text-primary">
                  {actionUser.displayName} ({actionUser.email})
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          {needsReason && (
            <div className="p-5 pt-0">
              <Textarea
                label="Reason"
                placeholder="Reason for this action…"
                maxLength={500}
                showCount
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
          )}

          <DialogFooter>
            <Button variant="secondary" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button
              variant={actionType === "unblock" ? "primary" : "destructive"}
              loading={busy}
              onClick={confirmAction}
            >
              {actionType === "block" ? "Block account" : actionType === "suspend" ? "Suspend account" : "Restore account"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
