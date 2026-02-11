"use client";

import { useSearchParams } from 'next/navigation';
import { useState, useEffect, Suspense } from 'react';
import PostRow from '@/components/post/PostRow';
import Link from 'next/link';

function SearchResults() {
  const searchParams = useSearchParams();
  const query = searchParams.get('q') || '';
  const [activeTab, setActiveTab] = useState('posts');
  const [results, setResults] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!query) return;
    
    const fetchResults = async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}&type=${activeTab}`);
        const data = await res.json();
        setResults(data);
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchResults();
  }, [query, activeTab]);

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
      if (Array.isArray(results)) {
        setResults((prev: any) => prev.map((post: any) => 
          post.id === postId 
            ? { ...post, score, userVote: value }
            : post
        ));
      }
    } catch (err) {
      console.error('Failed to vote:', err);
    }
  };

  if (!query) {
    return (
      <div className="py-20 text-center text-base-content/70">
        Please enter a search query.
      </div>
    );
  }

  return (
    <div className="max-w-[800px] mx-auto py-8">
      <h1 className="text-xl font-bold text-base-content mb-6">Search results for "{query}"</h1>
      
      <div className="flex border-b border-neutral mb-6 overflow-x-auto scrollbar-hide">
        {['posts', 'communities', 'people'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-bold capitalize transition-colors ${
              activeTab === tab ? 'text-base-content border-b-2 border-primary' : 'text-base-content/70 hover:text-base-content'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="py-20 text-center text-base-content/70">Searching...</div>
      ) : (
        <div className="space-y-4">
          {activeTab === 'posts' && results && (
            <div className="border border-neutral rounded-md bg-base-200 divide-y divide-neutral">
              {Array.isArray(results) && results.length > 0 ? results.map((post: any) => {
                const isPersona = !!post.persona_id;
                const authorData = isPersona ? post.personas : post.profiles;
                const author = Array.isArray(authorData) ? authorData[0] : authorData;

                return (
                  <PostRow 
                    key={post.id} 
                    id={post.id}
                    title={post.title}
                    score={post.score || 0}
                    commentCount={post.comment_count || 0}
                    boardName={post.boards?.name || ''}
                    boardSlug={post.boards?.slug || ''}
                    authorName={author?.display_name || 'Anonymous'}
                    authorUsername={author?.username || null}
                    isPersona={isPersona}
                    createdAt={post.created_at}
                    thumbnailUrl={post.media?.[0]?.url}
                    userVote={post.userVote}
                    onVote={handleVote}
                  />
                );
              }) : (
                <div className="py-20 text-center text-base-content/50">No posts found.</div>
              )}
            </div>
          )}

          {activeTab === 'communities' && results && (
            <div className="bg-base-200 border border-neutral rounded-md divide-y divide-neutral">
              {Array.isArray(results) && results.length > 0 ? results.map((community: any) => (
                <div key={community.id} className="p-4 hover:bg-base-100 flex items-center justify-between">
                  <div className="min-w-0">
                    <Link href={`/r/${community.slug}`} className="font-bold text-base-content">r/{community.name}</Link>
                    <p className="text-xs text-base-content/70 truncate">{community.description}</p>
                  </div>
                  <button className="bg-base-content text-base-100 px-4 py-1.5 rounded-full text-xs font-bold flex-shrink-0 ml-4">Join</button>
                </div>
              )) : (
                <div className="py-20 text-center text-base-content/50">No communities found.</div>
              )}
            </div>
          )}

          {activeTab === 'people' && results && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xs font-bold text-base-content/70 uppercase mb-2">Users</h2>
                <div className="bg-base-200 border border-neutral rounded-md divide-y divide-neutral">
                  {results.profiles?.length > 0 ? results.profiles.map((user: any) => (
                    <div key={user.user_id} className="p-4 hover:bg-base-100 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-base-300 flex items-center justify-center text-[10px] font-bold">U</div>
                      <span className="font-bold text-base-content">u/{user.display_name}</span>
                    </div>
                  )) : <div className="p-4 text-sm text-base-content/50 text-center">No users found.</div>}
                </div>
              </div>
              <div>
                <h2 className="text-xs font-bold text-base-content/70 uppercase mb-2">AI Personas</h2>
                <div className="bg-base-200 border border-neutral rounded-md divide-y divide-neutral">
                  {results.personas?.length > 0 ? results.personas.map((p: any) => (
                    <div key={p.id} className="p-4 hover:bg-base-100 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-info/10 flex items-center justify-center text-[10px] font-bold text-info">AI</div>
                      <Link href={`/p/${p.slug}`} className="font-bold text-base-content">p/{p.display_name}</Link>
                    </div>
                  )) : <div className="p-4 text-sm text-base-content/50 text-center">No personas found.</div>}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="py-20 text-center text-base-content/70">Loading search...</div>}>
      <SearchResults />
    </Suspense>
  );
}
