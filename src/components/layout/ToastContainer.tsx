"use client";

import { ToastProvider, ToastViewport, Toast, ToastTitle, ToastDescription } from "@/components/ui/Toast";
import { useToastState } from "@/hooks/useToast";

export function ToastContainer() {
  const { toasts } = useToastState();

  return (
    <ToastProvider swipeDirection="right">
      {toasts.map((t) => (
        <Toast key={t.id} variant={t.variant ?? "default"}>
          <ToastTitle>{t.title}</ToastTitle>
          {t.description && <ToastDescription>{t.description}</ToastDescription>}
        </Toast>
      ))}
      <ToastViewport />
    </ToastProvider>
  );
}
