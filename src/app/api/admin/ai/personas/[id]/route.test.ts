import { beforeEach, describe, expect, it, vi } from "vitest";

const { isAdmin, getPersonaProfile, patchPersonaProfile } = vi.hoisted(() => ({
  isAdmin: vi.fn(),
  getPersonaProfile: vi.fn(),
  patchPersonaProfile: vi.fn(),
}));

vi.mock("@/lib/admin", () => ({
  isAdmin,
}));

vi.mock("@/lib/ai/admin/control-plane-store", () => ({
  AdminAiControlPlaneStore: class {
    getPersonaProfile = getPersonaProfile;
    patchPersonaProfile = patchPersonaProfile;
  },
}));

vi.mock("@/lib/server/route-helpers", () => ({
  withAuth: (handler: any) => (req: Request, ctx: any) =>
    handler(req, { user: { id: "admin-1" }, supabase: {} }, ctx),
  http: {
    ok: (data: unknown) => Response.json(data, { status: 200 }),
    badRequest: (message = "Bad request") => Response.json({ error: message }, { status: 400 }),
    forbidden: (message = "Forbidden") => Response.json({ error: message }, { status: 403 }),
  },
}));

import { GET, PATCH } from "./route";

describe("/api/admin/ai/personas/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isAdmin.mockResolvedValue(true);
    getPersonaProfile.mockResolvedValue({
      persona: {
        id: "persona-1",
        username: "ai_critic",
        display_name: "AI Critic",
        bio: "Sharp but fair.",
        status: "active",
      },
      personaCore: {
        identity_summary: { archetype: "critic" },
      },
      personaMemories: [],
    });
    patchPersonaProfile.mockResolvedValue(undefined);
  });

  it("returns the canonical persona profile shape", async () => {
    const res = await GET(
      new Request("http://localhost/api/admin/ai/personas/persona-1") as any,
      { params: Promise.resolve({ id: "persona-1" }) } as any,
    );

    expect(res.status).toBe(200);
    expect(getPersonaProfile).toHaveBeenCalledWith("persona-1");
  });

  it("passes personaCore through patchPersonaProfile", async () => {
    const req = new Request("http://localhost/api/admin/ai/personas/persona-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "ai_critic_v2",
        bio: "Sharper and still fair.",
        personaCore: {
          identity_summary: { archetype: "sharper critic" },
        },
        longMemory: "Still dislikes vague praise.",
      }),
    });

    const res = await PATCH(req as any, { params: Promise.resolve({ id: "persona-1" }) } as any);
    expect(res.status).toBe(200);
    expect(patchPersonaProfile).toHaveBeenCalledWith({
      personaId: "persona-1",
      username: "ai_critic_v2",
      bio: "Sharper and still fair.",
      personaCore: {
        identity_summary: { archetype: "sharper critic" },
      },
      longMemory: "Still dislikes vague praise.",
    });
  });
});
