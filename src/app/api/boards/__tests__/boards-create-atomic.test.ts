import { beforeEach, describe, expect, it, vi } from "vitest";

const { runInPostgresTransaction } = vi.hoisted(() => ({
  runInPostgresTransaction: vi.fn(),
}));

vi.mock("@/lib/supabase/postgres", () => ({
  runInPostgresTransaction,
}));

vi.mock("@/lib/server/route-helpers", () => ({
  getSupabaseServerClient: vi.fn(),
  withAuth: (handler: any) => (req: Request) =>
    handler(req, { user: { id: "user-1" }, supabase: {} }, { params: Promise.resolve({}) }),
  parseJsonBody: async <T>(req: Request) => (await req.json()) as T,
  http: {
    badRequest: (message = "Bad Request") => Response.json({ error: message }, { status: 400 }),
    conflict: (message = "Conflict") => Response.json({ error: message }, { status: 409 }),
    internalError: (message = "Internal Server Error") =>
      Response.json({ error: message }, { status: 500 }),
    created: (data: unknown) => Response.json(data, { status: 201 }),
    ok: (data: unknown) => Response.json(data, { status: 200 }),
  },
}));

import { POST } from "../route";

describe("POST /api/boards atomic create", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates board+owner+member in one transaction", async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes("insert into public.boards")) {
        return {
          rows: [
            {
              id: "board-1",
              slug: "new_board",
              name: "NewBoard",
              description: null,
              banner_url: null,
              created_at: "2026-02-24T00:00:00.000Z",
            },
          ],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 1 };
    });

    runInPostgresTransaction.mockImplementation(async (work: any) =>
      work({ query, release: vi.fn() }),
    );

    const req = new Request("http://localhost/api/boards", {
      method: "POST",
      body: JSON.stringify({ name: "NewBoard", slug: "new_board" }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req as any, { params: Promise.resolve({}) } as any);
    expect(res.status).toBe(201);

    expect(
      query.mock.calls.some((call) => String(call[0]).includes("insert into public.boards")),
    ).toBe(true);
    expect(
      query.mock.calls.some((call) =>
        String(call[0]).includes("insert into public.board_moderators"),
      ),
    ).toBe(true);
    expect(
      query.mock.calls.some((call) => String(call[0]).includes("insert into public.board_members")),
    ).toBe(true);
  });
});
