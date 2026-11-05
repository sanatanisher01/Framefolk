import type { Metadata, Viewport } from "next";
import { Inter, Manrope } from "next/font/google";
import "./globals.css";
import { ToastContainer } from "@/components/layout/ToastContainer";
import { AuthProvider } from "@/lib/auth/AuthContext";
import { SWRegistrar } from "@/components/layout/SWRegistrar";
import { PWAInstallBanner } from "@/components/layout/PWAInstallBanner";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "FRAMEFOLK — Every frame has a story.",
    template: "%s | FRAMEFOLK",
  },
  description:
    "FRAMEFOLK is a premium photo and video sharing social network. Share your moments, build your story.",
  keywords: ["photography", "social network", "photo sharing", "memories", "albums"],
  authors: [{ name: "FRAMEFOLK" }],
  creator: "FRAMEFOLK",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? "https://framefolk.app"
  ),
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "/",
    siteName: "FRAMEFOLK",
    title: "FRAMEFOLK — Every frame has a story.",
    description: "Premium photo and video sharing social network.",
  },
  twitter: {
    card: "summary_large_image",
    title: "FRAMEFOLK",
    description: "Premium photo and video sharing social network.",
  },
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
    apple: "/icons/icon-192.svg",
  },
};

export const viewport: Viewport = {
  themeColor: "#FF765E",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${manrope.variable}`}
      suppressHydrationWarning
    >
      <body className="bg-bg-primary text-text-primary antialiased">
        <AuthProvider>
          {children}
          <ToastContainer />
          <SWRegistrar />
          <PWAInstallBanner />
        </AuthProvider>
      </body>
    </html>
  );
}
