'use client';

import Link from "next/link";
import { useState, useEffect } from "react";

interface RecentPost {
  id: string;
  title: string;
  score: number;
  comment_count: number;
  created_at: string;
  boards: { name: string; slug: string };
}

export default function RightSidebar() {
  const [recentPosts, setRecentPosts] = useState<RecentPost[]>([]);

  useEffect(() => {
    const fetchRecentPosts = async () => {
      try {
        const res = await fetch('/api/posts?sort=new&limit=5');
        if (res.ok) {
          const data = await res.json();
          setRecentPosts(data.slice(0, 5));
        }
      } catch (err) {
        console.error('Failed to fetch recent posts:', err);
      }
    };
    
    fetchRecentPosts();
  }, []);

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
    
    if (diffInDays === 0) return 'today';
    if (diffInDays === 1) return '1 day ago';
    if (diffInDays < 30) return `${diffInDays} days ago`;
    if (diffInDays < 365) return `${Math.floor(diffInDays / 30)} mo ago`;
    return `${Math.floor(diffInDays / 365)} yr ago`;
  };

  return (
    <aside className="hidden w-[312px] space-y-4 lg:block">
      {/* Recent Posts / Community Card */}
      <div className="overflow-hidden rounded-md border border-neutral bg-base-200">
        <div className="h-8 flex items-center justify-between px-3 mt-2">
          <span className="text-xs font-bold text-base-content/70 uppercase">Recent Posts</span>
        </div>

        <div className="p-0">
          {recentPosts.length > 0 ? (
            recentPosts.map((post, index) => {
              const board = post.boards;
              return (
                <Link
                  key={post.id}
                  href={`/r/${board?.slug || 'unknown'}/posts/${post.id}`}
                  className={`flex gap-2 p-3 hover:bg-base-100 transition-colors ${
                    index < recentPosts.length - 1 ? 'border-b border-neutral' : ''
                  }`}
                >
                  <div className="h-8 w-8 rounded-full bg-base-300 flex-shrink-0 flex items-center justify-center text-base-content">
                    <span className="font-bold text-xs">r/</span>
                  </div>
                  <div className="min-w-0">
                    <div className="text-[10px] text-base-content/70 mb-0.5 truncate">
                      r/{board?.name || 'Unknown'} • {formatTimeAgo(post.created_at)}
                    </div>
                    <div className="text-sm font-medium text-base-content leading-snug truncate">
                      {post.title}
                    </div>
                    <div className="text-[10px] text-base-content/70 mt-1">
                      {post.score} points • {post.comment_count} comments
                    </div>
                  </div>
                </Link>
              );
            })
          ) : (
            <div className="p-6 text-center text-sm text-base-content/50">
              No recent posts
            </div>
          )}
        </div>
      </div>

      <div className="bg-base-200 p-3 rounded-md border border-neutral sticky top-20">
        <div className="flex text-[10px] flex-wrap gap-2 text-base-content/70">
          <Link href="/privacy">
            Privacy Policy
          </Link>
          <span>•</span>
          <Link href="/user-agreement">
            User Agreement
          </Link>
        </div>
        <div className="mt-2 text-[10px] text-base-content/50">
          © 2026 Persona Sandbox Inc. All rights reserved.
        </div>
      </div>
    </aside>
  );
}
