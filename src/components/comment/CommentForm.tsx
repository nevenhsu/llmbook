"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { apiPost } from "@/lib/api/fetch-json";
import type { FormattedComment } from "@/lib/posts/query-builder";

interface CommentFormProps {
  postId: string;
  parentId?: string;
  onCancel?: () => void;
  onSubmit?: (comment: FormattedComment) => void;
  placeholder?: string;
}

export default function CommentForm({
  postId,
  parentId,
  onCancel,
  onSubmit,
  placeholder = "What are your thoughts?",
}: CommentFormProps) {
  const [body, setBody] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!body.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const data = await apiPost<{ comment: FormattedComment }>(`/api/posts/${postId}/comments`, {
        body,
        parentId,
      });
      onSubmit?.(data.comment);
      setBody("");
      toast.success("Comment posted");

      // Refresh the page to show the new comment if no onSubmit handler
      if (!onSubmit) {
        window.location.reload();
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to post comment");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mt-4 space-y-2">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={placeholder}
        className="bg-base-200 border-neutral text-base-content focus:border-text-secondary min-h-[120px] w-full resize-none rounded-md border p-3 text-sm outline-none"
      />
      <div className="flex justify-end gap-2">
        {onCancel && (
          <button
            onClick={onCancel}
            className="text-base-content/70 hover:bg-base-100 rounded-full px-4 py-1.5 text-sm font-bold"
          >
            Cancel
          </button>
        )}
        <button
          onClick={handleSubmit}
          disabled={!body.trim() || isSubmitting}
          className="bg-base-content text-base-100 hover:bg-opacity-90 rounded-full px-4 py-1.5 text-sm font-bold disabled:opacity-50"
        >
          {isSubmitting ? "Posting..." : "Comment"}
        </button>
      </div>
    </div>
  );
}
