"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import VotePill from "@/components/ui/VotePill";
import { EyeOff, Trash2 } from "lucide-react";
import PostMeta from "./PostMeta";
import PostActions from "./PostActions";
import { useVote } from "@/hooks/use-vote";
import { usePostInteractions } from "@/hooks/use-post-interactions";
import { votePost } from "@/lib/api/votes";
import { useOptionalBoardContext } from "@/contexts/BoardContext";
import type { FeedPost } from "@/lib/posts/query-builder";

interface PostRowProps extends FeedPost {
  /** ID of the currently logged-in user */
  userId?: string;
  /** Whether the current user can moderate this post */
  canModerate?: boolean;
  /** Layout style: default keeps the old divider list look */
  variant?: "list" | "card";
  /** Optional: called after optimistic update and server reconcile with updated score/userVote */
  onScoreChange?: (postId: string, score: number, userVote: 1 | -1 | null) => void;
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
  userVote,
  isSaved = false,
  authorId,
  userId,
  canModerate: canModerateProp = false,
  status,
  isHidden = false,
  variant = "list",
  onScoreChange,
}: PostRowProps) {
  const boardCtx = useOptionalBoardContext();
  // Prefer isModerator from BoardContext (auto-detected); fall back to prop
  const canModerate = boardCtx?.isModerator ?? canModerateProp;
  const router = useRouter();
  const {
    saved,
    hidden: localHidden,
    handleSave,
    handleHide,
    handleUnhide,
  } = usePostInteractions({
    postId: id,
    initialSaved: isSaved,
    initialHidden: isHidden,
  });
  const [localExpanded, setLocalExpanded] = useState(false);
  const [deleted, setDeleted] = useState(status === "DELETED");

  const {
    score: voteScore,
    userVote: voteUserVote,
    handleVote,
    voteDisabled,
  } = useVote({
    id,
    initialScore: score,
    initialUserVote: userVote ?? null,
    voteFn: votePost,
    disabled: status === "ARCHIVED" || status === "DELETED",
    onScoreChange,
  });

  const isHiddenAndCollapsed = localHidden && !localExpanded;

  const toggleExpanded = () => {
    setLocalExpanded(!localExpanded);
  };

  const handleDelete = () => {
    setDeleted(true);
  };

  const containerBorderClass =
    variant === "card" ? "border border-neutral rounded-md" : "border-b border-neutral";
  const baseBgClass = variant === "card" ? "bg-base-200" : "";

  if (deleted || status === "DELETED") {
    return (
      <article
        className={`flex items-center gap-2 px-3 py-2 ${containerBorderClass} ${baseBgClass} bg-base-200/30 cursor-default`}
      >
        <Trash2 size={14} className="text-base-content/40 flex-shrink-0" />
        <div className="text-base-content/50 flex min-w-0 items-center gap-2 text-xs">
          <span className="bg-base-300 flex-shrink-0 rounded px-1 text-[10px] font-bold tracking-tight uppercase">
            deleted
          </span>
          <span className="max-w-[200px] truncate font-medium sm:max-w-[400px]">{title}</span>
          <span className="flex-shrink-0">•</span>
          <span className="flex-shrink-0 truncate">{authorName}</span>
        </div>
      </article>
    );
  }

  const isArchived = status === "ARCHIVED";
  const isReadOnly = isArchived || isHiddenAndCollapsed;

  return (
    <article
      onClick={() => !isReadOnly && router.push(`/r/${boardSlug}/posts/${id}`)}
      className={`group flex items-start gap-2 px-2 py-3 transition-colors ${containerBorderClass} ${baseBgClass} ${
        isHiddenAndCollapsed ? "bg-base-200/50" : "hover:bg-base-300"
      } ${isReadOnly ? "cursor-default" : "cursor-pointer"}`}
    >
      {isHiddenAndCollapsed ? (
        <div className="flex w-full items-center gap-2 py-1">
          <div className="bg-base-300 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full">
            <EyeOff size={16} className="text-base-content/60" />
          </div>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="text-base-content/60 text-sm font-medium">Hidden by you</span>
            <span className="text-base-content/40 text-xs">author: {authorName}</span>
          </div>
          <div className="flex flex-shrink-0 items-center gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleUnhide();
              }}
              className="btn btn-xs btn-ghost"
            >
              Unhide
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleExpanded();
              }}
              className="btn btn-xs btn-ghost"
            >
              {localExpanded ? "Hide" : "Show"}
            </button>
          </div>
        </div>
      ) : (
        <>
          <VotePill
            score={voteScore}
            userVote={voteUserVote}
            onVote={handleVote}
            size="sm"
            orientation="vertical"
            disabled={voteDisabled}
          />

          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <span className="text-base-content line-clamp-2 text-lg font-bold">{title}</span>
              </div>
              <div
                className="flex flex-shrink-0 items-center gap-2"
                onClick={(e) => e.stopPropagation()}
              >
                {localHidden && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleExpanded();
                    }}
                    className="bg-base-300 text-base-content/70 hover:bg-base-content/10 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium transition-colors"
                    title="Click to collapse"
                  >
                    <EyeOff size={12} className="mr-1" />
                    Hidden
                  </button>
                )}
                {status === "ARCHIVED" && (
                  <span className="bg-warning/20 text-warning border-warning/30 inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold">
                    ARCHIVED
                  </span>
                )}
              </div>
            </div>

            <div className="w-fit">
              <PostMeta
                boardName={boardName}
                boardSlug={boardSlug}
                authorName={authorName}
                authorUsername={authorUsername}
                authorAvatarUrl={authorAvatarUrl}
                isPersona={isPersona}
                createdAt={createdAt}
              />
            </div>

            <div className="w-fit">
              <PostActions
                postId={id}
                boardSlug={boardSlug}
                commentCount={commentCount}
                isSaved={saved}
                authorId={authorId}
                userId={userId}
                canModerate={canModerate}
                onSave={() => void handleSave()}
                onHide={() => void handleHide()}
                onDelete={handleDelete}
                isHidden={localHidden}
                isExpanded={localExpanded}
                onUnhide={() => void handleUnhide()}
                onToggleExpand={toggleExpanded}
              />
            </div>
          </div>
        </>
      )}
    </article>
  );
}
