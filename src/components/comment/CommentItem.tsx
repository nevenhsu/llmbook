"use client";

import { useState } from 'react';
import Avatar from '@/components/ui/Avatar';
import Timestamp from '@/components/ui/Timestamp';
import VotePill from '@/components/ui/VotePill';
import { MessageSquare, MoreHorizontal, Edit, Trash2, ShieldOff } from 'lucide-react';
import CommentForm from './CommentForm';
import DOMPurify from 'isomorphic-dompurify';

interface CommentItemProps {
  comment: any;
  userVote?: 1 | -1 | null;
  onVote: (commentId: string, value: 1 | -1) => void;
  postId: string;
  userId?: string;
  canModerate?: boolean;
  onReply: (newComment: any) => void;
  onUpdate?: (commentId: string, newBody: string) => void;
  onDelete?: (commentId: string) => void;
  children?: React.ReactNode;
}

export default function CommentItem({ 
  comment, 
  userVote, 
  onVote, 
  postId, 
  userId, 
  canModerate = false,
  onReply,
  onUpdate,
  onDelete,
  children
}: CommentItemProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isReplying, setIsReplying] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [editBody, setEditBody] = useState(comment.body);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const author = comment.profiles || comment.personas;
  const isPersona = !!comment.persona_id;
  const isAuthor = userId && comment.author_id === userId;

  const handleEdit = async () => {
    if (!editBody.trim()) return;

    try {
      const res = await fetch(`/api/comments/${comment.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: editBody })
      });

      if (!res.ok) throw new Error('Failed to update comment');

      const { comment: updatedComment } = await res.json();
      onUpdate?.(comment.id, updatedComment.body);
      setIsEditing(false);
    } catch (err) {
      console.error('Failed to update comment:', err);
      alert('Failed to update comment');
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this comment?')) return;

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/comments/${comment.id}`, {
        method: 'DELETE'
      });

      if (!res.ok) throw new Error('Failed to delete comment');

      onDelete?.(comment.id);
    } catch (err) {
      console.error('Failed to delete comment:', err);
      alert('Failed to delete comment');
    } finally {
      setIsDeleting(false);
      setShowMoreMenu(false);
    }
  };

  const handleRemove = async () => {
    const reason = prompt('Reason for removal (optional):');
    if (reason === null) return;

    try {
      const res = await fetch(`/api/comments/${comment.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_deleted: true, deletion_reason: reason })
      });

      if (!res.ok) throw new Error('Failed to remove comment');

      const { comment: updatedComment } = await res.json();
      onUpdate?.(comment.id, updatedComment.body);
    } catch (err) {
      console.error('Failed to remove comment:', err);
      alert('Failed to remove comment');
    } finally {
      setShowMoreMenu(false);
    }
  };
  
  if (isCollapsed) {
    return (
      <div className="py-2">
        <button 
          onClick={() => setIsCollapsed(false)}
          className="text-xs text-base-content/70 hover:text-base-content flex items-center gap-2"
        >
          <span className="w-4 h-4 flex items-center justify-center bg-base-100 rounded-full text-[10px]">+</span>
          <span className="font-bold">{author?.display_name || 'Anonymous'}</span>
          <span>•</span>
          <span>{comment.score} points</span>
          <span>•</span>
          <Timestamp date={comment.created_at} />
        </button>
      </div>
    );
  }

  return (
    <div className="flex gap-2 py-2">
      {/* Collapse line */}
      <div className="flex flex-col items-center group cursor-pointer" onClick={() => setIsCollapsed(true)}>
        <div className="w-6 h-6 rounded-full overflow-hidden flex-shrink-0">
          <Avatar 
            fallbackSeed={author?.display_name || 'Anonymous'} 
            src={author?.avatar_url} 
            size="xs" 
            isPersona={isPersona} 
          />
        </div>
        <div className="w-0.5 flex-1 bg-neutral group-hover:bg-text-secondary mt-2" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 text-xs mb-1">
          <span className="font-bold text-base-content">{author?.display_name || 'Anonymous'}</span>
          {isPersona && <span className="bg-info/10 text-info font-bold text-[8px] px-1 rounded-sm">AI</span>}
          <span className="text-base-content/50">•</span>
          <Timestamp date={comment.created_at} />
        </div>

        {isEditing ? (
          <div className="mb-2">
            <textarea
              value={editBody}
              onChange={(e) => setEditBody(e.target.value)}
              className="w-full p-2 border border-neutral rounded-md bg-base-100 text-sm"
              rows={3}
            />
            <div className="flex gap-2 mt-2">
              <button
                onClick={handleEdit}
                className="btn btn-sm btn-primary"
              >
                Save
              </button>
              <button
                onClick={() => {
                  setIsEditing(false);
                  setEditBody(comment.body);
                }}
                className="btn btn-sm btn-ghost"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div 
            className="text-sm text-base-content mb-2 break-words"
            dangerouslySetInnerHTML={{ __html: comment.is_deleted ? '[deleted]' : DOMPurify.sanitize(comment.body) }}
          />
        )}

        <div className="flex items-center gap-4 text-base-content/70">
          <VotePill 
            score={comment.score} 
            userVote={userVote} 
            onVote={(v) => onVote(comment.id, v)} 
            size="sm" 
          />
          <button 
            onClick={() => setIsReplying(!isReplying)}
            className="flex items-center gap-1 hover:bg-base-100 rounded-sm px-2 py-1 text-xs font-bold"
          >
            <MessageSquare size={16} />
            Reply
          </button>
          
          <div className="relative">
            <button 
              onClick={() => setShowMoreMenu(!showMoreMenu)}
              className="p-1 hover:bg-base-100 rounded-sm"
            >
              <MoreHorizontal size={16} />
            </button>

            {showMoreMenu && (
              <>
                <div 
                  className="fixed inset-0 z-10" 
                  onClick={() => setShowMoreMenu(false)}
                />
                <div className="absolute left-0 top-8 z-20 w-48 bg-base-100 border border-neutral rounded-md shadow-lg py-1">
                  {isAuthor && !comment.is_deleted && (
                    <>
                      <button
                        onClick={() => {
                          setIsEditing(true);
                          setShowMoreMenu(false);
                        }}
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
                  {canModerate && !isAuthor && !comment.is_deleted && (
                    <button
                      onClick={handleRemove}
                      className="w-full flex items-center gap-2 px-4 py-2 text-sm text-warning hover:bg-base-200"
                    >
                      <ShieldOff size={16} />
                      Remove (Mod)
                    </button>
                  )}
                  {(!isAuthor && !canModerate) || comment.is_deleted && (
                    <div className="px-4 py-2 text-sm text-base-content/50">
                      No actions available
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {isReplying && (
          <CommentForm 
            postId={postId} 
            parentId={comment.id} 
            onCancel={() => setIsReplying(false)} 
            onSubmit={(newComment) => {
              setIsReplying(false);
              onReply(newComment);
            }} 
          />
        )}

        {children && (
          <div className="mt-2">
            {children}
          </div>
        )}
      </div>
    </div>
  );
}
