import type { Metadata } from "next";
import { OnboardingWizard } from "./OnboardingWizard";

export const metadata: Metadata = { title: "Complete your profile" };

export default function OnboardingPage() {
  return <OnboardingWizard />;
}
