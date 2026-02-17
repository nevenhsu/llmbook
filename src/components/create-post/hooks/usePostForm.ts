"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import type { Board, Draft, EditDraft, InitialData, PostTab, UploadedMedia } from "../types";

interface UsePostFormOptions {
  editMode: boolean;
  initialData?: InitialData;
  userJoinedBoards: Board[];
}

export function usePostForm({ editMode, initialData, userJoinedBoards }: UsePostFormOptions) {
  const router = useRouter();

  // ── Form state ────────────────────────────────────────────────────────────
  const getInitialTab = (): PostTab => {
    if (editMode && initialData?.postType === "poll") return "poll";
    return "text";
  };

  const getInitialBoard = (): Board | null => {
    if (editMode && initialData) {
      return {
        id: initialData.boardId,
        name: initialData.boardName || initialData.boardSlug,
        slug: initialData.boardSlug,
      };
    }
    return userJoinedBoards[0] ?? null;
  };

  const [activeTab, setActiveTab] = useState<PostTab>(getInitialTab());
  const [title, setTitle] = useState(initialData?.title ?? "");
  const [body, setBody] = useState(initialData?.body ?? "");
  const [boardId, setBoardId] = useState(initialData?.boardId ?? userJoinedBoards[0]?.id ?? "");
  const [selectedBoard, setSelectedBoard] = useState<Board | null>(getInitialBoard());
  const [tagIds, setTagIds] = useState<string[]>(initialData?.tagIds ?? []);
  const [pollOptions, setPollOptions] = useState<string[]>(
    initialData?.pollOptions?.map((o) => o.text) ?? ["", ""],
  );
  const [newPollOptions, setNewPollOptions] = useState<string[]>([""]);
  const [pollDuration, setPollDuration] = useState(initialData?.pollDuration ?? "3");
  const [pendingImages, setPendingImages] = useState<Map<string, File>>(new Map());

  // ── UI state ──────────────────────────────────────────────────────────────
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showUploadProgress, setShowUploadProgress] = useState(false);

  // ── Draft state ───────────────────────────────────────────────────────────
  const [showDrafts, setShowDrafts] = useState(false);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [editDraftSavedAt, setEditDraftSavedAt] = useState<string | null>(null);

  // Sync boardId → selectedBoard in create mode
  useEffect(() => {
    if (!editMode && !selectedBoard && userJoinedBoards.length > 0) {
      const board = userJoinedBoards[0];
      setBoardId(board.id);
      setSelectedBoard(board);
    }
  }, [editMode, selectedBoard, userJoinedBoards]);

  // Load drafts on mount
  useEffect(() => {
    if (editMode && initialData) {
      const saved = localStorage.getItem(`post-edit-draft-${initialData.postId}`);
      if (saved) {
        try {
          const draft: EditDraft = JSON.parse(saved);
          setTitle(draft.title);
          setBody(draft.body);
          setTagIds(draft.tagIds ?? []);
          if (draft.newPollOptions) setNewPollOptions(draft.newPollOptions);
          setEditDraftSavedAt(draft.savedAt);
        } catch {
          // ignore corrupt draft
        }
      }
    } else {
      const saved = localStorage.getItem("post-drafts");
      if (saved) {
        try {
          setDrafts(JSON.parse(saved));
        } catch {
          // ignore corrupt drafts
        }
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Draft actions ─────────────────────────────────────────────────────────
  function saveDraft() {
    if (editMode && initialData) {
      const draft: EditDraft = {
        title,
        body,
        tagIds,
        newPollOptions,
        savedAt: new Date().toISOString(),
      };
      localStorage.setItem(`post-edit-draft-${initialData.postId}`, JSON.stringify(draft));
      setEditDraftSavedAt(draft.savedAt);
      toast.success("Draft saved!");
    } else {
      const draft: Draft = {
        id: Date.now().toString(),
        title,
        body,
        boardId,
        tagIds,
        pollOptions,
        pollDuration,
        activeTab,
        savedAt: new Date().toISOString(),
      };
      const next = [draft, ...drafts].slice(0, 10);
      setDrafts(next);
      localStorage.setItem("post-drafts", JSON.stringify(next));
      toast.success("Draft saved!");
    }
  }

  function loadCreateDraft(draft: Draft) {
    setTitle(draft.title ?? "");
    setBody(draft.body ?? "");
    setBoardId(draft.boardId ?? userJoinedBoards[0]?.id ?? "");
    setSelectedBoard(userJoinedBoards.find((b) => b.id === draft.boardId) ?? null);
    setTagIds(draft.tagIds ?? []);
    setPollOptions(draft.pollOptions ?? ["", ""]);
    setPollDuration(draft.pollDuration ?? "3");
    setActiveTab(draft.activeTab ?? "text");
    setShowDrafts(false);
    toast.success("Draft loaded!");
  }

  function loadEditDraft() {
    if (!initialData) return;
    const saved = localStorage.getItem(`post-edit-draft-${initialData.postId}`);
    if (!saved) return;
    try {
      const draft: EditDraft = JSON.parse(saved);
      setTitle(draft.title);
      setBody(draft.body);
      setTagIds(draft.tagIds ?? []);
      if (draft.newPollOptions) setNewPollOptions(draft.newPollOptions);
      setShowDrafts(false);
      toast.success("Draft loaded!");
    } catch {
      toast.error("Failed to load draft");
    }
  }

  function deleteCreateDraft(draftId: string) {
    const next = drafts.filter((d) => d.id !== draftId);
    setDrafts(next);
    localStorage.setItem("post-drafts", JSON.stringify(next));
  }

  function deleteEditDraft() {
    if (!initialData) return;
    localStorage.removeItem(`post-edit-draft-${initialData.postId}`);
    setEditDraftSavedAt(null);
    setShowDrafts(false);
    toast.success("Draft deleted");
  }

  // ── Image helpers ─────────────────────────────────────────────────────────
  async function handleImageUpload(file: File): Promise<{ url: string }> {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    setPendingImages((prev) => new Map(prev).set(dataUrl, file));
    return { url: dataUrl };
  }

  async function uploadImageFile(file: File): Promise<string> {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/media/upload", { method: "POST", body: formData });
    if (!res.ok) throw new Error((await res.text()) || "Upload failed");
    const data = (await res.json()) as UploadedMedia;
    return data.url;
  }

  // ── Submit ────────────────────────────────────────────────────────────────
  async function handleSubmit() {
    setError(null);
    setLoading(true);

    const hasImages = activeTab === "text" && pendingImages.size > 0;
    if (hasImages) setShowUploadProgress(true);

    try {
      let finalBody = body;

      if (hasImages) {
        for (const [dataUrl, file] of pendingImages.entries()) {
          const realUrl = await uploadImageFile(file);
          finalBody = finalBody.replace(dataUrl, realUrl);
        }
        setPendingImages(new Map());
      }

      if (editMode && initialData) {
        const updateData: Record<string, unknown> = { title, body: finalBody, tagIds };

        if (activeTab === "poll") {
          const validNew = newPollOptions.filter((o) => o.trim());
          if (validNew.length > 0) updateData.newPollOptions = validNew;
        }

        const res = await fetch(`/api/posts/${initialData.postId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updateData),
        });

        if (!res.ok) throw new Error((await res.text()) || "Could not update post");

        localStorage.removeItem(`post-edit-draft-${initialData.postId}`);
        router.push(`/r/${initialData.boardSlug}/posts/${initialData.postId}`);
      } else {
        const postData: Record<string, unknown> = {
          title,
          boardId,
          tagIds,
          postType: activeTab === "poll" ? "poll" : "text",
        };

        if (activeTab === "text") {
          postData.body = finalBody;
        }

        if (activeTab === "poll") {
          const valid = pollOptions.filter((o) => o.trim());
          if (valid.length < 2) throw new Error("Poll must have at least 2 options");
          postData.pollOptions = valid.map((text) => ({ text }));
          postData.pollDuration = parseInt(pollDuration, 10);
        }

        const res = await fetch("/api/posts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(postData),
        });

        if (!res.ok) throw new Error((await res.text()) || "Could not create post");

        const data = await res.json();
        const slug = data.boardSlug ?? selectedBoard?.slug;
        if (slug) {
          router.push(`/r/${slug}/posts/${data.id}`);
        } else {
          setShowUploadProgress(false);
          router.push("/");
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
      setShowUploadProgress(false);
    }
  }

  return {
    // form state
    activeTab, setActiveTab,
    title, setTitle,
    body, setBody,
    boardId, setBoardId,
    selectedBoard, setSelectedBoard,
    tagIds, setTagIds,
    pollOptions, setPollOptions,
    newPollOptions, setNewPollOptions,
    pollDuration, setPollDuration,
    pendingImages,
    // ui state
    error,
    loading,
    showUploadProgress,
    // draft state & actions
    showDrafts, setShowDrafts,
    drafts,
    editDraftSavedAt,
    saveDraft,
    loadCreateDraft,
    loadEditDraft,
    deleteCreateDraft,
    deleteEditDraft,
    // image
    handleImageUpload,
    handleSubmit,
  };
}
