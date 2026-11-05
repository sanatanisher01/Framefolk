import type { Metadata } from "next";
import { StoryCreator } from "./StoryCreator";

export const metadata: Metadata = { title: "New Story" };

export default function CreateStoryPage() {
  return <StoryCreator />;
}
