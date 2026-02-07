"use client";

import Link from "next/link";
import { ArrowBigUp, ArrowBigDown, MoreHorizontal } from "lucide-react";
import PostActions from "./PostActions";

interface PostRowProps {
  post: {
    id: string;
    title: string;
    body: string;
    created_at: string;
    boardName?: string;
    profileName: string;
    media?: { url: string }[];
    score?: number;
    commentCount?: number;
  };
}

export default function PostRow({ post }: PostRowProps) {
  const score = post.score ?? 1066; // Placeholder if not provided
  const commentCount = post.commentCount ?? 136;

  return (
    <article className="group flex flex-col border-b border-neutral bg-base-100 sm:bg-transparent hover:bg-base-300 active:bg-base-300 transition-colors cursor-pointer">
      <div className="flex">
        {/* Left: Vote Bar (Desktop only) */}
        <div className="hidden sm:flex flex-col items-center w-10 bg-base-100/50 py-2">
          <button className="text-[#818384] hover:text-primary hover:bg-base-300 rounded p-1">
            <ArrowBigUp size={24} />
          </button>
          <span className="text-xs font-bold text-base-content py-1">{score}</span>
          <button className="text-[#818384] hover:text-secondary hover:bg-base-300 rounded p-1">
            <ArrowBigDown size={24} />
          </button>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 p-2 sm:p-3">
          {/* Post Meta */}
          <div className="flex items-center gap-1 text-xs text-[#818384] mb-1">
            {post.boardName && (
              <Link
                href={`/boards/${post.boardName}`}
                className="font-bold text-base-content hover:underline"
              >
                r/{post.boardName}
              </Link>
            )}
            <span>•</span>
            <span>Posted by u/{post.profileName}</span>
            <span>•</span>
            <span>{new Date(post.created_at).toLocaleDateString()}</span>
          </div>

          {/* Title and Thumbnail */}
          <div className="flex gap-3">
            <div className="flex-1">
              <Link href={`/posts/${post.id}`}>
                <h2 className="text-sm sm:text-base font-medium text-base-content line-clamp-2 sm:line-clamp-1">
                  {post.title}
                </h2>
              </Link>
            </div>
            {post.media?.[0] && (
              <div className="flex-shrink-0 w-[48px] h-[36px] sm:w-[56px] sm:h-[42px] rounded-md overflow-hidden bg-base-300">
                <img
                  src={post.media[0].url}
                  alt={post.title}
                  className="w-full h-full object-cover"
                />
              </div>
            )}
          </div>

          {/* Body Preview (Desktop only or optional) */}
          {!post.media?.[0] && (
            <p className="mt-1 text-xs text-[#818384] line-clamp-3 hidden sm:block">
              {post.body}
            </p>
          )}

          {/* Mobile Vote Pill + Actions */}
          <div className="mt-2 flex items-center gap-2">
            {/* Mobile Vote Pill */}
            <div className="sm:hidden join join-horizontal bg-base-300 rounded-full">
              <button className="join-item btn btn-ghost btn-xs px-2">
                <ArrowBigUp size={18} />
              </button>
              <span className="join-item flex items-center px-1 text-xs font-bold">
                {score}
              </span>
              <button className="join-item btn btn-ghost btn-xs px-2">
                <ArrowBigDown size={18} />
              </button>
            </div>

            <PostActions postId={post.id} commentCount={commentCount} />
          </div>
        </div>
      </div>
    </article>
  );
}
