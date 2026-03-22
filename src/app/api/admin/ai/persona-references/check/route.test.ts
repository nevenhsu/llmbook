import { beforeEach, describe, expect, it, vi } from "vitest";

const { isAdmin, checkPersonaReferenceSources } = vi.hoisted(() => ({
  isAdmin: vi.fn(),
  checkPersonaReferenceSources: vi.fn(),
}));

vi.mock("@/lib/admin", () => ({
  isAdmin,
}));

vi.mock("@/lib/ai/admin/control-plane-store", () => ({
  AdminAiControlPlaneStore: class {
    checkPersonaReferenceSources = checkPersonaReferenceSources;
  },
}));

vi.mock("@/lib/server/route-helpers", () => ({
  withAuth: (handler: any) => (req: Request) =>
    handler(req, { user: { id: "user-1" }, supabase: {} }, { params: Promise.resolve({}) }),
  http: {
    ok: (data: unknown) => Response.json(data, { status: 200 }),
    created: (data: unknown) => Response.json(data, { status: 201 }),
    forbidden: (message = "Forbidden") => Response.json({ error: message }, { status: 403 }),
    badRequest: (message = "Bad request") => Response.json({ error: message }, { status: 400 }),
  },
}));

import { POST } from "./route";

describe("POST /api/admin/ai/persona-references/check", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    checkPersonaReferenceSources.mockResolvedValue([
      {
        input: "Anthony Bourdain",
        matchKey: "anthonybourdain",
        romanizedName: "Anthony Bourdain",
        exists: true,
      },
      {
        input: "New Reference",
        matchKey: "newreference",
        romanizedName: "New Reference",
        exists: false,
      },
    ]);
  });

  it("requires admin access", async () => {
    isAdmin.mockResolvedValue(false);

    const req = new Request("http://localhost/api/admin/ai/persona-references/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ names: ["Anthony Bourdain"] }),
    });

    const res = await POST(req as any, { params: Promise.resolve({}) } as any);
    expect(res.status).toBe(403);
  });

  it("validates the names payload and passes it to the store", async () => {
    isAdmin.mockResolvedValue(true);

    const req = new Request("http://localhost/api/admin/ai/persona-references/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ names: ["Anthony Bourdain", "New Reference"] }),
    });

    const res = await POST(req as any, { params: Promise.resolve({}) } as any);

    expect(res.status).toBe(200);
    expect(checkPersonaReferenceSources).toHaveBeenCalledWith([
      "Anthony Bourdain",
      "New Reference",
    ]);
    await expect(res.json()).resolves.toEqual({
      items: [
        {
          input: "Anthony Bourdain",
          matchKey: "anthonybourdain",
          romanizedName: "Anthony Bourdain",
          exists: true,
        },
        {
          input: "New Reference",
          matchKey: "newreference",
          romanizedName: "New Reference",
          exists: false,
        },
      ],
    });
  });

  it("rejects empty or oversized name lists", async () => {
    isAdmin.mockResolvedValue(true);

    const emptyReq = new Request("http://localhost/api/admin/ai/persona-references/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ names: [] }),
    });
    const emptyRes = await POST(emptyReq as any, { params: Promise.resolve({}) } as any);
    expect(emptyRes.status).toBe(400);

    const tooManyReq = new Request("http://localhost/api/admin/ai/persona-references/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ names: Array.from({ length: 51 }, (_, index) => `name-${index}`) }),
    });
    const tooManyRes = await POST(tooManyReq as any, { params: Promise.resolve({}) } as any);
    expect(tooManyRes.status).toBe(400);
  });
});
