"use client";

import { useState } from "react";
import PostRow from "@/components/post/PostRow";

interface TagFeedProps {
  initialPosts: any[];
  userVotes: Record<string, 1 | -1>;
  userId?: string;
}

export default function TagFeed({ initialPosts, userVotes, userId }: TagFeedProps) {
  const [posts, setPosts] = useState(initialPosts);
  const [votes, setVotes] = useState(userVotes);

  const handleVote = async (postId: string, value: 1 | -1) => {
    // Optimistic update
    const prevVote = votes[postId];
    const newVote = prevVote === value ? null : value;
    
    setVotes(prev => ({
      ...prev,
      [postId]: newVote as 1 | -1,
    }));

    // Update post score optimistically
    setPosts(prev => prev.map(p => {
      if (p.id !== postId) return p;
      let scoreDelta = 0;
      if (prevVote === 1 && newVote === null) scoreDelta = -1;
      if (prevVote === -1 && newVote === null) scoreDelta = 1;
      if (prevVote === null && newVote === 1) scoreDelta = 1;
      if (prevVote === null && newVote === -1) scoreDelta = -1;
      if (prevVote === 1 && newVote === -1) scoreDelta = -2;
      if (prevVote === -1 && newVote === 1) scoreDelta = 2;
      
      return { ...p, score: p.score + scoreDelta };
    }));

    // Call API
    try {
      const res = await fetch('/api/votes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          postId,
          value: newVote,
        }),
      });

      if (!res.ok) {
        // Revert on error
        setVotes(prev => ({
          ...prev,
          [postId]: prevVote,
        }));
        setPosts(prev => prev.map(p => {
          if (p.id !== postId) return p;
          let scoreDelta = 0;
          if (prevVote === 1 && newVote === null) scoreDelta = 1;
          if (prevVote === -1 && newVote === null) scoreDelta = -1;
          if (prevVote === null && newVote === 1) scoreDelta = -1;
          if (prevVote === null && newVote === -1) scoreDelta = 1;
          if (prevVote === 1 && newVote === -1) scoreDelta = 2;
          if (prevVote === -1 && newVote === 1) scoreDelta = -2;
          
          return { ...p, score: p.score + scoreDelta };
        }));
      }
    } catch (err) {
      console.error('Failed to vote:', err);
      // Revert on error
      setVotes(prev => ({
        ...prev,
        [postId]: prevVote,
      }));
    }
  };

  if (!posts || posts.length === 0) {
    return (
      <div className="bg-base-100 p-6 rounded-box border border-neutral text-center">
        <p className="text-base-content/70">目前沒有貼文使用這個標籤。</p>
      </div>
    );
  }

  return (
    <div className="border border-neutral rounded-box bg-base-100 divide-y divide-neutral overflow-hidden">
      {posts.map((post) => {
        const board = post.boards as any;
        const author = post.profiles || post.personas;
        const isPersona = !!post.personas;
        const commentCount = Array.isArray(post.comments) ? post.comments.length : 0;

        return (
          <PostRow
            key={post.id}
            id={post.id}
            title={post.title}
            score={post.score}
            commentCount={commentCount}
            boardName={board?.name || 'Unknown'}
            boardSlug={board?.slug || 'unknown'}
            authorName={author?.display_name || 'Unknown'}
            authorUsername={author?.username || author?.slug}
            authorAvatarUrl={author?.avatar_url}
            isPersona={isPersona}
            createdAt={post.created_at}
            thumbnailUrl={post.media?.[0]?.url}
            userVote={votes[post.id] || null}
            authorId={author?.user_id}
            userId={userId}
            onVote={handleVote}
          />
        );
      })}
    </div>
  );
}
