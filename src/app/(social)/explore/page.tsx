import type { Metadata } from "next";
import { Suspense } from "react";
import { ExplorePage } from "./ExplorePage";
import { Spinner } from "@/components/ui/Spinner";

export const metadata: Metadata = { title: "Explore" };

export default function Explore() {
  return (
    <Suspense fallback={
      <div className="flex justify-center items-center min-h-[60vh]">
        <Spinner size="lg" />
      </div>
    }>
      <ExplorePage />
    </Suspense>
  );
}
