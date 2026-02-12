"use client";

import { Search, X } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function MobileSearchOverlay() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
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
          setResults(Array.isArray(data) ? data : []);
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
        <div className="modal-box w-full max-w-full sm:max-w-lg rounded-none sm:rounded-box bg-base-200 p-0">
          {/* Search header */}
          <form onSubmit={handleSearch} className="flex items-center gap-2 border-b border-neutral px-4 py-3">
            <Search size={20} className="text-[#818384] flex-shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search..."
              className="flex-1 bg-transparent text-base-content placeholder:text-[#818384] outline-none text-sm"
            />
            <button type="button" onClick={closeModal} className="btn btn-ghost btn-circle btn-sm">
              <X size={18} />
            </button>
          </form>

          {/* Results area */}
          <div className="max-h-[calc(100dvh-60px)] overflow-y-auto">
            {query.length === 0 ? (
              <p className="text-[#818384] text-sm text-center py-8">
                Type to search posts, communities, and people
              </p>
            ) : query.length > 1 ? (
              <div className="py-2">
                {results.length > 0 ? (
                  results.slice(0, 5).map(post => {
                    const board = post.boards;
                    return (
                      <Link
                        key={post.id}
                        href={`/r/${board?.slug || 'unknown'}/posts/${post.id}`}
                        onClick={closeModal}
                        className="block px-4 py-3 hover:bg-base-300 border-b border-neutral last:border-b-0"
                      >
                        <p className="text-sm font-medium text-base-content line-clamp-2">
                          {post.title}
                        </p>
                        {board && (
                          <p className="text-xs text-[#818384] mt-1">
                            r/{board.slug}
                          </p>
                        )}
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
                  className="w-full text-left px-4 py-3 border-t border-neutral bg-base-200 hover:bg-base-300 text-sm font-bold text-accent"
                >
                  Search for "{query}"
                </button>
              </div>
            ) : (
              <p className="text-[#818384] text-sm text-center py-8">
                Type at least 2 characters
              </p>
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
