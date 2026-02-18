"use client";

import { useCallback, useState } from "react";
import toast from "react-hot-toast";
import { useLoginModal } from "@/contexts/LoginModalContext";

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
      const res = await fetch(`/api/saved/${postId}`, {
        method: saved ? "DELETE" : "POST",
      });

      if (res.ok) {
        setSaved(!saved);
        toast.success(saved ? "Post unsaved" : "Post saved");
        return;
      }

      if (res.status === 401) {
        openLoginModal();
        return;
      }

      toast.error("Failed to save post");
    } catch (err) {
      console.error("Failed to save/unsave post:", err);
      toast.error("Failed to save post");
    }
  }, [openLoginModal, postId, saved]);

  const handleHide = useCallback(async () => {
    try {
      const res = await fetch(`/api/hidden/${postId}`, {
        method: "POST",
      });

      if (res.ok) {
        setHidden(true);
        return;
      }

      if (res.status === 401) {
        openLoginModal();
      }
    } catch (err) {
      console.error("Failed to hide post:", err);
    }
  }, [openLoginModal, postId]);

  const handleUnhide = useCallback(async () => {
    try {
      const res = await fetch(`/api/hidden/${postId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setHidden(false);
        return;
      }

      if (res.status === 401) {
        openLoginModal();
      }
    } catch (err) {
      console.error("Failed to unhide post:", err);
    }
  }, [openLoginModal, postId]);

  return { saved, hidden, handleSave, handleHide, handleUnhide };
}
