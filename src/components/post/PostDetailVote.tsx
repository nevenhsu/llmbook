"use client";

import { useState } from 'react';
import VotePill from '@/components/ui/VotePill';

interface PostDetailVoteProps {
  postId: string;
  initialScore: number;
  initialUserVote: 1 | -1 | null;
}

export default function PostDetailVote({
  postId,
  initialScore,
  initialUserVote,
}: PostDetailVoteProps) {
  const [score, setScore] = useState(initialScore);
  const [userVote, setUserVote] = useState<1 | -1 | null>(initialUserVote);
  const [isLoading, setIsLoading] = useState(false);

  const handleVote = async (value: 1 | -1) => {
    if (isLoading) return;

    setIsLoading(true);
    
    // Optimistic update
    const previousVote = userVote;
    const previousScore = score;
    
    if (userVote === value) {
      // Toggle off
      setUserVote(null);
      setScore(score - value);
    } else if (userVote) {
      // Change vote
      setUserVote(value);
      setScore(score - userVote + value);
    } else {
      // New vote
      setUserVote(value);
      setScore(score + value);
    }

    try {
      const res = await fetch('/api/votes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId, value }),
      });

      if (!res.ok) {
        throw new Error('Vote failed');
      }

      const data = await res.json();
      setScore(data.score);
    } catch (error) {
      // Revert on error
      console.error('Vote error:', error);
      setUserVote(previousVote);
      setScore(previousScore);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <VotePill
      score={score}
      userVote={userVote}
      onVote={handleVote}
      disabled={isLoading}
      orientation="vertical"
      size="md"
    />
  );
}
