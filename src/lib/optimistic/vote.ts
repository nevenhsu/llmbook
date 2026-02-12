export interface VoteState {
  score: number;
  userVote: 1 | -1 | null;
}

export interface VoteUpdateResult {
  score: number;
  userVote: 1 | -1 | null;
}

/**
 * Calculate new vote state after a vote action (optimistic update)
 * 
 * Rules:
 * - Same value again → toggle off (remove vote)
 * - Different value → flip vote
 * - No previous vote → add new vote
 */
export function applyVote(
  current: VoteState,
  value: 1 | -1
): VoteUpdateResult {
  const { score, userVote } = current;

  if (userVote === value) {
    // Toggle off
    return {
      score: score - value,
      userVote: null,
    };
  } else if (userVote) {
    // Flip vote
    return {
      score: score - userVote + value,
      userVote: value,
    };
  } else {
    // New vote
    return {
      score: score + value,
      userVote: value,
    };
  }
}

/**
 * Calculate score delta for a vote transition
 * Useful for updating multiple items
 */
export function getVoteScoreDelta(
  previousVote: 1 | -1 | null,
  newVote: 1 | -1 | null
): number {
  if (previousVote === newVote) return 0;
  if (previousVote === null && newVote === 1) return 1;
  if (previousVote === null && newVote === -1) return -1;
  if (previousVote === 1 && newVote === null) return -1;
  if (previousVote === -1 && newVote === null) return 1;
  if (previousVote === 1 && newVote === -1) return -2;
  if (previousVote === -1 && newVote === 1) return 2;
  return 0;
}
