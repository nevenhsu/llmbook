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
  withAdminAuth: (handler: any) => async (req: Request, routeContext?: any) => {
    const user = { id: "user-1" };
    if (!(await isAdmin(user.id))) {
      return Response.json({ error: "Forbidden - Admin access required" }, { status: 403 });
    }
    return handler(req, { user, supabase: {} }, routeContext ?? { params: Promise.resolve({}) });
  },
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

  it("passes the canonical persona generation payload to createPersona", async () => {
    isAdmin.mockResolvedValue(true);

    const req = new Request("http://localhost/api/admin/ai/personas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "ai_critic",
        persona: {
          display_name: "AI Critic",
          bio: "Sharp but fair.",
          status: "active",
        },
        personaCore: {
          identity_summary: { archetype: "critic" },
          voice_fingerprint: {
            opening_move: "Lead with suspicion, not neutral setup.",
            metaphor_domains: ["crime scene", "launch event"],
            attack_style: "sarcastic and evidence-oriented",
            praise_style: "grudging respect only after proof",
            closing_move: "Land a sting or reluctant concession.",
            forbidden_shapes: ["balanced explainer"],
          },
          task_style_matrix: {
            post: {
              entry_shape: "Plant the angle early.",
              body_shape: "Column-style argument, not tutorial.",
              close_shape: "End with a sting or reluctant concession.",
              forbidden_shapes: ["newsletter tone"],
            },
            comment: {
              entry_shape: "Sound like a live thread reply.",
              feedback_shape: "reaction -> suspicion -> concrete note -> grudging respect",
              close_shape: "Keep the close short and thread-native.",
              forbidden_shapes: ["sectioned critique"],
            },
          },
        },
        referenceSources: [
          {
            name: "Kotaro Isaka",
            type: "creator",
            contribution: ["calm structural payoff"],
          },
        ],
        otherReferenceSources: [
          {
            name: "crime-scene framing",
            type: "concept",
            contribution: ["Suspicion-first structural framing."],
          },
        ],
        referenceDerivation: ["Uses the reference for structure, not imitation."],
        originalizationNote: "Original persona.",
        personaMemories: [
          {
            memoryType: "long_memory",
            scope: "persona",
            content: "Prefers specific critique.",
            metadata: { memoryCategory: "knowledge" },
            expiresAt: null,
            importance: 9,
          },
        ],
      }),
    });

    const res = await POST(req as any, { params: Promise.resolve({}) } as any);
    expect(res.status).toBe(201);
    expect(createPersona).toHaveBeenCalledWith({
      username: "ai_critic",
      persona: {
        display_name: "AI Critic",
        bio: "Sharp but fair.",
        status: "active",
      },
      personaCore: {
        identity_summary: { archetype: "critic" },
        voice_fingerprint: {
          opening_move: "Lead with suspicion, not neutral setup.",
          metaphor_domains: ["crime scene", "launch event"],
          attack_style: "sarcastic and evidence-oriented",
          praise_style: "grudging respect only after proof",
          closing_move: "Land a sting or reluctant concession.",
          forbidden_shapes: ["balanced explainer"],
        },
        task_style_matrix: {
          post: {
            entry_shape: "Plant the angle early.",
            body_shape: "Column-style argument, not tutorial.",
            close_shape: "End with a sting or reluctant concession.",
            forbidden_shapes: ["newsletter tone"],
          },
          comment: {
            entry_shape: "Sound like a live thread reply.",
            feedback_shape: "reaction -> suspicion -> concrete note -> grudging respect",
            close_shape: "Keep the close short and thread-native.",
            forbidden_shapes: ["sectioned critique"],
          },
        },
      },
      referenceSources: [
        {
          name: "Kotaro Isaka",
          type: "creator",
          contribution: ["calm structural payoff"],
        },
      ],
      otherReferenceSources: [
        {
          name: "crime-scene framing",
          type: "concept",
          contribution: ["Suspicion-first structural framing."],
        },
      ],
      referenceDerivation: ["Uses the reference for structure, not imitation."],
      originalizationNote: "Original persona.",
    });
    expect(createPersona.mock.calls[0]?.[0]).not.toHaveProperty("personaMemories");
  });
});
