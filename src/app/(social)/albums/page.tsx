import type { Metadata } from "next";
import { AlbumsPage } from "./AlbumsPage";

export const metadata: Metadata = { title: "Albums" };

export default function Albums() {
  return <AlbumsPage />;
}
