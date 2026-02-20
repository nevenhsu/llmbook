"use client";

import { useRef, useState } from "react";
import Avatar from "@/components/ui/Avatar";
import Timestamp from "@/components/ui/Timestamp";
import VotePill from "@/components/ui/VotePill";
import { MessageSquare, MoreHorizontal, Edit, Trash2, ShieldOff } from "lucide-react";
import SafeHtml from "@/components/ui/SafeHtml";
import { useLoginModal } from "@/contexts/LoginModalContext";
import ConfirmModal from "@/components/ui/ConfirmModal";
import toast from "react-hot-toast";
import { useVote } from "@/hooks/use-vote";
import { voteComment } from "@/lib/api/votes";
import { apiDelete, apiPatch, ApiError } from "@/lib/api/fetch-json";
import ResponsiveMenu, { ResponsiveMenuHandle } from "@/components/ui/ResponsiveMenu";
import type { FormattedComment, VoteValue } from "@/lib/posts/query-builder";

interface CommentItemProps {
  comment: FormattedComment;
  userVote?: VoteValue;
  userId?: string;
  canModerate?: boolean;
  onRequestReply?: (comment: FormattedComment) => void;
  onRequestEdit?: (comment: FormattedComment) => void;
  onChanged?: () => void;
  onUpdate?: (commentId: string, newBody: string) => void;
  onDelete?: (commentId: string) => void;
  children?: React.ReactNode;
  isArchived?: boolean;
}

export default function CommentItem({
  comment,
  userVote: initialUserVote,
  userId,
  canModerate = false,
  onRequestReply,
  onRequestEdit,
  onChanged,
  onUpdate,
  onDelete,
  children,
  isArchived = false,
}: CommentItemProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUndeleting, setIsUndeleting] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showRemoveModal, setShowRemoveModal] = useState(false);
  const [removeReason, setRemoveReason] = useState("");
  const { openLoginModal } = useLoginModal();
  const menuRef = useRef<ResponsiveMenuHandle>(null);

  const { score, userVote, handleVote, voteDisabled } = useVote({
    id: comment.id,
    initialScore: comment.score ?? 0,
    initialUserVote: initialUserVote ?? null,
    voteFn: voteComment,
    disabled: isArchived,
  });

  // Standardized fields from transformCommentToFormat
  const isPersona = comment.isPersona;
  const isAuthor = userId && comment.authorId === userId;

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await apiDelete(`/api/comments/${comment.id}`);
      onDelete?.(comment.id);
      onChanged?.();
    } catch (err) {
      console.error("Failed to delete comment:", err);
      toast.error(err instanceof ApiError ? err.message : "Failed to delete comment");
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleUndelete = async () => {
    setIsUndeleting(true);
    try {
      await apiPatch(`/api/comments/${comment.id}`, { is_deleted: false });
      onChanged?.();
    } catch (err) {
      console.error("Failed to undelete comment:", err);
      toast.error(err instanceof ApiError ? err.message : "Failed to undelete comment");
    } finally {
      setIsUndeleting(false);
    }
  };

  const handleConfirmRemove = async () => {
    setIsRemoving(true);
    try {
      const result = await apiPatch<{ comment: { body: string } }>(`/api/comments/${comment.id}`, {
        is_deleted: true,
        deletion_reason: removeReason,
      });
      onUpdate?.(comment.id, result.comment.body);
      onChanged?.();
      setShowRemoveModal(false);
      setRemoveReason("");
    } catch (err) {
      console.error("Failed to remove comment:", err);
      toast.error(err instanceof ApiError ? err.message : "Failed to remove comment");
    } finally {
      setIsRemoving(false);
    }
  };

  const canEdit = isAuthor && !comment.isDeleted;
  const canDelete = isAuthor && !comment.isDeleted;
  const canRemove = canModerate && !comment.isDeleted && !isAuthor;
  const canRestore = canModerate && comment.isDeleted;
  const hasAnyAction = canEdit || canDelete || canRemove || canRestore;

  const menuItems = (
    <>
      {canEdit && (
        <li>
          <button
            aria-label="Edit comment"
            onClick={() => {
              menuRef.current?.close();
              onRequestEdit?.(comment);
            }}
            className="text-base-content flex w-full items-center gap-3 px-4 py-3 text-base md:px-3 md:py-2 md:text-sm"
          >
            <Edit size={20} className="md:hidden" />
            <Edit size={16} className="hidden md:inline" />
            Edit
          </button>
        </li>
      )}

      {canDelete && (
        <li>
          <button
            aria-label="Delete comment"
            onClick={() => {
              menuRef.current?.close();
              setShowDeleteConfirm(true);
            }}
            disabled={isDeleting}
            className="text-error flex w-full items-center gap-3 px-4 py-3 text-base md:px-3 md:py-2 md:text-sm"
          >
            <Trash2 size={20} className="md:hidden" />
            <Trash2 size={16} className="hidden md:inline" />
            {isDeleting ? "Deleting..." : "Delete"}
          </button>
        </li>
      )}

      {canRemove && (
        <li>
          <button
            aria-label="Remove comment (moderator)"
            onClick={() => {
              menuRef.current?.close();
              setShowRemoveModal(true);
            }}
            className="text-warning flex w-full items-center gap-3 px-4 py-3 text-base md:px-3 md:py-2 md:text-sm"
          >
            <ShieldOff size={20} className="md:hidden" />
            <ShieldOff size={16} className="hidden md:inline" />
            Remove (Mod)
          </button>
        </li>
      )}

      {canRestore && (
        <li>
          <button
            aria-label="Restore comment"
            onClick={() => {
              menuRef.current?.close();
              void handleUndelete();
            }}
            disabled={isUndeleting}
            className="text-success flex w-full items-center gap-3 px-4 py-3 text-base md:px-3 md:py-2 md:text-sm"
          >
            <ShieldOff size={20} className="md:hidden" />
            <ShieldOff size={16} className="hidden md:inline" />
            {isUndeleting ? "Restoring..." : "Restore"}
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

  if (isCollapsed) {
    return (
      <div className="py-2">
        <button
          onClick={() => setIsCollapsed(false)}
          className="text-base-content/70 hover:text-base-content flex items-center gap-2 text-xs"
        >
          <span className="bg-base-100 flex h-4 w-4 items-center justify-center rounded-full text-[10px]">
            +
          </span>
          <span className="font-bold">{comment.authorName}</span>
          <span>•</span>
          <span>{comment.score} points</span>
          <span>•</span>
          <Timestamp date={comment.createdAt} />
        </button>
      </div>
    );
  }

  return (
    <div className="flex gap-2 py-2">
      {/* Collapse line */}
      <div
        className="group flex cursor-pointer flex-col items-center"
        onClick={() => setIsCollapsed(true)}
      >
        <div className="h-6 w-6 flex-shrink-0 overflow-hidden rounded-full">
          <Avatar
            fallbackSeed={comment.authorName}
            src={comment.authorAvatarUrl}
            size="xs"
            isPersona={isPersona}
          />
        </div>
        <div className="bg-neutral group-hover:bg-text-secondary mt-2 w-0.5 flex-1" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center gap-2 text-xs">
          <span className="text-base-content font-bold">{comment.authorName}</span>
          {isPersona && (
            <span className="bg-info/10 text-info rounded-sm px-1 text-[8px] font-bold">AI</span>
          )}
          <span className="text-base-content/50">•</span>
          <Timestamp date={comment.createdAt} />
        </div>

        {comment.isDeleted ? (
          <div className="text-base-content/60 mb-2 text-sm">[deleted]</div>
        ) : (
          <SafeHtml
            html={comment.body ?? ""}
            className="tiptap-html text-base-content mb-2 text-sm break-words"
          />
        )}

        <div className="text-base-content/70 flex items-center gap-4">
          <VotePill
            score={score}
            userVote={userVote}
            onVote={handleVote}
            size="sm"
            disabled={voteDisabled}
          />
          {!isArchived && (
            <>
              {userId ? (
                <button
                  onClick={() => onRequestReply?.(comment)}
                  className="hover:bg-base-100 flex items-center gap-1 rounded-sm px-2 py-1 text-xs font-bold"
                >
                  <MessageSquare size={16} />
                  Reply
                </button>
              ) : (
                <button
                  onClick={openLoginModal}
                  className="hover:bg-base-100 flex items-center gap-1 rounded-sm px-2 py-1 text-xs font-bold"
                >
                  <MessageSquare size={16} />
                  Reply
                </button>
              )}
            </>
          )}

          {!isArchived && (
            <ResponsiveMenu
              ref={menuRef}
              trigger={<MoreHorizontal size={16} />}
              title="Comment actions"
              triggerClassName="hover:bg-base-100 rounded-sm p-1"
              ariaLabel="Comment actions"
            >
              {menuItems}
            </ResponsiveMenu>
          )}
        </div>

        {children && <div className="mt-2">{children}</div>}

        <ConfirmModal
          isOpen={showDeleteConfirm}
          onClose={() => setShowDeleteConfirm(false)}
          onConfirm={handleDelete}
          title="Delete Comment?"
          message="Are you sure you want to delete this comment?"
          confirmText="Delete Comment"
          confirmationText="DELETE"
          isLoading={isDeleting}
        />

        {showRemoveModal && (
          <dialog
            className="modal modal-open"
            role="dialog"
            aria-modal="true"
            aria-labelledby="remove-comment-title"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setShowRemoveModal(false);
                setRemoveReason("");
              }
            }}
          >
            <div className="modal-box">
              <h3 id="remove-comment-title" className="text-warning text-lg font-bold">
                Remove Comment
              </h3>
              <div className="py-4">
                <p className="text-base-content/80 mb-2">
                  Provide an optional reason for removing this comment:
                </p>
                <textarea
                  value={removeReason}
                  onChange={(e) => setRemoveReason(e.target.value)}
                  placeholder="Reason (optional)"
                  className="textarea textarea-bordered w-full"
                  rows={3}
                  autoFocus
                />
              </div>
              <div className="modal-action">
                <button
                  className="btn btn-ghost"
                  onClick={() => {
                    setShowRemoveModal(false);
                    setRemoveReason("");
                  }}
                  disabled={isRemoving}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-warning"
                  onClick={() => void handleConfirmRemove()}
                  disabled={isRemoving}
                >
                  {isRemoving ? (
                    <>
                      <span className="loading loading-spinner loading-sm"></span>
                      Removing...
                    </>
                  ) : (
                    "Remove Comment"
                  )}
                </button>
              </div>
            </div>
            <form method="dialog" className="modal-backdrop">
              <button
                onClick={() => {
                  setShowRemoveModal(false);
                  setRemoveReason("");
                }}
                aria-label="Close"
              >
                close
              </button>
            </form>
          </dialog>
        )}
      </div>
    </div>
  );
}
