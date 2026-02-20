"use client";

import { useState, useRef, useEffect } from "react";
import { Search, X } from "lucide-react";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export default function SearchBar({
  value,
  onChange,
  placeholder = "Search...",
  className = "",
}: SearchBarProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Prevent hydration mismatch
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Auto-expand when there's a value
  useEffect(() => {
    if (value && isMounted) {
      setIsExpanded(true);
    }
  }, [value, isMounted]);

  // Focus input when expanded
  useEffect(() => {
    if (isExpanded && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isExpanded]);

  const handleClear = () => {
    onChange("");
    setIsExpanded(false);
  };

  const handleExpand = () => {
    setIsExpanded(true);
  };

  // Prevent hydration mismatch by rendering consistent initial state
  if (!isMounted) {
    return (
      <div className={`flex items-center justify-end ${className}`}>
        <button
          className="hover:bg-base-200 flex h-10 w-10 items-center justify-center rounded-full transition-colors"
          aria-label="Search"
        >
          <Search size={20} className="text-base-content" />
        </button>
      </div>
    );
  }

  return (
    <div className={`flex items-center justify-end ${className}`}>
      {isExpanded ? (
        <div className="relative w-full max-w-md">
          <Search
            className="text-base-content/50 pointer-events-none absolute top-1/2 left-2.5 z-10 -translate-y-1/2"
            size={18}
          />
          <input
            ref={inputRef}
            type="text"
            placeholder={placeholder}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="input input-bordered w-full pr-10 pl-9"
          />
          <button
            onClick={handleClear}
            className="hover:bg-base-200 absolute top-1/2 right-2 z-10 -translate-y-1/2 rounded-full p-1 transition-colors"
            aria-label="Clear search"
          >
            <X size={18} />
          </button>
        </div>
      ) : (
        <button
          onClick={handleExpand}
          className="hover:bg-base-200 flex h-10 w-10 items-center justify-center rounded-full transition-colors"
          aria-label="Search"
        >
          <Search size={20} className="text-base-content" />
        </button>
      )}
    </div>
  );
}
