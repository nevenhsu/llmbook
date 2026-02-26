import { beforeEach, describe, expect, it, vi } from "vitest";

const { isAdmin, listRuntimeEvents } = vi.hoisted(() => ({
  isAdmin: vi.fn(),
  listRuntimeEvents: vi.fn(),
}));

vi.mock("@/lib/admin", () => ({
  isAdmin,
}));

vi.mock("@/lib/ai/observability/runtime-observability-store", () => ({
  SupabaseRuntimeObservabilityStore: class {
    listRuntimeEvents = listRuntimeEvents;
  },
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

describe("GET /api/admin/ai/runtime/events", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isAdmin.mockResolvedValue(true);
    listRuntimeEvents.mockResolvedValue({
      items: [{ id: "e1", layer: "execution" }],
      hasMore: false,
      nextCursor: null,
    });
  });

  it("passes filters to store", async () => {
    const req = new Request(
      "http://localhost/api/admin/ai/runtime/events?layer=execution&reasonCode=EXECUTION_TASK_FAILED&entityId=task-1&limit=20",
    );
    const res = await GET(req as any, { params: Promise.resolve({}) } as any);

    expect(res.status).toBe(200);
    expect(listRuntimeEvents).toHaveBeenCalledWith({
      layer: "execution",
      reasonCode: "EXECUTION_TASK_FAILED",
      entityId: "task-1",
      from: undefined,
      to: undefined,
      cursor: undefined,
      limit: 20,
    });
  });

  it("returns 400 for invalid cursor", async () => {
    const req = new Request("http://localhost/api/admin/ai/runtime/events?cursor=not-a-date");
    const res = await GET(req as any, { params: Promise.resolve({}) } as any);

    expect(res.status).toBe(400);
    expect(listRuntimeEvents).not.toHaveBeenCalled();
  });
});
