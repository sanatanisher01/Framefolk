import { LandingPage } from "@/components/layout/LandingPage";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "FRAMEFOLK — Every frame has a story.",
  description:
    "FRAMEFOLK is a premium photo and video sharing social network. Share your moments, build your story, and connect with the people who matter.",
};

export default function RootPage() {
  return <LandingPage />;
}
