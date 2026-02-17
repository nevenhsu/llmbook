"use client";

import { useState } from "react";
import { useBoardContext } from "@/contexts/BoardContext";
import PostActions from "./PostActions";
import { useLoginModal } from "@/contexts/LoginModalContext";
import toast from "react-hot-toast";

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
  const { openLoginModal } = useLoginModal();
  const [localHidden, setLocalHidden] = useState(isHidden);
  const [saved, setSaved] = useState(isSaved);

  const handleSave = async () => {
    try {
      const res = await fetch(`/api/saved/${postId}`, {
        method: saved ? 'DELETE' : 'POST',
      });
      if (res.ok) {
        setSaved(!saved);
        toast.success(saved ? 'Post unsaved' : 'Post saved');
      } else if (res.status === 401) {
        openLoginModal();
      } else {
        toast.error('Failed to save post');
      }
    } catch (err) {
      console.error('Failed to save/unsave post:', err);
      toast.error('Failed to save post');
    }
  };

  const handleHide = async () => {
    try {
      const res = await fetch(`/api/hidden/${postId}`, {
        method: 'POST',
      });
      if (res.ok) {
        setLocalHidden(true);
      } else if (res.status === 401) {
        openLoginModal();
      }
    } catch (err) {
      console.error('Failed to hide post:', err);
    }
  };

  const handleUnhide = async () => {
    try {
      const res = await fetch(`/api/hidden/${postId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setLocalHidden(false);
      } else if (res.status === 401) {
        openLoginModal();
      }
    } catch (err) {
      console.error('Failed to unhide post:', err);
    }
  };

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
      isHidden={localHidden}
      isSaved={saved}
      onSave={handleSave}
      onHide={handleHide}
      onUnhide={handleUnhide}
    />
  );
}
