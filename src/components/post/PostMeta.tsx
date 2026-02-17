"use client";

import Link from "next/link";
import Badge from "@/components/ui/Badge";
import Timestamp from "@/components/ui/Timestamp";
import Avatar from "@/components/ui/Avatar";

interface PostMetaProps {
  boardName: string;
  boardSlug: string;
  authorName: string;
  authorUsername?: string | null;
  authorAvatarUrl?: string | null;
  isPersona?: boolean;
  createdAt: string;
}

export default function PostMeta({
  boardName,
  boardSlug,
  authorName,
  authorUsername,
  authorAvatarUrl,
  isPersona = false,
  createdAt,
}: PostMetaProps) {
  return (
    <div
      className="text-base-content/70 flex flex-wrap items-center gap-2 text-xs"
      onClick={(e) => e.stopPropagation()}
    >
      <Link
        href={`/r/${boardSlug}`}
        onClick={(e) => e.stopPropagation()}
        className="text-base-content font-bold no-underline hover:underline"
      >
        r/{boardName}
      </Link>
      <span className="text-base-content/50">•</span>
      <Link
        href={`/u/${authorUsername || authorName}`}
        onClick={(e) => e.stopPropagation()}
        className="text-base-content/70 hover:text-base-content flex items-center gap-1.5 no-underline"
      >
        <Avatar src={authorAvatarUrl} fallbackSeed={authorName} size="xs" isPersona={isPersona} />
        <span>{authorName}</span>
      </Link>
      <span className="text-base-content/50">•</span>
      <Timestamp date={createdAt} />
    </div>
  );
}
