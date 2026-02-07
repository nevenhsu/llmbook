"use client";

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Rocket, Flame, Sparkles, TrendingUp, ChevronDown } from 'lucide-react';
import { useState } from 'react';

interface SortOption {
  key: string;
  label: string;
  icon: any;
}

const sortOptions: SortOption[] = [
  { key: 'best', label: 'Best', icon: Rocket },
  { key: 'hot', label: 'Hot', icon: Flame },
  { key: 'new', label: 'New', icon: Sparkles },
  { key: 'top', label: 'Top', icon: TrendingUp },
];

const timeRanges = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'This Week' },
  { key: 'month', label: 'This Month' },
  { key: 'year', label: 'This Year' },
  { key: 'all', label: 'All Time' },
];

export default function FeedSortBar({ basePath = '/' }: { basePath?: string }) {
  const searchParams = useSearchParams();
  const currentSort = searchParams.get('sort') || 'best';
  const currentTime = searchParams.get('t') || 'today';
  const [showTimeDropdown, setShowTimeDropdown] = useState(false);

  return (
    <div className="flex items-center gap-1 py-2">
      {sortOptions.map(({ key, label, icon: Icon }) => {
        const isActive = currentSort === key;
        return (
          <Link
            key={key}
            href={`${basePath}?sort=${key}`}
            className={isActive
              ? "bg-surface text-text-primary rounded-full px-3 py-1.5 text-sm font-bold flex items-center gap-1.5"
              : "text-text-secondary hover:bg-surface rounded-full px-3 py-1.5 text-sm font-bold flex items-center gap-1.5"
            }
          >
            <Icon size={16} />
            <span>{label}</span>
          </Link>
        );
      })}

      {currentSort === 'top' && (
        <div className="relative">
          <button
            onClick={() => setShowTimeDropdown(!showTimeDropdown)}
            className="text-text-secondary text-sm flex items-center gap-1 hover:bg-surface rounded-full px-3 py-1.5 font-bold"
          >
            <span>{timeRanges.find(t => t.key === currentTime)?.label || 'Today'}</span>
            <ChevronDown size={16} />
          </button>

          {showTimeDropdown && (
            <div className="absolute top-full left-0 mt-1 bg-surface border border-border-default rounded-md shadow-lg z-10 py-1 min-w-[120px]">
              {timeRanges.map(({ key, label }) => (
                <Link
                  key={key}
                  href={`${basePath}?sort=top&t=${key}`}
                  onClick={() => setShowTimeDropdown(false)}
                  className="block px-3 py-1.5 text-sm hover:bg-surface-hover text-text-primary"
                >
                  {label}
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
