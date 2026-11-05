import * as React from "react";
import * as AvatarPrimitive from "@radix-ui/react-avatar";
import { cn } from "@/utils/cn";

const sizeMap = {
  xs: "h-6 w-6 text-xs",
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-14 w-14 text-base",
  xl: "h-20 w-20 text-xl",
  "2xl": "h-28 w-28 text-2xl",
};

export interface AvatarProps {
  src?: string | null;
  alt?: string;
  fallback?: string;
  size?: keyof typeof sizeMap;
  className?: string;
  /** Show online indicator */
  online?: boolean;
  /** Show story ring (accent coloured border) */
  hasStory?: boolean;
}

export function Avatar({
  src,
  alt,
  fallback,
  size = "md",
  className,
  online,
  hasStory,
}: AvatarProps) {
  const initials = fallback
    ? fallback
        .split(" ")
        .map((w) => w[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "?";

  return (
    <div className="relative inline-flex shrink-0">
      <AvatarPrimitive.Root
        className={cn(
          "relative flex shrink-0 overflow-hidden rounded-full",
          hasStory && "ring-2 ring-accent ring-offset-2 ring-offset-bg-primary",
          sizeMap[size],
          className
        )}
      >
        <AvatarPrimitive.Image
          src={src ?? undefined}
          alt={alt ?? fallback ?? "Avatar"}
          className="aspect-square h-full w-full object-cover"
        />
        <AvatarPrimitive.Fallback
          className="flex h-full w-full items-center justify-center rounded-full bg-bg-card text-text-secondary font-medium font-display"
          delayMs={300}
        >
          {initials}
        </AvatarPrimitive.Fallback>
      </AvatarPrimitive.Root>

      {online && (
        <span
          className="absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full bg-green-500 ring-2 ring-bg-primary"
          aria-label="Online"
        />
      )}
    </div>
  );
}
