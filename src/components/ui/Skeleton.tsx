import { cn } from "@/utils/cn";

interface SkeletonProps {
  className?: string;
  /** Rounded full (circle shape) */
  circle?: boolean;
}

export function Skeleton({ className, circle }: SkeletonProps) {
  return (
    <div
      className={cn(
        "animate-skeleton bg-bg-secondary",
        circle ? "rounded-full" : "rounded-xl",
        className
      )}
      aria-hidden="true"
    />
  );
}

/** A standard post card skeleton */
export function PostSkeleton() {
  return (
    <div className="bg-bg-card border border-border rounded-2xl p-4 space-y-3">
      {/* Author row */}
      <div className="flex items-center gap-3">
        <Skeleton circle className="h-10 w-10 shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>
      {/* Media */}
      <Skeleton className="h-64 w-full rounded-xl" />
      {/* Actions */}
      <div className="flex gap-4">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-16" />
      </div>
    </div>
  );
}

/** A profile header skeleton */
export function ProfileSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-36 w-full rounded-2xl" />
      <div className="px-4 space-y-3 -mt-8">
        <Skeleton circle className="h-20 w-20 ring-4 ring-bg-primary" />
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-4 w-60" />
        <div className="flex gap-6 pt-1">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-20" />
        </div>
      </div>
    </div>
  );
}

/** Notification item skeleton */
export function NotificationSkeleton() {
  return (
    <div className="flex items-center gap-3 p-3">
      <Skeleton circle className="h-10 w-10 shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-3 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
      <Skeleton className="h-10 w-10 shrink-0 rounded-xl" />
    </div>
  );
}
