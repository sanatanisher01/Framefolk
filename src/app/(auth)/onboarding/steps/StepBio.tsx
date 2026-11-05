"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Smile, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { onboardingProfileSchema, type OnboardingProfileFormValues } from "@/lib/validations/auth";
import { completeOnboarding } from "@/services/auth.service";

interface Props {
  uid: string;
  displayName: string;
  onComplete: () => void;
  onBack: () => void;
}

const BIO_PROMPTS = [
  "Photography enthusiast 📷",
  "Capturing moments, one frame at a time",
  "The world through my lens",
  "Making memories last forever",
];

export function StepBio({ uid, displayName, onComplete, onBack }: Props) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<OnboardingProfileFormValues>({
    resolver: zodResolver(onboardingProfileSchema),
    defaultValues: { bio: "" },
  });

  const bioValue = watch("bio", "");

  async function onSubmit(data: OnboardingProfileFormValues) {
    setIsLoading(true);
    setError(null);
    try {
      await completeOnboarding({
        uid,
        bio: data.bio ?? "",
        displayName,
      });
      onComplete();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Card className="w-full">
      <CardHeader className="pb-2">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/10 border border-accent/30 mb-2">
          <Smile className="h-6 w-6 text-accent" />
        </div>
        <CardTitle className="text-xl">Tell us about yourself</CardTitle>
        <CardDescription>
          Add a short bio to your profile. You can always update it later.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
          <Textarea
            label="Bio"
            placeholder="Write a short bio..."
            maxLength={200}
            showCount
            value={bioValue}
            error={errors.bio?.message ?? error ?? undefined}
            {...register("bio")}
          />

          {/* Quick prompts */}
          <div className="flex flex-col gap-1.5">
            <p className="text-xs text-text-muted flex items-center gap-1">
              <Sparkles className="h-3 w-3" /> Quick ideas
            </p>
            <div className="flex flex-wrap gap-1.5">
              {BIO_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => setValue("bio", prompt)}
                  className="text-xs px-2.5 py-1 rounded-full bg-bg-secondary border border-border text-text-secondary hover:border-accent/50 hover:text-text-primary transition-colors"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2 mt-1">
            <Button type="button" variant="secondary" className="flex-1" onClick={onBack}>
              Back
            </Button>
            <Button type="submit" variant="primary" className="flex-1" loading={isLoading}>
              Finish setup
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
