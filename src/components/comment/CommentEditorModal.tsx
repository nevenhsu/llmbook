"use client";

import { useState, useRef, useEffect } from "react";
import { X } from "lucide-react";
import { SimpleEditor } from "@/components/editor/SimpleEditor";
import toast from "react-hot-toast";
import { apiPatch, apiPost } from "@/lib/api/fetch-json";
import type { FormattedComment } from "@/lib/posts/query-builder";

interface CommentEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  postId: string;
  parentId?: string;
  initialContent?: string;
  commentId?: string; // For edit mode
  mode: "create" | "edit" | "reply";
  onSuccess?: (comment: FormattedComment) => void;
}

export default function CommentEditorModal({
  isOpen,
  onClose,
  postId,
  parentId,
  initialContent = "",
  commentId,
  mode,
  onSuccess,
}: CommentEditorModalProps) {
  const [content, setContent] = useState(initialContent);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const dialogRef = useRef<HTMLDialogElement>(null);

  const isEmptyTiptapHtml = (html: string) => {
    const normalized = html
      .replace(/<br\s*\/?\s*>/gi, "")
      .replace(/&nbsp;/gi, " ")
      .replace(/<[^>]*>/g, "")
      .trim();
    return normalized.length === 0;
  };

  useEffect(() => {
    if (isOpen && dialogRef.current) {
      dialogRef.current.showModal();
      document.body.style.overflow = "hidden";
    } else if (dialogRef.current) {
      dialogRef.current.close();
      document.body.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    setContent(initialContent);
    setError("");
  }, [isOpen, initialContent]);

  const handleClose = () => {
    setContent(initialContent);
    setError("");
    onClose();
  };

  const handleSubmit = async () => {
    if (isEmptyTiptapHtml(content)) {
      setError("Comment cannot be empty");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      if (mode === "edit" && commentId) {
        const data = await apiPatch<{ comment: FormattedComment }>(`/api/comments/${commentId}`, {
          body: content,
        });
        onSuccess?.(data.comment);
        toast.success("Comment updated");
      } else {
        const data = await apiPost<{ comment: FormattedComment }>(`/api/posts/${postId}/comments`, {
          body: content,
          parentId: parentId || undefined,
        });
        onSuccess?.(data.comment);
        toast.success(mode === "reply" ? "Reply posted" : "Comment posted");
      }

      // Reset and close
      setContent("");
      handleClose();

      // Reload page if no success handler
      if (!onSuccess) {
        window.location.reload();
      }
    } catch (err: unknown) {
      console.error(err);
      const message = err instanceof Error ? err.message : "Failed to save comment";
      toast.error(message);
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getTitle = () => {
    switch (mode) {
      case "edit":
        return "Edit Comment";
      case "reply":
        return "Reply to Comment";
      default:
        return "Add a Comment";
    }
  };

  return (
    <dialog
      ref={dialogRef}
      className="modal"
      onClose={handleClose}
      onClick={(e) => {
        // Close on backdrop click
        if (e.target === dialogRef.current) {
          handleClose();
        }
      }}
    >
      <div className="modal-box flex max-h-[90vh] w-11/12 max-w-3xl flex-col overflow-hidden p-0">
        {/* Header */}
        <div className="border-neutral bg-base-100 sticky top-0 z-10 flex items-center justify-between border-b p-4">
          <h3 className="text-lg font-bold">{getTitle()}</h3>
          <button
            onClick={handleClose}
            className="btn btn-sm btn-circle btn-ghost"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {error && (
            <div className="alert alert-error mb-4">
              <span>{error}</span>
            </div>
          )}

          <div className="min-h-[200px]">
            <SimpleEditor
              content={content}
              onChange={setContent}
              placeholder="What are your thoughts?"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="border-neutral bg-base-100 sticky bottom-0 flex justify-end gap-2 border-t p-4">
          <button onClick={handleClose} className="btn btn-ghost" disabled={isSubmitting}>
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!content.trim() || isSubmitting}
            className="btn btn-primary"
          >
            {isSubmitting ? (
              <>
                <span className="loading loading-spinner loading-sm"></span>
                {mode === "edit" ? "Updating..." : "Posting..."}
              </>
            ) : mode === "edit" ? (
              "Update"
            ) : (
              "Comment"
            )}
          </button>
        </div>
      </div>
    </dialog>
  );
}
