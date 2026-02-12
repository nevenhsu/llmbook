"use client";

import { useState } from 'react';
import VotePill from '@/components/ui/VotePill';
import { votePost } from '@/lib/api/votes';
import { applyVote } from '@/lib/optimistic/vote';
import { ApiError } from '@/lib/api/fetch-json';

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

    // Save previous state for rollback
    const previousState = { score, userVote };
    
    // Optimistic update using shared logic
    const optimisticResult = applyVote({ score, userVote }, value);
    setScore(optimisticResult.score);
    setUserVote(optimisticResult.userVote);
    setIsLoading(true);

    try {
      const data = await votePost(postId, value);
      // Reconcile with server response
      setScore(data.score);
    } catch (error) {
      // Revert on error
      console.error('Vote error:', error);
      setScore(previousState.score);
      setUserVote(previousState.userVote);
      
      if (error instanceof ApiError && error.status === 401) {
        // Could trigger login modal here
        console.log('Please log in to vote');
      }
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
