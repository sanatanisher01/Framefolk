"use client";

import { useState, useEffect, useCallback } from "react";
import { sendEmailVerification, reload } from "firebase/auth";
import type { User as FirebaseUser } from "firebase/auth";
import { Mail, RefreshCw, CheckCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

interface Props {
  firebaseUser: FirebaseUser;
  onVerified: () => void;
}

export function StepVerifyEmail({ firebaseUser, onVerified }: Props) {
  const [resending, setResending] = useState(false);
  const [checking, setChecking] = useState(false);
  const [resent, setResent] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  // Poll every 4s to detect email verification
  useEffect(() => {
    if (firebaseUser.emailVerified) {
      onVerified();
      return;
    }

    const interval = setInterval(async () => {
      try {
        await reload(firebaseUser);
        if (firebaseUser.emailVerified) {
          onVerified();
          clearInterval(interval);
        }
      } catch {
        // Network error — keep polling
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [firebaseUser, onVerified]);

  // Cooldown timer after resend
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const handleResend = useCallback(async () => {
    setResending(true);
    try {
      await sendEmailVerification(firebaseUser, {
        url: `${window.location.origin}/onboarding`,
      });
      setResent(true);
      setCooldown(60);
    } catch {
      // Ignore — likely too-many-requests
    } finally {
      setResending(false);
    }
  }, [firebaseUser]);

  const handleCheckNow = useCallback(async () => {
    setChecking(true);
    try {
      await reload(firebaseUser);
      if (firebaseUser.emailVerified) {
        onVerified();
      }
    } catch {
      // Ignore
    } finally {
      setChecking(false);
    }
  }, [firebaseUser, onVerified]);

  return (
    <Card className="w-full">
      <CardHeader className="pb-2">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/10 border border-accent/30 mb-2">
          <Mail className="h-6 w-6 text-accent" />
        </div>
        <CardTitle className="text-xl">Verify your email</CardTitle>
        <CardDescription>
          We sent a verification link to{" "}
          <span className="text-text-primary font-medium">
            {firebaseUser.email}
          </span>
          . Click the link in the email to continue.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Button
          variant="primary"
          className="w-full"
          onClick={handleCheckNow}
          loading={checking}
        >
          <RefreshCw className="h-4 w-4" />
          I&apos;ve verified my email
        </Button>

        <Button
          variant="secondary"
          className="w-full"
          onClick={handleResend}
          loading={resending}
          disabled={cooldown > 0}
        >
          {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend verification email"}
        </Button>

        {resent && cooldown > 0 && (
          <div className="flex items-center gap-2 text-xs text-green-400 justify-center">
            <CheckCircle className="h-3.5 w-3.5" />
            Verification email sent!
          </div>
        )}

        <p className="text-xs text-text-muted text-center">
          Check your spam folder if you don&apos;t see it.
        </p>
      </CardContent>
    </Card>
  );
}
