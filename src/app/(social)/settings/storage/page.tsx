import type { Metadata } from "next";
import { StorageSettingsPage } from "./StorageSettingsPage";

export const metadata: Metadata = { title: "Storage Settings" };

export default function StorageSettings() {
  return <StorageSettingsPage />;
}
