"use client";

import { Clock, LogOut, Mail } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthContext";
import { useLogout } from "@/hooks/useLogout";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

const STATUS_CONFIG = {
  pending: {
    icon: Clock,
    color: "text-yellow-400",
    bg: "bg-yellow-500/10 border-yellow-500/30",
    badge: "pending" as const,
    title: "Account pending approval",
    message:
      "Your account is being reviewed by our team. You'll receive an email once it's approved. This usually takes less than 24 hours.",
  },
  rejected: {
    icon: Mail,
    color: "text-red-400",
    bg: "bg-red-500/10 border-red-500/30",
    badge: "rejected" as const,
    title: "Account not approved",
    message:
      "Unfortunately your registration was not approved at this time. If you believe this is a mistake, please contact support.",
  },
  blocked: {
    icon: Clock,
    color: "text-red-400",
    bg: "bg-red-500/10 border-red-500/30",
    badge: "blocked" as const,
    title: "Account suspended",
    message:
      "Your account has been suspended. Please contact support if you believe this is an error.",
  },
  suspended: {
    icon: Clock,
    color: "text-orange-400",
    bg: "bg-orange-500/10 border-orange-500/30",
    badge: "suspended" as const,
    title: "Account temporarily suspended",
    message:
      "Your account has been temporarily suspended. Please contact support for more information.",
  },
};

export default function PendingPage() {
  const { status, user } = useAuth();
  const { logout: handleLogout, loading } = useLogout();

  const config = STATUS_CONFIG[(status as keyof typeof STATUS_CONFIG) ?? "pending"]
    ?? STATUS_CONFIG.pending;
  const Icon = config.icon;

  return (
    <div className="flex flex-col items-center gap-6 text-center max-w-sm w-full">
      <div className={`h-20 w-20 rounded-full border flex items-center justify-center ${config.bg}`}>
        <Icon className={`h-10 w-10 ${config.color}`} />
      </div>

      <div className="space-y-2">
        <Badge variant={config.badge}>{config.badge}</Badge>
        <h1 className="font-display font-bold text-2xl text-text-primary mt-2">
          {config.title}
        </h1>
        <p className="text-text-secondary text-sm leading-relaxed">
          {config.message}
        </p>
      </div>

      {user?.email && (
        <p className="text-xs text-text-muted">
          Signed in as <span className="text-text-secondary">{user.email}</span>
        </p>
      )}

      {status === "pending" && (
        <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-yellow-500/10 border border-yellow-500/30">
          <span className="h-2 w-2 rounded-full bg-yellow-400 animate-pulse" />
          <span className="text-xs font-medium text-yellow-400">Awaiting review</span>
        </div>
      )}

      <Button
        variant="secondary"
        size="sm"
        onClick={handleLogout}
        loading={loading}
        className="gap-2"
      >
        <LogOut className="h-4 w-4" />
        Sign out
      </Button>
    </div>
  );
}
