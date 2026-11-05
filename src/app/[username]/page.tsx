import type { Metadata } from "next";
import { ProfilePage } from "@/components/profile/ProfilePage";

interface Props {
  params: { username: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return {
    title: `@${params.username}`,
    description: `View @${params.username}'s profile on FRAMEFOLK`,
  };
}

export default function UserProfilePage({ params }: Props) {
  return <ProfilePage username={params.username} />;
}
