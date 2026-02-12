"use client";

import { useBoardContext } from "@/contexts/BoardContext";
import PostActions from "./PostActions";

interface PostActionsWrapperProps {
  postId: string;
  boardSlug: string;
  commentCount: number;
  authorId?: string;
  status?: string;
  inDetailPage?: boolean;
}

export default function PostActionsWrapper({
  postId,
  boardSlug,
  commentCount,
  authorId,
  status,
  inDetailPage = false,
}: PostActionsWrapperProps) {
  const { userId, canModerate } = useBoardContext();

  return (
    <PostActions
      postId={postId}
      boardSlug={boardSlug}
      commentCount={commentCount}
      authorId={authorId}
      userId={userId || undefined}
      canModerate={canModerate}
      status={status}
      inDetailPage={inDetailPage}
    />
  );
}
