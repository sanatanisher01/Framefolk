"use client";

import { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, CheckCircle } from "lucide-react";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useAuth } from "@/lib/auth/AuthContext";
import { useDebounce } from "@/hooks/useDebounce";
import { checkUsernameAvailable } from "@/services/auth.service";
import { MobileHeader } from "@/components/layout/MobileHeader";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Separator } from "@/components/ui/Separator";
import { editProfileSchema, type EditProfileFormValues } from "@/lib/validations/profile";
import { cn } from "@/utils/cn";
import { ProfilePhotoUploader } from "@/components/profile/ProfilePhotoUploader";

export function EditProfilePage() {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [usernameAvail, setUsernameAvail] = useState<"idle" | "checking" | "available" | "taken">("idle");

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isDirty },
    reset,
  } = useForm<EditProfileFormValues>({
    resolver: zodResolver(editProfileSchema),
    defaultValues: {
      displayName: user?.displayName ?? "",
      username: user?.username ?? "",
      bio: user?.bio ?? "",
      website: "",
      location: "",
      pronouns: "",
      isPrivate: user?.isPrivate ?? false,
    },
  });

  const hydratedUid = useRef<string | null>(null);
  // Populate once per account; later snapshots must preserve edits.
  useEffect(() => {
    if (user && hydratedUid.current !== user.uid) {
      hydratedUid.current = user.uid;
      reset({
        displayName: user.displayName ?? "",
        username: user.username ?? "",
        bio: user.bio ?? "",
        website: "",
        location: "",
        pronouns: "",
        isPrivate: user.isPrivate ?? false,
      });
    }
  }, [user, reset]);

  const usernameValue = watch("username", "");
  const debouncedUsername = useDebounce(usernameValue, 500);

  // Username availability (skip check if unchanged)
  useEffect(() => {
    const val = debouncedUsername?.toLowerCase().trim();
    if (!val || val === user?.username || val.length < 3) {
      setUsernameAvail("idle");
      return;
    }
    let cancelled = false;
    setUsernameAvail("checking");
    checkUsernameAvailable(val).then((avail) => {
      if (!cancelled) setUsernameAvail(avail ? "available" : "taken");
    }).catch(() => {
      if (!cancelled) setUsernameAvail("idle");
    });
    return () => { cancelled = true; };
  }, [debouncedUsername, user?.username]);

  async function onSubmit(data: EditProfileFormValues) {
    if (!user || !db) return;
    if (usernameAvail === "taken") return;

    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      const updates: Record<string, unknown> = {
        displayName: data.displayName,
        bio: data.bio ?? "",
        isPrivate: data.isPrivate,
        updatedAt: serverTimestamp(),
      };

      // Username change — need to update usernames collection too
      if (data.username !== user.username) {
        const { claimUsername } = await import("@/services/auth.service");
        await claimUsername({ uid: user.uid, username: data.username });
        updates.username = data.username.toLowerCase();
      }

      await setDoc(doc(db, "users", user.uid), updates, { merge: true });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      reset(data); // clear dirty state
    } catch (err: unknown) {
      const msg = (err as Error).message ?? "";
      if (msg === "USERNAME_TAKEN") {
        setSaveError("That username was just taken. Please choose another.");
      } else {
        setSaveError("Failed to save. Please try again.");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <MobileHeader title="Edit Profile" showBack />
      <div className="max-w-xl mx-auto px-4 py-6 flex flex-col gap-6">

        {/* Avatar editor */}
        <div className="flex flex-col items-center gap-3">
          {user && (
            <ProfilePhotoUploader
              uid={user.uid}
              currentUrl={user.profilePhotoUrl}
              displayName={user.displayName}
              type="profile"
              onUpdated={() => {/* AuthContext real-time listener refreshes automatically */}}
            />
          )}
          <p className="text-xs text-text-secondary">Tap the camera to change your photo</p>
        </div>

        {/* Save status */}
        {saveSuccess && (
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-green-500/10 border border-green-500/30">
            <CheckCircle className="h-4 w-4 text-green-400 shrink-0" />
            <p className="text-sm text-green-400">Profile saved successfully.</p>
          </div>
        )}
        {saveError && (
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/30">
            <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
            <p className="text-sm text-red-400">{saveError}</p>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
          <Card>
            <CardContent className="flex flex-col gap-4 pt-5">
              <Input
                label="Display name"
                placeholder="Your name"
                error={errors.displayName?.message}
                {...register("displayName")}
              />
              <Separator />
              <div className="flex flex-col gap-1.5">
                <Input
                  label="Username"
                  placeholder="username"
                  autoCapitalize="none"
                  autoCorrect="off"
                  hint={`framefolk.app/@${usernameValue || user?.username || ""}`}
                  error={errors.username?.message ?? (usernameAvail === "taken" ? "Username is already taken" : undefined)}
                  rightIcon={
                    usernameAvail === "checking" ? (
                      <span className="h-4 w-4 rounded-full border-2 border-accent border-t-transparent animate-spin" />
                    ) : usernameAvail === "available" ? (
                      <CheckCircle className="h-4 w-4 text-green-400" />
                    ) : null
                  }
                  {...register("username")}
                />
              </div>
              <Separator />
              <Textarea
                label="Bio"
                placeholder="Tell people about yourself..."
                maxLength={200}
                showCount
                value={watch("bio", "")}
                error={errors.bio?.message}
                {...register("bio")}
              />
            </CardContent>
          </Card>

          {/* Privacy toggle */}
          <Card>
            <CardContent className="pt-5">
              <label className="flex items-start justify-between gap-4 cursor-pointer">
                <div>
                  <p className="text-sm font-medium text-text-primary">Private account</p>
                  <p className="text-xs text-text-secondary mt-0.5">
                    Only approved followers can see your posts and stories.
                  </p>
                </div>
                <div className="relative shrink-0 mt-0.5">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    {...register("isPrivate")}
                  />
                  <div className={cn(
                    "w-10 h-6 rounded-full transition-colors peer-checked:bg-accent bg-bg-secondary border border-border peer-checked:border-accent"
                  )} />
                  <div className={cn(
                    "absolute top-1 left-1 w-4 h-4 rounded-full bg-text-muted transition-transform",
                    "peer-checked:translate-x-4 peer-checked:bg-bg-primary"
                  )} />
                </div>
              </label>
            </CardContent>
          </Card>

          <Button
            type="submit"
            variant="primary"
            className="w-full"
            loading={saving}
            disabled={!isDirty && usernameAvail === "idle"}
          >
            Save changes
          </Button>
        </form>
      </div>
    </>
  );
}
