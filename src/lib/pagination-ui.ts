export type PaginationToken = number | "ellipsis";

type BuildPaginationTokensOptions = {
  /** Max numeric page buttons to show (including first/last) before using ellipsis. */
  maxButtons?: number;
  /** How many pages to show around the current page. */
  siblingCount?: number;
};

/**
 * Build a compact pagination token list like:
 * [1, "ellipsis", 4, 5, 6, "ellipsis", 20]
 */
export function buildPaginationTokens(
  currentPage: number,
  totalPages: number,
  { maxButtons = 7, siblingCount = 1 }: BuildPaginationTokensOptions = {},
): PaginationToken[] {
  const safeTotal = Math.max(1, Math.floor(totalPages));
  const safeCurrent = Math.max(1, Math.min(Math.floor(currentPage), safeTotal));

  if (safeTotal <= maxButtons) {
    return Array.from({ length: safeTotal }, (_, i) => i + 1);
  }

  const tokens: PaginationToken[] = [];
  const first = 1;
  const last = safeTotal;

  const start = Math.max(2, safeCurrent - siblingCount);
  const end = Math.min(last - 1, safeCurrent + siblingCount);

  tokens.push(first);

  if (start > 2) {
    tokens.push("ellipsis");
  }

  for (let p = start; p <= end; p += 1) {
    tokens.push(p);
  }

  if (end < last - 1) {
    tokens.push("ellipsis");
  }

  tokens.push(last);
  return tokens;
}
