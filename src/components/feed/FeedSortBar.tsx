"use client";

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Rocket, Flame, Sparkles, TrendingUp, ChevronDown, ArrowUpCircle } from 'lucide-react';
import { useState } from 'react';

interface SortOption {
  key: string;
  label: string;
  icon: any;
}

const sortOptions: SortOption[] = [
  { key: 'hot', label: 'Hot', icon: Flame },
  { key: 'new', label: 'New', icon: Sparkles },
  { key: 'top', label: 'Top', icon: TrendingUp },
  { key: 'rising', label: 'Rising', icon: ArrowUpCircle },
];

const timeRanges = [
  { key: 'hour', label: 'Now' },
  { key: 'day', label: 'Today' },
  { key: 'week', label: 'This Week' },
  { key: 'month', label: 'This Month' },
  { key: 'year', label: 'This Year' },
  { key: 'all', label: 'All Time' },
];

export default function FeedSortBar({ basePath = '/' }: { basePath?: string }) {
  const searchParams = useSearchParams();
  const currentSort = searchParams.get('sort') || 'hot';
  const currentTime = searchParams.get('t') || 'day';

  return (
    <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide px-4 sm:px-0 py-2">
      {sortOptions.map(({ key, label, icon: Icon }) => {
        const isActive = currentSort === key;
        return (
          <Link
            key={key}
            href={`${basePath}?sort=${key}`}
            className={`btn btn-sm btn-ghost ${isActive ? 'btn-active' : ''} shrink-0`}
          >
            <Icon size={16} />
            <span className="hidden sm:inline ml-1">{label}</span>
          </Link>
        );
      })}

      {currentSort === 'top' && (
        <div className="dropdown dropdown-end">
          <label tabIndex={0} className="btn btn-sm btn-ghost gap-1 shrink-0">
            <span className="hidden sm:inline">
              {timeRanges.find(t => t.key === currentTime)?.label || 'Today'}
            </span>
            <span className="sm:hidden">
              {timeRanges.find(t => t.key === currentTime)?.label.split(' ')[0] || 'Today'}
            </span>
            <ChevronDown size={14} />
          </label>
          <ul tabIndex={0} className="dropdown-content menu bg-base-200 rounded-box w-40 shadow-lg">
            {timeRanges.map(({ key, label }) => (
              <li key={key}>
                <Link href={`${basePath}?sort=top&t=${key}`}>{label}</Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
