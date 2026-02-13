"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  MessageSquare,
  Share2,
  Bookmark,
  Eye,
  EyeOff,
  MoreHorizontal,
  Edit,
  Trash2,
  ShieldOff,
} from "lucide-react";
import ConfirmModal from "@/components/ui/ConfirmModal";
import toast from "react-hot-toast";

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
  isHidden?: boolean;
  isExpanded?: boolean;
  onShare?: () => void;
  onSave?: () => void;
  onHide?: () => void;
  onUnhide?: () => void;
  onToggleExpand?: () => void;
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
  isHidden = false,
  isExpanded = false,
  onSave,
  onHide,
  onUnhide,
  onToggleExpand,
  onDelete,
}: PostActionsProps) {
  const router = useRouter();
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isUndeleting, setIsUndeleting] = useState(false);
  const modalRef = useRef<HTMLDialogElement>(null);

  const isAuthor = !!(authorId && userId && authorId === userId);
  const isModerator = !!canModerate;
  const isLoggedIn = !!userId;
  const isArchived = status === 'ARCHIVED';
  const isDeleted = status === 'DELETED';

  // Action permissions based on requirements
  const canHide = isLoggedIn && !isArchived && !isAuthor;
  const canEdit = isAuthor && !isArchived && !isDeleted;
  const canDelete = isAuthor || isModerator;
  
  // Additional moderator-only actions
  const canUndelete = isModerator && isDeleted;
  const canUnarchive = isModerator && isArchived;
  const canArchive = isModerator && !isArchived && !isDeleted;

  const hasAnyAction = canHide || canEdit || canDelete || canUndelete || canUnarchive || canArchive;

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

  const handleDelete = async () => {
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
      toast.error('Failed to delete post');
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleUndelete = async () => {
    setIsUndeleting(true);
    try {
      const res = await fetch(`/api/posts/${postId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'PUBLISHED' }),
      });

      if (!res.ok) throw new Error('Failed to undelete post');

      closeMoreMenu();
      router.refresh();
    } catch (err) {
      console.error('Failed to undelete post:', err);
      toast.error('Failed to undelete post');
    } finally {
      setIsUndeleting(false);
    }
  };

  const handleUnarchive = async () => {
    try {
      const res = await fetch(`/api/posts/${postId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'PUBLISHED' }),
      });

      if (!res.ok) throw new Error('Failed to unarchive post');

      closeMoreMenu();
      router.refresh();
    } catch (err) {
      console.error('Failed to unarchive post:', err);
      toast.error('Failed to unarchive post');
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
      toast.error('Failed to archive post');
    }
  };

  const menuItems = (
    <div className="space-y-1">
      {/* Hide/Unhide - logged in only */}
      {canHide && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (isHidden) {
              onUnhide?.();
            } else {
              onHide?.();
            }
            closeMoreMenu();
          }}
          className="w-full flex items-center gap-3 px-4 py-3 md:px-3 md:py-2 text-base md:text-sm text-base-content hover:bg-base-200 rounded-lg transition-colors"
        >
          {isHidden ? (
            <>
              <Eye size={20} className="md:w-4 md:h-4" />
              Unhide post
            </>
          ) : (
            <>
              <EyeOff size={20} className="md:w-4 md:h-4" />
              Hide post
            </>
          )}
        </button>
      )}

      {/* Edit - author only, not archived/deleted */}
      {canEdit && (
        <button
          onClick={handleEdit}
          className="w-full flex items-center gap-3 px-4 py-3 md:px-3 md:py-2 text-base md:text-sm text-base-content hover:bg-base-200 rounded-lg transition-colors"
        >
          <Edit size={20} className="md:w-4 md:h-4" />
          Edit post
        </button>
      )}

      {/* Delete - author or moderator */}
      {canDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowDeleteConfirm(true);
            closeMoreMenu();
          }}
          disabled={isDeleting}
          className="w-full flex items-center gap-3 px-4 py-3 md:px-3 md:py-2 text-base md:text-sm text-error hover:bg-base-200 rounded-lg transition-colors"
        >
          <Trash2 size={20} className="md:w-4 md:h-4" />
          {isDeleting ? 'Deleting...' : 'Delete post'}
        </button>
      )}

      {/* Moderator Actions */}
      {canUndelete && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleUndelete();
          }}
          disabled={isUndeleting}
          className="w-full flex items-center gap-3 px-4 py-3 md:px-3 md:py-2 text-base md:text-sm text-success hover:bg-base-200 rounded-lg transition-colors"
        >
          <ShieldOff size={20} className="md:w-4 md:h-4" />
          {isUndeleting ? 'Restoring...' : 'Restore post'}
        </button>
      )}

      {canArchive && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleArchive(e);
          }}
          className="w-full flex items-center gap-3 px-4 py-3 md:px-3 md:py-2 text-base md:text-sm text-warning hover:bg-base-200 rounded-lg transition-colors"
        >
          <ShieldOff size={20} className="md:w-4 md:h-4" />
          Archive post
        </button>
      )}

      {canUnarchive && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleUnarchive();
          }}
          className="w-full flex items-center gap-3 px-4 py-3 md:px-3 md:py-2 text-base md:text-sm text-success hover:bg-base-200 rounded-lg transition-colors"
        >
          <ShieldOff size={20} className="md:w-4 md:h-4" />
          Unarchive post
        </button>
      )}

      {!hasAnyAction && (
        <div className="px-4 py-3 text-base md:text-sm text-base-content/50 text-center">
          No actions available
        </div>
      )}
    </div>
  );

  return (
    <div 
      className="flex items-center gap-0.5 text-xs text-base-content/70"
      onClick={(e) => e.stopPropagation()}
    >
      <button 
        onClick={handleCommentsClick}
        className="flex items-center gap-1 rounded-sm px-2 py-1 hover:hover:bg-base-300"
      >
        <MessageSquare size={16} /> <span>{commentCount}</span>
      </button>
      {!isArchived && (
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
      )}
      {!isArchived && isLoggedIn && (
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
      )}
      {/* More button - logged in only and if there are actions */}
      {isLoggedIn && hasAnyAction && (
        <>
          {/* Desktop Dropdown */}
          <div className="hidden md:block dropdown dropdown-end">
            <button 
              tabIndex={0}
              className="flex items-center gap-1 rounded-sm px-1 py-1 hover:hover:bg-base-300"
            >
              <MoreHorizontal size={16} />
            </button>
            <div tabIndex={0} className="dropdown-content z-[20] menu p-1 shadow-lg bg-base-100 rounded-lg w-48 border border-neutral mt-1">
              {menuItems}
            </div>
          </div>

          {/* Mobile Button (opens modal) */}
          <button 
            onClick={openMoreMenu}
            className="md:hidden flex items-center gap-1 rounded-sm px-1 py-1 hover:hover:bg-base-300"
          >
            <MoreHorizontal size={16} />
          </button>
        </>
      )}

      {/* More menu modal - bottom sheet on mobile, centered on desktop */}
      <dialog ref={modalRef} className="modal modal-bottom md:hidden">
        <div className="modal-box">
          <h3 className="font-bold text-lg mb-4">Post actions</h3>
          {menuItems}
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

      <ConfirmModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDelete}
        title="Delete Post?"
        message="Are you sure you want to delete this post?"
        confirmText="Delete Post"
        isLoading={isDeleting}
      />
    </div>
  );
}
