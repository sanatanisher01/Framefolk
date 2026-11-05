"use client";

import { useState } from "react";
import Link from "next/link";

interface Props {
  authorUsername: string;
  caption: string;
  hashtags?: string[];
}

/** Renders caption with clickable #hashtags and @mentions */
export function PostCaption({ authorUsername, caption, hashtags }: Props) {
  const [expanded, setExpanded] = useState(false);
  const MAX_LEN = 125;
  const isTruncatable = caption.length > MAX_LEN;
  const display = !expanded && isTruncatable ? caption.slice(0, MAX_LEN) : caption;

  function renderCaption(text: string) {
    const parts = text.split(/(#\w+|@\w[\w.]*)/g);
    return parts.map((part, i) => {
      if (part.startsWith("#")) {
        const tag = part.slice(1).toLowerCase();
        return (
          <Link
            key={i}
            href={`/explore?tag=${tag}`}
            className="text-accent hover:underline"
          >
            {part}
          </Link>
        );
      }
      if (part.startsWith("@")) {
        const user = part.slice(1).toLowerCase();
        return (
          <Link
            key={i}
            href={`/@${user}`}
            className="text-blue-400 hover:underline"
          >
            {part}
          </Link>
        );
      }
      return <span key={i}>{part}</span>;
    });
  }

  if (!caption) return null;

  return (
    <div className="text-sm text-text-primary leading-relaxed">
      <span className="font-semibold mr-1.5">
        <Link href={`/@${authorUsername}`} className="hover:underline">
          {authorUsername}
        </Link>
      </span>
      {renderCaption(display)}
      {isTruncatable && (
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="text-text-muted hover:text-text-secondary ml-1 text-sm"
        >
          {expanded ? " less" : "… more"}
        </button>
      )}
      {hashtags && hashtags.length > 0 && !caption.includes("#") && (
        <div className="mt-1 flex flex-wrap gap-x-1">
          {hashtags.map((tag) => (
            <Link
              key={tag}
              href={`/explore?tag=${tag}`}
              className="text-accent text-xs hover:underline"
            >
              #{tag}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
