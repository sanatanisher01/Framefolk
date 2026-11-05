"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { UserCheck, UserX, UserPlus } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/lib/auth/AuthContext";
import { MobileHeader } from "@/components/layout/MobileHeader";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  subscribeToFollowRequests,
  acceptFollowRequest,
  rejectFollowRequest,
  type FollowRequestWithUser,
} from "@/services/auth.service";
import { formatRelativeTime } from "@/utils/format";
import { cn } from "@/utils/cn";

type ActionState = "idle" | "accepting" | "rejecting";

export function FollowRequestsPage() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<FollowRequestWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionStates, setActionStates] = useState<Record<string, ActionState>>({});
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    const unsub = subscribeToFollowRequests(user.uid, (reqs) => {
      setRequests(reqs);
      setLoading(false);
    });
    return unsub;
  }, [user]);

  async function handleAccept(req: FollowRequestWithUser) {
    if (!user) return;
    setActionStates((s) => ({ ...s, [req.id]: "accepting" }));
    try {
      await acceptFollowRequest(req.id, req.fromUid, user.uid);
      setDismissed((d) => new Set(d).add(req.id));
    } catch {
      setActionStates((s) => ({ ...s, [req.id]: "idle" }));
    }
  }

  async function handleReject(req: FollowRequestWithUser) {
    setActionStates((s) => ({ ...s, [req.id]: "rejecting" }));
    try {
      await rejectFollowRequest(req.id);
      setDismissed((d) => new Set(d).add(req.id));
    } catch {
      setActionStates((s) => ({ ...s, [req.id]: "idle" }));
    }
  }

  const visible = requests.filter((r) => !dismissed.has(r.id));

  return (
    <>
      <MobileHeader title="Follow Requests" showBack />
      <div className="max-w-xl mx-auto px-4 py-4 flex flex-col gap-4">

        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="font-display font-bold text-xl text-text-primary hidden lg:block">
            Follow Requests
          </h1>
          {visible.length > 0 && (
            <span className="text-sm text-text-secondary ml-auto">
              {visible.length} pending
            </span>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Spinner size="lg" />
          </div>
        ) : visible.length === 0 ? (
          <EmptyState
            icon={UserPlus}
            title="No pending requests"
            description="When someone requests to follow your private account, it will appear here."
          />
        ) : (
          <div className="bg-bg-card border border-border rounded-2xl overflow-hidden divide-y divide-border/50">
            <AnimatePresence initial={false}>
              {visible.map((req) => {
                const state = actionStates[req.id] ?? "idle";
                return (
                  <motion.div
                    key={req.id}
                    layout
                    initial={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0, overflow: "hidden" }}
                    transition={{ duration: 0.2 }}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3.5",
                      state !== "idle" && "opacity-60"
                    )}
                  >
                    {/* Avatar */}
                    <Link href={`/@${req.fromUsername}`} className="shrink-0">
                      <Avatar
                        src={req.fromPhotoUrl}
                        fallback={req.fromDisplayName || req.fromUsername}
                        size="md"
                      />
                    </Link>

                    {/* User info */}
                    <div className="flex-1 min-w-0">
                      <Link href={`/@${req.fromUsername}`}>
                        <p className="text-sm font-semibold text-text-primary hover:text-accent transition-colors truncate">
                          {req.fromDisplayName || req.fromUsername}
                        </p>
                        <p className="text-xs text-text-muted truncate">@{req.fromUsername}</p>
                      </Link>
                      <p className="text-xs text-text-muted mt-0.5">
                        {formatRelativeTime(req.createdAt)}
                      </p>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        size="sm"
                        variant="primary"
                        className="gap-1.5"
                        loading={state === "accepting"}
                        disabled={state === "rejecting"}
                        onClick={() => handleAccept(req)}
                        aria-label={`Accept ${req.fromUsername}'s follow request`}
                      >
                        <UserCheck className="h-3.5 w-3.5" />
                        Accept
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        className="gap-1.5"
                        loading={state === "rejecting"}
                        disabled={state === "accepting"}
                        onClick={() => handleReject(req)}
                        aria-label={`Reject ${req.fromUsername}'s follow request`}
                      >
                        <UserX className="h-3.5 w-3.5" />
                        Decline
                      </Button>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>
    </>
  );
}
