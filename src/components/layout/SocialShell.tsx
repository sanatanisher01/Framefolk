"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthContext";
import { Sidebar } from "./Sidebar";
import { BottomNav } from "./BottomNav";
import { subscribeToUnreadCount } from "@/services/messaging.service";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { FullPageSpinner } from "@/components/ui/Spinner";

/** Wrapper that injects live auth data into navigation components and guards social routes */
export function SocialShell({ children }: { children: React.ReactNode }) {
  const { user, isAdmin, initialized, loading, status } = useAuth();
  const router = useRouter();
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const uid = user?.uid;
  useEffect(() => {
    if (!uid || status !== "approved") return;
    const stopMessages = subscribeToUnreadCount(uid, setUnreadMessages);
    const stopNotifications = onSnapshot(query(collection(db, "notifications"), where("recipientUid", "==", uid), where("isRead", "==", false)), snap => setUnreadNotifications(snap.size), () => setUnreadNotifications(0));
    return () => { stopMessages(); stopNotifications(); };
  }, [uid, status]);

  useEffect(() => {
    if (!initialized || loading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (!user.isEmailVerified || !user.onboardingComplete) { router.replace("/onboarding"); return; }
    // Blocked or suspended users get redirected to /pending which shows the reason
    if (status === "blocked" || status === "suspended" || status === "rejected") {
      router.replace("/pending");
    }
  }, [initialized, loading, user, status, router]);

  // Show spinner while auth is resolving
  if (!initialized || loading) return <FullPageSpinner />;

  // Don't render social shell for unauthenticated or blocked users
  if (!user || !user.isEmailVerified || !user.onboardingComplete) return null;
  if (status === "blocked" || status === "suspended" || status === "rejected") return null;

  return (
    <div className="min-h-dvh bg-bg-primary">
      <Sidebar unreadMessages={unreadMessages} unreadNotifications={unreadNotifications}
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
      <BottomNav username={user?.username ?? "me"} unreadMessages={unreadMessages} />
    </div>
  );
}
