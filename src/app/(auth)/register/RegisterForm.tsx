"use client";

import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Mail, Lock, User, Check, AlertCircle } from "lucide-react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";

import { registerSchema, type RegisterFormValues } from "@/lib/validations/auth";
import { registerWithEmail, signInWithGoogle } from "@/services/auth.service";
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Separator } from "@/components/ui/Separator";
import { LogoMark } from "@/components/ui/Logo";
import { cn } from "@/utils/cn";
import { fadeUp, staggerFast } from "@/lib/animations";

const stagger = staggerFast;

function PasswordStrength({ password }: { password: string }) {
  const checks = [
    { label: "8+ characters", pass: password.length >= 8 },
    { label: "Uppercase letter", pass: /[A-Z]/.test(password) },
    { label: "Number", pass: /[0-9]/.test(password) },
  ];
  if (!password) return null;
  return (
    <ul className="flex flex-col gap-1 mt-1">
      {checks.map((c) => (
        <li key={c.label} className="flex items-center gap-1.5 text-xs">
          <span className={cn(
            "flex h-3.5 w-3.5 items-center justify-center rounded-full shrink-0 transition-colors",
            c.pass ? "bg-green-500/20 text-green-400" : "bg-bg-secondary text-text-muted"
          )}>
            <Check className="h-2.5 w-2.5" />
          </span>
          <span className={c.pass ? "text-green-400" : "text-text-muted"}>{c.label}</span>
        </li>
      ))}
    </ul>
  );
}

function getFirebaseError(code: string): string {
  const map: Record<string, string> = {
    "auth/email-already-in-use": "An account with this email already exists.",
    "auth/invalid-email": "Please enter a valid email address.",
    "auth/weak-password": "Password is too weak. Use at least 8 characters.",
    "auth/network-request-failed": "Network error. Check your connection and try again.",
    "auth/too-many-requests": "Too many attempts. Please try again later.",
    "auth/popup-closed-by-user": "Sign-in popup was closed. Please try again.",
  };
  return map[code] ?? "Something went wrong. Please try again.";
}

export function RegisterForm() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
  });

  const passwordValue = watch("password", "");

  async function onSubmit(data: RegisterFormValues) {
    setIsLoading(true);
    setError(null);
    try {
      await registerWithEmail({
        displayName: data.displayName,
        email: data.email,
        password: data.password,
      });
      // Redirect to onboarding — user must verify email first
      router.push("/onboarding");
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
      await signInWithGoogle();
      router.push("/onboarding");
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
            <CardTitle className="text-2xl font-display">Create your account</CardTitle>
            <CardDescription>
              Join FRAMEFOLK. Every new account is reviewed before access is granted.
            </CardDescription>
          </CardHeader>

          <CardContent className="flex flex-col gap-4 pt-4">
            {/* Firebase error banner */}
            {error && (
              <div className="flex items-start gap-2.5 rounded-xl bg-red-500/10 border border-red-500/30 px-3 py-2.5">
                <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}

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
              <span className="text-xs text-text-muted font-medium shrink-0">or register with email</span>
              <Separator className="flex-1" />
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3" noValidate>
              <Input
                type="text"
                label="Full name"
                placeholder="Your name"
                autoComplete="name"
                leftIcon={<User className="h-4 w-4" />}
                error={errors.displayName?.message}
                {...register("displayName")}
              />
              <Input
                type="email"
                label="Email address"
                placeholder="you@example.com"
                autoComplete="email"
                leftIcon={<Mail className="h-4 w-4" />}
                error={errors.email?.message}
                {...register("email")}
              />
              <div className="flex flex-col gap-1">
                <Input
                  type={showPassword ? "text" : "password"}
                  label="Password"
                  placeholder="Create a strong password"
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
                <PasswordStrength password={passwordValue} />
              </div>

              <Button type="submit" variant="primary" className="w-full mt-2" loading={isLoading}>
                Create account
              </Button>

              <p className="text-xs text-text-muted text-center leading-relaxed">
                By creating an account, you agree to our{" "}
                <a href="#" className="text-accent hover:underline">Terms of Service</a>{" "}
                and{" "}
                <a href="#" className="text-accent hover:underline">Privacy Policy</a>.
              </p>
            </form>

            <p className="text-center text-sm text-text-secondary">
              Already have an account?{" "}
              <Link href="/login" className="text-accent hover:underline font-medium">Sign in</Link>
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
