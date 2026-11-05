"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthContext";
import { Sidebar } from "./Sidebar";
import { BottomNav } from "./BottomNav";
import { FullPageSpinner } from "@/components/ui/Spinner";

/** Wrapper that injects live auth data into navigation components and guards social routes */
export function SocialShell({ children }: { children: React.ReactNode }) {
  const { user, isAdmin, initialized, loading, status } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!initialized || loading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    // Blocked or suspended users get redirected to /pending which shows the reason
    if (status === "blocked" || status === "suspended" || status === "rejected") {
      router.replace("/pending");
    }
  }, [initialized, loading, user, status, router]);

  // Show spinner while auth is resolving
  if (!initialized || loading) return <FullPageSpinner />;

  // Don't render social shell for unauthenticated or blocked users
  if (!user) return null;
  if (status === "blocked" || status === "suspended" || status === "rejected") return null;

  return (
    <div className="min-h-dvh bg-bg-primary">
      <Sidebar
        user={
          user
            ? {
                displayName: user.displayName,
                username: user.username,
                photoUrl: user.profilePhotoUrl || undefined,
              }
            : null
        }
        isAdmin={isAdmin}
      />
      <main className="lg:pl-[240px] pb-16 lg:pb-0 min-h-dvh transition-all duration-300">
        {children}
      </main>
      <BottomNav username={user?.username ?? "me"} />
    </div>
  );
}
