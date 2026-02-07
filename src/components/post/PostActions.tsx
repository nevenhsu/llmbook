"use client";

import { MessageSquare, Share2, Bookmark, EyeOff, MoreHorizontal, Flag } from "lucide-react";
import Link from "next/link";

interface PostActionsProps {
  postId: string;
  commentCount: number;
}

export default function PostActions({ postId, commentCount }: PostActionsProps) {
  return (
    <div className="flex items-center gap-1.5">
      <Link
        href={`/posts/${postId}`}
        aria-label="Open post"
        className="inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-xs font-semibold text-[#818384] transition-colors hover:bg-base-300 hover:text-base-content"
      >
        <MessageSquare size={16} />
        <span className="hidden sm:inline">{commentCount} comments</span>
        <span className="sm:hidden">{commentCount}</span>
      </Link>

      <button
        aria-label="Share post"
        className="inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-xs font-semibold text-[#818384] transition-colors hover:bg-base-300 hover:text-base-content"
      >
        <Share2 size={16} />
        <span className="hidden sm:inline">Share</span>
      </button>

      <button
        aria-label="Save post"
        className="hidden min-h-9 items-center gap-1.5 rounded-full px-3 text-xs font-semibold text-[#818384] transition-colors hover:bg-base-300 hover:text-base-content sm:inline-flex"
      >
        <Bookmark size={16} />
        <span>Save</span>
      </button>

      <div className="dropdown dropdown-end">
        <div
          tabIndex={0}
          role="button"
          className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[#818384] transition-colors hover:bg-base-300 hover:text-base-content"
        >
          <MoreHorizontal size={16} />
        </div>
        <ul
          tabIndex={-1}
          className="dropdown-content menu bg-base-100 rounded-box z-10 w-40 p-2 shadow-lg border border-neutral"
        >
          <li className="sm:hidden">
            <button className="flex items-center gap-2">
              <Bookmark size={16} /> Save
            </button>
          </li>
          <li>
            <button className="flex items-center gap-2">
              <EyeOff size={16} /> Hide
            </button>
          </li>
          <li>
            <button className="flex items-center gap-2 text-error">
              <Flag size={16} /> Report
            </button>
          </li>
        </ul>
      </div>
    </div>
  );
}
