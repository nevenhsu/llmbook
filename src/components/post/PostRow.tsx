"use client";

import { useRouter } from "next/navigation";
import VotePill from "@/components/ui/VotePill";
import PostMeta from "./PostMeta";
import PostActions from "./PostActions";
import Badge from "@/components/ui/Badge";

interface PostRowProps {
  id: string;
  title: string;
  score: number;
  commentCount: number;
  boardName: string;
  boardSlug: string;
  authorName: string;
  authorUsername?: string | null;
  authorAvatarUrl?: string | null;
  isPersona?: boolean;
  createdAt: string;
  thumbnailUrl?: string | null;
  flairs?: string[];
  userVote?: 1 | -1 | null;
  onVote: (postId: string, value: 1 | -1) => void;
}

export default function PostRow({
  id,
  title,
  score,
  commentCount,
  boardName,
  boardSlug,
  authorName,
  authorUsername,
  authorAvatarUrl,
  isPersona = false,
  createdAt,
  thumbnailUrl,
  flairs,
  userVote,
  onVote,
}: PostRowProps) {
  const router = useRouter();

  return (
    <article
      onClick={() => router.push(`/posts/${id}`)}
      className="group flex items-start gap-2 px-2 py-3 border-b border-neutral hover:hover:bg-base-300 cursor-pointer transition-colors"
    >
      <VotePill
        score={score}
        userVote={userVote}
        onVote={(v) => onVote(id, v)}
        size="sm"
        orientation="horizontal"
      />

      {thumbnailUrl && (
        <div className="flex-shrink-0 w-[56px] h-[42px] rounded-md overflow-hidden bg-base-100">
          <img
            src={thumbnailUrl}
            alt=""
            className="w-full h-full object-cover"
          />
        </div>
      )}

      <div className="flex-1 min-w-0 flex flex-col gap-1.5">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-md font-medium text-base-content line-clamp-1">
            {title}
          </span>
          {flairs?.map((f) => (
            <Badge key={f} variant="flair">
              {f}
            </Badge>
          ))}
        </div>

        <PostMeta
          boardName={boardName}
          boardSlug={boardSlug}
          authorName={authorName}
          authorUsername={authorUsername}
          authorAvatarUrl={authorAvatarUrl}
          isPersona={isPersona}
          createdAt={createdAt}
        />

        <div className="opacity-0 group-hover:opacity-100 transition-opacity md:opacity-0 max-md:opacity-100">
          <PostActions postId={id} commentCount={commentCount} />
        </div>
      </div>
    </article>
  );
}
