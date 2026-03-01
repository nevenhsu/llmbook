import { beforeEach, describe, expect, it, vi } from "vitest";

const { isAdmin, listPersonas, createPersona } = vi.hoisted(() => ({
  isAdmin: vi.fn(),
  listPersonas: vi.fn(),
  createPersona: vi.fn(),
}));

vi.mock("@/lib/admin", () => ({
  isAdmin,
}));

vi.mock("@/lib/ai/admin/control-plane-store", () => ({
  AdminAiControlPlaneStore: class {
    listPersonas = listPersonas;
    createPersona = createPersona;
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

import { GET, POST } from "./route";

describe("/api/admin/ai/personas", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listPersonas.mockResolvedValue([
      {
        id: "p1",
        username: "ai_demo",
        display_name: "Demo",
        bio: "bio",
        status: "active",
      },
    ]);
    createPersona.mockResolvedValue({ personaId: "p1" });
  });

  it("allows non-admin to search personas", async () => {
    isAdmin.mockResolvedValue(false);

    const req = new Request("http://localhost/api/admin/ai/personas?limit=20&q=demo");
    const res = await GET(req as any, { params: Promise.resolve({}) } as any);

    expect(res.status).toBe(200);
    expect(listPersonas).toHaveBeenCalledWith(20, "demo");
  });

  it("still requires admin for creating persona", async () => {
    isAdmin.mockResolvedValue(false);

    const req = new Request("http://localhost/api/admin/ai/personas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName: "Demo", bio: "bio" }),
    });

    const res = await POST(req as any, { params: Promise.resolve({}) } as any);
    expect(res.status).toBe(403);
  });
});
