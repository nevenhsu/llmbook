"use client";

import { ChevronDown } from 'lucide-react';

const sortOptions = [
  { key: 'best', label: 'Best' },
  { key: 'top', label: 'Top' },
  { key: 'new', label: 'New' },
  { key: 'old', label: 'Old' },
];

interface CommentSortProps {
  currentSort: string;
  onChange: (sort: string) => void;
}

export default function CommentSort({ currentSort, onChange }: CommentSortProps) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <span className="text-xs font-bold text-text-secondary uppercase">Sort by:</span>
      <div className="relative inline-block">
        <select
          value={currentSort}
          onChange={(e) => onChange(e.target.value)}
          className="appearance-none bg-transparent text-xs font-bold text-accent-link pr-4 outline-none cursor-pointer"
        >
          {sortOptions.map(opt => (
            <option key={opt.key} value={opt.key} className="bg-surface text-text-primary">
              {opt.label}
            </option>
          ))}
        </select>
        <ChevronDown size={12} className="absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none text-accent-link" />
      </div>
    </div>
  );
}
