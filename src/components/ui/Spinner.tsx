import { cn } from "@/utils/cn";

interface SpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeMap = {
  sm: "h-4 w-4 border-2",
  md: "h-6 w-6 border-2",
  lg: "h-10 w-10 border-[3px]",
};

export function Spinner({ size = "md", className }: SpinnerProps) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={cn(
        "inline-block rounded-full border-accent border-t-transparent animate-spin",
        sizeMap[size],
        className
      )}
    />
  );
}

export function FullPageSpinner() {
  return (
    <div className="flex h-full min-h-[60vh] w-full items-center justify-center">
      <Spinner size="lg" />
    </div>
  );
}
