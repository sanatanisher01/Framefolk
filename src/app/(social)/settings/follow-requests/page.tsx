import type { Metadata } from "next";
import { FollowRequestsPage } from "./FollowRequestsPage";

export const metadata: Metadata = { title: "Follow Requests" };

export default function Page() {
  return <FollowRequestsPage />;
}
