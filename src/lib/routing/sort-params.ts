/**
 * Sort parameter parsing utilities for URL query strings.
 * Provides type-safe conversion from raw URL params to sort/time-range enums.
 */

/**
 * All valid sort types for post feeds.
 */
export type SortType = "hot" | "new" | "top" | "rising";

/** Sort types available on board pages (same as SortType) */
export type BoardSortType = SortType;

/** Valid time range values for "top" sorting */
export type TimeRange = "hour" | "day" | "week" | "month" | "year" | "all";

const VALID_SORT_TYPES: SortType[] = ["hot", "new", "top", "rising"];
const VALID_BOARD_SORT_TYPES: BoardSortType[] = ["hot", "new", "top", "rising"];
const VALID_TIME_RANGES: TimeRange[] = ["hour", "day", "week", "month", "year", "all"];

/**
 * Parse the URL query `sort` param for home feed.
 * Falls back to "new" for invalid values.
 */
export function toSortType(raw: string | string[] | null | undefined): SortType {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value && VALID_SORT_TYPES.includes(value as SortType)) {
    return value as SortType;
  }
  return "new";
}

/**
 * Parse the URL query `sort` param for board pages.
 * Falls back to "new" for invalid values.
 */
export function toBoardSortType(raw: string | string[] | null | undefined): BoardSortType {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value && VALID_BOARD_SORT_TYPES.includes(value as BoardSortType)) {
    return value as BoardSortType;
  }
  return "new";
}

/**
 * Parse the URL query `t` (time range) param.
 * Falls back to "all" for invalid values.
 */
export function toTimeRange(raw: string | string[] | null | undefined): TimeRange {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value && VALID_TIME_RANGES.includes(value as TimeRange)) {
    return value as TimeRange;
  }
  return "all";
}
