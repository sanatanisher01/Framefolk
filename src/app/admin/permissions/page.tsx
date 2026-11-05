"use client";

import { useState, useEffect } from "react";
import { collection, query, getDocs, onSnapshot, doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ShieldCheck, UserCog } from "lucide-react";

interface RoleRow {
  uid: string;
  role: string;
}

export default function PermissionsPage() {
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [userNames, setUserNames] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!db) { setLoading(false); return; }
    const q = query(collection(db, "roles"));
    const unsub = onSnapshot(q, async (snap) => {
      const roleRows = snap.docs.map((d) => ({
        uid: d.id,
        role: (d.data().role as string) ?? "user",
      }));
      setRoles(roleRows);
      // Load display names
      const nameMap: Record<string, string> = {};
      for (const r of roleRows) {
        try {
          const uSnap = await getDoc(doc(db!, "users", r.uid));
          if (uSnap.exists()) nameMap[r.uid] = (uSnap.data().displayName as string) ?? r.uid.slice(0, 8);
        } catch { /* ignore */ }
      }
      setUserNames(nameMap);
      setLoading(false);
    });
    return unsub;
  }, []);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <AdminPageHeader
        title="Permissions"
        description="Manage admin and moderator roles"
      />

      {loading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-3 bg-bg-card border border-border rounded-xl">
              <Skeleton circle className="h-9 w-9 shrink-0" />
              <Skeleton className="h-3 flex-1" />
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>
          ))}
        </div>
      ) : roles.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title="No roles assigned"
          description="Assign moderator or admin roles from the user management page."
        />
      ) : (
        <div className="flex flex-col gap-2">
          {roles.map((r) => (
            <div
              key={r.uid}
              className="flex items-center gap-3 p-3 bg-bg-card border border-border rounded-xl hover:shadow-card-hover transition-shadow"
            >
              <div className="h-9 w-9 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                <UserCog className="h-4 w-4 text-accent" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text-primary truncate">
                  {userNames[r.uid] ?? r.uid.slice(0, 12)}
                </p>
                <p className="text-xs text-text-muted font-mono">{r.uid}</p>
              </div>
              <Badge variant={r.role === "superAdmin" ? "default" : "secondary"}>
                {r.role === "superAdmin" ? "Super Admin" : r.role === "moderator" ? "Moderator" : "User"}
              </Badge>
            </div>
          ))}
        </div>
      )}

      <div className="mt-6 p-4 bg-bg-card border border-border rounded-xl">
        <p className="text-xs text-text-secondary leading-relaxed">
          <span className="font-medium text-text-primary">Role hierarchy: </span>
          Super Admin has full control including assigning roles. Moderators have configurable permissions
          (approve registrations, block accounts, review reports, approve deletions). Role assignment is done
          via the <span className="text-accent">setRole</span> Cloud Function — never client-side.
        </p>
      </div>
    </div>
  );
}
