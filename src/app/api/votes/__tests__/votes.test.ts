import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock must be defined before importing the route
export const mockCookieJar = new Map<string, string>();

export const mockCookieStore = {
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

// Mock the supabase server client
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

// Mock the notifications lib
vi.mock("@/lib/notifications", () => ({
  createNotification: vi.fn(),
}));

// Now import the route and dependencies
import { POST } from "../route";
import { createClient } from "@/lib/supabase/server";
import { createNotification } from "@/lib/notifications";
import { NOTIFICATION_TYPES } from "@/types/notification";

describe("POST /api/votes", () => {
  type SupabaseMock = {
    auth: {
      getUser: ReturnType<typeof vi.fn>;
    };
    from: ReturnType<typeof vi.fn>;
    select: ReturnType<typeof vi.fn>;
    insert: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    eq: ReturnType<typeof vi.fn>;
    maybeSingle: ReturnType<typeof vi.fn>;
    single: ReturnType<typeof vi.fn>;
  };

  let supabaseMock: SupabaseMock;

  beforeEach(() => {
    vi.clearAllMocks();
    mockCookieJar.clear();

    // Create fresh mock chain
    supabaseMock = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      },
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    };

    const createClientMock = createClient as unknown as {
      mockResolvedValue: (value: SupabaseMock) => void;
    };
    createClientMock.mockResolvedValue(supabaseMock);
  });

  it("returns 401 if user is not logged in", async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });

    const req = new Request("http://localhost/api/votes", {
      method: "POST",
      body: JSON.stringify({ postId: "123", value: 1 }),
    });

    const res = await POST(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe("Unauthorized");
  });

  it("returns 400 for invalid input (wrong value)", async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: "user123" } }, error: null });

    const req = new Request("http://localhost/api/votes", {
      method: "POST",
      body: JSON.stringify({ postId: "123", value: 0 }),
    });

    const res = await POST(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("Invalid input");
  });

  it("returns 400 for invalid input (missing target)", async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: "user123" } }, error: null });

    const req = new Request("http://localhost/api/votes", {
      method: "POST",
      body: JSON.stringify({ value: 1 }),
    });

    const res = await POST(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(400);
  });

  it("creates a new vote for a post", async () => {
    const userId = "user123";
    const postId = "post123";
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: userId } }, error: null });

    // First call to check existing vote returns null
    supabaseMock.maybeSingle.mockResolvedValueOnce({ data: null, error: null });

    // Board lookup for ban check
    supabaseMock.single.mockResolvedValueOnce({ data: { board_id: "board123" }, error: null });

    // Call to get post details for notification
    supabaseMock.single.mockResolvedValueOnce({
      data: { author_id: "author123", title: "Post Title" },
      error: null,
    });

    // Call to get updated score
    supabaseMock.single.mockResolvedValueOnce({ data: { score: 1 }, error: null });

    const req = new Request("http://localhost/api/votes", {
      method: "POST",
      body: JSON.stringify({ postId, value: 1 }),
    });

    const res = await POST(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.score).toBe(1);

    // Verify insert was called
    expect(supabaseMock.from).toHaveBeenCalledWith("votes");
    expect(supabaseMock.insert).toHaveBeenCalledWith({
      user_id: userId,
      post_id: postId,
      value: 1,
    });

    // Verify notification was created
    expect(createNotification).toHaveBeenCalledWith("author123", NOTIFICATION_TYPES.POST_UPVOTE, {
      postId,
      postTitle: "Post Title",
    });
  });

  it("toggles off an existing vote of the same value", async () => {
    const userId = "user123";
    const postId = "post123";
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: userId } }, error: null });

    // Existing vote with same value
    const existingVote = { id: "vote123", value: 1 };
    supabaseMock.maybeSingle.mockResolvedValueOnce({ data: existingVote, error: null });

    // Call to get updated score
    supabaseMock.single.mockResolvedValueOnce({ data: { score: 0 }, error: null });

    const req = new Request("http://localhost/api/votes", {
      method: "POST",
      body: JSON.stringify({ postId, value: 1 }),
    });

    const res = await POST(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.score).toBe(0);

    // Verify delete was called
    expect(supabaseMock.delete).toHaveBeenCalled();
    expect(supabaseMock.eq).toHaveBeenCalledWith("id", "vote123");
  });

  it("updates an existing vote with a different value (flip)", async () => {
    const userId = "user123";
    const postId = "post123";
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: userId } }, error: null });

    // Ban check should pass first
    supabaseMock.maybeSingle.mockResolvedValueOnce({ data: null, error: null });

    // Existing vote with different value
    const existingVote = { id: "vote123", value: -1 };
    supabaseMock.maybeSingle.mockResolvedValueOnce({ data: existingVote, error: null });

    // Board lookup for ban check
    supabaseMock.single.mockResolvedValueOnce({ data: { board_id: "board123" }, error: null });

    // Call to get updated score
    supabaseMock.single.mockResolvedValueOnce({ data: { score: 1 }, error: null });

    const req = new Request("http://localhost/api/votes", {
      method: "POST",
      body: JSON.stringify({ postId, value: 1 }),
    });

    const res = await POST(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.score).toBe(1);

    // Verify update was called
    expect(supabaseMock.update).toHaveBeenCalledWith({ value: 1 });
    expect(supabaseMock.eq).toHaveBeenCalledWith("id", "vote123");
  });

  it("regression: handles comment votes correctly", async () => {
    const userId = "user123";
    const commentId = "comment123";
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: userId } }, error: null });

    supabaseMock.maybeSingle.mockResolvedValueOnce({ data: null, error: null });

    // Lookup comment post_id for ban check
    supabaseMock.single.mockResolvedValueOnce({ data: { post_id: "post123" }, error: null });

    // Lookup board_id for ban check
    supabaseMock.single.mockResolvedValueOnce({ data: { board_id: "board123" }, error: null });

    // Comment details for notification
    supabaseMock.single.mockResolvedValueOnce({
      data: { author_id: "author123", post_id: "post123" },
      error: null,
    });

    // Updated score
    supabaseMock.single.mockResolvedValueOnce({ data: { score: 1 }, error: null });

    const req = new Request("http://localhost/api/votes", {
      method: "POST",
      body: JSON.stringify({ commentId, value: 1 }),
    });

    const res = await POST(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.score).toBe(1);

    expect(supabaseMock.insert).toHaveBeenCalledWith({
      user_id: userId,
      comment_id: commentId,
      value: 1,
    });

    expect(createNotification).toHaveBeenCalledWith(
      "author123",
      NOTIFICATION_TYPES.COMMENT_UPVOTE,
      {
        postId: "post123",
        commentId,
      },
    );
  });
});
