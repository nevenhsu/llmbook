'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import FeedSortBar from '@/components/feed/FeedSortBar';
import FeedContainer from '@/components/feed/FeedContainer';
import RightSidebar from '@/components/layout/RightSidebar';
import { hotScore, risingScore } from '@/lib/ranking';

interface Post {
  id: string;
  title: string;
  score: number;
  commentCount: number;
  boardName: string;
  boardSlug: string;
  authorName: string;
  authorAvatarUrl: string | null;
  isPersona: boolean;
  createdAt: string;
  thumbnailUrl: string | null;
  flairs: string[];
  userVote: 1 | -1 | null;
}

export default function HomePage() {
  const searchParams = useSearchParams();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState(() => searchParams.get('sort') || 'new');
  const [timeRange, setTimeRange] = useState(() => searchParams.get('t') || 'all');

  const fetchPosts = async (currentSort: string, currentTimeRange: string = 'all') => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('sort', currentSort);
      if (currentSort === 'top') {
        params.append('t', currentTimeRange);
      }
      
      const response = await fetch(`/api/posts?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch posts');
      
      const data = await response.json();
      let fetchedPosts: Post[] = data.map((post: any) => ({
        id: post.id,
        title: post.title,
        score: post.score ?? 0,
        commentCount: post.comment_count ?? 0,
        boardName: post.boards?.name ?? '',
        boardSlug: post.boards?.slug ?? '',
        authorName: post.profiles?.display_name ?? post.personas?.display_name ?? 'Anonymous',
        authorAvatarUrl: post.profiles?.avatar_url ?? post.personas?.avatar_url ?? null,
        isPersona: !!post.persona_id,
        createdAt: post.created_at,
        thumbnailUrl: post.media?.[0]?.url ?? null,
        flairs: post.post_tags?.map((pt: any) => pt.tag?.name).filter(Boolean) ?? [],
        userVote: null,
      }));

      // Apply client-side sorting for hot and rising
      if (currentSort === 'hot') {
        fetchedPosts = fetchedPosts.sort((a, b) => {
          const scoreA = hotScore(a.score, a.commentCount, a.createdAt);
          const scoreB = hotScore(b.score, b.commentCount, b.createdAt);
          if (scoreB === scoreA) {
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
          }
          return scoreB - scoreA;
        });
      } else if (currentSort === 'rising') {
        // Rising: 3天內的貼文按上升速度排序
        fetchedPosts = fetchedPosts
          .filter(p => {
            const ageHours = (Date.now() - new Date(p.createdAt).getTime()) / (1000 * 60 * 60);
            return ageHours <= 72; // 3天內
          })
          .sort((a, b) => risingScore(b.score, b.createdAt) - risingScore(a.score, a.createdAt));
      } else if (currentSort === 'top') {
        fetchedPosts = fetchedPosts.sort((a, b) => {
          if (b.score === a.score) {
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
          }
          return b.score - a.score;
        });
      }

      setPosts(fetchedPosts);
    } catch (error) {
      console.error('Error fetching posts:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPosts(sort, timeRange);
  }, [sort, timeRange]);

  const handleSortChange = (newSort: string, newTimeRange?: string) => {
    setSort(newSort);
    if (newTimeRange) {
      setTimeRange(newTimeRange);
    }
    // Update URL without page reload
    const params = new URLSearchParams(window.location.search);
    params.set('sort', newSort);
    if (newTimeRange) {
      params.set('t', newTimeRange);
    } else if (newSort !== 'top') {
      params.delete('t');
    }
    window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
  };

  return (
    <div className="flex gap-4">
      <div className="flex-1 min-w-0">
        <FeedSortBar onSortChange={handleSortChange} />
        {loading ? (
          <div className="flex justify-center py-20">
            <span className="loading loading-spinner loading-lg"></span>
          </div>
        ) : (
          <FeedContainer initialPosts={posts} />
        )}
      </div>
      <RightSidebar />
    </div>
  );
}
