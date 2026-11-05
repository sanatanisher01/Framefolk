"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Lock, AlertCircle, CheckCircle } from "lucide-react";
import { motion } from "framer-motion";
import { confirmPasswordReset, verifyPasswordResetCode } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { resetPasswordSchema, type ResetPasswordFormValues } from "@/lib/validations/auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Spinner } from "@/components/ui/Spinner";
import { fadeUp, staggerFast } from "@/lib/animations";

const stagger = staggerFast;

type PageState = "verifying" | "ready" | "success" | "invalid";

function getFirebaseError(code: string): string {
  const map: Record<string, string> = {
    "auth/expired-action-code": "This reset link has expired. Please request a new one.",
    "auth/invalid-action-code": "This reset link is invalid or has already been used.",
    "auth/user-disabled": "This account has been disabled.",
    "auth/user-not-found": "No account associated with this link.",
    "auth/weak-password": "Password is too weak. Please choose a stronger one.",
  };
  return map[code] ?? "Something went wrong. Please try again.";
}

export function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const oobCode = searchParams.get("oobCode") ?? "";

  const [pageState, setPageState] = useState<PageState>("verifying");
  const [email, setEmail] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordFormValues>({ resolver: zodResolver(resetPasswordSchema) });

  // Verify the oobCode on mount
  useEffect(() => {
    if (!oobCode) {
      setPageState("invalid");
      return;
    }
    if (!auth) {
      setPageState("invalid");
      return;
    }

    verifyPasswordResetCode(auth, oobCode)
      .then((resolvedEmail) => {
        setEmail(resolvedEmail);
        setPageState("ready");
      })
      .catch(() => {
        setPageState("invalid");
      });
  }, [oobCode]);

  async function onSubmit(data: ResetPasswordFormValues) {
    if (!auth || !oobCode) return;
    setIsLoading(true);
    setError(null);
    try {
      await confirmPasswordReset(auth, oobCode, data.password);
      setPageState("success");
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? "";
      setError(getFirebaseError(code));
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="w-full max-w-sm">
      <motion.div variants={fadeUp}>
        <Card className="w-full">
          <CardHeader className="pb-2">
            <CardTitle className="text-2xl font-display">
              {pageState === "success" ? "Password updated!" : "Set new password"}
            </CardTitle>
            <CardDescription>
              {pageState === "ready" && email && (
                <>Resetting password for <span className="text-text-primary">{email}</span></>
              )}
              {pageState === "success" && "You can now sign in with your new password."}
              {pageState === "invalid" && "This link is no longer valid."}
              {pageState === "verifying" && "Verifying your reset link…"}
            </CardDescription>
          </CardHeader>

          <CardContent className="flex flex-col gap-4 pt-4">
            {/* Verifying */}
            {pageState === "verifying" && (
              <div className="flex justify-center py-8">
                <Spinner size="lg" />
              </div>
            )}

            {/* Invalid link */}
            {pageState === "invalid" && (
              <div className="flex flex-col items-center gap-4 py-4 text-center">
                <div className="h-16 w-16 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center">
                  <AlertCircle className="h-8 w-8 text-red-400" />
                </div>
                <p className="text-sm text-text-secondary">
                  This reset link is invalid or has expired. Request a new one from the
                  forgot password page.
                </p>
                <Link href="/forgot-password">
                  <Button variant="primary" size="sm">Request new link</Button>
                </Link>
              </div>
            )}

            {/* Success */}
            {pageState === "success" && (
              <div className="flex flex-col items-center gap-4 py-4 text-center">
                <div className="h-16 w-16 rounded-full bg-green-500/10 border border-green-500/30 flex items-center justify-center">
                  <CheckCircle className="h-8 w-8 text-green-400" />
                </div>
                <p className="text-sm text-text-secondary">
                  Your password has been updated successfully. Sign in with your new password.
                </p>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => router.replace("/login")}
                >
                  Sign in
                </Button>
              </div>
            )}

            {/* Ready — show form */}
            {pageState === "ready" && (
              <>
                {error && (
                  <div className="flex items-start gap-2.5 rounded-xl bg-red-500/10 border border-red-500/30 px-3 py-2.5">
                    <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                    <p className="text-sm text-red-400">{error}</p>
                  </div>
                )}

                <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3" noValidate>
                  <Input
                    type={showPassword ? "text" : "password"}
                    label="New password"
                    placeholder="Min. 8 characters"
                    autoComplete="new-password"
                    leftIcon={<Lock className="h-4 w-4" />}
                    rightIcon={
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        className="p-0.5 hover:text-text-primary transition-colors"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    }
                    error={errors.password?.message}
                    {...register("password")}
                  />
                  <Input
                    type={showConfirm ? "text" : "password"}
                    label="Confirm new password"
                    placeholder="Re-enter your password"
                    autoComplete="new-password"
                    leftIcon={<Lock className="h-4 w-4" />}
                    rightIcon={
                      <button
                        type="button"
                        onClick={() => setShowConfirm((v) => !v)}
                        className="p-0.5 hover:text-text-primary transition-colors"
                        aria-label={showConfirm ? "Hide password" : "Show password"}
                      >
                        {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    }
                    error={errors.confirmPassword?.message}
                    {...register("confirmPassword")}
                  />
                  <Button
                    type="submit"
                    variant="primary"
                    className="w-full mt-1"
                    loading={isLoading}
                  >
                    Update password
                  </Button>
                </form>

                <p className="text-center text-sm text-text-secondary">
                  Remembered it?{" "}
                  <Link href="/login" className="text-accent hover:underline font-medium">
                    Sign in
                  </Link>
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
