"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Cloud, CheckCircle, AlertCircle, Unplug, Plug, RotateCcw,
} from "lucide-react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { auth } from "@/lib/firebase/client";
import { useAuth } from "@/lib/auth/AuthContext";
import { MobileHeader } from "@/components/layout/MobileHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Separator } from "@/components/ui/Separator";
import { Badge } from "@/components/ui/Badge";
import { cloudinaryConnectionSchema, type CloudinaryConnectionFormValues } from "@/lib/validations/profile";
import { formatFileSize } from "@/utils/format";

interface ConnectionData {
  cloudName: string;
  status: "connected" | "disconnected" | "error";
  usageBytes: number;
  lastSyncedAt: Date | null;
}

export function StorageSettingsPage() {
  const { user } = useAuth();
  const [connection, setConnection] = useState<ConnectionData | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isPersonal = user?.storageProvider === "personal";

  // Subscribe to connection document
  useEffect(() => {
    if (!user || !db) { return; }

    const unsub = onSnapshot(
      doc(db, "cloudinaryConnections", user.uid),
      (snap) => {
        if (snap.exists()) {
          const d = snap.data();
          setConnection({
            cloudName: d.cloudName as string,
            status: d.status as ConnectionData["status"],
            usageBytes: (d.usageBytes as number) ?? 0,
            lastSyncedAt: d.lastSyncedAt?.toDate() ?? null,
          });
        } else {
          setConnection(null);
        }
      },
      () => setConnection(null)
    );
    return unsub;
  }, [user]);

  const {
    register,
    handleSubmit,
    reset: resetForm,
    formState: { errors },
  } = useForm<CloudinaryConnectionFormValues>({
    resolver: zodResolver(cloudinaryConnectionSchema),
  });

  async function getIdToken() {
    const fbUser = auth?.currentUser;
    if (!fbUser) throw new Error("Not signed in");
    return fbUser.getIdToken();
  }

  async function onConnect(data: CloudinaryConnectionFormValues) {
    setConnecting(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const token = await getIdToken();
      const res = await fetch("/api/cloudinary/connect", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });

      const json = await res.json() as { success?: boolean; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Connection failed");

      setSuccessMsg(`Connected to ${data.cloudName} successfully!`);
      setShowForm(false);
      resetForm();
    } catch (err: unknown) {
      setErrorMsg((err as Error).message ?? "Failed to connect. Check your credentials.");
    } finally {
      setConnecting(false);
    }
  }

  async function handleDisconnect() {
    setDisconnecting(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const token = await getIdToken();
      const res = await fetch("/api/cloudinary/disconnect", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json() as { success?: boolean; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Disconnect failed");
      setSuccessMsg("Switched back to FRAMEFOLK storage.");
    } catch (err: unknown) {
      setErrorMsg((err as Error).message ?? "Failed to disconnect.");
    } finally {
      setDisconnecting(false);
    }
  }

  return (
    <>
      <MobileHeader title="Storage" showBack />
      <div className="max-w-xl mx-auto px-4 py-6 flex flex-col gap-5">

        {/* Current provider */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center">
                <Cloud className="h-5 w-5 text-accent" />
              </div>
              <div>
                <CardTitle className="text-base">Storage Provider</CardTitle>
                <CardDescription className="text-xs">
                  Where your photos and videos are stored
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-bg-secondary">
              <div>
                <p className="text-sm font-medium text-text-primary">
                  {isPersonal ? "Your Cloudinary account" : "FRAMEFOLK central storage"}
                </p>
                <p className="text-xs text-text-secondary mt-0.5">
                  {isPersonal
                    ? connection?.cloudName ?? "Connected"
                    : "Managed by FRAMEFOLK · No setup required"}
                </p>
              </div>
              <Badge variant={isPersonal ? "approved" : "default"}>
                {isPersonal ? "Personal" : "Central"}
              </Badge>
            </div>

            {/* Personal connection status */}
            {isPersonal && connection && (
              <div className="flex flex-col gap-2">
                <Separator />
                <div className="flex items-center justify-between text-sm">
                  <span className="text-text-secondary">Cloud name</span>
                  <span className="text-text-primary font-mono text-xs">{connection.cloudName}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-text-secondary">Status</span>
                  <div className="flex items-center gap-1.5">
                    {connection.status === "connected"
                      ? <CheckCircle className="h-3.5 w-3.5 text-green-400" />
                      : <AlertCircle className="h-3.5 w-3.5 text-red-400" />}
                    <span className={connection.status === "connected" ? "text-green-400 text-xs" : "text-red-400 text-xs"}>
                      {connection.status === "connected" ? "Connected" : "Error"}
                    </span>
                  </div>
                </div>
                {connection.usageBytes > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-text-secondary">Storage used</span>
                    <span className="text-text-primary text-xs">{formatFileSize(connection.usageBytes)}</span>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Status messages */}
        {successMsg && (
          <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-green-500/10 border border-green-500/30">
            <CheckCircle className="h-4 w-4 text-green-400 shrink-0" />
            <p className="text-sm text-green-400">{successMsg}</p>
          </div>
        )}
        {errorMsg && (
          <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/30">
            <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
            <p className="text-sm text-red-400">{errorMsg}</p>
          </div>
        )}

        {/* Connect personal Cloudinary */}
        {!isPersonal && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Connect your Cloudinary account</CardTitle>
              <CardDescription>
                Use your own Cloudinary account for full control over your media storage and
                bandwidth.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {!showForm ? (
                <Button
                  variant="primary"
                  className="gap-2"
                  onClick={() => setShowForm(true)}
                >
                  <Plug className="h-4 w-4" />
                  Connect Cloudinary
                </Button>
              ) : (
                <form onSubmit={handleSubmit(onConnect)} className="flex flex-col gap-3" noValidate>
                  <Input
                    label="Cloud name"
                    placeholder="my-cloud-name"
                    autoCapitalize="none"
                    autoCorrect="off"
                    hint="Found in your Cloudinary Console dashboard"
                    error={errors.cloudName?.message}
                    {...register("cloudName")}
                  />
                  <Input
                    label="API Key"
                    placeholder="123456789012345"
                    autoCapitalize="none"
                    autoCorrect="off"
                    error={errors.apiKey?.message}
                    {...register("apiKey")}
                  />
                  <Input
                    type="password"
                    label="API Secret"
                    placeholder="Your API secret"
                    hint="Transmitted securely and stored encrypted. Never visible after saving."
                    error={errors.apiSecret?.message}
                    {...register("apiSecret")}
                  />
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      className="flex-1"
                      onClick={() => { setShowForm(false); resetForm(); setErrorMsg(null); }}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      variant="primary"
                      className="flex-1 gap-2"
                      loading={connecting}
                    >
                      {connecting ? "Verifying…" : "Connect"}
                    </Button>
                  </div>
                  <p className="text-xs text-text-muted text-center">
                    Your credentials are verified then stored securely. They are never logged or
                    exposed.
                  </p>
                </form>
              )}
            </CardContent>
          </Card>
        )}

        {/* Disconnect */}
        {isPersonal && (
          <Card>
            <CardContent className="pt-5 flex flex-col gap-3">
              <div>
                <p className="text-sm font-medium text-text-primary">Switch to FRAMEFOLK storage</p>
                <p className="text-xs text-text-secondary mt-1">
                  Your existing media in your personal Cloudinary account will remain there.
                  New uploads will use FRAMEFOLK&apos;s central storage.
                </p>
              </div>
              <Button
                variant="secondary"
                className="gap-2 text-red-400 border-red-500/30 hover:bg-red-500/10 w-full"
                onClick={handleDisconnect}
                loading={disconnecting}
              >
                <Unplug className="h-4 w-4" />
                Disconnect personal account
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Re-test connection */}
        {isPersonal && connection?.status === "error" && (
          <Button variant="secondary" className="gap-2" onClick={() => setShowForm(true)}>
            <RotateCcw className="h-4 w-4" />
            Re-enter credentials
          </Button>
        )}

        {/* Info card */}
        <Card className="bg-bg-secondary/50">
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-text-secondary leading-relaxed">
              <span className="text-text-primary font-medium">About storage modes: </span>
              Central storage (default) is managed by FRAMEFOLK at no cost to you.
              Personal Cloudinary gives you full control, your own CDN bandwidth and the ability to
              manage assets independently. Both modes use signed uploads and secure delivery.
            </p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
