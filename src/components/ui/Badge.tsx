import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/utils/cn";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors select-none",
  {
    variants: {
      variant: {
        default: "bg-accent/15 text-accent border border-accent/30",
        secondary: "bg-bg-card text-text-secondary border border-border",
        success: "bg-green-500/15 text-green-400 border border-green-500/30",
        warning: "bg-yellow-500/15 text-yellow-400 border border-yellow-500/30",
        destructive: "bg-red-500/15 text-red-400 border border-red-500/30",
        outline: "border border-border text-text-secondary",
        pending: "bg-yellow-500/15 text-yellow-400 border border-yellow-500/30",
        approved: "bg-green-500/15 text-green-400 border border-green-500/30",
        rejected: "bg-red-500/15 text-red-400 border border-red-500/30",
        blocked: "bg-red-500/15 text-red-400 border border-red-500/30",
        suspended: "bg-orange-500/15 text-orange-400 border border-orange-500/30",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
