"use client";

import { useState, useCallback } from "react";

export type ToastVariant = "default" | "success" | "error" | "warning" | "info";

export interface ToastMessage {
  id: string;
  title: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number;
}

let toastQueue: ((t: ToastMessage) => void) | null = null;

/** Call this from anywhere outside React to show a toast */
export function showToast(message: Omit<ToastMessage, "id">) {
  toastQueue?.({ ...message, id: crypto.randomUUID() });
}

export function useToastState() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = useCallback((t: ToastMessage) => {
    setToasts((prev) => [...prev, t]);
    setTimeout(
      () => setToasts((prev) => prev.filter((x) => x.id !== t.id)),
      t.duration ?? 4000
    );
  }, []);

  // Register the global handler
  toastQueue = addToast;

  const toast = useCallback(
    (message: Omit<ToastMessage, "id">) => {
      addToast({ ...message, id: crypto.randomUUID() });
    },
    [addToast]
  );

  return { toasts, toast };
}

/** Convenience wrapper — returns just the toast() function */
export function useToast() {
  const { toast } = useToastState();
  return { toast };
}
