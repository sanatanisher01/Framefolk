import type { Metadata } from "next";
import { ProfilePage } from "@/components/profile/ProfilePage";

interface Props {
  params: Promise<{ username: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  return {
    title: `@${username}`,
    description: `View @${username}'s profile on FRAMEFOLK`,
  };
}

export default async function UserProfilePage({ params }: Props) {
  const { username } = await params;
  return <ProfilePage username={username} />;
}
