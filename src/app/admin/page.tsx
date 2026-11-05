"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Users, UserCheck, UserX, Ban, Image as ImageIcon, Flag,
  Trash2, HardDrive, Clock, ChevronRight, RefreshCw, CheckCircle,
} from "lucide-react";
import { loadAdminStats, type AdminStats } from "@/services/admin.service";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { StatCard } from "@/components/admin/StatCard";
import { Button } from "@/components/ui/Button";
import { formatRelativeTime } from "@/utils/format";
import {
  subscribeToPendingRegistrations, subscribeToReports, subscribeToDeletionRequests,
  type PendingRegistration, type AdminReportRow, type AdminDeletionRequest,
} from "@/services/admin.service";

async function clearAllCaches(): Promise<number> {
  if (typeof window === "undefined" || !("caches" in window)) return 0;
  const keys = await window.caches.keys();
  await Promise.all(keys.map((k) => window.caches.delete(k)));
  return keys.length;
}

export default function AdminOverview() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [pending, setPending] = useState<PendingRegistration[]>([]);
  const [reports, setReports] = useState<AdminReportRow[]>([]);
  const [delReqs, setDelReqs] = useState<AdminDeletionRequest[]>([]);
  const [cacheClearing, setCacheClearing] = useState(false);
  const [cacheCleared, setCacheCleared] = useState(false);

  useEffect(() => {
    loadAdminStats().then(setStats).catch(() => {}).finally(() => setStatsLoading(false));
    const u1 = subscribeToPendingRegistrations(setPending);
    const u2 = subscribeToReports(setReports);
    const u3 = subscribeToDeletionRequests(setDelReqs);
    return () => { u1(); u2(); u3(); };
  }, []);

  async function handleClearCache() {
    setCacheClearing(true);
    try {
      const count = await clearAllCaches();
      // Also tell SW to skip waiting and reload all clients
      if ("serviceWorker" in navigator) {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg?.waiting) {
          reg.waiting.postMessage({ type: "SKIP_WAITING" });
        }
      }
      setCacheCleared(true);
      setTimeout(() => setCacheCleared(false), 3000);
      console.log(`[Admin] Cleared ${count} cache(s)`);
    } catch (err) {
      console.error("[Admin] Cache clear failed:", err);
    } finally {
      setCacheClearing(false);
    }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-start justify-between gap-4 mb-6">
        <AdminPageHeader title="Overview" description="Platform health and moderation queue at a glance" />
        <Button
          variant={cacheCleared ? "secondary" : "primary"}
          size="sm"
          className="gap-2 shrink-0"
          loading={cacheClearing}
          onClick={handleClearCache}
        >
          {cacheCleared
            ? <><CheckCircle className="h-4 w-4" /> Cache cleared</>
            : <><RefreshCw className="h-4 w-4" /> Clear all caches</>
          }
        </Button>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total users" value={stats?.totalUsers ?? 0} icon={Users} loading={statsLoading} />
        <StatCard label="Approved" value={stats?.approvedUsers ?? 0} icon={UserCheck} accent="green" loading={statsLoading} />
        <StatCard label="Pending approval" value={stats?.pendingUsers ?? 0} icon={Clock} accent="yellow" loading={statsLoading} />
        <StatCard label="Blocked" value={stats?.blockedUsers ?? 0} icon={Ban} accent="red" loading={statsLoading} />
        <StatCard label="Total posts" value={stats?.totalPosts ?? 0} icon={ImageIcon} loading={statsLoading} />
        <StatCard label="Pending reports" value={stats?.pendingReports ?? 0} icon={Flag} accent="red" loading={statsLoading} />
        <StatCard label="Deletion requests" value={stats?.pendingDeletionRequests ?? 0} icon={Trash2} accent="yellow" loading={statsLoading} />
        <StatCard label="Media storage" value={stats?.mediaStorageBytes ?? 0} icon={HardDrive} formatBytes loading={statsLoading} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pending registrations */}
        <div className="bg-bg-card border border-border rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <h2 className="font-display font-semibold text-text-primary">Pending Registrations</h2>
            <Link href="/admin/registrations" className="text-xs text-accent hover:underline flex items-center gap-1">
              View all <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="p-2">
            {pending.length === 0 ? (
              <p className="text-sm text-text-muted px-3 py-6 text-center">No pending registrations.</p>
            ) : (
              pending.slice(0, 5).map((u) => (
                <div key={u.uid} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-bg-secondary transition-colors">
                  <div className="h-9 w-9 rounded-full bg-accent/10 flex items-center justify-center text-sm font-bold text-accent shrink-0">
                    {u.displayName.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text-primary truncate">{u.displayName}</p>
                    <p className="text-xs text-text-secondary truncate">{u.email}</p>
                  </div>
                  <span className="text-xs text-text-muted shrink-0">{formatRelativeTime(u.createdAt)}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Reports queue */}
        <div className="bg-bg-card border border-border rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <h2 className="font-display font-semibold text-text-primary">Recent Reports</h2>
            <Link href="/admin/reports" className="text-xs text-accent hover:underline flex items-center gap-1">
              View all <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="p-2">
            {reports.length === 0 ? (
              <p className="text-sm text-text-muted px-3 py-6 text-center">No pending reports.</p>
            ) : (
              reports.slice(0, 5).map((r) => (
                <div key={r.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-bg-secondary transition-colors">
                  <div className="h-9 w-9 rounded-lg bg-red-500/10 flex items-center justify-center shrink-0">
                    <Flag className="h-4 w-4 text-red-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text-primary truncate">Report: {r.reason}</p>
                    <p className="text-xs text-text-secondary truncate">{r.entityType} · {r.details}</p>
                  </div>
                  <span className="text-xs text-text-muted shrink-0">{formatRelativeTime(r.createdAt)}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Deletion requests queue */}
        <div className="bg-bg-card border border-border rounded-2xl overflow-hidden lg:col-span-2">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <h2 className="font-display font-semibold text-text-primary">Deletion Requests</h2>
            <Link href="/admin/deletion-requests" className="text-xs text-accent hover:underline flex items-center gap-1">
              View all <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="p-2">
            {delReqs.length === 0 ? (
              <p className="text-sm text-text-muted px-3 py-6 text-center">No pending deletion requests.</p>
            ) : (
              delReqs.slice(0, 5).map((d) => (
                <div key={d.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-bg-secondary transition-colors">
                  <div className="h-9 w-9 rounded-lg bg-yellow-500/10 flex items-center justify-center shrink-0">
                    <Trash2 className="h-4 w-4 text-yellow-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text-primary truncate capitalize">{d.entityType} deletion</p>
                    <p className="text-xs text-text-secondary truncate">{d.reason}</p>
                  </div>
                  <span className="text-xs text-text-muted shrink-0">{formatRelativeTime(d.createdAt)}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mt-6">
        {[
          { href: "/admin/users", label: "Manage Users", icon: Users },
          { href: "/admin/registrations", label: "Registrations", icon: UserCheck, badge: pending.length },
          { href: "/admin/reports", label: "Reports", icon: Flag, badge: reports.length },
          { href: "/admin/deletion-requests", label: "Deletion Requests", icon: Trash2, badge: delReqs.length },
          { href: "/admin/permissions", label: "Permissions", icon: UserX },
          { href: "/admin/audit-logs", label: "Audit Logs", icon: Clock },
          { href: "/admin/content", label: "Content", icon: ImageIcon },
          { href: "/admin/settings", label: "Settings", icon: ChevronRight },
        ].map((link) => {
          const LinkIcon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              className="flex items-center gap-3 bg-bg-card border border-border rounded-xl px-4 py-3 hover:border-accent/30 hover:shadow-card-hover transition-all group"
            >
              <div className="h-8 w-8 rounded-lg bg-bg-secondary flex items-center justify-center group-hover:bg-accent/10 transition-colors">
                <LinkIcon className="h-4 w-4 text-text-secondary group-hover:text-accent transition-colors" />
              </div>
              <span className="text-sm font-medium text-text-primary flex-1">{link.label}</span>
              {link.badge ? (
                <span className="text-xs px-1.5 py-0.5 rounded-full bg-accent/10 text-accent border border-accent/20 font-medium tabular-nums">
                  {link.badge}
                </span>
              ) : null}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
