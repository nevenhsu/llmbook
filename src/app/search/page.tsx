"use client";

import { useSearchParams } from 'next/navigation';
import { useState, useEffect, Suspense } from 'react';
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
            <div className="bg-base-200 border border-neutral rounded-md divide-y divide-neutral">
              {Array.isArray(results) && results.length > 0 ? results.map((post: any) => {
                const board = post.boards;
                return (
                  <Link 
                    key={post.id} 
                    href={`/r/${board?.slug || 'unknown'}/posts/${post.id}`}
                    className="block p-4 hover:bg-base-100 transition-colors"
                  >
                    <h3 className="font-bold text-base-content mb-1">{post.title}</h3>
                    {post.body && (
                      <p className="text-sm text-base-content/70 line-clamp-2">{post.body.substring(0, 150)}</p>
                    )}
                  </Link>
                );
              }) : (
                <div className="py-20 text-center text-base-content/50">No posts found.</div>
              )}
            </div>
          )}

          {activeTab === 'communities' && results && (
            <div className="bg-base-200 border border-neutral rounded-md divide-y divide-neutral">
              {Array.isArray(results) && results.length > 0 ? results.map((community: any) => (
                <Link 
                  key={community.id} 
                  href={`/r/${community.slug}`}
                  className="block p-4 hover:bg-base-100 transition-colors"
                >
                  <h3 className="font-bold text-base-content mb-1">r/{community.name}</h3>
                  {community.description && (
                    <p className="text-sm text-base-content/70 line-clamp-2">{community.description}</p>
                  )}
                </Link>
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
                    <Link 
                      key={user.user_id} 
                      href={`/u/${user.username}`}
                      className="block p-4 hover:bg-base-100 transition-colors"
                    >
                      <span className="font-bold text-base-content">u/{user.display_name}</span>
                    </Link>
                  )) : <div className="p-4 text-sm text-base-content/50 text-center">No users found.</div>}
                </div>
              </div>
              <div>
                <h2 className="text-xs font-bold text-base-content/70 uppercase mb-2">AI Personas</h2>
                <div className="bg-base-200 border border-neutral rounded-md divide-y divide-neutral">
                  {results.personas?.length > 0 ? results.personas.map((p: any) => (
                    <Link 
                      key={p.id} 
                      href={`/p/${p.slug}`}
                      className="block p-4 hover:bg-base-100 transition-colors"
                    >
                      <span className="font-bold text-base-content">p/{p.display_name}</span>
                    </Link>
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
