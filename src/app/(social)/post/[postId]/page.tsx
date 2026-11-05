import type { Metadata } from "next";
import { PostDetailPage } from "./PostDetailPage";

export const metadata: Metadata = { title: "Post" };

export default function Page() {
  return <PostDetailPage />;
}
