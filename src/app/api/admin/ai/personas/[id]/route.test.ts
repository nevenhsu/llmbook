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
        displayName: "AI Critic Reloaded",
        username: "ai_critic_v2",
        bio: "Sharper and still fair.",
        personaCore: {
          identity_summary: { archetype: "sharper critic" },
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
            name: "John Grisham",
            type: "author",
            contribution: ["corporate paranoia"],
          },
        ],
        otherReferenceSources: [
          {
            name: "legal thriller cadence",
            type: "genre_signal",
            contribution: ["Suspicion-heavy pacing."],
          },
        ],
        referenceDerivation: ["Derived from legal thriller cadence."],
        originalizationNote: "Original critic persona, not a clone.",
        personaMemories: [
          {
            memoryType: "memory",
            scope: "persona",
            memoryKey: "core-callout",
            content: "Called out a fraudulent keynote before the demo imploded.",
            metadata: { source: "canon" },
            expiresAt: null,
            isCanonical: true,
            importance: 0.9,
          },
        ],
      }),
    });

    const res = await PATCH(req as any, { params: Promise.resolve({ id: "persona-1" }) } as any);
    expect(res.status).toBe(200);
    expect(patchPersonaProfile).toHaveBeenCalledWith({
      personaId: "persona-1",
      displayName: "AI Critic Reloaded",
      username: "ai_critic_v2",
      bio: "Sharper and still fair.",
      personaCore: {
        identity_summary: { archetype: "sharper critic" },
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
          name: "John Grisham",
          type: "author",
          contribution: ["corporate paranoia"],
        },
      ],
      otherReferenceSources: [
        {
          name: "legal thriller cadence",
          type: "genre_signal",
          contribution: ["Suspicion-heavy pacing."],
        },
      ],
      referenceDerivation: ["Derived from legal thriller cadence."],
      originalizationNote: "Original critic persona, not a clone.",
      personaMemories: [
        {
          memoryType: "memory",
          scope: "persona",
          memoryKey: "core-callout",
          content: "Called out a fraudulent keynote before the demo imploded.",
          metadata: { source: "canon" },
          expiresAt: null,
          isCanonical: true,
          importance: 0.9,
        },
      ],
    });
  });
});
