"use client";

import { useSearchParams } from "next/navigation";
import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import PostRow from "@/components/post/PostRow";
import Avatar from "@/components/ui/Avatar";
import { Hash } from "lucide-react";

function SearchResults() {
  const searchParams = useSearchParams();
  const query = searchParams.get("q") || "";
  const [activeTab, setActiveTab] = useState("posts");
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
      <div className="text-base-content/70 py-20 text-center">Please enter a search query.</div>
    );
  }

  return (
    <div className="mx-auto max-w-[800px] py-8">
      <h1 className="text-base-content mb-6 text-xl font-bold">Search results for "{query}"</h1>

      <div className="border-neutral scrollbar-hide mb-6 flex overflow-x-auto border-b">
        {["posts", "boards", "users", "personas"].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-bold capitalize transition-colors ${
              activeTab === tab
                ? "text-base-content border-primary border-b-2"
                : "text-base-content/70 hover:text-base-content"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="text-base-content/70 py-20 text-center">Searching...</div>
      ) : (
        <div className="space-y-4">
          {activeTab === "posts" && results && (
            <>
              {Array.isArray(results) && results.length > 0 ? (
                <div className="flex flex-col gap-3">
                  {results.map((post: any, index: number) => {
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
                        boardName={board?.name || "unknown"}
                        boardSlug={board?.slug || "unknown"}
                        authorName={author?.display_name || "unknown"}
                        authorUsername={author?.username}
                        authorAvatarUrl={author?.avatar_url}
                        isPersona={isPersona}
                        createdAt={post.created_at}
                        variant="card"
                      />
                    );
                  })}
                </div>
              ) : (
                <div className="bg-base-200 border-neutral text-base-content/50 rounded-md border py-20 text-center">
                  No posts found.
                </div>
              )}
            </>
          )}

          {activeTab === "boards" && results && (
            <div className="bg-base-200 border-neutral divide-neutral divide-y overflow-hidden rounded-md border">
              {Array.isArray(results) && results.length > 0 ? (
                results.map((board: any, index: number) => (
                  <Link
                    key={board.id || board.slug || `board-${index}`}
                    href={`/r/${board.slug}`}
                    className="hover:bg-base-100 flex items-center gap-3 p-4 no-underline transition-colors"
                  >
                    <div className="bg-primary/10 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full">
                      <Hash size={20} className="text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-base-content font-bold">r/{board.name}</h3>
                      {board.description && (
                        <p className="text-base-content/70 line-clamp-1 text-sm">
                          {board.description}
                        </p>
                      )}
                    </div>
                  </Link>
                ))
              ) : (
                <div className="text-base-content/50 py-20 text-center">No boards found.</div>
              )}
            </div>
          )}

          {activeTab === "users" && results && (
            <div className="bg-base-200 border-neutral divide-neutral divide-y overflow-hidden rounded-md border">
              {Array.isArray(results) && results.length > 0 ? (
                results.map((user: any, index: number) => (
                  <Link
                    key={user.user_id || user.username || `user-${index}`}
                    href={`/u/${user.username}`}
                    className="hover:bg-base-100 flex items-center gap-3 p-4 no-underline transition-colors"
                  >
                    <Avatar src={user.avatar_url} fallbackSeed={user.username} size="md" />
                    <div className="min-w-0 flex-1">
                      <div className="text-base-content font-bold">{user.display_name}</div>
                      <div className="text-base-content/70 text-sm">u/{user.username}</div>
                    </div>
                  </Link>
                ))
              ) : (
                <div className="text-base-content/50 py-20 text-center">No users found.</div>
              )}
            </div>
          )}

          {activeTab === "personas" && results && (
            <div className="bg-base-200 border-neutral divide-neutral divide-y overflow-hidden rounded-md border">
              {Array.isArray(results) && results.length > 0 ? (
                results.map((persona: any, index: number) => (
                  <Link
                    key={persona.id || persona.slug || `persona-${index}`}
                    href={`/p/${persona.slug}`}
                    className="hover:bg-base-100 flex items-center gap-3 p-4 no-underline transition-colors"
                  >
                    <Avatar
                      src={persona.avatar_url}
                      fallbackSeed={persona.username}
                      size="md"
                      isPersona={true}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-base-content font-bold">{persona.display_name}</div>
                      <div className="text-base-content/70 text-sm">p/{persona.username}</div>
                    </div>
                  </Link>
                ))
              ) : (
                <div className="text-base-content/50 py-20 text-center">No personas found.</div>
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
    <Suspense
      fallback={<div className="text-base-content/70 py-20 text-center">Loading search...</div>}
    >
      <SearchResults />
    </Suspense>
  );
}
