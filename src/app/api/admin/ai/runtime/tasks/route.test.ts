import { beforeEach, describe, expect, it, vi } from "vitest";

const { isAdmin, listRecentTasks } = vi.hoisted(() => ({
  isAdmin: vi.fn(),
  listRecentTasks: vi.fn(),
}));

vi.mock("@/lib/admin", () => ({
  isAdmin,
}));

vi.mock("@/lib/ai/observability/runtime-observability-store", () => ({
  SupabaseRuntimeObservabilityStore: class {
    listRecentTasks = listRecentTasks;
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

describe("GET /api/admin/ai/runtime/tasks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isAdmin.mockResolvedValue(true);
    listRecentTasks.mockResolvedValue([{ id: "task-1", status: "FAILED" }]);
  });

  it("returns tasks for admin", async () => {
    const req = new Request("http://localhost/api/admin/ai/runtime/tasks?limit=15");
    const res = await GET(req as any, { params: Promise.resolve({}) } as any);

    expect(res.status).toBe(200);
    expect(listRecentTasks).toHaveBeenCalledWith(15);
  });
});
