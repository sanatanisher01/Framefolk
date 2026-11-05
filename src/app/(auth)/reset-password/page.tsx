import { Suspense } from "react";
import type { Metadata } from "next";
import { Spinner } from "@/components/ui/Spinner";
import { ResetPasswordForm } from "./ResetPasswordForm";

export const metadata: Metadata = { title: "Reset Password" };

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-16">
          <Spinner size="lg" />
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
