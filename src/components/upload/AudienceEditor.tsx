"use client";
import { useEffect, useState } from "react";
import { collection, doc, getDocs, setDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useAuth } from "@/lib/auth/AuthContext";
import { getUserByUsername, getUserDoc } from "@/services/auth.service";
import { Button } from "@/components/ui/Button";

export function AudienceEditor({ closeFriends, value, onChange }: { closeFriends: boolean; value: string[]; onChange: (uids: string[]) => void }) {
  const { user } = useAuth();
  const currentUid = user?.uid;
  const [username, setUsername] = useState("");
  const [members, setMembers] = useState<{ uid: string; username: string }[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    async function load() {
      const ids = closeFriends && currentUid ? (await getDocs(collection(db, "closeFriends", currentUid, "members"))).docs.map(d => d.id) : value;
      const profiles = await Promise.all(ids.map(async uid => ({ uid, username: String((await getUserDoc(uid))?.username ?? uid) })));
      if (active) setMembers(profiles);
    }
    load().catch(() => { if (active) setError("Could not load this audience."); });
    return () => { active = false; };
  }, [closeFriends, currentUid, value]);
  async function add() {
    if (!user || !username.trim() || busy) return;
    setBusy(true); setError("");
    try {
      const profile = await getUserByUsername(username.replace(/^@/, "").trim());
      if (!profile || profile.uid === user.uid || !await getUserDoc(profile.uid)) throw new Error("Choose another active user by their exact username.");
      if (members.some(m => m.uid === profile.uid)) return;
      if (closeFriends) await setDoc(doc(db, "closeFriends", user.uid, "members", profile.uid), { uid: profile.uid, createdAt: serverTimestamp() });
      else onChange([...value, profile.uid]);
      setMembers(old => [...old, { uid: profile.uid, username: username.replace(/^@/, "").trim() }]); setUsername("");
    } catch (error) { setError((error as Error).message); }
    finally { setBusy(false); }
  }
  async function remove(uid: string) {
    if (!user) return;
    try {
      if (closeFriends) await deleteDoc(doc(db, "closeFriends", user.uid, "members", uid));
      else onChange(value.filter(id => id !== uid));
      setMembers(old => old.filter(m => m.uid !== uid));
    } catch { setError("Could not remove this person."); }
  }
  return <div className="space-y-2 text-sm">
    <p className="text-text-secondary">{closeFriends ? "Your close friends list" : "People who can see this"}</p>
    <div className="flex gap-2"><input className="flex-1 min-w-0 rounded-lg border border-border bg-bg-secondary p-2" aria-label="Audience username" placeholder="Exact @username" value={username} onChange={e => setUsername(e.target.value)} /><Button type="button" size="sm" loading={busy} onClick={add}>Add</Button></div>
    <div className="flex flex-wrap gap-2">{members.map(m => <button type="button" className="rounded-full border border-border px-2 py-1 text-xs" key={m.uid} onClick={() => remove(m.uid)} aria-label={`Remove ${m.username}`}>@{m.username} ×</button>)}</div>
    {members.length === 0 && <p className="text-xs text-text-muted">Add at least one person before sharing.</p>}
    {error && <p role="alert" className="text-xs text-red-400">{error}</p>}
  </div>;
}
