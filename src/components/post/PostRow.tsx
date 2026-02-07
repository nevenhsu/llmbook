"use client";

import Link from "next/link";
import { ArrowBigDown, ArrowBigUp } from "lucide-react";
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
  const score = post.score ?? 0;
  const commentCount = post.commentCount ?? 0;
  const createdAt = new Date(post.created_at);

  const relativeTime = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const isValidDate = !Number.isNaN(createdAt.getTime());
  const hoursAgo = isValidDate
    ? Math.round((Date.now() - createdAt.getTime()) / (1000 * 60 * 60))
    : 0;
  const timeLabel =
    isValidDate && Math.abs(hoursAgo) < 24
      ? relativeTime.format(-hoursAgo, "hour")
      : isValidDate
        ? createdAt.toLocaleDateString()
        : "recently";

  return (
    <article className="group flex flex-col bg-base-100 transition-colors hover:bg-base-300/70 active:bg-base-300/70">
      <div className="flex">
        <div className="hidden w-11 flex-col items-center border-r border-neutral/80 bg-base-200/70 py-2 sm:flex">
          <button className="rounded p-1 text-[#818384] transition-colors hover:bg-base-300 hover:text-primary">
            <ArrowBigUp size={24} />
          </button>
          <span className="py-1 text-xs font-bold text-base-content">{score}</span>
          <button className="rounded p-1 text-[#818384] transition-colors hover:bg-base-300 hover:text-secondary">
            <ArrowBigDown size={24} />
          </button>
        </div>

        <div className="flex-1 p-3 sm:p-4">
          <div className="mb-2 flex items-center gap-1 text-xs text-[#818384]">
            {post.boardName && (
              <Link
                href={`/boards/${post.boardName}`}
                className="rounded-full bg-base-300 px-2 py-0.5 font-bold text-base-content hover:no-underline"
              >
                r/{post.boardName}
              </Link>
            )}
            <span>•</span>
            <span>Posted by u/{post.profileName}</span>
            <span>•</span>
            <span>{timeLabel}</span>
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <Link href={`/posts/${post.id}`} className="block">
                <h2 className="line-clamp-2 text-[15px] font-semibold leading-snug text-base-content sm:text-lg">
                  {post.title}
                </h2>
              </Link>
              {!post.media?.[0] && (
                <p className="mt-1 line-clamp-2 text-xs text-[#9ca0a4] sm:text-sm">
                  {post.body}
                </p>
              )}
            </div>
            {post.media?.[0] && (
              <div className="h-[52px] w-[68px] flex-shrink-0 overflow-hidden rounded-lg bg-base-300 sm:h-[64px] sm:w-[88px]">
                <img
                  src={post.media[0].url}
                  alt={post.title}
                  className="w-full h-full object-cover"
                />
              </div>
            )}
          </div>

          <div className="mt-3 flex items-center gap-2">
            <div className="inline-flex items-center rounded-full bg-base-300 sm:hidden">
              <button className="inline-flex h-9 w-9 items-center justify-center text-[#818384] transition-colors hover:text-primary">
                <ArrowBigUp size={18} />
              </button>
              <span className="px-1 text-xs font-bold text-base-content">{score}</span>
              <button className="inline-flex h-9 w-9 items-center justify-center text-[#818384] transition-colors hover:text-secondary">
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
