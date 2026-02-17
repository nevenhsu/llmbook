"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { applyVote } from "@/lib/optimistic/vote";
import { ApiError } from "@/lib/api/fetch-json";
import { VoteResponse } from "@/lib/api/votes";
import { useLoginModal } from "@/contexts/LoginModalContext";
import toast from "react-hot-toast";

type VoteFn = (id: string, value: 1 | -1) => Promise<VoteResponse>;

interface UseVoteOptions {
  id: string;
  initialScore: number;
  initialUserVote: 1 | -1 | null;
  voteFn: VoteFn;
  /** Pass to disable voting (e.g. status === 'ARCHIVED' || status === 'DELETED') */
  disabled?: boolean;
  /**
   * Called once after the server confirms the vote.
   * Receives the server-confirmed score and the optimistic userVote.
   */
  onScoreChange?: (id: string, score: number, userVote: 1 | -1 | null) => void;
}

export interface UseVoteReturn {
  score: number;
  userVote: 1 | -1 | null;
  isVoting: boolean;
  handleVote: (value: 1 | -1) => Promise<void>;
  /** Combined disabled: isVoting || props.disabled */
  voteDisabled: boolean;
}

export function useVote({
  id,
  initialScore,
  initialUserVote,
  voteFn,
  disabled = false,
  onScoreChange,
}: UseVoteOptions): UseVoteReturn {
  const [score, setScore] = useState(initialScore);
  const [userVote, setUserVote] = useState<1 | -1 | null>(initialUserVote);
  const [isVoting, setIsVoting] = useState(false);
  const { openLoginModal } = useLoginModal();

  // Always-fresh refs so the async callback never reads stale state
  const scoreRef = useRef(score);
  const userVoteRef = useRef(userVote);
  const isVotingRef = useRef(false);
  // Sequence counter: only the latest call's response is applied
  const seqRef = useRef(0);

  scoreRef.current = score;
  userVoteRef.current = userVote;

  // Sync internal state when the item being rendered changes (e.g. list reuse)
  // but never clobber an in-flight optimistic update
  useEffect(() => {
    if (!isVotingRef.current) {
      setScore(initialScore);
      setUserVote(initialUserVote);
    }
  }, [initialScore, initialUserVote]);

  const handleVote = useCallback(async (value: 1 | -1) => {
    if (isVotingRef.current || disabled) return;

    const previousScore = scoreRef.current;
    const previousUserVote = userVoteRef.current;

    // Optimistic update — update local UI immediately, no external callback yet
    const optimistic = applyVote({ score: previousScore, userVote: previousUserVote }, value);
    setScore(optimistic.score);
    setUserVote(optimistic.userVote);

    isVotingRef.current = true;
    setIsVoting(true);

    // Claim this sequence slot — stale responses from older calls are ignored
    const seq = ++seqRef.current;

    try {
      const data = await voteFn(id, value);
      if (seq !== seqRef.current) return;

      // Reconcile score with server-confirmed value
      setScore(data.score);
      // Notify parent only once, after server confirmation
      onScoreChange?.(id, data.score, optimistic.userVote);
    } catch (err) {
      if (seq !== seqRef.current) return;

      // Rollback optimistic update
      setScore(previousScore);
      setUserVote(previousUserVote);

      if (err instanceof ApiError && err.status === 401) {
        openLoginModal();
      } else {
        toast.error("Failed to vote");
      }
    } finally {
      if (seq === seqRef.current) {
        isVotingRef.current = false;
        setIsVoting(false);
      }
    }
  }, [id, disabled, voteFn, onScoreChange, openLoginModal]);

  return {
    score,
    userVote,
    isVoting,
    handleVote,
    voteDisabled: isVoting || disabled,
  };
}
