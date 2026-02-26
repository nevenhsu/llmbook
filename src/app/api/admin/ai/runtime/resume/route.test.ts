import { beforeEach, describe, expect, it, vi } from "vitest";

const { isAdmin, tryResumeWorkerCircuit, runtimeEventRecord } = vi.hoisted(() => ({
  isAdmin: vi.fn(),
  tryResumeWorkerCircuit: vi.fn(),
  runtimeEventRecord: vi.fn(),
}));

vi.mock("@/lib/admin", () => ({
  isAdmin,
}));

vi.mock("@/lib/ai/observability/runtime-observability-store", () => ({
  SupabaseRuntimeObservabilityStore: class {
    tryResumeWorkerCircuit = tryResumeWorkerCircuit;
  },
}));

vi.mock("@/lib/ai/observability/runtime-event-sink", () => ({
  SupabaseRuntimeEventSink: class {
    record = runtimeEventRecord;
  },
}));

vi.mock("@/lib/server/route-helpers", () => ({
  withAuth: (handler: any) => (req: Request) =>
    handler(req, { user: { id: "admin-1" }, supabase: {} }, { params: Promise.resolve({}) }),
  parseJsonBody: async (req: Request) => req.json(),
  http: {
    ok: (data: unknown) => Response.json(data, { status: 200 }),
    forbidden: (message = "Forbidden") => Response.json({ error: message }, { status: 403 }),
    badRequest: (message = "Bad request") => Response.json({ error: message }, { status: 400 }),
  },
}));

import { POST } from "./route";

describe("POST /api/admin/ai/runtime/resume", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isAdmin.mockResolvedValue(true);
    tryResumeWorkerCircuit.mockResolvedValue(undefined);
    runtimeEventRecord.mockResolvedValue(undefined);
  });

  it("requests circuit resume", async () => {
    const req = new Request("http://localhost/api/admin/ai/runtime/resume", {
      method: "POST",
      body: JSON.stringify({ workerId: "phase1-runner" }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req as any, { params: Promise.resolve({}) } as any);
    expect(res.status).toBe(200);
    expect(tryResumeWorkerCircuit).toHaveBeenCalled();
    expect(runtimeEventRecord).toHaveBeenCalled();
  });

  it("returns 400 when workerId missing", async () => {
    const req = new Request("http://localhost/api/admin/ai/runtime/resume", {
      method: "POST",
      body: JSON.stringify({}),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req as any, { params: Promise.resolve({}) } as any);
    expect(res.status).toBe(400);
  });
});
