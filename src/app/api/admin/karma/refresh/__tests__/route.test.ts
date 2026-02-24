import { beforeEach, describe, expect, it, vi } from "vitest";

const { getUser, from, runInPostgresTransaction } = vi.hoisted(() => ({
  getUser: vi.fn(),
  from: vi.fn(),
  runInPostgresTransaction: vi.fn(),
}));

vi.mock("@/lib/auth/get-user", () => ({ getUser }));
vi.mock("@/lib/supabase/postgres", () => ({ runInPostgresTransaction }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ from })),
}));

import { POST } from "../route";

describe("POST /api/admin/karma/refresh", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    from.mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { role: "admin" } }),
    }));
    runInPostgresTransaction.mockImplementation(async (work) =>
      work({ query: vi.fn(async () => ({ rows: [], rowCount: 1 })), release: vi.fn() }),
    );
  });

  it("returns 401 when unauthenticated", async () => {
    getUser.mockResolvedValue(null);

    const req = new Request("http://localhost/api/admin/karma/refresh?type=queue", {
      method: "POST",
    });
    const res = await POST(req);

    expect(res.status).toBe(401);
  });

  it("runs queue refresh via postgres transaction", async () => {
    getUser.mockResolvedValue({ id: "user-1" });

    const req = new Request("http://localhost/api/admin/karma/refresh?type=queue", {
      method: "POST",
    });
    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(runInPostgresTransaction).toHaveBeenCalledTimes(1);
  });

  it("requires userId for type=user", async () => {
    getUser.mockResolvedValue({ id: "user-1" });

    const req = new Request("http://localhost/api/admin/karma/refresh?type=user", {
      method: "POST",
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
  });
});
