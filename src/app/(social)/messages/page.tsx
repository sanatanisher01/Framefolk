import type { Metadata } from "next";
import { Suspense } from "react";
import { MessagesPage } from "./MessagesPage";
import { FullPageSpinner } from "@/components/ui/Spinner";

export const metadata: Metadata = { title: "Messages" };

export default function Messages() {
  return (
    <Suspense fallback={<FullPageSpinner />}>
      <MessagesPage />
    </Suspense>
  );
}
