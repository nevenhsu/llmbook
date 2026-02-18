"use client";

import { useSearchParams } from "next/navigation";
import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import PostRow from "@/components/post/PostRow";
import Avatar from "@/components/ui/Avatar";
import SearchResultList from "@/components/search/SearchResultList";
import { Hash } from "lucide-react";

function SearchResults() {
  const searchParams = useSearchParams();
  const query = searchParams.get("q") || "";
  const [activeTab, setActiveTab] = useState("posts");

  type SearchPost = {
    id: string;
    title: string;
    created_at: string;
    score?: number | null;
    comment_count?: number | null;
    persona_id?: string | null;
    boards?: { name: string; slug: string } | { name: string; slug: string }[] | null;
    profiles?:
      | { username: string | null; display_name: string | null; avatar_url: string | null }
      | { username: string | null; display_name: string | null; avatar_url: string | null }[]
      | null;
    personas?:
      | { username: string | null; display_name: string | null; avatar_url: string | null }
      | { username: string | null; display_name: string | null; avatar_url: string | null }[]
      | null;
  };

  type SearchBoard = { id: string; name: string; slug: string; description?: string | null };
  type SearchUser = {
    user_id: string;
    username: string;
    display_name: string;
    avatar_url: string | null;
  };
  type SearchPersona = {
    id: string;
    username: string;
    display_name: string;
    avatar_url: string | null;
    slug: string;
  };

  const [results, setResults] = useState<
    SearchPost[] | SearchBoard[] | SearchUser[] | SearchPersona[] | null
  >(null);
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

      <div
        className="border-neutral scrollbar-hide mb-6 flex overflow-x-auto border-b"
        role="tablist"
        aria-label="Search result tabs"
      >
        {["posts", "boards", "users", "personas"].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            role="tab"
            aria-selected={activeTab === tab}
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
                  {(results as SearchPost[]).map((post, index) => {
                    const board = Array.isArray(post.boards) ? post.boards[0] : post.boards;
                    const author = post.personas ?? post.profiles;
                    const authorData = Array.isArray(author) ? author[0] : author;
                    const isPersona = !!post.persona_id;

                    return (
                      <PostRow
                        key={post.id || `post-${index}`}
                        id={post.id}
                        title={post.title}
                        score={post.score || 0}
                        commentCount={post.comment_count || 0}
                        boardName={board?.name || "unknown"}
                        boardSlug={board?.slug || "unknown"}
                        authorName={authorData?.display_name || "unknown"}
                        authorUsername={authorData?.username}
                        authorAvatarUrl={authorData?.avatar_url}
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
            <SearchResultList
              items={Array.isArray(results) ? (results as SearchBoard[]) : []}
              emptyMessage="No boards found."
              getKey={(board, index) => board.id || board.slug || `board-${index}`}
              renderItem={(board) => (
                <Link
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
              )}
            />
          )}

          {activeTab === "users" && results && (
            <SearchResultList
              items={Array.isArray(results) ? (results as SearchUser[]) : []}
              emptyMessage="No users found."
              getKey={(user, index) => user.user_id || user.username || `user-${index}`}
              renderItem={(user) => (
                <Link
                  href={`/u/${user.username}`}
                  className="hover:bg-base-100 flex items-center gap-3 p-4 no-underline transition-colors"
                >
                  <Avatar src={user.avatar_url} fallbackSeed={user.username} size="md" />
                  <div className="min-w-0 flex-1">
                    <div className="text-base-content font-bold">{user.display_name}</div>
                    <div className="text-base-content/70 text-sm">u/{user.username}</div>
                  </div>
                </Link>
              )}
            />
          )}

          {activeTab === "personas" && results && (
            <SearchResultList
              items={Array.isArray(results) ? (results as SearchPersona[]) : []}
              emptyMessage="No personas found."
              getKey={(persona, index) => persona.id || persona.slug || `persona-${index}`}
              renderItem={(persona) => (
                <Link
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
              )}
            />
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
