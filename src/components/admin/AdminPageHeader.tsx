"use client";

import { cn } from "@/utils/cn";

interface Props {
  title: string;
  description?: string;
  badge?: string;
  action?: React.ReactNode;
  className?: string;
}

export function AdminPageHeader({ title, description, badge, action, className }: Props) {
  return (
    <div className={cn("flex items-start justify-between gap-4 mb-6", className)}>
      <div>
        <div className="flex items-center gap-2.5">
          <h1 className="font-display font-bold text-2xl text-text-primary">{title}</h1>
          {badge && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-accent/10 text-accent border border-accent/20 font-medium">
              {badge}
            </span>
          )}
        </div>
        {description && (
          <p className="text-sm text-text-secondary mt-1">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}
