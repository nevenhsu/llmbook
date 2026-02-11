"use client";

import { ArrowBigUp, ArrowBigDown } from 'lucide-react';

interface VotePillProps {
  score: number;
  userVote?: 1 | -1 | null;
  onVote: (value: 1 | -1) => void;
  disabled?: boolean;
  size?: 'sm' | 'md';
  orientation?: 'horizontal' | 'vertical';
}

export function formatScore(n: number): string {
  const absN = Math.abs(n);
  if (absN >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}m`;
  if (absN >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

export default function VotePill({
  score,
  userVote,
  onVote,
  disabled = false,
  size = 'sm',
  orientation = 'horizontal',
}: VotePillProps) {
  const isUpvoted = userVote === 1;
  const isDownvoted = userVote === -1;
  const iconSize = size === 'sm' ? 16 : 20;

  if (orientation === 'vertical') {
    return (
      <div className="flex flex-col items-center rounded-lg bg-base-100 py-1">
        <button
          onClick={(e) => { e.stopPropagation(); if (!disabled) onVote(1); }}
          className={`p-1 rounded-md hover:hover:bg-base-300 ${isUpvoted ? 'text-success' : 'text-base-content/70 hover:text-success'} ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
          aria-label="Upvote"
          disabled={disabled}
        >
          <ArrowBigUp size={iconSize} fill={isUpvoted ? 'currentColor' : 'none'} />
        </button>
        <span className={`text-xs font-bold py-0.5 min-w-[2ch] text-center ${isUpvoted ? 'text-success' : isDownvoted ? 'text-error' : 'text-base-content'}`}>
          {formatScore(score)}
        </span>
        <button
          onClick={(e) => { e.stopPropagation(); if (!disabled) onVote(-1); }}
          className={`p-1 rounded-md hover:hover:bg-base-300 ${isDownvoted ? 'text-error' : 'text-base-content/70 hover:text-error'} ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
          aria-label="Downvote"
          disabled={disabled}
        >
          <ArrowBigDown size={iconSize} fill={isDownvoted ? 'currentColor' : 'none'} />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center rounded-full bg-base-100">
      <button
        onClick={(e) => { e.stopPropagation(); if (!disabled) onVote(1); }}
        className={`p-1 rounded-l-full hover:hover:bg-base-300 ${isUpvoted ? 'text-success' : 'text-base-content/70 hover:text-success'} ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
        aria-label="Upvote"
        disabled={disabled}
      >
        <ArrowBigUp size={iconSize} fill={isUpvoted ? 'currentColor' : 'none'} />
      </button>
      <span className={`text-xs font-bold px-0.5 min-w-[2ch] text-center ${isUpvoted ? 'text-success' : isDownvoted ? 'text-error' : 'text-base-content'}`}>
        {formatScore(score)}
      </span>
      <button
        onClick={(e) => { e.stopPropagation(); if (!disabled) onVote(-1); }}
        className={`p-1 rounded-r-full hover:hover:bg-base-300 ${isDownvoted ? 'text-error' : 'text-base-content/70 hover:text-error'} ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
        aria-label="Downvote"
        disabled={disabled}
      >
        <ArrowBigDown size={iconSize} fill={isDownvoted ? 'currentColor' : 'none'} />
      </button>
    </div>
  );
}
