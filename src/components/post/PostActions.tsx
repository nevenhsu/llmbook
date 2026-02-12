"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  MessageSquare,
  Share2,
  Bookmark,
  EyeOff,
  MoreHorizontal,
  Edit,
  Trash2,
  ShieldOff,
} from "lucide-react";

interface PostActionsProps {
  postId: string;
  boardSlug?: string;
  commentCount: number;
  isSaved?: boolean;
  inDetailPage?: boolean;
  authorId?: string;
  userId?: string;
  canModerate?: boolean;
  onShare?: () => void;
  onSave?: () => void;
  onHide?: () => void;
  onDelete?: () => void;
}

export default function PostActions({
  postId,
  boardSlug,
  commentCount,
  isSaved = false,
  inDetailPage = false,
  authorId,
  userId,
  canModerate = false,
  onSave,
  onHide,
  onDelete,
}: PostActionsProps) {
  const router = useRouter();
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const isAuthor = authorId && userId && authorId === userId;

  const handleCommentsClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (inDetailPage) {
      // Scroll to comments section
      document.getElementById('comments')?.scrollIntoView({ behavior: 'smooth' });
    } else if (boardSlug) {
      // Navigate to post detail page
      router.push(`/r/${boardSlug}/posts/${postId}#comments`);
    }
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Edit page will need to be created at /r/[slug]/posts/[id]/edit
    if (boardSlug) {
      router.push(`/r/${boardSlug}/posts/${postId}/edit`);
    }
    setShowMoreMenu(false);
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this post? This action cannot be undone.')) {
      return;
    }

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/posts/${postId}`, {
        method: 'DELETE',
      });

      if (!res.ok) throw new Error('Failed to delete post');

      onDelete?.();
      router.refresh();
    } catch (err) {
      console.error('Failed to delete post:', err);
      alert('Failed to delete post');
    } finally {
      setIsDeleting(false);
      setShowMoreMenu(false);
    }
  };

  const handleRemove = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const reason = prompt('Reason for removal (optional):');
    if (reason === null) return; // User cancelled

    try {
      const res = await fetch(`/api/posts/${postId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'ARCHIVED', removal_reason: reason }),
      });

      if (!res.ok) throw new Error('Failed to remove post');

      router.refresh();
    } catch (err) {
      console.error('Failed to remove post:', err);
      alert('Failed to remove post');
    } finally {
      setShowMoreMenu(false);
    }
  };

  return (
    <div className="flex items-center gap-0.5 text-xs text-base-content/70">
      <button 
        onClick={handleCommentsClick}
        className="flex items-center gap-1 rounded-sm px-2 py-1 hover:hover:bg-base-300"
      >
        <MessageSquare size={16} /> <span>{commentCount}</span>
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          if (boardSlug) {
            navigator.clipboard.writeText(
              `${window.location.origin}/r/${boardSlug}/posts/${postId}`,
            );
          }
        }}
        className="flex items-center gap-1 rounded-sm px-2 py-1 hover:hover:bg-base-300"
      >
        <Share2 size={16} /> <span>Share</span>
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onSave?.();
        }}
        className={`flex items-center gap-1 rounded-sm px-2 py-1 hover:hover:bg-base-300 ${
          isSaved ? 'text-primary' : ''
        }`}
      >
        <Bookmark size={16} fill={isSaved ? 'currentColor' : 'none'} /> 
        <span>{isSaved ? 'Saved' : 'Save'}</span>
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onHide?.();
        }}
        className="flex items-center gap-1 rounded-sm px-2 py-1 hover:hover:bg-base-300"
      >
        <EyeOff size={16} /> <span>Hide</span>
      </button>
      <div className="relative">
        <button 
          onClick={(e) => {
            e.stopPropagation();
            setShowMoreMenu(!showMoreMenu);
          }}
          className="flex items-center gap-1 rounded-sm px-1 py-1 hover:hover:bg-base-300"
        >
          <MoreHorizontal size={16} />
        </button>

        {showMoreMenu && (
          <>
            <div 
              className="fixed inset-0 z-10" 
              onClick={(e) => {
                e.stopPropagation();
                setShowMoreMenu(false);
              }}
            />
            <div className="absolute right-0 top-8 z-20 w-48 bg-base-100 border border-neutral rounded-md shadow-lg py-1">
              {isAuthor && (
                <>
                  <button
                    onClick={handleEdit}
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-base-content hover:bg-base-200"
                  >
                    <Edit size={16} />
                    Edit
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-error hover:bg-base-200"
                  >
                    <Trash2 size={16} />
                    {isDeleting ? 'Deleting...' : 'Delete'}
                  </button>
                </>
              )}
              {canModerate && !isAuthor && (
                <button
                  onClick={handleRemove}
                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-warning hover:bg-base-200"
                >
                  <ShieldOff size={16} />
                  Remove (Mod)
                </button>
              )}
              {!isAuthor && !canModerate && (
                <div className="px-4 py-2 text-sm text-base-content/50">
                  No actions available
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
