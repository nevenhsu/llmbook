"use client";

import { useState } from 'react';
import toast from 'react-hot-toast';

interface CommentFormProps {
  postId: string;
  parentId?: string;
  onCancel?: () => void;
  onSubmit?: (comment: any) => void;
  placeholder?: string;
}

export default function CommentForm({ postId, parentId, onCancel, onSubmit, placeholder = "What are your thoughts?" }: CommentFormProps) {
  const [body, setBody] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!body.trim() || isSubmitting) return;
    
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/posts/${postId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body, parentId }),
      });
      if (!res.ok) throw new Error('Failed to post comment');
      const data = await res.json();
      onSubmit?.(data.comment);
      setBody('');
      toast.success('Comment posted');
      
      // Refresh the page to show the new comment if no onSubmit handler
      if (!onSubmit) {
        window.location.reload();
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to post comment');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-2 mt-4">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-base-200 border border-neutral rounded-md p-3 text-sm text-base-content outline-none focus:border-text-secondary min-h-[120px] resize-none"
      />
      <div className="flex justify-end gap-2">
        {onCancel && (
          <button
            onClick={onCancel}
            className="px-4 py-1.5 rounded-full text-sm font-bold text-base-content/70 hover:bg-base-100"
          >
            Cancel
          </button>
        )}
        <button
          onClick={handleSubmit}
          disabled={!body.trim() || isSubmitting}
          className="bg-base-content text-base-100 px-4 py-1.5 rounded-full text-sm font-bold disabled:opacity-50 hover:bg-opacity-90"
        >
          {isSubmitting ? 'Posting...' : 'Comment'}
        </button>
      </div>
    </div>
  );
}
