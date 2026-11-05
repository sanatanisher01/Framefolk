"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/lib/auth/AuthContext";
import { StepVerifyEmail } from "./steps/StepVerifyEmail";
import { StepUsername } from "./steps/StepUsername";
import { StepPhoto } from "./steps/StepPhoto";
import { StepBio } from "./steps/StepBio";
import { FullPageSpinner } from "@/components/ui/Spinner";
import { Logo } from "@/components/ui/Logo";

export type OnboardingStep = "verify-email" | "username" | "photo" | "bio";

const STEPS: OnboardingStep[] = ["verify-email", "username", "photo", "bio"];

const STEP_LABELS: Record<OnboardingStep, string> = {
  "verify-email": "Verify email",
  username: "Username",
  photo: "Profile photo",
  bio: "About you",
};

export function OnboardingWizard() {
  const router = useRouter();
  const { firebaseUser, user, loading, initialized } = useAuth();
  const [step, setStep] = useState<OnboardingStep>("verify-email");
  const [direction, setDirection] = useState(1);

  // Redirect to login if not signed in
  useEffect(() => {
    if (!initialized || loading) return;
    if (!firebaseUser) {
      router.replace("/login");
      return;
    }
    // Jump past verify-email if already verified
    if (firebaseUser.emailVerified && step === "verify-email") {
      setStep("username");
    }
    // Jump past username if already set
    if (user?.username && step === "username") {
      setStep("photo");
    }
    // If onboarding is complete, go straight to /home (no approval needed)
    if (user?.onboardingComplete) {
      router.replace("/home");
    }
  }, [initialized, loading, firebaseUser, user, step, router]);

  function goNext() {
    const idx = STEPS.indexOf(step);
    if (idx < STEPS.length - 1) {
      setDirection(1);
      setStep(STEPS[idx + 1]);
    }
  }

  function goBack() {
    const idx = STEPS.indexOf(step);
    if (idx > 0) {
      setDirection(-1);
      setStep(STEPS[idx - 1]);
    }
  }

  if (!initialized || loading) return <FullPageSpinner />;
  if (!firebaseUser) return null;

  const currentIdx = STEPS.indexOf(step);
  const progress = ((currentIdx + 1) / STEPS.length) * 100;

  const variants = {
    enter: (d: number) => ({ opacity: 0, x: d > 0 ? 40 : -40 }),
    center: { opacity: 1, x: 0, transition: { duration: 0.35, ease: [0.25, 0.1, 0.25, 1] as [number, number, number, number] } },
    exit: (d: number) => ({
      opacity: 0, x: d > 0 ? -40 : 40,
      transition: { duration: 0.25, ease: [0.25, 0.1, 0.25, 1] as [number, number, number, number] },
    }),
  };

  return (
    <div className="w-full max-w-sm flex flex-col gap-6">
      {/* Logo */}
      <div className="flex justify-center">
        <Logo size="md" />
      </div>

      {/* Progress */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-xs text-text-secondary">
          <span className="font-medium">{STEP_LABELS[step]}</span>
          <span>{currentIdx + 1} of {STEPS.length}</span>
        </div>
        <div className="h-1.5 bg-bg-secondary rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-accent rounded-full"
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
          />
        </div>
        {/* Step dots */}
        <div className="flex items-center justify-center gap-2 pt-1">
          {STEPS.map((s, i) => (
            <div
              key={s}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i <= currentIdx
                  ? "bg-accent w-4"
                  : "bg-bg-secondary w-1.5"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Step content */}
      <div className="relative overflow-hidden" style={{ minHeight: 400 }}>
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={step}
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
          >
            {step === "verify-email" && (
              <StepVerifyEmail
                firebaseUser={firebaseUser}
                onVerified={goNext}
              />
            )}
            {step === "username" && (
              <StepUsername
                uid={firebaseUser.uid}
                onComplete={goNext}
                onBack={goBack}
              />
            )}
            {step === "photo" && (
              <StepPhoto
                uid={firebaseUser.uid}
                onComplete={goNext}
                onBack={goBack}
                onSkip={goNext}
              />
            )}
            {step === "bio" && (
              <StepBio
                uid={firebaseUser.uid}
                displayName={firebaseUser.displayName ?? ""}
                onComplete={() => router.replace("/home")}
                onBack={goBack}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
