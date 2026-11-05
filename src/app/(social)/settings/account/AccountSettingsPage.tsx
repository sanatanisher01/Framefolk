"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Eye, EyeOff, Lock, Shield, UserX, CheckCircle, AlertCircle,
} from "lucide-react";
import {
  updatePassword, reauthenticateWithCredential, EmailAuthProvider,
} from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { useAuth } from "@/lib/auth/AuthContext";
import { MobileHeader } from "@/components/layout/MobileHeader";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Separator } from "@/components/ui/Separator";
import {
  updatePrivacySettings,
  subscribeToBlockedUsers,
  unblockUser,
  getUserDoc,
} from "@/services/auth.service";
import { cn } from "@/utils/cn";
import { useEffect } from "react";

// ─────────────────────────────────────────────
// Password change section
// ─────────────────────────────────────────────

function PasswordSection() {
  const { firebaseUser } = useAuth();
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Check if user has a password (not Google-only)
  const isPasswordProvider = firebaseUser?.providerData.some(
    (p) => p.providerId === "password"
  );

  if (!isPasswordProvider) {
    return (
      <div className="px-4 py-3 text-sm text-text-secondary">
        You signed in with Google. Password change is not available for Google accounts.
      </div>
    );
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!firebaseUser || !auth) return;
    if (newPw.length < 8) { setError("New password must be at least 8 characters."); return; }
    if (!/[A-Z]/.test(newPw)) { setError("New password must contain at least one uppercase letter."); return; }
    if (!/[0-9]/.test(newPw)) { setError("New password must contain at least one number."); return; }
    if (newPw !== confirmPw) { setError("Passwords do not match."); return; }

    setLoading(true);
    try {
      // Re-authenticate before changing password
      const credential = EmailAuthProvider.credential(firebaseUser.email ?? "", currentPw);
      await reauthenticateWithCredential(firebaseUser, credential);
      await updatePassword(firebaseUser, newPw);
      setSuccess(true);
      setCurrentPw(""); setNewPw(""); setConfirmPw("");
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? "";
      if (code === "auth/wrong-password" || code === "auth/invalid-credential") {
        setError("Current password is incorrect.");
      } else if (code === "auth/too-many-requests") {
        setError("Too many attempts. Please try again later.");
      } else {
        setError("Failed to update password. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleChangePassword} className="flex flex-col gap-3 px-4 py-3">
      {success && (
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-green-500/10 border border-green-500/30">
          <CheckCircle className="h-4 w-4 text-green-400 shrink-0" />
          <p className="text-sm text-green-400">Password updated successfully.</p>
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/30">
          <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}
      <Input
        type={showCurrent ? "text" : "password"}
        label="Current password"
        placeholder="Your current password"
        autoComplete="current-password"
        value={currentPw}
        onChange={(e) => setCurrentPw(e.target.value)}
        leftIcon={<Lock className="h-4 w-4" />}
        rightIcon={
          <button type="button" onClick={() => setShowCurrent((v) => !v)} className="p-0.5 hover:text-text-primary">
            {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        }
      />
      <Input
        type={showNew ? "text" : "password"}
        label="New password"
        placeholder="Min. 8 chars, 1 uppercase, 1 number"
        autoComplete="new-password"
        value={newPw}
        onChange={(e) => setNewPw(e.target.value)}
        leftIcon={<Lock className="h-4 w-4" />}
        rightIcon={
          <button type="button" onClick={() => setShowNew((v) => !v)} className="p-0.5 hover:text-text-primary">
            {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        }
      />
      <Input
        type="password"
        label="Confirm new password"
        placeholder="Re-enter new password"
        autoComplete="new-password"
        value={confirmPw}
        onChange={(e) => setConfirmPw(e.target.value)}
        leftIcon={<Lock className="h-4 w-4" />}
      />
      <Button type="submit" variant="primary" size="sm" loading={loading} className="self-start mt-1">
        Update password
      </Button>
    </form>
  );
}

// ─────────────────────────────────────────────
// Privacy section
// ─────────────────────────────────────────────

function PrivacySection() {
  const { user } = useAuth();
  const [isPrivate, setIsPrivate] = useState(user?.isPrivate ?? false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setIsPrivate(user?.isPrivate ?? false);
  }, [user?.isPrivate]);

  async function handleToggle() {
    if (!user || loading) return;
    const next = !isPrivate;
    setIsPrivate(next);
    setLoading(true);
    try {
      await updatePrivacySettings(user.uid, next);
    } catch {
      setIsPrivate(!next); // revert on error
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center justify-between px-4 py-3.5">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-text-primary">Private account</p>
        <p className="text-xs text-text-muted mt-0.5">
          Only approved followers can see your posts and stories.
        </p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={isPrivate}
        onClick={handleToggle}
        disabled={loading}
        className={cn(
          "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent shrink-0 ml-4",
          isPrivate ? "bg-accent" : "bg-bg-secondary border border-border",
          loading && "opacity-50"
        )}
      >
        <span
          className={cn(
            "inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform",
            isPrivate ? "translate-x-6" : "translate-x-1"
          )}
        />
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────
// Blocked users section
// ─────────────────────────────────────────────

function BlockedUsersSection() {
  const { user } = useAuth();
  const [blockedUids, setBlockedUids] = useState<string[]>([]);
  const [blockedUsers, setBlockedUsers] = useState<Record<string, { username: string; displayName: string; photoUrl: string }>>({});
  const [unblockLoading, setUnblockLoading] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!user) return;
    const unsub = subscribeToBlockedUsers(user.uid, (uids) => {
      setBlockedUids(uids);
      // Fetch user info for each
      uids.forEach(async (uid) => {
        if (blockedUsers[uid]) return;
        try {
          const doc = await getUserDoc(uid);
          if (doc) {
            setBlockedUsers((prev) => ({
              ...prev,
              [uid]: {
                username: (doc.username as string) ?? "",
                displayName: (doc.displayName as string) ?? "",
                photoUrl: (doc.profilePhotoUrl as string) ?? "",
              },
            }));
          }
        } catch { /* ignore */ }
      });
    });
    return unsub;
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleUnblock(targetUid: string) {
    if (!user) return;
    setUnblockLoading((s) => ({ ...s, [targetUid]: true }));
    try {
      await unblockUser(user.uid, targetUid);
    } catch { /* ignore */ } finally {
      setUnblockLoading((s) => ({ ...s, [targetUid]: false }));
    }
  }

  if (blockedUids.length === 0) {
    return (
      <div className="px-4 py-3 text-sm text-text-muted">
        You haven&apos;t blocked anyone.
      </div>
    );
  }

  return (
    <div className="divide-y divide-border/50">
      {blockedUids.map((uid) => {
        const info = blockedUsers[uid];
        return (
          <div key={uid} className="flex items-center gap-3 px-4 py-3">
            <div className="h-9 w-9 rounded-full bg-bg-secondary flex items-center justify-center shrink-0">
              <UserX className="h-4 w-4 text-text-muted" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-text-primary truncate">
                {info?.displayName || uid}
              </p>
              {info?.username && (
                <p className="text-xs text-text-muted">@{info.username}</p>
              )}
            </div>
            <Button
              size="sm"
              variant="secondary"
              loading={unblockLoading[uid]}
              onClick={() => handleUnblock(uid)}
            >
              Unblock
            </Button>
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────

export function AccountSettingsPage() {
  return (
    <>
      <MobileHeader title="Account & Privacy" showBack />
      <div className="max-w-xl mx-auto px-4 py-6 flex flex-col gap-6">

        {/* Password */}
        <section className="flex flex-col gap-1">
          <p className="text-xs font-medium text-text-muted uppercase tracking-wider px-1 mb-1">
            Password
          </p>
          <Card>
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border/50">
              <div className="h-9 w-9 rounded-xl bg-bg-secondary flex items-center justify-center shrink-0">
                <Lock className="h-4 w-4 text-text-secondary" />
              </div>
              <p className="text-sm font-medium text-text-primary">Change password</p>
            </div>
            <PasswordSection />
          </Card>
        </section>

        {/* Privacy */}
        <section className="flex flex-col gap-1">
          <p className="text-xs font-medium text-text-muted uppercase tracking-wider px-1 mb-1">
            Privacy
          </p>
          <Card>
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border/50">
              <div className="h-9 w-9 rounded-xl bg-bg-secondary flex items-center justify-center shrink-0">
                <Shield className="h-4 w-4 text-text-secondary" />
              </div>
              <p className="text-sm font-medium text-text-primary">Account visibility</p>
            </div>
            <PrivacySection />
          </Card>
        </section>

        {/* Blocked users */}
        <section className="flex flex-col gap-1">
          <p className="text-xs font-medium text-text-muted uppercase tracking-wider px-1 mb-1">
            Blocked accounts
          </p>
          <Card>
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border/50">
              <div className="h-9 w-9 rounded-xl bg-bg-secondary flex items-center justify-center shrink-0">
                <UserX className="h-4 w-4 text-text-secondary" />
              </div>
              <p className="text-sm font-medium text-text-primary">Blocked users</p>
            </div>
            <BlockedUsersSection />
          </Card>
        </section>

      </div>
    </>
  );
}
