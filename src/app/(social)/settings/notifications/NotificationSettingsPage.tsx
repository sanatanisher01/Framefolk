"use client";

import { useState, useEffect } from "react";
import { Bell, Heart, MessageCircle, UserPlus, BookImage, Shield, CheckCircle } from "lucide-react";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useAuth } from "@/lib/auth/AuthContext";
import { MobileHeader } from "@/components/layout/MobileHeader";
import { Card } from "@/components/ui/Card";
import { Separator } from "@/components/ui/Separator";
import { Spinner } from "@/components/ui/Spinner";
import { cn } from "@/utils/cn";

interface NotifPrefs {
  likes: boolean;
  comments: boolean;
  follows: boolean;
  followRequests: boolean;
  messages: boolean;
  albumInvites: boolean;
  adminActions: boolean;
}

const DEFAULT_PREFS: NotifPrefs = {
  likes: true,
  comments: true,
  follows: true,
  followRequests: true,
  messages: true,
  albumInvites: true,
  adminActions: true,
};

const SETTINGS: { key: keyof NotifPrefs; label: string; description: string; icon: React.ElementType }[] = [
  { key: "likes", label: "Likes", description: "When someone likes your post", icon: Heart },
  { key: "comments", label: "Comments", description: "When someone comments on your post", icon: MessageCircle },
  { key: "follows", label: "New followers", description: "When someone follows you", icon: UserPlus },
  { key: "followRequests", label: "Follow requests", description: "When someone requests to follow you", icon: UserPlus },
  { key: "messages", label: "Direct messages", description: "When you receive a new message", icon: MessageCircle },
  { key: "albumInvites", label: "Album invites", description: "When you're invited to a collaborative album", icon: BookImage },
  { key: "adminActions", label: "Account notifications", description: "Important updates from FRAMEFOLK", icon: Shield },
];

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      disabled={disabled}
      className={cn(
        "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent shrink-0",
        checked ? "bg-accent" : "bg-bg-secondary border border-border",
        disabled && "opacity-50 pointer-events-none"
      )}
    >
      <span className={cn(
        "inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform",
        checked ? "translate-x-6" : "translate-x-1"
      )} />
    </button>
  );
}

export function NotificationSettingsPage() {
  const { user } = useAuth();
  const [prefs, setPrefs] = useState<NotifPrefs>(DEFAULT_PREFS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Load prefs from Firestore
  useEffect(() => {
    if (!user || !db) { setLoading(false); return; }
    getDoc(doc(db, "notificationPrefs", user.uid))
      .then((snap) => {
        if (snap.exists()) {
          setPrefs({ ...DEFAULT_PREFS, ...(snap.data() as Partial<NotifPrefs>) });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user]);

  async function handleToggle(key: keyof NotifPrefs, value: boolean) {
    if (!user || !db) return;
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    setSaving(true);
    try {
      await setDoc(doc(db, "notificationPrefs", user.uid), {
        ...next,
        updatedAt: serverTimestamp(),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      // revert on error
      setPrefs(prefs);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <MobileHeader title="Notifications" showBack />
      <div className="max-w-xl mx-auto px-4 py-6 flex flex-col gap-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display font-bold text-xl text-text-primary hidden lg:block">
              Notification preferences
            </h1>
            <p className="text-sm text-text-secondary mt-0.5">
              Choose which in-app notifications you receive.
            </p>
          </div>
          {(saving || saved) && (
            <div className="flex items-center gap-1.5 text-xs text-text-secondary">
              {saving
                ? <Spinner size="sm" />
                : <CheckCircle className="h-3.5 w-3.5 text-green-400" />}
              {saving ? "Saving…" : "Saved"}
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Spinner size="lg" /></div>
        ) : (
          <section className="flex flex-col gap-1">
            <p className="text-xs font-medium text-text-muted uppercase tracking-wider px-1 mb-1">
              In-app notifications
            </p>
            <Card>
              {SETTINGS.map((item, idx) => {
                const Icon = item.icon;
                return (
                  <div key={item.key}>
                    <div className="flex items-center gap-3 px-4 py-3.5">
                      <div className="h-9 w-9 rounded-xl bg-bg-secondary flex items-center justify-center shrink-0">
                        <Icon className="h-4 w-4 text-text-secondary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-text-primary">{item.label}</p>
                        <p className="text-xs text-text-muted">{item.description}</p>
                      </div>
                      <Toggle
                        checked={prefs[item.key]}
                        onChange={(v) => handleToggle(item.key, v)}
                        disabled={saving}
                      />
                    </div>
                    {idx < SETTINGS.length - 1 && <Separator className="mx-4" />}
                  </div>
                );
              })}
            </Card>
          </section>
        )}

        <p className="text-xs text-text-muted text-center pb-2">
          Push notifications can be managed from your device&apos;s system settings.
        </p>
      </div>
    </>
  );
}
