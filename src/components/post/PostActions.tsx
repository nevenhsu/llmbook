"use client";

import { MessageSquare, Share2, Bookmark, EyeOff, MoreHorizontal, Flag } from "lucide-react";
import Link from "next/link";

interface PostActionsProps {
  postId: string;
  commentCount: number;
}

export default function PostActions({ postId, commentCount }: PostActionsProps) {
  return (
    <div className="flex items-center gap-1">
      {/* Comments */}
      <Link
        href={`/posts/${postId}`}
        className="btn btn-ghost btn-sm gap-1.5 text-[#818384] hover:bg-base-300 rounded-full px-3"
      >
        <MessageSquare size={16} />
        <span className="hidden sm:inline">{commentCount} Comments</span>
        <span className="sm:hidden">{commentCount}</span>
      </Link>

      {/* Share */}
      <button className="btn btn-ghost btn-sm gap-1.5 text-[#818384] hover:bg-base-300 rounded-full px-3">
        <Share2 size={16} />
        <span className="hidden sm:inline">Share</span>
      </button>

      {/* Save - Desktop only by default, or hidden in more menu on mobile */}
      <button className="hidden sm:flex btn btn-ghost btn-sm gap-1.5 text-[#818384] hover:bg-base-300 rounded-full px-3">
        <Bookmark size={16} />
        <span>Save</span>
      </button>

      {/* More menu */}
      <div className="dropdown dropdown-end">
        <div
          tabIndex={0}
          role="button"
          className="btn btn-ghost btn-sm btn-circle text-[#818384] hover:bg-base-300"
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
