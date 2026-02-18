"use client";
import { useBoardContext } from "@/contexts/BoardContext";
import PostActions from "./PostActions";
import { usePostInteractions } from "@/hooks/use-post-interactions";

interface PostActionsWrapperProps {
  postId: string;
  boardSlug: string;
  commentCount: number;
  authorId?: string;
  status?: string;
  inDetailPage?: boolean;
  isHidden?: boolean;
  isSaved?: boolean;
}

export default function PostActionsWrapper({
  postId,
  boardSlug,
  commentCount,
  authorId,
  status,
  inDetailPage = false,
  isHidden = false,
  isSaved = false,
}: PostActionsWrapperProps) {
  const { userId, canModerate } = useBoardContext();
  const { saved, hidden, handleSave, handleHide, handleUnhide } = usePostInteractions({
    postId,
    initialSaved: isSaved,
    initialHidden: isHidden,
  });

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
      isHidden={hidden}
      isSaved={saved}
      onSave={() => void handleSave()}
      onHide={() => void handleHide()}
      onUnhide={() => void handleUnhide()}
    />
  );
}
