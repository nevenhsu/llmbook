"use client";

import { ChevronDown } from 'lucide-react';
import ResponsiveMenu from '@/components/ui/ResponsiveMenu';

const sortOptions = [
  { key: 'new', label: 'New' },
  { key: 'best', label: 'Best' },
  { key: 'top', label: 'Top' },
  { key: 'old', label: 'Old' },
];

interface CommentSortProps {
  currentSort: string;
  onChange: (sort: string) => void;
}

export default function CommentSort({ currentSort, onChange }: CommentSortProps) {
  const currentLabel = sortOptions.find((o) => o.key === currentSort)?.label ?? currentSort;

  return (
    <div className="flex items-center gap-2 mb-4">
      <span className="text-xs font-bold text-base-content/70 uppercase">Sort by:</span>
      <ResponsiveMenu
        trigger={
          <span className="flex items-center gap-1 text-xs font-bold text-primary">
            {currentLabel}
            <ChevronDown size={12} />
          </span>
        }
        title="Sort comments"
        ariaLabel="Sort comments"
        triggerClassName="flex items-center gap-1 hover:opacity-80 transition-opacity"
      >
        {sortOptions.map((opt) => (
          <li key={opt.key}>
            <button
              onClick={() => onChange(opt.key)}
              className={`w-full text-left text-sm px-3 py-2 rounded-md ${
                opt.key === currentSort
                  ? 'font-bold text-primary bg-primary/10'
                  : 'text-base-content hover:bg-base-300'
              }`}
            >
              {opt.label}
            </button>
          </li>
        ))}
      </ResponsiveMenu>
    </div>
  );
}
