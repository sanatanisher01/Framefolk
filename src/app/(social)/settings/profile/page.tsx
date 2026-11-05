import type { Metadata } from "next";
import { EditProfilePage } from "./EditProfilePage";

export const metadata: Metadata = { title: "Edit Profile" };

export default function EditProfile() {
  return <EditProfilePage />;
}
