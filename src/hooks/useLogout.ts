"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { logout } from "@/services/auth.service";

export function useLogout() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleLogout = useCallback(async () => {
    setLoading(true);
    try {
      await logout();
      router.replace("/login");
    } catch {
      // Ignore — user is effectively signed out locally even if network call fails
      router.replace("/login");
    } finally {
      setLoading(false);
    }
  }, [router]);

  return { logout: handleLogout, loading };
}
