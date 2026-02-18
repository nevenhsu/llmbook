export type VoteValue = 1 | -1 | null;

export function toVoteValue(value: unknown): VoteValue {
  return value === 1 || value === -1 ? value : null;
}
