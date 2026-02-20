"use client";

import { useState, useEffect } from "react";
import { useLoginModal } from "@/contexts/LoginModalContext";
import toast from "react-hot-toast";
import { apiFetchJson } from "@/lib/api/fetch-json";

interface PollOption {
  id: string;
  text: string;
  vote_count: number;
  position: number;
}

interface PollDisplayProps {
  postId: string;
  initialOptions?: PollOption[];
  initialUserVote?: string | null;
  isExpired?: boolean;
  expiresAt?: string | null;
}

function formatTimeLeft(ms: number) {
  if (!Number.isFinite(ms) || ms <= 0) return "0s";
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m`;
  return `${seconds}s`;
}

export default function PollDisplay({
  postId,
  initialOptions = [],
  initialUserVote = null,
  isExpired = false,
  expiresAt = null,
}: PollDisplayProps) {
  const [options, setOptions] = useState<PollOption[]>(initialOptions);
  const [userVote, setUserVote] = useState<string | null>(initialUserVote);
  const [loading, setLoading] = useState(false);
  const [expired, setExpired] = useState(isExpired);
  const [timeLeftMs, setTimeLeftMs] = useState<number | null>(null);
  const { openLoginModal } = useLoginModal();

  useEffect(() => {
    // Fetch poll data if not provided
    if (!initialOptions.length) {
      fetchPollData();
    }
  }, [postId, initialOptions.length]);

  useEffect(() => {
    if (!expiresAt || expired) {
      setTimeLeftMs(null);
      return;
    }

    const expiresAtMs = new Date(expiresAt).getTime();
    if (Number.isNaN(expiresAtMs)) {
      setTimeLeftMs(null);
      return;
    }

    const tick = () => {
      const left = expiresAtMs - Date.now();
      if (left <= 0) {
        setExpired(true);
        setTimeLeftMs(0);
        return;
      }
      setTimeLeftMs(left);
    };

    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [expiresAt, expired]);

  const fetchPollData = async () => {
    try {
      const data = await apiFetchJson<{ options: PollOption[]; userVote: string | null }>(
        `/api/polls/${postId}/vote`,
      );
      setOptions(data.options);
      setUserVote(data.userVote);
    } catch (err) {
      console.error("Failed to fetch poll data:", err);
    }
  };

  const totalVotes = options.reduce((sum, opt) => sum + opt.vote_count, 0);
  const hasVoted = !!userVote;
  const maxVotes = options.reduce((m, opt) => Math.max(m, opt.vote_count), 0);

  const handleVote = async (optionId: string) => {
    if (expired || loading) return;

    setLoading(true);
    const prevVote = userVote;

    try {
      const res = await fetch(`/api/polls/${postId}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ optionId }),
      });

      if (!res.ok) {
        if (res.status === 401) {
          openLoginModal();
          return;
        }

        const data = await res.json().catch(() => null);
        const message =
          data && typeof data === "object" && "error" in data && typeof data.error === "string"
            ? data.error
            : "Failed to vote";

        if (res.status === 403 && message === "This poll has ended") {
          setExpired(true);
        }
        throw new Error(message);
      }

      const data = await res.json();
      setOptions(data.options);
      setUserVote(data.userVote);

      const nextVote: string | null = data.userVote ?? null;
      if (prevVote && nextVote === null) {
        toast.success("Vote removed");
      } else if (!prevVote && nextVote) {
        toast.success("Vote recorded");
      } else if (prevVote && nextVote && prevVote !== nextVote) {
        toast.success("Vote updated");
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to vote";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      {options.map((option) => {
        const percentage = totalVotes > 0 ? (option.vote_count / totalVotes) * 100 : 0;
        const isUserChoice = userVote === option.id;
        const isLeading = hasVoted && maxVotes > 0 && option.vote_count === maxVotes;
        const showUserVote = hasVoted && isUserChoice;
        const showLeading = hasVoted && isLeading;

        const userBorderClass = showUserVote
          ? isLeading
            ? "border-success/70 ring-success ring-2"
            : "border-base-content/20 ring-base-content/30 ring-2"
          : "";

        return (
          <button
            key={option.id}
            onClick={() => handleVote(option.id)}
            disabled={expired || loading}
            className={`rounded-box bg-base-100 w-full border p-3 text-left transition-all ${expired ? "border-neutral cursor-not-allowed" : "border-neutral hover:border-neutral hover:bg-base-200/60 active:scale-[0.98]"} ${showLeading ? "border-success/40 bg-success/5" : ""} ${userBorderClass} ${loading ? "opacity-50" : ""} `}
          >
            <div className="flex items-start justify-between gap-3">
              <span className="min-w-0 flex-1 text-sm break-words whitespace-normal">
                {option.text}
              </span>

              <div className="flex shrink-0 items-center gap-2">
                {showUserVote && (
                  <span
                    className={`badge badge-sm ${isLeading ? "badge-success" : "badge-neutral"}`}
                  >
                    Your vote
                  </span>
                )}
                {hasVoted && (
                  <div className="flex flex-col items-end leading-tight">
                    <span className={`text-xs ${showLeading ? "text-success" : "text-[#818384]"}`}>
                      {Math.round(percentage)}%
                    </span>
                    <span className="text-[11px] text-[#818384]">
                      {option.vote_count} vote{option.vote_count !== 1 ? "s" : ""}
                    </span>
                  </div>
                )}
              </div>
            </div>
            {hasVoted && (
              <div className="bg-base-300 mt-2 h-1 overflow-hidden rounded-full">
                <div
                  className={`h-full transition-all duration-300 ${showLeading ? "bg-success" : "bg-base-content/30"}`}
                  style={{ width: `${percentage}%` }}
                />
              </div>
            )}
          </button>
        );
      })}

      <div className="mt-3 flex items-center justify-between text-xs text-[#818384]">
        <span>
          {totalVotes} vote{totalVotes !== 1 ? "s" : ""}
        </span>
        {expired ? (
          <span>Voting closed</span>
        ) : timeLeftMs != null ? (
          <span>Ends in {formatTimeLeft(timeLeftMs)}</span>
        ) : null}
      </div>
    </div>
  );
}
