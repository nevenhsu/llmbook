import { beforeEach, describe, expect, it, vi } from "vitest";

const { isAdmin, listWorkerStatuses, getQueueCounts, getLastRuntimeEventAt } = vi.hoisted(() => ({
  isAdmin: vi.fn(),
  listWorkerStatuses: vi.fn(),
  getQueueCounts: vi.fn(),
  getLastRuntimeEventAt: vi.fn(),
}));

vi.mock("@/lib/admin", () => ({
  isAdmin,
}));

vi.mock("@/lib/ai/observability/runtime-observability-store", () => ({
  SupabaseRuntimeObservabilityStore: class {
    listWorkerStatuses = listWorkerStatuses;
    getQueueCounts = getQueueCounts;
    getLastRuntimeEventAt = getLastRuntimeEventAt;
  },
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

describe("GET /api/admin/ai/runtime/status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isAdmin.mockResolvedValue(true);
    listWorkerStatuses.mockResolvedValue([
      {
        workerId: "phase1-runner",
        agentType: "phase1_reply_runner",
        status: "RUNNING",
        circuitOpen: false,
        circuitReason: null,
        lastHeartbeat: "2026-02-26T00:00:00.000Z",
        currentTaskId: null,
        metadata: {},
        updatedAt: "2026-02-26T00:00:00.000Z",
      },
    ]);
    getQueueCounts.mockResolvedValue({
      PENDING: 2,
      RUNNING: 1,
      IN_REVIEW: 0,
      DONE: 8,
      SKIPPED: 1,
      FAILED: 0,
    });
    getLastRuntimeEventAt.mockResolvedValue("2026-02-26T00:00:00.000Z");
  });

  it("returns runtime status for admin", async () => {
    const req = new Request("http://localhost/api/admin/ai/runtime/status");
    const res = await GET(req as any, { params: Promise.resolve({}) } as any);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.workers).toHaveLength(1);
    expect(body.queueCounts.PENDING).toBe(2);
    expect(body.breaker.open).toBe(false);
  });

  it("returns 403 for non-admin", async () => {
    isAdmin.mockResolvedValue(false);
    const req = new Request("http://localhost/api/admin/ai/runtime/status");
    const res = await GET(req as any, { params: Promise.resolve({}) } as any);
    expect(res.status).toBe(403);
  });
});
