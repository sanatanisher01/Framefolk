import type { Metadata } from "next";
import { AccountSettingsPage } from "./AccountSettingsPage";

export const metadata: Metadata = { title: "Account & Privacy" };

export default function Page() {
  return <AccountSettingsPage />;
}
