"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AtSign, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { usernameSchema, type UsernameFormValues } from "@/lib/validations/auth";
import { checkUsernameAvailable, claimUsername } from "@/services/auth.service";
import { useDebounce } from "@/hooks/useDebounce";
import { cn } from "@/utils/cn";

interface Props {
  uid: string;
  onComplete: () => void;
  onBack: () => void;
}

type AvailState = "idle" | "checking" | "available" | "taken" | "error";

export function StepUsername({ uid, onComplete, onBack }: Props) {
  const [isLoading, setIsLoading] = useState(false);
  const [availState, setAvailState] = useState<AvailState>("idle");
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<UsernameFormValues>({
    resolver: zodResolver(usernameSchema),
    mode: "onChange",
  });

  const usernameValue = watch("username", "");
  const debouncedUsername = useDebounce(usernameValue, 500);

  // Availability check
  useEffect(() => {
    const val = debouncedUsername?.trim().toLowerCase();
    if (!val || val.length < 3) {
      setAvailState("idle");
      return;
    }
    let cancelled = false;
    setAvailState("checking");
    checkUsernameAvailable(val)
      .then((available) => {
        if (!cancelled) setAvailState(available ? "available" : "taken");
      })
      .catch(() => {
        if (!cancelled) setAvailState("error");
      });
    return () => { cancelled = true; };
  }, [debouncedUsername]);

  async function onSubmit(data: UsernameFormValues) {
    if (availState !== "available") return;
    setIsLoading(true);
    setServerError(null);
    try {
      await claimUsername({ uid, username: data.username });
      onComplete();
    } catch (err: unknown) {
      const msg = (err as Error).message ?? "";
      if (msg === "USERNAME_TAKEN") {
        setServerError("Someone just grabbed that username. Try another.");
      } else {
        setServerError("Something went wrong. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Card className="w-full">
      <CardHeader className="pb-2">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/10 border border-accent/30 mb-2">
          <AtSign className="h-6 w-6 text-accent" />
        </div>
        <CardTitle className="text-xl">Choose a username</CardTitle>
        <CardDescription>
          Your username is your unique identity on FRAMEFOLK. It appears in your
          profile URL and cannot be easily changed.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3" noValidate>
          <div className="flex flex-col gap-1.5">
            <Input
              type="text"
              label="Username"
              placeholder="yourname"
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              leftIcon={<AtSign className="h-4 w-4" />}
              rightIcon={
                availState === "checking" ? (
                  <Loader2 className="h-4 w-4 animate-spin text-text-secondary" />
                ) : availState === "available" ? (
                  <CheckCircle className="h-4 w-4 text-green-400" />
                ) : availState === "taken" ? (
                  <XCircle className="h-4 w-4 text-red-400" />
                ) : null
              }
              error={errors.username?.message ?? serverError ?? undefined}
              {...register("username")}
            />

            {/* Availability status */}
            {availState === "available" && !errors.username && (
              <p className="text-xs text-green-400 flex items-center gap-1.5">
                <CheckCircle className="h-3 w-3" />
                @{usernameValue.toLowerCase()} is available
              </p>
            )}
            {availState === "taken" && !errors.username && (
              <p className="text-xs text-red-400 flex items-center gap-1.5">
                <XCircle className="h-3 w-3" />
                @{usernameValue.toLowerCase()} is already taken
              </p>
            )}

            {/* Preview URL */}
            {usernameValue && (
              <p className="text-xs text-text-muted">
                Your profile:{" "}
                <span className={cn(
                  "font-mono",
                  availState === "available" ? "text-accent" : "text-text-secondary"
                )}>
                  framefolk.app/@{usernameValue.toLowerCase()}
                </span>
              </p>
            )}
          </div>

          <div className="flex gap-2 mt-1">
            <Button
              type="button"
              variant="secondary"
              className="flex-1"
              onClick={onBack}
            >
              Back
            </Button>
            <Button
              type="submit"
              variant="primary"
              className="flex-1"
              loading={isLoading}
              disabled={availState !== "available" || !!errors.username}
            >
              Continue
            </Button>
          </div>
        </form>

        <p className="text-xs text-text-muted text-center">
          Allowed: letters, numbers, periods and underscores (3–30 chars)
        </p>
      </CardContent>
    </Card>
  );
}
