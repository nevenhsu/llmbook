"use client";

import { useState, useRef } from "react";
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
  status?: string;
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
  status,
  onSave,
  onHide,
  onDelete,
}: PostActionsProps) {
  const router = useRouter();
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const modalRef = useRef<HTMLDialogElement>(null);

  const isAuthor = authorId && userId && authorId === userId;
  const canEdit = isAuthor && status !== 'ARCHIVED' && status !== 'DELETED';
  const canDelete = isAuthor || canModerate;
  const canArchive = canModerate;

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

  const openMoreMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    modalRef.current?.showModal();
  };

  const closeMoreMenu = () => {
    modalRef.current?.close();
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    closeMoreMenu();
    // Edit page will need to be created at /r/[slug]/posts/[id]/edit
    if (boardSlug) {
      router.push(`/r/${boardSlug}/posts/${postId}/edit`);
    }
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
      closeMoreMenu();
      router.refresh();
    } catch (err) {
      console.error('Failed to delete post:', err);
      alert('Failed to delete post');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleArchive = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const reason = prompt('Reason for archiving (optional):');
    if (reason === null) return; // User cancelled

    try {
      const res = await fetch(`/api/posts/${postId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'ARCHIVED' }),
      });

      if (!res.ok) throw new Error('Failed to archive post');

      closeMoreMenu();
      router.refresh();
    } catch (err) {
      console.error('Failed to archive post:', err);
      alert('Failed to archive post');
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
      {/* More button */}
      <button 
        onClick={openMoreMenu}
        className="flex items-center gap-1 rounded-sm px-1 py-1 hover:hover:bg-base-300"
      >
        <MoreHorizontal size={16} />
      </button>

      {/* More menu modal - bottom sheet on mobile, centered on desktop */}
      <dialog ref={modalRef} className="modal modal-bottom sm:modal-middle">
        <div className="modal-box">
          <h3 className="font-bold text-lg mb-4">Post actions</h3>
          
          <div className="space-y-2">
            {/* Edit - only owner and not archived/deleted */}
            {canEdit && (
              <button
                onClick={handleEdit}
                className="w-full flex items-center gap-3 px-4 py-3 text-base text-base-content hover:bg-base-200 rounded-lg transition-colors"
              >
                <Edit size={20} />
                Edit post
              </button>
            )}
            
            {/* Delete - owner or moderator */}
            {canDelete && (
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="w-full flex items-center gap-3 px-4 py-3 text-base text-error hover:bg-base-200 rounded-lg transition-colors"
              >
                <Trash2 size={20} />
                {isDeleting ? 'Deleting...' : 'Delete post'}
              </button>
            )}
            
            {/* Archive - moderator only, not already archived/deleted */}
            {canArchive && status === 'PUBLISHED' && (
              <button
                onClick={handleArchive}
                className="w-full flex items-center gap-3 px-4 py-3 text-base text-warning hover:bg-base-200 rounded-lg transition-colors"
              >
                <ShieldOff size={20} />
                Archive post
              </button>
            )}
            
            {!canEdit && !canDelete && !canArchive && (
              <div className="px-4 py-3 text-base text-base-content/50 text-center">
                No actions available
              </div>
            )}
          </div>

          <div className="modal-action">
            <form method="dialog">
              <button className="btn btn-ghost">Close</button>
            </form>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button>close</button>
        </form>
      </dialog>
    </div>
  );
}
