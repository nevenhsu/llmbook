"use client";

import { useState, useEffect, useRef } from "react";
import { Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function SearchBar() {
  const [query, setQuery] = useState("");
  type SearchPostResult = {
    id: string;
    title: string;
    boards?:
      | {
          slug: string;
        }
      | {
          slug: string;
        }[]
      | null;
  };
  const [results, setResults] = useState<SearchPostResult[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const router = useRouter();
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (query.length > 1) {
        try {
          const res = await fetch(`/api/search?q=${encodeURIComponent(query)}&type=posts`);
          const data = await res.json();
          setResults(Array.isArray(data) ? (data as SearchPostResult[]) : []);
          setShowDropdown(true);
        } catch (err) {
          console.error(err);
        }
      } else {
        setResults([]);
        setShowDropdown(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSearch = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (query.trim()) {
      router.push(`/search?q=${encodeURIComponent(query)}`);
      setShowDropdown(false);
    }
  };

  return (
    <div className="relative max-w-[640px] flex-1" ref={dropdownRef}>
      <form
        onSubmit={handleSearch}
        className="border-neutral bg-base-100 hover:bg-base-300 focus-within:border-primary flex items-center rounded-full border px-4 py-2 transition-colors"
      >
        <Search size={20} className="text-base-content/70" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search Reddit"
          className="text-base-content placeholder:text-base-content/70 ml-2 w-full bg-transparent text-sm outline-none"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            className="text-base-content/70 hover:text-base-content"
          >
            <X size={16} />
          </button>
        )}
      </form>

      {showDropdown && query.length > 1 && (
        <div className="bg-base-100 border-neutral absolute top-full right-0 left-0 z-[110] mt-2 overflow-hidden rounded-md border shadow-xl">
          <div className="py-2">
            {results.length > 0 ? (
              results.slice(0, 5).map((post) => {
                const board = Array.isArray(post.boards) ? post.boards[0] : post.boards;
                return (
                  <Link
                    key={post.id}
                    href={`/r/${board?.slug || "unknown"}/posts/${post.id}`}
                    onClick={() => setShowDropdown(false)}
                    className="hover:bg-base-300 text-base-content block truncate px-4 py-2 text-sm"
                  >
                    {post.title}
                  </Link>
                );
              })
            ) : (
              <div className="text-base-content/70 px-4 py-2 text-sm">
                No quick results found. Press Enter to search everywhere.
              </div>
            )}
            <button
              onClick={() => handleSearch()}
              className="border-neutral hover:bg-base-300 text-accent w-full border-t px-4 py-2 text-left text-sm font-bold"
            >
              Search for "{query}"
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
