"use client";
import { auth } from "@/lib/firebase/client";

export async function platformRequest<T = void>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  const user = auth?.currentUser;
  if (!user) throw new Error("Sign in required.");
  const response = await fetch("/api/platform", {
    method: "POST", cache: "no-store",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${await user.getIdToken()}` },
    body: JSON.stringify({ action, ...payload }),
  });
  const text = await response.text();
  const body = text ? JSON.parse(text, (_key, value) => value && typeof value === "object" && value.$date ? new Date(value.$date) : value) : null;
  if (!response.ok) throw new Error(body?.error ?? "Request failed. Please try again.");
  if (!["posts", "stories", "albums", "conversations", "user", "albumMediaPage", "suggestedUsers", "searchUsers", "myMedia"].includes(action) && typeof window !== "undefined") window.dispatchEvent(new Event("framefolk:updated"));
  return body as T;
}

export function poll<T>(load: () => Promise<T>, callback: (value: T) => void, onError?: (error: Error) => void) {
  let stopped = false;
  let running = false;
  let timer: ReturnType<typeof setTimeout>;
  const run = async () => {
    if (running || stopped) return;
    running = true;
    try { const result = await load(); if (!stopped) callback(result); }
    catch (error) { if (!stopped) onError?.(error as Error); }
    finally { running = false; if (!stopped) timer = setTimeout(run, 15000); }
  };
  const update = () => { clearTimeout(timer); void run(); };
  window.addEventListener("framefolk:updated", update);
  void run();
  return () => { stopped = true; clearTimeout(timer); window.removeEventListener("framefolk:updated", update); };
}
