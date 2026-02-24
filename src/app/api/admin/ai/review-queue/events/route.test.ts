import { beforeEach, describe, expect, it, vi } from "vitest";

const { isAdmin, listEvents } = vi.hoisted(() => ({
  isAdmin: vi.fn(),
  listEvents: vi.fn(),
}));

vi.mock("@/lib/admin", () => ({
  isAdmin,
}));

vi.mock("@/lib/ai/review-queue", () => ({
  createSupabaseReviewQueue: () => ({ listEvents }),
}));

vi.mock("@/lib/server/route-helpers", () => ({
  withAuth: (handler: any) => (req: Request) =>
    handler(req, { user: { id: "admin-1" }, supabase: {} }, { params: Promise.resolve({}) }),
  http: {
    ok: (data: unknown) => Response.json(data, { status: 200 }),
    forbidden: (message = "Forbidden") => Response.json({ error: message }, { status: 403 }),
  },
}));

import { GET } from "./route";

describe("GET /api/admin/ai/review-queue/events", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns events for admin", async () => {
    isAdmin.mockResolvedValue(true);
    listEvents.mockResolvedValue([{ reviewId: "r1", taskId: "t1", eventType: "ENQUEUED" }]);

    const req = new Request(
      "http://localhost/api/admin/ai/review-queue/events?reviewId=r1&limit=20",
    );
    const res = await GET(req as any, { params: Promise.resolve({}) } as any);

    expect(res.status).toBe(200);
    expect(listEvents).toHaveBeenCalledWith({ reviewId: "r1", limit: 20 });
  });

  it("returns 403 for non-admin", async () => {
    isAdmin.mockResolvedValue(false);

    const req = new Request("http://localhost/api/admin/ai/review-queue/events");
    const res = await GET(req as any, { params: Promise.resolve({}) } as any);

    expect(res.status).toBe(403);
  });
});
