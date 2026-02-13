"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import VotePill from "@/components/ui/VotePill";
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
import PostMeta from "./PostMeta";
import PostActions from "./PostActions";
import Badge from "@/components/ui/Badge";
import { useLoginModal } from "@/contexts/LoginModalContext";

interface PostRowProps {
  id: string;
  title: string;
  score: number;
  commentCount: number;
  boardName: string;
  boardSlug: string;
  authorName: string;
  authorUsername?: string | null;
  authorAvatarUrl?: string | null;
  isPersona?: boolean;
  createdAt: string;
  thumbnailUrl?: string | null;
  flairs?: string[];
  userVote?: 1 | -1 | null;
  isSaved?: boolean;
  authorId?: string;
  userId?: string;
  canModerate?: boolean;
  status?: string;
  isHidden?: boolean;
  onVote: (postId: string, value: 1 | -1) => void;
}

export default function PostRow({
  id,
  title,
  score,
  commentCount,
  boardName,
  boardSlug,
  authorName,
  authorUsername,
  authorAvatarUrl,
  isPersona = false,
  createdAt,
  thumbnailUrl,
  flairs,
  userVote,
  isSaved = false,
  authorId,
  userId,
  canModerate = false,
  status,
  isHidden = false,
  onVote,
}: PostRowProps) {
  const router = useRouter();
  const [saved, setSaved] = useState(isSaved);
  const [localHidden, setLocalHidden] = useState(isHidden);
  const [localExpanded, setLocalExpanded] = useState(false);
  const [deleted, setDeleted] = useState(status === "DELETED");
  const { openLoginModal } = useLoginModal();

  const isHiddenAndCollapsed = localHidden && !localExpanded;

  const handleSave = async () => {
    try {
      const res = await fetch(`/api/saved/${id}`, {
        method: saved ? 'DELETE' : 'POST',
      });
      if (res.ok) {
        setSaved(!saved);
      } else if (res.status === 401) {
        openLoginModal();
      }
    } catch (err) {
      console.error('Failed to save/unsave post:', err);
    }
  };

  const handleHide = async () => {
    try {
      const res = await fetch(`/api/hidden/${id}`, {
        method: 'POST',
      });
      if (res.ok) {
        setLocalHidden(true);
      } else if (res.status === 401) {
        openLoginModal();
      }
    } catch (err) {
      console.error('Failed to hide post:', err);
    }
  };

  const handleUnhide = async () => {
    try {
      const res = await fetch(`/api/hidden/${id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setLocalHidden(false);
      } else if (res.status === 401) {
        openLoginModal();
      }
    } catch (err) {
      console.error('Failed to unhide post:', err);
    }
  };

  const toggleExpanded = () => {
    setLocalExpanded(!localExpanded);
  };

  const handleDelete = () => {
    setDeleted(true);
  };

  if (deleted || status === "DELETED") {
    return (
      <article className="flex items-center gap-2 px-3 py-2 border-b border-neutral bg-base-200/30 cursor-default">
        <Trash2 size={14} className="text-base-content/40 flex-shrink-0" />
        <div className="flex items-center gap-2 min-w-0 text-xs text-base-content/50">
          <span className="font-bold text-[10px] uppercase tracking-tight bg-base-300 px-1 rounded flex-shrink-0">
            deleted
          </span>
          <span className="font-medium truncate max-w-[200px] sm:max-w-[400px]">
            {title}
          </span>
          <span className="flex-shrink-0">•</span>
          <span className="truncate flex-shrink-0">{authorName}</span>
        </div>
      </article>
    );
  }

  const isArchived = status === 'ARCHIVED';
  const isReadOnly = isArchived || isHiddenAndCollapsed;

  return (
    <article
      onClick={() => !isReadOnly && router.push(`/r/${boardSlug}/posts/${id}`)}
      className={`group flex items-start gap-2 px-2 py-3 border-b border-neutral transition-colors ${
        isHiddenAndCollapsed ? 'bg-base-200/50' : isArchived ? 'bg-warning/5' : 'hover:bg-base-300'
      } ${isReadOnly ? 'cursor-default' : 'cursor-pointer'}`}
    >
      {isHiddenAndCollapsed ? (
        <div className="w-full flex items-center gap-2 py-1">
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-base-300 flex items-center justify-center">
            <EyeOff size={16} className="text-base-content/60" />
          </div>
          <div className="flex-1 min-w-0 flex flex-col">
            <span className="text-sm font-medium text-base-content/60">Hidden by you</span>
            <span className="text-xs text-base-content/40">author: {authorName}</span>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleUnhide();
              }}
              className="btn btn-xs btn-ghost"
            >
              Unhide
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleExpanded();
              }}
              className="btn btn-xs btn-ghost"
            >
              {localExpanded ? 'Hide' : 'Show'}
            </button>
          </div>
        </div>
      ) : (
        <>
          <VotePill
            score={score}
            userVote={userVote}
            onVote={(v) => !isArchived && onVote(id, v)}
            size="sm"
            orientation="horizontal"
            disabled={isArchived}
          />

          {thumbnailUrl && (
            <div className="flex-shrink-0 w-[56px] h-[42px] rounded-md overflow-hidden bg-base-100">
              <img
                src={thumbnailUrl}
                alt=""
                className="w-full h-full object-cover"
              />
            </div>
          )}

          <div className="flex-1 min-w-0 flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-lg font-bold text-base-content line-clamp-2">
                {title}
              </span>
              {status === 'ARCHIVED' && (
                <span className="inline-flex items-center rounded-full bg-warning/20 px-2 py-0.5 text-xs font-semibold text-warning border border-warning/30">
                  ARCHIVED
                </span>
              )}
              {localHidden && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleExpanded();
                  }}
                  className="inline-flex items-center rounded-full bg-base-300 px-2 py-0.5 text-xs font-medium text-base-content/70 hover:bg-base-content/10 transition-colors ml-auto"
                  title="Click to collapse"
                >
                  <EyeOff size={12} className="mr-1" />
                  Hidden
                </button>
              )}
              {flairs?.map((f) => (
                <Badge key={f} variant="flair">
                  {f}
                </Badge>
              ))}
            </div>

            <PostMeta
              boardName={boardName}
              boardSlug={boardSlug}
              authorName={authorName}
              authorUsername={authorUsername}
              authorAvatarUrl={authorAvatarUrl}
              isPersona={isPersona}
              createdAt={createdAt}
            />

            <div className="opacity-0 group-hover:opacity-100 transition-opacity md:opacity-0 max-md:opacity-100">
              <PostActions 
                postId={id}
                boardSlug={boardSlug}
                commentCount={commentCount} 
                isSaved={saved}
                authorId={authorId}
                userId={userId}
                canModerate={canModerate}
                onSave={handleSave}
                onHide={handleHide}
                onDelete={handleDelete}
                isHidden={localHidden}
                isExpanded={localExpanded}
                onUnhide={handleUnhide}
                onToggleExpand={toggleExpanded}
              />
            </div>
          </div>
        </>
      )}
    </article>
  );
}
