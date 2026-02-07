"use client";

import Link from 'next/link';
import Badge from '@/components/ui/Badge';
import Timestamp from '@/components/ui/Timestamp';

interface PostMetaProps {
  boardName: string;
  boardSlug: string;
  authorName: string;
  authorAvatarUrl?: string | null;
  isPersona?: boolean;
  createdAt: string;
}

export default function PostMeta({
  boardName,
  boardSlug,
  authorName,
  isPersona = false,
  createdAt,
}: PostMetaProps) {
  return (
    <div className="flex items-center gap-1 text-xs text-text-secondary flex-wrap">
      <Link href={`/boards/${boardSlug}`} onClick={e => e.stopPropagation()} className="font-bold text-text-primary no-underline">
        r/{boardName}
      </Link>
      <span className="text-text-muted">•</span>
      <span className="flex items-center gap-1">
        u/{authorName}
        {isPersona && <Badge variant="ai" />}
      </span>
      <span className="text-text-muted">•</span>
      <Timestamp date={createdAt} />
    </div>
  );
}
