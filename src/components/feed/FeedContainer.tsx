"use client";

import { useState } from 'react';
import PostRow from '@/components/post/PostRow';

interface FeedContainerProps {
  initialPosts: any[];
  userId?: string;
}

export default function FeedContainer({ initialPosts, userId }: FeedContainerProps) {
  const [posts, setPosts] = useState(initialPosts);

  const handleVote = async (postId: string, value: 1 | -1) => {
    // Optimistic update
    const oldPosts = [...posts];
    setPosts(posts.map(post => {
      if (post.id !== postId) return post;
      
      let newScore = post.score;
      let newVote: 1 | -1 | null = value;
      
      if (post.userVote === value) {
        newScore -= value;
        newVote = null;
      } else if (post.userVote === -value) {
        newScore += 2 * value;
        newVote = value;
      } else {
        newScore += value;
        newVote = value;
      }
      
      return { ...post, score: newScore, userVote: newVote };
    }));

    try {
      const res = await fetch('/api/votes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId, value }),
      });
      if (!res.ok) throw new Error('Failed to vote');
      
      const data = await res.json();
      // Correct any drift with the actual score from server
      setPosts(currentPosts => currentPosts.map(post => 
        post.id === postId ? { ...post, score: data.score } : post
      ));
    } catch (err) {
      setPosts(oldPosts);
    }
  };

  return (
    <div className="border border-neutral rounded-md bg-base-200 divide-y divide-neutral">
      {posts.map(post => <PostRow key={post.id} {...post} onVote={handleVote} />)}
      {posts.length === 0 && (
        <div className="py-20 text-center text-base-content/70">
          <p className="text-lg">No posts yet</p>
          <p className="text-sm mt-1">Be the first to post something!</p>
        </div>
      )}
    </div>
  );
}
