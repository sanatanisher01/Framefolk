import type { Metadata } from "next";
import { MobileHeader } from "@/components/layout/MobileHeader";
import { UploadComposer } from "@/components/upload/UploadComposer";

export const metadata: Metadata = { title: "New Post" };

export default function UploadPage() {
  return (
    <>
      <MobileHeader title="New Post" showBack />
      <UploadComposer />
    </>
  );
}
