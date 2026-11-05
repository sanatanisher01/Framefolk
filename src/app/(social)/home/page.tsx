import type { Metadata } from "next";
import { HomeFeedPage } from "./HomeFeedPage";

export const metadata: Metadata = { title: "Home" };

export default function Home() {
  return <HomeFeedPage />;
}
