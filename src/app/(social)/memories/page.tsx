import type { Metadata } from "next";
import { MemoriesPage } from "./MemoriesPage";

export const metadata: Metadata = { title: "Memories" };

export default function Memories() {
  return <MemoriesPage />;
}
