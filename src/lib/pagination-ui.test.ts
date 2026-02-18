import { describe, it, expect } from "vitest";
import { buildPaginationTokens } from "./pagination-ui";

describe("buildPaginationTokens", () => {
  it("returns full range when totalPages <= maxButtons", () => {
    expect(buildPaginationTokens(1, 1)).toEqual([1]);
    expect(buildPaginationTokens(1, 5)).toEqual([1, 2, 3, 4, 5]);
    expect(buildPaginationTokens(3, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("clamps currentPage within bounds", () => {
    expect(buildPaginationTokens(-10, 8)).toEqual([1, 2, "ellipsis", 8]);
    expect(buildPaginationTokens(999, 8)).toEqual([1, "ellipsis", 7, 8]);
  });

  it("builds tokens with ellipsis for larger totals", () => {
    expect(buildPaginationTokens(1, 8)).toEqual([1, 2, "ellipsis", 8]);
    expect(buildPaginationTokens(2, 8)).toEqual([1, 2, 3, "ellipsis", 8]);
    expect(buildPaginationTokens(4, 8)).toEqual([1, "ellipsis", 3, 4, 5, "ellipsis", 8]);
    expect(buildPaginationTokens(7, 8)).toEqual([1, "ellipsis", 6, 7, 8]);
    expect(buildPaginationTokens(8, 8)).toEqual([1, "ellipsis", 7, 8]);
  });

  it("respects siblingCount option", () => {
    expect(buildPaginationTokens(10, 20, { siblingCount: 2 })).toEqual([
      1,
      "ellipsis",
      8,
      9,
      10,
      11,
      12,
      "ellipsis",
      20,
    ]);
  });
});
