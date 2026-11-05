import { cn } from "@/utils/cn";
import { formatCount, formatFileSize } from "@/utils/format";
import type { LucideIcon } from "lucide-react";

interface Props {
  label: string;
  value: number;
  icon: LucideIcon;
  accent?: "default" | "green" | "yellow" | "red" | "blue";
  formatBytes?: boolean;
  loading?: boolean;
}

const accentMap = {
  default: "bg-accent/10 border-accent/20 text-accent",
  green: "bg-green-500/10 border-green-500/20 text-green-400",
  yellow: "bg-yellow-500/10 border-yellow-500/20 text-yellow-400",
  red: "bg-red-500/10 border-red-500/20 text-red-400",
  blue: "bg-blue-500/10 border-blue-500/20 text-blue-400",
};

export function StatCard({ label, value, icon: Icon, accent = "default", formatBytes, loading }: Props) {
  return (
    <div className="bg-bg-card border border-border rounded-2xl p-5 hover:shadow-card-hover transition-shadow">
      <div className="flex items-center justify-between mb-3">
        <div className={cn("h-10 w-10 rounded-xl border flex items-center justify-center", accentMap[accent])}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <p className="text-2xl font-display font-bold text-text-primary tabular-nums">
        {loading ? "…" : formatBytes ? formatFileSize(value) : formatCount(value)}
      </p>
      <p className="text-xs text-text-secondary mt-0.5">{label}</p>
    </div>
  );
}
