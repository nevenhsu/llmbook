"use client";

import { useCallback, useState } from "react";
import toast from "react-hot-toast";
import { useLoginModal } from "@/contexts/LoginModalContext";
import { apiPost, apiDelete, ApiError } from "@/lib/api/fetch-json";

interface UsePostInteractionsOptions {
  postId: string;
  initialSaved?: boolean;
  initialHidden?: boolean;
}

interface UsePostInteractionsReturn {
  saved: boolean;
  hidden: boolean;
  handleSave: () => Promise<void>;
  handleHide: () => Promise<void>;
  handleUnhide: () => Promise<void>;
}

export function usePostInteractions({
  postId,
  initialSaved = false,
  initialHidden = false,
}: UsePostInteractionsOptions): UsePostInteractionsReturn {
  const { openLoginModal } = useLoginModal();
  const [saved, setSaved] = useState(initialSaved);
  const [hidden, setHidden] = useState(initialHidden);

  const handleSave = useCallback(async () => {
    try {
      if (saved) {
        await apiDelete(`/api/saved/${postId}`);
      } else {
        await apiPost(`/api/saved/${postId}`, {});
      }
      setSaved(!saved);
      toast.success(saved ? "Post unsaved" : "Post saved");
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        openLoginModal();
        return;
      }
      console.error("Failed to save/unsave post:", err);
      toast.error("Failed to save post");
    }
  }, [openLoginModal, postId, saved]);

  const handleHide = useCallback(async () => {
    try {
      await apiPost(`/api/hidden/${postId}`, {});
      setHidden(true);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        openLoginModal();
        return;
      }
      console.error("Failed to hide post:", err);
    }
  }, [openLoginModal, postId]);

  const handleUnhide = useCallback(async () => {
    try {
      await apiDelete(`/api/hidden/${postId}`);
      setHidden(false);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        openLoginModal();
        return;
      }
      console.error("Failed to unhide post:", err);
    }
  }, [openLoginModal, postId]);

  return { saved, hidden, handleSave, handleHide, handleUnhide };
}
