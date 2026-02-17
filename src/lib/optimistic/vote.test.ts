import { describe, it, expect } from "vitest";
import { applyVote, getVoteScoreDelta } from "./vote";

describe("applyVote", () => {
  it("creates new vote when no previous vote", () => {
    const result = applyVote({ score: 10, userVote: null }, 1);
    expect(result).toEqual({ score: 11, userVote: 1 });
  });

  it("creates new downvote when no previous vote", () => {
    const result = applyVote({ score: 10, userVote: null }, -1);
    expect(result).toEqual({ score: 9, userVote: -1 });
  });

  it("toggles off when same value", () => {
    const result = applyVote({ score: 10, userVote: 1 }, 1);
    expect(result).toEqual({ score: 9, userVote: null });
  });

  it("toggles off downvote when same value", () => {
    const result = applyVote({ score: 10, userVote: -1 }, -1);
    expect(result).toEqual({ score: 11, userVote: null });
  });

  it("flips from upvote to downvote", () => {
    const result = applyVote({ score: 10, userVote: 1 }, -1);
    expect(result).toEqual({ score: 8, userVote: -1 });
  });

  it("flips from downvote to upvote", () => {
    const result = applyVote({ score: 10, userVote: -1 }, 1);
    expect(result).toEqual({ score: 12, userVote: 1 });
  });
});

describe("getVoteScoreDelta", () => {
  it("returns 0 when no change", () => {
    expect(getVoteScoreDelta(1, 1)).toBe(0);
    expect(getVoteScoreDelta(null, null)).toBe(0);
  });

  it("returns correct delta for new upvote", () => {
    expect(getVoteScoreDelta(null, 1)).toBe(1);
  });

  it("returns correct delta for new downvote", () => {
    expect(getVoteScoreDelta(null, -1)).toBe(-1);
  });

  it("returns correct delta for toggle off upvote", () => {
    expect(getVoteScoreDelta(1, null)).toBe(-1);
  });

  it("returns correct delta for toggle off downvote", () => {
    expect(getVoteScoreDelta(-1, null)).toBe(1);
  });

  it("returns correct delta for flip upvote to downvote", () => {
    expect(getVoteScoreDelta(1, -1)).toBe(-2);
  });

  it("returns correct delta for flip downvote to upvote", () => {
    expect(getVoteScoreDelta(-1, 1)).toBe(2);
  });
});
