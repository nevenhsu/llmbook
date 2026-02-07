"use client";

import { useState } from 'react';
import Avatar from '@/components/ui/Avatar';
import Timestamp from '@/components/ui/Timestamp';
import VotePill from '@/components/ui/VotePill';
import { MessageSquare, MoreHorizontal } from 'lucide-react';
import CommentForm from './CommentForm';
import DOMPurify from 'dompurify';

interface CommentItemProps {
  comment: any;
  userVote?: 1 | -1 | null;
  onVote: (commentId: string, value: 1 | -1) => void;
  postId: string;
  userId?: string;
  onReply: (newComment: any) => void;
  children?: React.ReactNode;
}

export default function CommentItem({ 
  comment, 
  userVote, 
  onVote, 
  postId, 
  userId, 
  onReply,
  children
}: CommentItemProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isReplying, setIsReplying] = useState(false);
  
  const author = comment.profiles || comment.personas;
  const isPersona = !!comment.persona_id;
  
  if (isCollapsed) {
    return (
      <div className="py-2">
        <button 
          onClick={() => setIsCollapsed(false)}
          className="text-xs text-text-secondary hover:text-text-primary flex items-center gap-2"
        >
          <span className="w-4 h-4 flex items-center justify-center bg-surface rounded-full text-[10px]">+</span>
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
        <div className="w-0.5 flex-1 bg-border-default group-hover:bg-text-secondary mt-2" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 text-xs mb-1">
          <span className="font-bold text-text-primary">{author?.display_name || 'Anonymous'}</span>
          {isPersona && <span className="bg-ai-badge-bg text-ai-badge-text font-bold text-[8px] px-1 rounded-sm">AI</span>}
          <span className="text-text-muted">•</span>
          <Timestamp date={comment.created_at} />
        </div>

        <div 
          className="text-sm text-text-primary mb-2 break-words"
          dangerouslySetInnerHTML={{ __html: comment.is_deleted ? '[deleted]' : DOMPurify.sanitize(comment.body) }}
        />

        <div className="flex items-center gap-4 text-text-secondary">
          <VotePill 
            score={comment.score} 
            userVote={userVote} 
            onVote={(v) => onVote(comment.id, v)} 
            size="sm" 
          />
          <button 
            onClick={() => setIsReplying(!isReplying)}
            className="flex items-center gap-1 hover:bg-surface rounded-sm px-2 py-1 text-xs font-bold"
          >
            <MessageSquare size={16} />
            Reply
          </button>
          <button className="p-1 hover:bg-surface rounded-sm">
            <MoreHorizontal size={16} />
          </button>
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
