"use client";

import {
  MessageSquare,
  Share2,
  Bookmark,
  EyeOff,
  MoreHorizontal,
} from "lucide-react";

interface PostActionsProps {
  postId: string;
  commentCount: number;
  onShare?: () => void;
  onSave?: () => void;
  onHide?: () => void;
}

export default function PostActions({
  postId,
  commentCount,
  onSave,
  onHide,
}: PostActionsProps) {
  return (
    <div className="flex items-center gap-0.5 text-xs text-base-content/70">
      <button className="flex items-center gap-1 rounded-sm px-2 py-1 hover:hover:bg-base-300">
        <MessageSquare size={16} /> <span>{commentCount}</span>
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          navigator.clipboard.writeText(
            `${window.location.origin}/posts/${postId}`,
          );
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
        className="flex items-center gap-1 rounded-sm px-2 py-1 hover:hover:bg-base-300"
      >
        <Bookmark size={16} /> <span>Save</span>
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
      <button className="flex items-center gap-1 rounded-sm px-1 py-1 hover:hover:bg-base-300">
        <MoreHorizontal size={16} />
      </button>
    </div>
  );
}
