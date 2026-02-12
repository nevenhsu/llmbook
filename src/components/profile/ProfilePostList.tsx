"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import PostRow from "@/components/post/PostRow";
import Link from "next/link";

interface ProfilePostListProps {
  posts: any[];
  comments?: any[];
  displayName: string;
  username: string;
  tab: string;
}

export default function ProfilePostList({ posts: initialPosts, comments: initialComments, displayName, username, tab }: ProfilePostListProps) {
  const [posts, setPosts] = useState(initialPosts);

  const handleVote = async (postId: string, value: 1 | -1) => {
    try {
      const res = await fetch('/api/votes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ post_id: postId, value })
      });

      if (!res.ok) throw new Error('Vote failed');

      const { score } = await res.json();
      
      // Optimistic update
      setPosts(prev => prev.map(post => 
        post.id === postId 
          ? { ...post, score, userVote: value }
          : post
      ));
    } catch (err) {
      console.error('Failed to vote:', err);
    }
  };

  // Check if showing comments tab
  const showingComments = tab === 'comments';
  const items = showingComments ? (initialComments ?? []) : posts;

  if (items.length === 0) {
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

  // Render comments
  if (showingComments) {
    return (
      <>
        {items.map((comment: any) => {
          const post = Array.isArray(comment.posts) ? comment.posts[0] : comment.posts;
          const board = post?.boards;
          
          return (
            <div key={comment.id} className="p-4 hover:bg-base-100/50 transition-colors">
              <div className="text-xs text-base-content/70 mb-2">
                評論於{' '}
                <Link 
                  href={`/r/${board?.slug || 'unknown'}/posts/${post?.id}`}
                  className="font-semibold text-base-content hover:underline"
                >
                  {post?.title}
                </Link>
                {board?.slug && (
                  <>
                    {' '}在{' '}
                    <Link 
                      href={`/r/${board.slug}`}
                      className="text-accent hover:underline"
                    >
                      r/{board.slug}
                    </Link>
                  </>
                )}
              </div>
              <p className="text-sm text-base-content">{comment.body}</p>
              <div className="flex items-center gap-3 mt-2 text-xs text-base-content/60">
                <span>{comment.score ?? 0} points</span>
                <span>•</span>
                <span>{new Date(comment.created_at).toLocaleDateString()}</span>
              </div>
            </div>
          );
        })}
      </>
    );
  }

  // Render posts
  return (
    <>
      {posts.map((post) => (
        <PostRow
          key={post.id}
          id={post.id}
          title={post.title}
          score={post.score || 0}
          commentCount={post.comment_count || 0}
          boardName={post.boards?.name || ''}
          boardSlug={post.boards?.slug || ''}
          authorName={displayName}
          authorUsername={username}
          createdAt={post.created_at}
          thumbnailUrl={post.media?.[0]?.url}
          userVote={post.userVote}
          onVote={handleVote}
        />
      ))}
    </>
  );
}
