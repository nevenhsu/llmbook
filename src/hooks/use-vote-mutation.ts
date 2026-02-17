"use client";

import { useState, useCallback } from "react";
import { votePost, voteComment, VoteResponse } from "@/lib/api/votes";
import { ApiError } from "@/lib/api/fetch-json";
import { applyVote, VoteState, VoteUpdateResult } from "@/lib/optimistic/vote";

interface UseVoteMutationOptions {
  onSuccess?: (data: VoteResponse) => void;
  onError?: (error: ApiError) => void;
}

interface UseVoteMutationReturn {
  isLoading: boolean;
  error: ApiError | null;
  mutate: (postId: string, value: 1 | -1) => Promise<void>;
}

/**
 * Hook for voting on posts with optimistic updates
 *
 * Usage:
 * ```tsx
 * const { mutate, isLoading, error } = useVoteMutation({
 *   onSuccess: (data) => console.log('New score:', data.score),
 *   onError: (err) => console.error('Vote failed:', err.message),
 * });
 *
 * // In event handler:
 * await mutate(postId, 1); // upvote
 * ```
 */
export function useVoteMutation(options?: UseVoteMutationOptions): UseVoteMutationReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const mutate = useCallback(
    async (postId: string, value: 1 | -1) => {
      setIsLoading(true);
      setError(null);

      try {
        const data = await votePost(postId, value);
        options?.onSuccess?.(data);
      } catch (err) {
        const apiError = err instanceof ApiError ? err : new ApiError("Unknown error", 500);
        setError(apiError);
        options?.onError?.(apiError);
        throw apiError;
      } finally {
        setIsLoading(false);
      }
    },
    [options],
  );

  return { isLoading, error, mutate };
}

/**
 * Hook for voting on comments with optimistic updates
 */
export function useCommentVoteMutation(options?: UseVoteMutationOptions): UseVoteMutationReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const mutate = useCallback(
    async (commentId: string, value: 1 | -1) => {
      setIsLoading(true);
      setError(null);

      try {
        const data = await voteComment(commentId, value);
        options?.onSuccess?.(data);
      } catch (err) {
        const apiError = err instanceof ApiError ? err : new ApiError("Unknown error", 500);
        setError(apiError);
        options?.onError?.(apiError);
        throw apiError;
      } finally {
        setIsLoading(false);
      }
    },
    [options],
  );

  return { isLoading, error, mutate };
}

/**
 * Higher-level hook that manages both optimistic state and API call
 * Returns current state and a function to trigger vote
 */
export function useOptimisticVote(initialState: VoteState, options?: UseVoteMutationOptions) {
  const [state, setState] = useState<VoteState>(initialState);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const vote = useCallback(
    async (value: 1 | -1) => {
      // Save previous state for rollback
      const previousState = { ...state };

      // Optimistic update
      const optimisticResult = applyVote(state, value);
      setState(optimisticResult);
      setIsLoading(true);
      setError(null);

      try {
        const data = await votePost(state.score.toString(), value); // Note: need postId here

        // Reconcile with server response
        setState((prev) => ({
          ...prev,
          score: data.score,
        }));

        options?.onSuccess?.(data);
      } catch (err) {
        // Rollback on error
        setState(previousState);

        const apiError = err instanceof ApiError ? err : new ApiError("Unknown error", 500);
        setError(apiError);
        options?.onError?.(apiError);
      } finally {
        setIsLoading(false);
      }
    },
    [state, options],
  );

  return {
    state,
    isLoading,
    error,
    vote,
    setState,
  };
}
