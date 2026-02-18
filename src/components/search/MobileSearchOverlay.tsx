"use client";

import { Search, X } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function MobileSearchOverlay() {
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
  const inputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDialogElement>(null);
  const router = useRouter();

  // Debounced search (300ms)
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (query.length > 1) {
        try {
          const res = await fetch(`/api/search?q=${encodeURIComponent(query)}&type=posts`);
          const data = await res.json();
          setResults(Array.isArray(data) ? (data as SearchPostResult[]) : []);
        } catch (err) {
          console.error(err);
          setResults([]);
        }
      } else {
        setResults([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  function openModal() {
    modalRef.current?.showModal();
    // Auto-focus input after modal opens
    setTimeout(() => inputRef.current?.focus(), 100);
  }

  function handleSearch(e?: React.FormEvent) {
    e?.preventDefault();
    if (query.trim()) {
      router.push(`/search?q=${encodeURIComponent(query)}`);
      modalRef.current?.close();
      setQuery("");
      setResults([]);
    }
  }

  function closeModal() {
    modalRef.current?.close();
    setQuery("");
    setResults([]);
  }

  return (
    <>
      {/* Trigger — visible on mobile only */}
      <button
        className="btn btn-ghost btn-circle md:hidden"
        onClick={openModal}
        aria-label="Search"
      >
        <Search size={20} />
      </button>

      {/* Modal — full screen on mobile */}
      <dialog ref={modalRef} className="modal modal-top">
        <div className="modal-box sm:rounded-box bg-base-200 w-full max-w-full rounded-none p-0 sm:max-w-lg">
          {/* Search header */}
          <form
            onSubmit={handleSearch}
            className="border-neutral flex items-center gap-2 border-b px-4 py-3"
          >
            <Search size={20} className="flex-shrink-0 text-[#818384]" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search..."
              className="text-base-content flex-1 bg-transparent text-sm outline-none placeholder:text-[#818384]"
            />
            <button type="button" onClick={closeModal} className="btn btn-ghost btn-circle btn-sm">
              <X size={18} />
            </button>
          </form>

          {/* Results area */}
          <div className="max-h-[calc(100dvh-60px)] overflow-y-auto">
            {query.length === 0 ? (
              <p className="py-8 text-center text-sm text-[#818384]">
                Type to search posts, communities, and people
              </p>
            ) : query.length > 1 ? (
              <div className="py-2">
                {results.length > 0 ? (
                  results.slice(0, 5).map((post) => {
                    const board = Array.isArray(post.boards) ? post.boards[0] : post.boards;
                    return (
                      <Link
                        key={post.id}
                        href={`/r/${board?.slug || "unknown"}/posts/${post.id}`}
                        onClick={closeModal}
                        className="hover:bg-base-300 border-neutral block border-b px-4 py-3 last:border-b-0"
                      >
                        <p className="text-base-content line-clamp-2 text-sm font-medium">
                          {post.title}
                        </p>
                        {board && <p className="mt-1 text-xs text-[#818384]">r/{board.slug}</p>}
                      </Link>
                    );
                  })
                ) : (
                  <div className="px-4 py-3 text-sm text-[#818384]">
                    No quick results found. Press Enter to search everywhere.
                  </div>
                )}
                <button
                  onClick={handleSearch}
                  className="border-neutral bg-base-200 hover:bg-base-300 text-accent w-full border-t px-4 py-3 text-left text-sm font-bold"
                >
                  Search for "{query}"
                </button>
              </div>
            ) : (
              <p className="py-8 text-center text-sm text-[#818384]">Type at least 2 characters</p>
            )}
          </div>
        </div>

        {/* Click outside to close */}
        <form method="dialog" className="modal-backdrop">
          <button>close</button>
        </form>
      </dialog>
    </>
  );
}
