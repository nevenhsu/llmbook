"use client";

import { ArrowBigUp, ArrowBigDown } from "lucide-react";

interface VotePillProps {
  score: number;
  userVote?: 1 | -1 | null;
  onVote: (value: 1 | -1) => void;
  disabled?: boolean;
  size?: "sm" | "md";
  orientation?: "horizontal" | "vertical";
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
  size = "sm",
  orientation = "horizontal",
}: VotePillProps) {
  const isUpvoted = userVote === 1;
  const isDownvoted = userVote === -1;
  const iconSize = size === "sm" ? 16 : 20;

  if (orientation === "vertical") {
    return (
      <div
        className="bg-base-100 flex flex-col items-center rounded-lg py-1"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (!disabled) onVote(1);
          }}
          className={`hover:hover:bg-base-300 rounded-md p-1 ${isUpvoted ? "text-success" : "text-base-content/70 hover:text-success"} ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
          aria-label="Upvote"
          disabled={disabled}
        >
          <ArrowBigUp size={iconSize} fill={isUpvoted ? "currentColor" : "none"} />
        </button>
        <span
          className={`min-w-[2ch] py-0.5 text-center text-xs font-bold ${isUpvoted ? "text-success" : isDownvoted ? "text-error" : "text-base-content"}`}
        >
          {formatScore(score)}
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (!disabled) onVote(-1);
          }}
          className={`hover:hover:bg-base-300 rounded-md p-1 ${isDownvoted ? "text-error" : "text-base-content/70 hover:text-error"} ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
          aria-label="Downvote"
          disabled={disabled}
        >
          <ArrowBigDown size={iconSize} fill={isDownvoted ? "currentColor" : "none"} />
        </button>
      </div>
    );
  }

  return (
    <div
      className="bg-base-100 flex items-center rounded-full"
      onClick={(e) => e.stopPropagation()}
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          if (!disabled) onVote(1);
        }}
        className={`hover:hover:bg-base-300 rounded-l-full p-1 ${isUpvoted ? "text-success" : "text-base-content/70 hover:text-success"} ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
        aria-label="Upvote"
        disabled={disabled}
      >
        <ArrowBigUp size={iconSize} fill={isUpvoted ? "currentColor" : "none"} />
      </button>
      <span
        className={`min-w-[2ch] px-0.5 text-center text-xs font-bold ${isUpvoted ? "text-success" : isDownvoted ? "text-error" : "text-base-content"}`}
      >
        {formatScore(score)}
      </span>
      <button
        onClick={(e) => {
          e.stopPropagation();
          if (!disabled) onVote(-1);
        }}
        className={`hover:hover:bg-base-300 rounded-r-full p-1 ${isDownvoted ? "text-error" : "text-base-content/70 hover:text-error"} ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
        aria-label="Downvote"
        disabled={disabled}
      >
        <ArrowBigDown size={iconSize} fill={isDownvoted ? "currentColor" : "none"} />
      </button>
    </div>
  );
}
