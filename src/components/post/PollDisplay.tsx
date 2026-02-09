'use client';

import { useState, useEffect } from 'react';

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
}

export default function PollDisplay({
  postId,
  initialOptions = [],
  initialUserVote = null,
  isExpired = false
}: PollDisplayProps) {
  const [options, setOptions] = useState<PollOption[]>(initialOptions);
  const [userVote, setUserVote] = useState<string | null>(initialUserVote);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // Fetch poll data if not provided
    if (!initialOptions.length) {
      fetchPollData();
    }
  }, [postId]);

  const fetchPollData = async () => {
    try {
      const res = await fetch(`/api/polls/${postId}/vote`);
      if (res.ok) {
        const data = await res.json();
        setOptions(data.options);
        setUserVote(data.userVote);
      }
    } catch (err) {
      console.error('Failed to fetch poll data:', err);
    }
  };

  const totalVotes = options.reduce((sum, opt) => sum + opt.vote_count, 0);
  const hasVoted = !!userVote;

  const handleVote = async (optionId: string) => {
    if (hasVoted || isExpired || loading) return;

    setLoading(true);
    setError('');

    try {
      const res = await fetch(`/api/polls/${postId}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ optionId })
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || 'Failed to vote');
      }

      const data = await res.json();
      setOptions(data.options);
      setUserVote(data.userVote);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      {error && (
        <div className="alert alert-error alert-sm">
          <span>{error}</span>
        </div>
      )}

      {options.map((option) => {
        const percentage = totalVotes > 0 ? (option.vote_count / totalVotes) * 100 : 0;
        const isUserChoice = userVote === option.id;

        return (
          <button
            key={option.id}
            onClick={() => handleVote(option.id)}
            disabled={hasVoted || isExpired || loading}
            className={`
              w-full text-left p-3 rounded-box border transition-all bg-base-100
              ${hasVoted || isExpired ? 'border-neutral cursor-default' : 'border-neutral hover:border-neutral active:scale-[0.98]'}
              ${isUserChoice ? 'border-neutral ring-1 ring-neutral' : ''}
              ${loading ? 'opacity-50' : ''}
            `}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm flex-1">{option.text}</span>
              {hasVoted && (
                <span className="text-xs text-[#818384]">
                  {Math.round(percentage)}%
                </span>
              )}
            </div>
            {hasVoted && (
              <div className="mt-2 h-1 bg-base-300 rounded-full overflow-hidden">
                <div
                  className="h-full bg-neutral transition-all duration-300"
                  style={{ width: `${percentage}%` }}
                />
              </div>
            )}
          </button>
        );
      })}

      <div className="flex items-center justify-between text-xs text-[#818384] mt-3">
        <span>{totalVotes} vote{totalVotes !== 1 ? 's' : ''}</span>
        {isExpired && <span>Voting closed</span>}
      </div>
    </div>
  );
}
