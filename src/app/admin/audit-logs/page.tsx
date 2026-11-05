"use client";

import { useState, useEffect } from "react";
import { subscribeToAuditLogs, type AuditLogRow } from "@/services/admin.service";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ScrollText } from "lucide-react";
import { formatFullDate, formatRelativeTime } from "@/utils/format";

const ACTION_LABELS: Record<string, string> = {
  accountApproved: "Account Approved",
  accountRejected: "Account Rejected",
  accountBlocked: "Account Blocked",
  accountUnblocked: "Account Unblocked",
  accountSuspended: "Account Suspended",
  accountRestored: "Account Restored",
  roleAssigned: "Role Assigned",
  permissionChanged: "Permission Changed",
  deletionApproved: "Deletion Approved",
  deletionRejected: "Deletion Rejected",
  contentHidden: "Content Hidden",
  contentRestored: "Content Restored",
  contentRemoved: "Content Removed",
  reportActioned: "Report Actioned",
  reportDismissed: "Report Dismissed",
};

const ACTION_VARIANTS: Record<string, "approved" | "rejected" | "blocked" | "warning" | "default"> = {
  accountApproved: "approved",
  accountRejected: "rejected",
  accountBlocked: "blocked",
  accountUnblocked: "approved",
  accountSuspended: "warning",
  accountRestored: "approved",
  roleAssigned: "default",
  permissionChanged: "default",
  deletionApproved: "rejected",
  deletionRejected: "default",
  contentHidden: "warning",
  contentRestored: "approved",
  contentRemoved: "rejected",
  reportActioned: "warning",
  reportDismissed: "default",
};

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLogRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = subscribeToAuditLogs((l) => {
      setLogs(l);
      setLoading(false);
    });
    return unsub;
  }, []);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <AdminPageHeader
        title="Audit Logs"
        description="Immutable record of all administrative actions"
        badge={`${logs.length} entries`}
      />

      {loading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="p-3 bg-bg-card border border-border rounded-xl space-y-1.5">
              <Skeleton className="h-3 w-40" />
              <Skeleton className="h-2.5 w-56" />
            </div>
          ))}
        </div>
      ) : logs.length === 0 ? (
        <EmptyState icon={ScrollText} title="No audit entries" description="Administrative actions will be logged here." />
      ) : (
        <div className="flex flex-col gap-1.5">
          {logs.map((log) => (
            <div
              key={log.id}
              className="flex items-start gap-3 p-3 bg-bg-card border border-border rounded-xl hover:bg-bg-secondary transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant={ACTION_VARIANTS[log.action] ?? "default"}>
                    {ACTION_LABELS[log.action] ?? log.action}
                  </Badge>
                  <span className="text-xs text-text-muted">
                    by <span className="font-mono text-text-secondary">{log.actorUid.slice(0, 8)}…</span>
                    <span className="ml-1 px-1.5 py-0.5 rounded bg-bg-secondary text-[10px] font-medium">{log.actorRole}</span>
                  </span>
                </div>
                <div className="text-xs text-text-secondary mt-1.5 space-y-0.5">
                  {log.targetEntityType && (
                    <p>
                      <span className="text-text-muted">Target:</span>{" "}
                      <span className="capitalize">{log.targetEntityType}</span>
                      {log.targetEntityId && (
                        <span className="font-mono ml-1 text-text-muted">
                          ({log.targetEntityId.slice(0, 12)}…)
                        </span>
                      )}
                    </p>
                  )}
                  {log.targetUid && (
                    <p>
                      <span className="text-text-muted">Target UID:</span>{" "}
                      <span className="font-mono">{log.targetUid.slice(0, 12)}…</span>
                    </p>
                  )}
                  {log.reason && (
                    <p className="text-text-muted">
                      <span className="text-text-secondary">Reason:</span> {log.reason}
                    </p>
                  )}
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs text-text-muted">{formatRelativeTime(log.createdAt)}</p>
                <p className="text-[10px] text-text-muted mt-0.5">
                  {formatFullDate(log.createdAt)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
