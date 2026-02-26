import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReviewQueueItem } from "@/lib/ai/review-queue/review-queue";

const { isAdmin, expireDue, list, consumeWarnings, collectMetrics } = vi.hoisted(() => ({
  isAdmin: vi.fn(),
  expireDue: vi.fn(),
  list: vi.fn(),
  consumeWarnings: vi.fn(),
  collectMetrics: vi.fn(),
}));

vi.mock("@/lib/admin", () => ({
  isAdmin,
}));

vi.mock("@/lib/ai/review-queue", () => ({
  createSupabaseReviewQueue: () => ({
    expireDue,
    list,
    consumeWarnings,
  }),
}));

vi.mock("@/lib/ai/observability/review-queue-metrics", () => ({
  collectReviewQueueMetrics: collectMetrics,
}));

vi.mock("@/lib/server/route-helpers", () => ({
  withAuth: (handler: any) => (req: Request) =>
    handler(req, { user: { id: "admin-1" }, supabase: {} }, { params: Promise.resolve({}) }),
  http: {
    ok: (data: unknown) => Response.json(data, { status: 200 }),
    forbidden: (message = "Forbidden") => Response.json({ error: message }, { status: 403 }),
    badRequest: (message = "Bad request") => Response.json({ error: message }, { status: 400 }),
  },
}));

import { GET } from "./route";

const BASE_METRICS = {
  windowHours: 24,
  resolvedTotal: 0,
  expiredCount: 0,
  expiredRatio: 0,
  avgExpiredWaitMs: null,
  pendingCount: 2,
};

function createItem(id: string, createdAt: string): ReviewQueueItem {
  const time = new Date(createdAt);
  return {
    id,
    taskId: `task-${id}`,
    personaId: `persona-${id}`,
    riskLevel: "HIGH",
    status: "PENDING",
    enqueueReasonCode: "safety_block",
    expiresAt: new Date("2026-01-01T00:00:00.000Z"),
    createdAt: time,
    updatedAt: time,
    metadata: {},
  };
}

describe("GET /api/admin/ai/review-queue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isAdmin.mockResolvedValue(true);
    expireDue.mockResolvedValue(undefined);
    consumeWarnings.mockReturnValue([]);
    collectMetrics.mockResolvedValue(BASE_METRICS);
  });

  it("returns 403 for non-admin", async () => {
    isAdmin.mockResolvedValue(false);

    const req = new Request("http://localhost/api/admin/ai/review-queue");
    const res = await GET(req as any, { params: Promise.resolve({}) } as any);

    expect(res.status).toBe(403);
  });

  it("returns 400 for invalid cursor", async () => {
    const req = new Request("http://localhost/api/admin/ai/review-queue?cursor=not-a-date");
    const res = await GET(req as any, { params: Promise.resolve({}) } as any);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Invalid cursor");
    expect(list).not.toHaveBeenCalled();
  });

  it("uses cursor pagination and returns nextCursor when hasMore", async () => {
    list.mockResolvedValue([
      createItem("r1", "2026-01-03T10:00:00.000Z"),
      createItem("r2", "2026-01-03T09:00:00.000Z"),
      createItem("r3", "2026-01-03T08:00:00.000Z"),
    ]);

    const req = new Request(
      "http://localhost/api/admin/ai/review-queue?status=PENDING,IN_REVIEW&limit=2&cursor=2026-01-04T00:00:00.000Z",
    );
    const res = await GET(req as any, { params: Promise.resolve({}) } as any);

    expect(res.status).toBe(200);
    expect(expireDue).toHaveBeenCalledTimes(1);
    expect(list).toHaveBeenCalledWith({
      statuses: ["PENDING", "IN_REVIEW"],
      limit: 3,
      cursor: new Date("2026-01-04T00:00:00.000Z"),
    });

    const body = await res.json();
    expect(body.items).toHaveLength(2);
    expect(body.pagination).toEqual({
      limit: 2,
      cursor: "2026-01-04T00:00:00.000Z",
      hasMore: true,
      nextCursor: "2026-01-03T09:00:00.000Z",
    });
  });
});
