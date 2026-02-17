"use client";

import { useState } from "react";
import Avatar from "@/components/ui/Avatar";
import Timestamp from "@/components/ui/Timestamp";
import VotePill from "@/components/ui/VotePill";
import { MessageSquare, MoreHorizontal, Edit, Trash2, ShieldOff } from "lucide-react";
import SafeHtml from "@/components/ui/SafeHtml";
import { useLoginModal } from "@/contexts/LoginModalContext";
import ConfirmModal from "@/components/ui/ConfirmModal";
import toast from "react-hot-toast";
import { useVote } from "@/hooks/useVote";
import { voteComment } from "@/lib/api/votes";

interface CommentItemProps {
  comment: any;
  userVote?: 1 | -1 | null;
  userId?: string;
  canModerate?: boolean;
  onRequestReply?: (comment: any) => void;
  onRequestEdit?: (comment: any) => void;
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
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUndeleting, setIsUndeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const { openLoginModal } = useLoginModal();

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
      const res = await fetch(`/api/comments/${comment.id}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Failed to delete comment");

      onDelete?.(comment.id);
      onChanged?.();
    } catch (err) {
      console.error("Failed to delete comment:", err);
      toast.error("Failed to delete comment");
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
      setShowMoreMenu(false);
    }
  };

  const handleUndelete = async () => {
    setIsUndeleting(true);
    try {
      const res = await fetch(`/api/comments/${comment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_deleted: false }),
      });

      if (!res.ok) throw new Error("Failed to undelete comment");

      onChanged?.();
    } catch (err) {
      console.error("Failed to undelete comment:", err);
      toast.error("Failed to undelete comment");
    } finally {
      setIsUndeleting(false);
      setShowMoreMenu(false);
    }
  };

  const handleRemove = async () => {
    const reason = prompt("Reason for removal (optional):");
    if (reason === null) return;

    try {
      const res = await fetch(`/api/comments/${comment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_deleted: true, deletion_reason: reason }),
      });

      if (!res.ok) throw new Error("Failed to remove comment");

      const { comment: updatedComment } = await res.json();
      onUpdate?.(comment.id, updatedComment.body);
      onChanged?.();
    } catch (err) {
      console.error("Failed to remove comment:", err);
      toast.error("Failed to remove comment");
    } finally {
      setShowMoreMenu(false);
    }
  };

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

        {comment.is_deleted ? (
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
            <div className="relative">
              <button
                onClick={() => setShowMoreMenu(!showMoreMenu)}
                className="hover:bg-base-100 rounded-sm p-1"
              >
                <MoreHorizontal size={16} />
              </button>

              {showMoreMenu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowMoreMenu(false)} />
                  <div className="bg-base-100 border-neutral absolute top-8 left-0 z-20 w-48 rounded-md border py-1 shadow-lg">
                    {isAuthor && !comment.is_deleted && (
                      <>
                        <button
                          onClick={() => {
                            onRequestEdit?.(comment);
                            setShowMoreMenu(false);
                          }}
                          className="text-base-content hover:bg-base-200 flex w-full items-center gap-2 px-4 py-2 text-sm"
                        >
                          <Edit size={16} />
                          Edit
                        </button>
                        <button
                          onClick={() => {
                            setShowDeleteConfirm(true);
                          }}
                          disabled={isDeleting}
                          className="text-error hover:bg-base-200 flex w-full items-center gap-2 px-4 py-2 text-sm"
                        >
                          <Trash2 size={16} />
                          {isDeleting ? "Deleting..." : "Delete"}
                        </button>
                      </>
                    )}
                    {canModerate && !comment.is_deleted && !isAuthor && (
                      <button
                        onClick={handleRemove}
                        className="text-warning hover:bg-base-200 flex w-full items-center gap-2 px-4 py-2 text-sm"
                      >
                        <ShieldOff size={16} />
                        Remove (Mod)
                      </button>
                    )}
                    {canModerate && comment.is_deleted && (
                      <>
                        <button
                          onClick={handleUndelete}
                          disabled={isUndeleting}
                          className="text-success hover:bg-base-200 flex w-full items-center gap-2 px-4 py-2 text-sm"
                        >
                          <ShieldOff size={16} />
                          {isUndeleting ? "Restoring..." : "Restore"}
                        </button>
                      </>
                    )}
                    {!isAuthor && !canModerate && !comment.is_deleted && (
                      <div className="text-base-content/50 px-4 py-2 text-sm">
                        No actions available
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
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
          isLoading={isDeleting}
        />
      </div>
    </div>
  );
}
