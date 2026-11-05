"use client";

import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Mail, Lock, AlertCircle } from "lucide-react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";

import { loginSchema, type LoginFormValues } from "@/lib/validations/auth";
import { loginWithEmail, signInWithGoogle } from "@/services/auth.service";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Separator } from "@/components/ui/Separator";
import { LogoMark } from "@/components/ui/Logo";
import { fadeUp, staggerFast } from "@/lib/animations";

const stagger = staggerFast;

function getFirebaseError(code: string): string {
  const map: Record<string, string> = {
    "auth/user-not-found": "No account found with this email.",
    "auth/wrong-password": "Incorrect password. Please try again.",
    "auth/invalid-credential": "Incorrect email or password.",
    "auth/invalid-email": "Please enter a valid email address.",
    "auth/user-disabled": "This account has been disabled.",
    "auth/too-many-requests": "Too many attempts. Please try again later.",
    "auth/network-request-failed": "Network error. Check your connection.",
    "auth/popup-closed-by-user": "Sign-in popup was closed. Please try again.",
  };
  return map[code] ?? "Something went wrong. Please try again.";
}

/** Determine where to send user after successful login based on account state */
function getPostLoginRoute(status: string | undefined, hasUsername: boolean, emailVerified: boolean): string {
  if (!emailVerified) return "/onboarding";
  if (!hasUsername) return "/onboarding";
  // blocked/suspended users see the pending page with a status-specific message
  if (status === "blocked" || status === "suspended") return "/pending";
  if (status === "rejected") return "/pending";
  // approved OR pending (auto-approve means pending is now just "newly registered, not onboarded")
  return "/home";
}

export function LoginForm() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({ resolver: zodResolver(loginSchema) });

  async function onSubmit(data: LoginFormValues) {
    setIsLoading(true);
    setError(null);
    try {
      const fbUser = await loginWithEmail(data.email, data.password);
      // Read Firestore status via a quick fetch (AuthContext will pick it up too)
      const { getUserDoc } = await import("@/services/auth.service");
      const userDoc = await getUserDoc(fbUser.uid);
      const route = getPostLoginRoute(
        userDoc?.status as string | undefined,
        !!(userDoc?.username),
        fbUser.emailVerified
      );
      router.replace(route);
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? "";
      setError(getFirebaseError(code));
    } finally {
      setIsLoading(false);
    }
  }

  async function handleGoogleSignIn() {
    setGoogleLoading(true);
    setError(null);
    try {
      const fbUser = await signInWithGoogle();
      const { getUserDoc } = await import("@/services/auth.service");
      const userDoc = await getUserDoc(fbUser.uid);
      const route = getPostLoginRoute(
        userDoc?.status as string | undefined,
        !!(userDoc?.username),
        fbUser.emailVerified
      );
      router.replace(route);
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? "";
      setError(getFirebaseError(code));
    } finally {
      setGoogleLoading(false);
    }
  }

  return (
    <motion.div
      variants={stagger}
      initial="hidden"
      animate="show"
      className="w-full max-w-sm"
    >
      <motion.div variants={fadeUp} className="flex justify-center mb-6 md:hidden">
        <LogoMark size={40} />
      </motion.div>

      <motion.div variants={fadeUp}>
        <Card className="w-full">
          <CardHeader className="pb-2">
            <CardTitle className="text-2xl font-display">Welcome back</CardTitle>
            <CardDescription>Sign in to your FRAMEFOLK account.</CardDescription>
          </CardHeader>

          <CardContent className="flex flex-col gap-4 pt-4">
            {/* Error banner */}
            {error && (
              <div className="flex items-start gap-2.5 rounded-xl bg-red-500/10 border border-red-500/30 px-3 py-2.5">
                <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}

            {/* Google */}
            <Button
              variant="secondary"
              className="w-full gap-3"
              loading={googleLoading}
              onClick={handleGoogleSignIn}
              type="button"
            >
              {!googleLoading && (
                <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" aria-hidden>
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
              )}
              Continue with Google
            </Button>

            <div className="relative flex items-center gap-3">
              <Separator className="flex-1" />
              <span className="text-xs text-text-muted font-medium shrink-0">or sign in with email</span>
              <Separator className="flex-1" />
            </div>

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
              <Input
                type={showPassword ? "text" : "password"}
                label="Password"
                placeholder="Your password"
                autoComplete="current-password"
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
              <div className="flex justify-end -mt-1">
                <Link href="/forgot-password" className="text-xs text-accent hover:underline font-medium">
                  Forgot password?
                </Link>
              </div>
              <Button type="submit" variant="primary" className="w-full mt-1" loading={isLoading}>
                Sign in
              </Button>
            </form>

            <p className="text-center text-sm text-text-secondary">
              Don&apos;t have an account?{" "}
              <Link href="/register" className="text-accent hover:underline font-medium">Create one</Link>
            </p>
          </CardContent>
        </Card>
      </motion.div>

      <motion.p variants={fadeUp} className="text-center text-xs text-text-muted mt-5">
        Every frame has a story.
      </motion.p>
    </motion.div>
  );
}
