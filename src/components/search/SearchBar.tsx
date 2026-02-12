"use client";

import { useState, useEffect, useRef } from 'react';
import { Search, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function SearchBar() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const router = useRouter();
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (query.length > 1) {
        try {
          const res = await fetch(`/api/search?q=${encodeURIComponent(query)}&type=posts`);
          const data = await res.json();
          setResults(Array.isArray(data) ? data : []);
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
    <div className="relative flex-1 max-w-[640px]" ref={dropdownRef}>
      <form onSubmit={handleSearch} className="flex items-center rounded-full border border-neutral bg-base-100 px-4 py-2 transition-colors hover:hover:bg-base-300 focus-within:">
        <Search size={20} className="text-base-content/70" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search Reddit"
          className="ml-2 w-full bg-transparent text-sm text-base-content outline-none placeholder:text-base-content/70"
        />
        {query && (
          <button type="button" onClick={() => setQuery('')} className="text-base-content/70 hover:text-base-content">
            <X size={16} />
          </button>
        )}
      </form>

      {showDropdown && query.length > 1 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-base-100 border border-neutral rounded-md shadow-xl z-[110] overflow-hidden">
          <div className="py-2">
            {results.length > 0 ? (
              results.slice(0, 5).map(post => {
                const board = post.boards;
                return (
                  <Link 
                    key={post.id} 
                    href={`/r/${board?.slug || 'unknown'}/posts/${post.id}`}
                    onClick={() => setShowDropdown(false)}
                    className="block px-4 py-2 hover:hover:bg-base-300 text-sm text-base-content truncate"
                  >
                    {post.title}
                  </Link>
                );
              })
            ) : (
              <div className="px-4 py-2 text-sm text-base-content/70">No quick results found. Press Enter to search everywhere.</div>
            )}
            <button 
              onClick={() => handleSearch()}
              className="w-full text-left px-4 py-2 border-t border-neutral hover:hover:bg-base-300 text-sm font-bold text-accent"
            >
              Search for "{query}"
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
