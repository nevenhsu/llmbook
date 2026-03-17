import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdminAiControlPlaneStore } from "@/lib/ai/admin/control-plane-store";

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({}),
}));

vi.mock("@/lib/tiptap-markdown", () => ({
  markdownToEditorHtml: vi.fn(() => "<p>ok</p>"),
}));

describe("AdminAiControlPlaneStore.previewGlobalPolicyRelease", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("includes an empty agent_profile block in policy prompt preview", async () => {
    const store = new AdminAiControlPlaneStore();

    vi.spyOn(store as any, "fetchReleaseByVersion").mockResolvedValue({
      version: 10,
      policy: {
        global: {
          systemBaseline: "baseline",
          globalPolicy: "Respectful discussion",
          styleGuide: "Use natural conversational tone\nPrefer short paragraphs",
          forbiddenRules: "No harassment",
        },
      },
      is_active: true,
      created_by: "admin-1",
      change_note: null,
      created_at: "2026-03-06T00:00:00.000Z",
    });

    const preview = await store.previewGlobalPolicyRelease(10, "test");

    expect(preview.assembledPrompt).toContain("[agent_profile]");
    expect(preview.assembledPrompt).toContain("No agent profile available.");
    expect(preview.assembledPrompt).toContain("[output_style]");
    expect(preview.assembledPrompt).toContain("[agent_core]");
    expect(preview.assembledPrompt).toContain("[agent_memory]");
    expect(preview.assembledPrompt).toContain("[agent_relationship_context]");
    expect(preview.assembledPrompt).toContain("[agent_enactment_rules]");
    expect(preview.assembledPrompt).toContain("[agent_examples]");
    expect(preview.assembledPrompt).toContain("Short-term:");
    expect(preview.assembledPrompt).toContain("Long-term:");
    expect(preview.assembledPrompt).toContain("No relationship context available.");
    expect(preview.assembledPrompt).toContain("Do not produce a generic assistant-style reply.");
    expect(preview.assembledPrompt).toContain("No in-character examples available.");
    expect(preview.assembledPrompt).toContain("Use natural conversational tone");
  });

  it("keeps an explicit empty output_style fallback when style guide is missing", async () => {
    const store = new AdminAiControlPlaneStore();

    vi.spyOn(store as any, "fetchReleaseByVersion").mockResolvedValue({
      version: 11,
      policy: {
        global: {
          systemBaseline: "baseline",
          globalPolicy: "Respectful discussion",
          styleGuide: "",
          forbiddenRules: "No harassment",
        },
      },
      is_active: true,
      created_by: "admin-1",
      change_note: null,
      created_at: "2026-03-06T00:00:00.000Z",
    });

    const preview = await store.previewGlobalPolicyRelease(11, "test");

    expect(preview.assembledPrompt).toContain("[output_style]");
    expect(preview.assembledPrompt).toContain("[agent_core]");
    expect(preview.assembledPrompt).toContain("[agent_memory]");
    expect(preview.assembledPrompt).toContain("[agent_relationship_context]");
    expect(preview.assembledPrompt).toContain("[agent_enactment_rules]");
    expect(preview.assembledPrompt).toContain("[agent_examples]");
    expect(preview.assembledPrompt).toContain("Short-term:");
    expect(preview.assembledPrompt).toContain("Long-term:");
    expect(preview.assembledPrompt).toContain("No output style guidance available.");
  });
});
