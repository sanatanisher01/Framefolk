import type { Metadata } from "next";
import { NotificationSettingsPage } from "./NotificationSettingsPage";

export const metadata: Metadata = { title: "Notification Settings" };

export default function Page() {
  return <NotificationSettingsPage />;
}
