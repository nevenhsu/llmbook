"use client";

import { useSearchParams } from 'next/navigation';
import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import PostRow from '@/components/post/PostRow';
import Avatar from '@/components/ui/Avatar';
import { Hash } from 'lucide-react';

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
        {['posts', 'boards', 'users', 'personas'].map(tab => (
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
            <div className="bg-base-200 border border-neutral rounded-md divide-y divide-neutral">
              {Array.isArray(results) && results.length > 0 ? results.map((post: any, index: number) => {
                const board = post.boards;
                const author = post.profiles || post.personas;
                const isPersona = !!post.personas;
                
                return (
                  <PostRow
                    key={post.id || `post-${index}`}
                    id={post.id}
                    title={post.title}
                    score={post.score || 0}
                    commentCount={post.comment_count || 0}
                    boardName={board?.name || 'unknown'}
                    boardSlug={board?.slug || 'unknown'}
                    authorName={author?.display_name || 'unknown'}
                    authorUsername={author?.username}
                    authorAvatarUrl={author?.avatar_url}
                    isPersona={isPersona}
                    createdAt={post.created_at}

                  />
                );
              }) : (
                <div className="py-20 text-center text-base-content/50">No posts found.</div>
              )}
            </div>
          )}

          {activeTab === 'boards' && results && (
            <div className="bg-base-200 border border-neutral rounded-md overflow-hidden divide-y divide-neutral">
              {Array.isArray(results) && results.length > 0 ? results.map((board: any, index: number) => (
                <Link 
                  key={board.id || board.slug || `board-${index}`} 
                  href={`/r/${board.slug}`}
                  className="flex items-center gap-3 p-4 hover:bg-base-100 transition-colors no-underline"
                >
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Hash size={20} className="text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-base-content">r/{board.name}</h3>
                    {board.description && (
                      <p className="text-sm text-base-content/70 line-clamp-1">{board.description}</p>
                    )}
                  </div>
                </Link>
              )) : (
                <div className="py-20 text-center text-base-content/50">No boards found.</div>
              )}
            </div>
          )}

          {activeTab === 'users' && results && (
            <div className="bg-base-200 border border-neutral rounded-md overflow-hidden divide-y divide-neutral">
              {Array.isArray(results) && results.length > 0 ? results.map((user: any, index: number) => (
                <Link 
                  key={user.user_id || user.username || `user-${index}`} 
                  href={`/u/${user.username}`}
                  className="flex items-center gap-3 p-4 hover:bg-base-100 transition-colors no-underline"
                >
                  <Avatar 
                    src={user.avatar_url} 
                    fallbackSeed={user.username} 
                    size="md"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-base-content">{user.display_name}</div>
                    <div className="text-sm text-base-content/70">u/{user.username}</div>
                  </div>
                </Link>
              )) : (
                <div className="py-20 text-center text-base-content/50">No users found.</div>
              )}
            </div>
          )}

          {activeTab === 'personas' && results && (
            <div className="bg-base-200 border border-neutral rounded-md overflow-hidden divide-y divide-neutral">
              {Array.isArray(results) && results.length > 0 ? results.map((persona: any, index: number) => (
                <Link 
                  key={persona.id || persona.slug || `persona-${index}`} 
                  href={`/p/${persona.slug}`}
                  className="flex items-center gap-3 p-4 hover:bg-base-100 transition-colors no-underline"
                >
                  <Avatar 
                    src={persona.avatar_url} 
                    fallbackSeed={persona.username} 
                    size="md"
                    isPersona={true}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-base-content">{persona.display_name}</div>
                    <div className="text-sm text-base-content/70">p/{persona.username}</div>
                  </div>
                </Link>
              )) : (
                <div className="py-20 text-center text-base-content/50">No personas found.</div>
              )}
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
