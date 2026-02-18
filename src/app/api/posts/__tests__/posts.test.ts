import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock must be defined before importing the route
const mockCookieJar = new Map<string, string>();

const mockCookieStore = {
  get: vi.fn((name: string) => {
    const value = mockCookieJar.get(name);
    return value ? { name, value } : undefined;
  }),
  getAll: vi.fn(() => Array.from(mockCookieJar, ([name, value]) => ({ name, value }))),
  set: vi.fn((name: string, value: string) => {
    mockCookieJar.set(name, value);
  }),
  delete: vi.fn((name: string) => {
    mockCookieJar.delete(name);
  }),
};

vi.mock("next/headers", () => ({
  cookies: vi.fn(() => mockCookieStore),
}));

// Mock ranking
vi.mock("@/lib/ranking", () => ({
  getTimeRangeDate: vi.fn(() => new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
  getHotPostsFromCache: vi.fn(),
  getRisingPostsFromCache: vi.fn(),
}));

// Mock admin
vi.mock("@/lib/admin", () => ({
  isAdmin: vi.fn(() => Promise.resolve(false)),
}));

// Mock board-permissions
vi.mock("@/lib/board-permissions", () => ({
  canManageBoard: vi.fn(() => Promise.resolve(false)),
  canPostInBoard: vi.fn(() => Promise.resolve(true)),
  isUserBanned: vi.fn(() => Promise.resolve(false)),
}));

// Create mock functions before defining the mock
const mockAuthGetUser = vi.fn();
const mockFrom = vi.fn();

// Mock the supabase server client - must be before importing route
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: mockAuthGetUser,
    },
    from: mockFrom,
  })),
}));

// Now import the route and dependencies
import { GET, POST } from "../route";
import { getHotPostsFromCache, getRisingPostsFromCache } from "@/lib/ranking";

describe("GET /api/posts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCookieJar.clear();

    // Setup default mock responses
    mockAuthGetUser.mockResolvedValue({ data: { user: null }, error: null });

    // Chainable mock for from().select()...
    const chainableMock = {
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      then: vi.fn(
        (
          callback: (value: { data: unknown[]; error: null }) => unknown,
        ) => Promise.resolve(callback({ data: [], error: null })),
      ),
    };

    mockFrom.mockImplementation((table: string) => {
      if (table === "hidden_posts") {
        return {
          ...chainableMock,
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({ data: [], error: null }),
        };
      }
      return chainableMock;
    });
  });

  it("returns empty array for invalid board", async () => {
    // boards query returns null
    mockFrom.mockImplementation((table: string) => {
      if (table === "boards") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      };
    });

    const req = new Request("http://localhost/api/posts?board=nonexistent");
    const res = await GET(req);

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual({ items: [], hasMore: false });
  });

  it("returns empty array for invalid tag", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "tags") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      };
    });

    const req = new Request("http://localhost/api/posts?tag=nonexistent");
    const res = await GET(req);

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual({ items: [], hasMore: false });
  });

  it("uses cached rankings for hot sort", async () => {
    const cachedPosts = [
      { id: "post1", title: "Post 1", score: 100 },
      { id: "post2", title: "Post 2", score: 90 },
    ];

    const getHotPostsFromCacheMock = getHotPostsFromCache as unknown as {
      mockResolvedValue: (value: unknown) => void;
    };
    getHotPostsFromCacheMock.mockResolvedValue({
      posts: cachedPosts,
      error: null,
    });

    const req = new Request("http://localhost/api/posts?sort=hot");
    const res = await GET(req);

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.items)).toBe(true);
    expect(data.items).toHaveLength(2);
    expect(data.items[0]).toEqual(
      expect.objectContaining({
        id: "post1",
        title: "Post 1",
        score: 100,
        tags: [],
      }),
    );
    expect(data.items[1]).toEqual(
      expect.objectContaining({
        id: "post2",
        title: "Post 2",
        score: 90,
        tags: [],
      }),
    );
    expect(res.headers.get("X-Cache-Hit")).toBe("1");

    expect(getHotPostsFromCache).toHaveBeenCalledWith(expect.any(Object), {
      boardId: undefined,
      limit: 21,
      offset: 0,
    });
  });
});

describe("POST /api/posts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCookieJar.clear();

    mockAuthGetUser.mockResolvedValue({ data: { user: null }, error: null });
  });

  it("returns 401 if user is not logged in", async () => {
    const req = new Request("http://localhost/api/posts", {
      method: "POST",
      body: JSON.stringify({ title: "Test", body: "Body", boardId: "board123" }),
    });

    const res = await POST(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(401);
  });
});
