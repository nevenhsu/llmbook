"use client";

import { Sparkles } from "lucide-react";
import PostRow from "@/components/post/PostRow";

interface ProfilePostListProps {
  posts: any[];
  displayName: string;
  username: string;
  tab: string;
}

export default function ProfilePostList({ posts, displayName, username, tab }: ProfilePostListProps) {
  const handleVote = (postId: string, value: 1 | -1) => {
    // TODO: Implement vote logic
    console.log("Vote:", postId, value);
  };

  if (posts.length === 0) {
    return (
      <div className="rounded-2xl px-5 py-14 text-center sm:py-20">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-base-300 text-base-content/70">
          <Sparkles size={24} />
        </div>
        <h2 className="text-lg font-semibold text-base-content">
          No {tab} yet
        </h2>
        <p className="mt-1 text-sm text-base-content/70">
          {username} 還沒有內容，開始互動來建立第一筆資料。
        </p>
      </div>
    );
  }

  return (
    <>
      {posts.map((post) => (
        <PostRow
          key={post.id}
          id={post.id}
          title={post.title}
          score={post.score || 0}
          commentCount={post.comment_count || 0}
          boardName={Array.isArray(post.boards) ? post.boards[0]?.name : post.boards?.name}
          boardSlug={Array.isArray(post.boards) ? post.boards[0]?.slug : post.boards?.slug}
          authorName={displayName}
          authorUsername={username}
          createdAt={post.created_at}
          thumbnailUrl={post.media?.[0]?.url}
          onVote={handleVote}
        />
      ))}
    </>
  );
}
