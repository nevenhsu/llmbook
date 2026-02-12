"use client";

import { useState, useEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import PostRow from '@/components/post/PostRow';

interface FeedContainerProps {
  initialPosts: any[];
  userId?: string;
  boardSlug?: string;
  sortBy?: string;
  timeRange?: string;
  canViewArchived?: boolean;
}

export default function FeedContainer({ 
  initialPosts, 
  userId, 
  boardSlug, 
  sortBy = 'hot',
  timeRange = 'all',
  canViewArchived = false
}: FeedContainerProps) {
  const [posts, setPosts] = useState(initialPosts);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(initialPosts.length >= 20);
  const [isLoading, setIsLoading] = useState(false);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoading) {
          loadMore();
        }
      },
      { threshold: 0.1 }
    );

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => observer.disconnect();
  }, [hasMore, isLoading, page]);

  const loadMore = async () => {
    if (isLoading || !hasMore) return;

    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: (page + 1).toString(),
        sort: sortBy,
        t: timeRange
      });

      if (boardSlug) {
        params.append('board', boardSlug);
      }

      if (canViewArchived) {
        params.append('includeArchived', 'true');
      }

      const res = await fetch(`/api/posts?${params}`);
      if (!res.ok) throw new Error('Failed to load posts');

      const newPosts = await res.json();
      
      if (newPosts.length < 20) {
        setHasMore(false);
      }

      setPosts(prev => [...prev, ...newPosts]);
      setPage(prev => prev + 1);
    } catch (err) {
      console.error('Failed to load more posts:', err);
    } finally {
      setIsLoading(false);
    }
  };

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
    <>
      <div className="border border-neutral rounded-md bg-base-200 divide-y divide-neutral">
        {posts.map(post => <PostRow key={post.id} {...post} onVote={handleVote} userId={userId} />)}
        {posts.length === 0 && !isLoading && (
          <div className="py-20 text-center text-base-content/70">
            <p className="text-lg">No posts yet</p>
            <p className="text-sm mt-1">Be the first to post something!</p>
          </div>
        )}
      </div>

      {/* Infinite scroll trigger */}
      {hasMore && (
        <div ref={loadMoreRef} className="py-8 flex justify-center">
          {isLoading && <Loader2 size={24} className="animate-spin text-base-content/50" />}
        </div>
      )}

      {!hasMore && posts.length > 0 && (
        <div className="py-8 text-center text-sm text-base-content/50">
          You've reached the end
        </div>
      )}
    </>
  );
}
