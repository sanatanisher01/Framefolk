"use client";

import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Mail, AlertCircle, CheckCircle } from "lucide-react";
import { motion } from "framer-motion";
import { forgotPasswordSchema, type ForgotPasswordFormValues } from "@/lib/validations/auth";
import { sendPasswordReset } from "@/services/auth.service";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { fadeUp, staggerFast } from "@/lib/animations";

const stagger = staggerFast;

export function ForgotPasswordForm() {
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { register, handleSubmit, getValues, formState: { errors } } = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  async function onSubmit(data: ForgotPasswordFormValues) {
    setIsLoading(true);
    setError(null);
    try {
      await sendPasswordReset(data.email);
      setSent(true);
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? "";
      if (code === "auth/user-not-found") {
        // Don't reveal whether account exists — show success anyway
        setSent(true);
      } else if (code === "auth/too-many-requests") {
        setError("Too many requests. Please wait a few minutes and try again.");
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="w-full max-w-sm">
      <motion.div variants={fadeUp}>
        <Card className="w-full">
          <CardHeader className="pb-2">
            <CardTitle className="text-2xl font-display">Reset your password</CardTitle>
            <CardDescription>
              {sent
                ? "Check your inbox for a reset link."
                : "Enter your email and we'll send you a reset link."}
            </CardDescription>
          </CardHeader>

          <CardContent className="flex flex-col gap-4 pt-4">
            {sent ? (
              <div className="flex flex-col items-center gap-4 py-4 text-center">
                <div className="h-16 w-16 rounded-full bg-green-500/10 border border-green-500/30 flex items-center justify-center">
                  <CheckCircle className="h-8 w-8 text-green-400" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-text-primary">Email sent!</p>
                  <p className="text-xs text-text-secondary">
                    We sent a reset link to{" "}
                    <span className="text-text-primary">{getValues("email")}</span>.
                    Check your spam folder if you don&apos;t see it.
                  </p>
                </div>
                <Link href="/login">
                  <Button variant="primary" size="sm">Back to sign in</Button>
                </Link>
              </div>
            ) : (
              <>
                {error && (
                  <div className="flex items-start gap-2.5 rounded-xl bg-red-500/10 border border-red-500/30 px-3 py-2.5">
                    <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                    <p className="text-sm text-red-400">{error}</p>
                  </div>
                )}
                <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3" noValidate>
                  <Input
                    type="email"
                    label="Email address"
                    placeholder="you@example.com"
                    autoComplete="email"
                    leftIcon={<Mail className="h-4 w-4" />}
                    error={errors.email?.message}
                    {...register("email")}
                  />
                  <Button type="submit" variant="primary" className="w-full" loading={isLoading}>
                    Send reset link
                  </Button>
                </form>
                <p className="text-center text-sm text-text-secondary">
                  Remember your password?{" "}
                  <Link href="/login" className="text-accent hover:underline font-medium">Sign in</Link>
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
