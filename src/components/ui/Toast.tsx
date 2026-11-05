"use client";

import * as React from "react";
import * as ToastPrimitive from "@radix-ui/react-toast";
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from "lucide-react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/utils/cn";

const ToastProvider = ToastPrimitive.Provider;
const ToastViewport = React.forwardRef<
  React.ElementRef<typeof ToastPrimitive.Viewport>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitive.Viewport>
>(({ className, ...props }, ref) => (
  <ToastPrimitive.Viewport
    ref={ref}
    className={cn(
      "fixed bottom-4 right-4 z-[100] flex max-h-screen w-full max-w-sm flex-col gap-2",
      "md:bottom-6 md:right-6",
      className
    )}
    {...props}
  />
));
ToastViewport.displayName = ToastPrimitive.Viewport.displayName;

const toastVariants = cva(
  "group pointer-events-auto relative flex w-full items-start gap-3 overflow-hidden rounded-xl border p-4 shadow-modal transition-all data-[swipe=cancel]:translate-x-0 data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)] data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[swipe=move]:transition-none data-[state=open]:animate-slide-in-right data-[state=closed]:opacity-0",
  {
    variants: {
      variant: {
        default: "bg-bg-card border-border text-text-primary",
        success: "bg-bg-card border-green-500/40 text-text-primary",
        error: "bg-bg-card border-red-500/40 text-text-primary",
        warning: "bg-bg-card border-yellow-500/40 text-text-primary",
        info: "bg-bg-card border-accent/40 text-text-primary",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

const icons = {
  default: null,
  success: <CheckCircle className="h-5 w-5 text-green-400 shrink-0 mt-0.5" />,
  error: <AlertCircle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />,
  warning: <AlertTriangle className="h-5 w-5 text-yellow-400 shrink-0 mt-0.5" />,
  info: <Info className="h-5 w-5 text-accent shrink-0 mt-0.5" />,
};

const Toast = React.forwardRef<
  React.ElementRef<typeof ToastPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitive.Root> &
    VariantProps<typeof toastVariants>
>(({ className, variant = "default", ...props }, ref) => (
  <ToastPrimitive.Root
    ref={ref}
    className={cn(toastVariants({ variant }), className)}
    {...props}
  >
    {variant && icons[variant]}
    <div className="flex-1 min-w-0">{props.children}</div>
    <ToastPrimitive.Close className="shrink-0 rounded-lg p-1 text-text-secondary hover:text-text-primary opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent">
      <X className="h-4 w-4" />
      <span className="sr-only">Dismiss</span>
    </ToastPrimitive.Close>
  </ToastPrimitive.Root>
));
Toast.displayName = ToastPrimitive.Root.displayName;

const ToastTitle = React.forwardRef<
  React.ElementRef<typeof ToastPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitive.Title>
>(({ className, ...props }, ref) => (
  <ToastPrimitive.Title
    ref={ref}
    className={cn("text-sm font-medium text-text-primary leading-snug", className)}
    {...props}
  />
));
ToastTitle.displayName = ToastPrimitive.Title.displayName;

const ToastDescription = React.forwardRef<
  React.ElementRef<typeof ToastPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitive.Description>
>(({ className, ...props }, ref) => (
  <ToastPrimitive.Description
    ref={ref}
    className={cn("text-xs text-text-secondary mt-0.5", className)}
    {...props}
  />
));
ToastDescription.displayName = ToastPrimitive.Description.displayName;

export {
  ToastProvider,
  ToastViewport,
  Toast,
  ToastTitle,
  ToastDescription,
};
