import * as React from "react";
import { cn } from "@/utils/cn";

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
  showCount?: boolean;
  maxLength?: number;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, hint, showCount, maxLength, id, value, ...props }, ref) => {
    const generatedId = React.useId();
    const textareaId = id ?? generatedId;
    const charCount = typeof value === "string" ? value.length : 0;

    return (
      <div className="flex flex-col gap-1.5 w-full">
        {label && (
          <label htmlFor={textareaId} className="text-sm font-medium text-text-primary">
            {label}
          </label>
        )}
        <textarea
          id={textareaId}
          className={cn(
            "w-full rounded-xl border bg-bg-secondary px-4 py-3 text-sm text-text-primary placeholder:text-text-muted",
            "border-border transition-colors duration-150 resize-none min-h-[100px]",
            "focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            error && "border-destructive focus:border-destructive focus:ring-destructive",
            className
          )}
          ref={ref}
          maxLength={maxLength}
          value={value}
          aria-invalid={!!error}
          aria-describedby={error ? `${textareaId}-error` : undefined}
          {...props}
        />
        <div className="flex justify-between items-center">
          <div>
            {error && (
              <p id={`${textareaId}-error`} className="text-xs text-destructive" role="alert">
                {error}
              </p>
            )}
            {hint && !error && (
              <p className="text-xs text-text-secondary">{hint}</p>
            )}
          </div>
          {showCount && maxLength && (
            <span className={cn(
              "text-xs tabular-nums",
              charCount >= maxLength * 0.9 ? "text-accent" : "text-text-muted"
            )}>
              {charCount}/{maxLength}
            </span>
          )}
        </div>
      </div>
    );
  }
);
Textarea.displayName = "Textarea";

export { Textarea };
