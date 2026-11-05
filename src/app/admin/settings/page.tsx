"use client";

import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Separator } from "@/components/ui/Separator";
import { Button } from "@/components/ui/Button";
import { Settings as SettingsIcon, Database, Cloud, Shield } from "lucide-react";

export default function AdminSettingsPage() {
  return (
    <div className="p-6 max-w-3xl mx-auto">
      <AdminPageHeader title="Admin Settings" description="Platform configuration and feature flags" />

      <div className="flex flex-col gap-4">
        {/* Platform info */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center">
                <SettingsIcon className="h-5 w-5 text-accent" />
              </div>
              <div>
                <CardTitle className="text-base">Platform</CardTitle>
                <CardDescription className="text-xs">FRAMEFOLK platform information</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-2 text-sm">
              <div className="flex justify-between">
                <span className="text-text-secondary">Version</span>
                <span className="text-text-primary font-mono">1.0.0</span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-text-secondary">Firebase Project</span>
                <span className="text-text-primary font-mono">framefolk</span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-text-secondary">Cloudinary Cloud</span>
                <span className="text-text-primary font-mono">{process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? "Not configured"}</span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-text-secondary">Environment</span>
                <span className="text-text-primary font-mono">{process.env.NODE_ENV ?? "development"}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Storage */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                <Database className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <CardTitle className="text-base">Storage</CardTitle>
                <CardDescription className="text-xs">Cloudinary storage configuration</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-xs text-text-secondary">
              Storage settings are managed per-user. The platform central Cloudinary account is the default
              storage provider. Users can connect their own Cloudinary account from{" "}
              <span className="text-accent">Settings → Storage</span>.
            </p>
            <Button variant="secondary" size="sm" className="self-start gap-1.5">
              <Cloud className="h-4 w-4" />
              View Cloudinary dashboard
            </Button>
          </CardContent>
        </Card>

        {/* Security */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center justify-center">
                <Shield className="h-5 w-5 text-green-400" />
              </div>
              <div>
                <CardTitle className="text-base">Security</CardTitle>
                <CardDescription className="text-xs">Firebase App Check and security rules</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-text-secondary">Firestore Security Rules</span>
              <span className="text-green-400 text-xs">✓ Deployed</span>
            </div>
            <Separator />
            <div className="flex items-center justify-between text-sm">
              <span className="text-text-secondary">Composite Indexes</span>
              <span className="text-green-400 text-xs">✓ Deployed</span>
            </div>
            <Separator />
            <div className="flex items-center justify-between text-sm">
              <span className="text-text-secondary">App Check</span>
              <span className="text-yellow-400 text-xs">Configure in Firebase Console</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
