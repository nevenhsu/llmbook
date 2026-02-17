"use client";

import { useRef, useState } from "react";
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
  RotateCcw,
  Archive,
  ArchiveRestore,
} from "lucide-react";
import ConfirmModal from "@/components/ui/ConfirmModal";
import ResponsiveMenu, { ResponsiveMenuHandle } from "@/components/ui/ResponsiveMenu";
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
  const menuRef = useRef<ResponsiveMenuHandle>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isUndeleting, setIsUndeleting] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [isUnarchiving, setIsUnarchiving] = useState(false);

  const isAuthor = !!(authorId && userId && authorId === userId);
  const isModerator = !!canModerate;
  const isLoggedIn = !!userId;
  const isArchived = status === "ARCHIVED";
  const isDeleted = status === "DELETED";

  // Action permissions based on requirements
  const canHide = isLoggedIn && !isArchived && !isAuthor;
  const canEdit = isAuthor && !isArchived && !isDeleted;
  const canDelete = isModerator;

  // Additional moderator-only actions
  const canUndelete = isModerator && isDeleted;
  const canUnarchive = isModerator && isArchived;
  const canArchive = isModerator && !isArchived && !isDeleted;

  const hasAnyAction = canHide || canEdit || canDelete || canUndelete || canUnarchive || canArchive;

  const handleCommentsClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (inDetailPage) {
      // Scroll to comments section
      document.getElementById("comments")?.scrollIntoView({ behavior: "smooth" });
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
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/posts/${postId}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Failed to delete post");

      onDelete?.();
      router.refresh();
    } catch (err) {
      console.error("Failed to delete post:", err);
      toast.error("Failed to delete post");
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleUndelete = async () => {
    setIsUndeleting(true);
    try {
      const res = await fetch(`/api/posts/${postId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "PUBLISHED" }),
      });

      if (!res.ok) throw new Error("Failed to restore post");

      menuRef.current?.close();
      toast.success("Post restored");
      router.refresh();
    } catch (err) {
      console.error("Failed to restore post:", err);
      toast.error("Failed to restore post");
    } finally {
      setIsUndeleting(false);
    }
  };

  const handleUnarchive = async () => {
    setIsUnarchiving(true);
    try {
      const res = await fetch(`/api/posts/${postId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "PUBLISHED" }),
      });

      if (!res.ok) throw new Error("Failed to unarchive post");

      menuRef.current?.close();
      toast.success("Post unarchived");
      router.refresh();
    } catch (err) {
      console.error("Failed to unarchive post:", err);
      toast.error("Failed to unarchive post");
    } finally {
      setIsUnarchiving(false);
    }
  };

  const handleArchive = async () => {
    setIsArchiving(true);
    try {
      const res = await fetch(`/api/posts/${postId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "ARCHIVED" }),
      });

      if (!res.ok) throw new Error("Failed to archive post");

      menuRef.current?.close();
      toast.success("Post archived");
      router.refresh();
    } catch (err) {
      console.error("Failed to archive post:", err);
      toast.error("Failed to archive post");
    } finally {
      setIsArchiving(false);
    }
  };

  const menuItems = (
    <>
      {/* Hide/Unhide - logged in only */}
      {canHide && (
        <li>
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (isHidden) {
                onUnhide?.();
              } else {
                onHide?.();
              }
            }}
            className="text-base-content flex w-full items-center gap-3 px-4 py-3 text-base md:px-3 md:py-2 md:text-sm"
          >
            <Eye size={20} className="md:hidden" />
            <Eye size={16} className="hidden md:inline" />
            {isHidden ? "Unhide post" : "Hide post"}
          </button>
        </li>
      )}

      {/* Edit - author only, not archived/deleted */}
      {canEdit && (
        <li>
          <button
            onClick={handleEdit}
            className="text-base-content flex w-full items-center gap-3 px-4 py-3 text-base md:px-3 md:py-2 md:text-sm"
          >
            <Edit size={20} className="md:hidden" />
            <Edit size={16} className="hidden md:inline" />
            Edit post
          </button>
        </li>
      )}

      {/* Moderator: Restore deleted post */}
      {canUndelete && (
        <li>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleUndelete();
            }}
            disabled={isUndeleting}
            className="text-base-content flex w-full items-center gap-3 px-4 py-3 text-base md:px-3 md:py-2 md:text-sm"
          >
            <RotateCcw size={20} className="md:hidden" />
            <RotateCcw size={16} className="hidden md:inline" />
            {isUndeleting ? "Restoring..." : "Restore post"}
          </button>
        </li>
      )}

      {/* Moderator: Archive */}
      {canArchive && (
        <li>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleArchive();
            }}
            disabled={isArchiving}
            className="text-base-content flex w-full items-center gap-3 px-4 py-3 text-base md:px-3 md:py-2 md:text-sm"
          >
            <Archive size={20} className="md:hidden" />
            <Archive size={16} className="hidden md:inline" />
            {isArchiving ? "Archiving..." : "Archive post"}
          </button>
        </li>
      )}

      {/* Moderator: Unarchive */}
      {canUnarchive && (
        <li>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleUnarchive();
            }}
            disabled={isUnarchiving}
            className="text-base-content flex w-full items-center gap-3 px-4 py-3 text-base md:px-3 md:py-2 md:text-sm"
          >
            <ArchiveRestore size={20} className="md:hidden" />
            <ArchiveRestore size={16} className="hidden md:inline" />
            {isUnarchiving ? "Unarchiving..." : "Unarchive post"}
          </button>
        </li>
      )}

      {/* Delete - moderator only */}
      {canDelete && (
        <li>
          <button
            onClick={(e) => {
              e.stopPropagation();
              menuRef.current?.close();
              setShowDeleteConfirm(true);
            }}
            disabled={isDeleting}
            className="text-error flex w-full items-center gap-3 px-4 py-3 text-base md:px-3 md:py-2 md:text-sm"
          >
            <Trash2 size={20} className="md:hidden" />
            <Trash2 size={16} className="hidden md:inline" />
            {isDeleting ? "Deleting..." : "Delete post"}
          </button>
        </li>
      )}

      {!hasAnyAction && (
        <li className="text-base-content/50 px-4 py-3 text-center text-base md:text-sm">
          No actions available
        </li>
      )}
    </>
  );

  return (
    <div
      className="text-base-content/70 flex items-center gap-0.5 text-xs"
      onClick={(e) => e.stopPropagation()}
    >
      <button
        onClick={handleCommentsClick}
        className="hover:hover:bg-base-300 flex items-center gap-1 rounded-sm px-2 py-1"
      >
        <MessageSquare size={16} /> <span>{commentCount}</span>
      </button>
      {!isArchived && !isDeleted && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (boardSlug) {
              navigator.clipboard.writeText(
                `${window.location.origin}/r/${boardSlug}/posts/${postId}`,
              );
            }
          }}
          className="hover:hover:bg-base-300 flex items-center gap-1 rounded-sm px-2 py-1"
        >
          <Share2 size={16} /> <span>Share</span>
        </button>
      )}
      {!isArchived && !isDeleted && isLoggedIn && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onSave?.();
          }}
          className={`hover:hover:bg-base-300 flex items-center gap-1 rounded-sm px-2 py-1 ${
            isSaved ? "text-primary" : ""
          }`}
        >
          <Bookmark size={16} fill={isSaved ? "currentColor" : "none"} />
          <span>{isSaved ? "Saved" : "Save"}</span>
        </button>
      )}
      {/* More button - logged in only and if there are actions */}
      {isLoggedIn && hasAnyAction && (
        <ResponsiveMenu
          ref={menuRef}
          trigger={<MoreHorizontal size={16} />}
          title="Post actions"
          triggerClassName="flex items-center gap-1 rounded-sm px-1 py-1 hover:hover:bg-base-300"
          ariaLabel="Post actions"
        >
          {menuItems}
        </ResponsiveMenu>
      )}

      <ConfirmModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDelete}
        title="Delete Post?"
        message="Are you sure you want to delete this post? This action cannot be undone."
        confirmText="Delete Post"
        isLoading={isDeleting}
      />
    </div>
  );
}
