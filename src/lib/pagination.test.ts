import { describe, it, expect } from "vitest";
import {
  buildPostsQueryParams,
  getNextCursor,
  calculateHasMore,
  getPaginationMode,
  createInitialPaginationState,
  updatePaginationState,
} from "./pagination";

describe("buildPostsQueryParams", () => {
  it("builds params with all options", () => {
    const params = buildPostsQueryParams({
      board: "test-board",
      sort: "hot",
      timeRange: "week",
      limit: 50,
      offset: 20,
    });

    expect(params.get("board")).toBe("test-board");
    expect(params.get("sort")).toBe("hot");
    expect(params.get("t")).toBe("week");
    expect(params.get("limit")).toBe("50");
    expect(params.get("cursor")).toBe("20");
  });

  it("prefers cursor over offset when both provided", () => {
    const params = buildPostsQueryParams({
      cursor: "2024-01-15T00:00:00.000Z",
      offset: 10,
    });

    expect(params.get("cursor")).toBe("2024-01-15T00:00:00.000Z");
  });

  it("builds tag feed params", () => {
    const params = buildPostsQueryParams({
      tag: "javascript",
      sort: "new",
      limit: 20,
      cursor: "2024-01-15T00:00:00.000Z",
    });

    expect(params.get("tag")).toBe("javascript");
    expect(params.get("cursor")).toBe("2024-01-15T00:00:00.000Z");
    expect(params.get("sort")).toBe("new");
  });

  it("includes includeArchived when true", () => {
    const params = buildPostsQueryParams({
      includeArchived: true,
    });

    expect(params.get("includeArchived")).toBe("true");
  });

  it("omits includeArchived when false", () => {
    const params = buildPostsQueryParams({
      includeArchived: false,
    });

    expect(params.has("includeArchived")).toBe(false);
  });
});

describe("getNextCursor", () => {
  it("returns created_at of last item", () => {
    const items = [
      { id: "1", created_at: "2024-01-15T10:00:00.000Z" },
      { id: "2", created_at: "2024-01-14T10:00:00.000Z" },
    ];

    expect(getNextCursor(items)).toBe("2024-01-14T10:00:00.000Z");
  });

  it("returns undefined for empty array", () => {
    expect(getNextCursor([])).toBeUndefined();
  });

  it("handles single item", () => {
    const items = [{ id: "1", created_at: "2024-01-15T10:00:00.000Z" }];
    expect(getNextCursor(items)).toBe("2024-01-15T10:00:00.000Z");
  });
});

describe("calculateHasMore", () => {
  it("returns true when items count equals limit", () => {
    const items = new Array(20).fill(null);
    expect(calculateHasMore(items, 20)).toBe(true);
  });

  it("returns true when items count exceeds limit", () => {
    const items = new Array(25).fill(null);
    expect(calculateHasMore(items, 20)).toBe(true);
  });

  it("returns false when items count less than limit", () => {
    const items = new Array(19).fill(null);
    expect(calculateHasMore(items, 20)).toBe(false);
  });

  it("returns false for empty array", () => {
    expect(calculateHasMore([], 20)).toBe(false);
  });
});

describe("getPaginationMode", () => {
  it("returns cursor for tag feeds regardless of sort", () => {
    expect(getPaginationMode("hot", true)).toBe("cursor");
    expect(getPaginationMode("new", true)).toBe("cursor");
    expect(getPaginationMode("top", true)).toBe("cursor");
  });

  it("returns offset for hot sort", () => {
    expect(getPaginationMode("hot", false)).toBe("offset");
  });

  it("returns offset for rising sort", () => {
    expect(getPaginationMode("rising", false)).toBe("offset");
  });

  it("returns cursor for new sort", () => {
    expect(getPaginationMode("new", false)).toBe("cursor");
  });

  it("returns cursor for top sort", () => {
    expect(getPaginationMode("top", false)).toBe("cursor");
  });
});

describe("createInitialPaginationState", () => {
  it("creates state with hasMore=true when items >= limit", () => {
    const items = new Array(20).fill(null);
    const state = createInitialPaginationState(items, 20);

    expect(state.page).toBe(1);
    expect(state.hasMore).toBe(true);
    expect(state.isLoading).toBe(false);
    expect(state.cursor).toBeUndefined();
  });

  it("creates state with hasMore=false when items < limit", () => {
    const items = new Array(10).fill(null);
    const state = createInitialPaginationState(items, 20);

    expect(state.hasMore).toBe(false);
  });
});

describe("updatePaginationState", () => {
  it("updates page for offset mode", () => {
    const initialState = {
      page: 1,
      hasMore: true,
      isLoading: true,
    };

    const newItems = new Array(20).fill({ created_at: "2024-01-15T00:00:00.000Z" });
    const state = updatePaginationState(initialState, newItems, 20, "offset");

    expect(state.page).toBe(2);
    expect(state.isLoading).toBe(false);
    expect(state.hasMore).toBe(true);
  });

  it("updates cursor for cursor mode", () => {
    const initialState = {
      page: 1,
      hasMore: true,
      isLoading: true,
    };

    const newItems = [
      { id: "1", created_at: "2024-01-15T10:00:00.000Z" },
      { id: "2", created_at: "2024-01-14T10:00:00.000Z" },
    ];
    const state = updatePaginationState(initialState, newItems, 20, "cursor");

    expect(state.cursor).toBe("2024-01-14T10:00:00.000Z");
    expect(state.page).toBe(1); // page unchanged in cursor mode
    expect(state.isLoading).toBe(false);
  });

  it("sets hasMore=false when fewer items than limit", () => {
    const initialState = {
      page: 1,
      hasMore: true,
      isLoading: true,
    };

    const newItems = new Array(15).fill({ created_at: "2024-01-15T00:00:00.000Z" });
    const state = updatePaginationState(initialState, newItems, 20, "offset");

    expect(state.hasMore).toBe(false);
  });
});
