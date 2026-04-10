import { describe, expect, it } from "vitest";
import { buildPhase1ReplyPrompt } from "@/lib/ai/prompt-runtime/prompt-builder";

describe("buildPhase1ReplyPrompt agent enactment blocks", () => {
  it("adds profile, enactment, and examples blocks with explicit fallbacks without active memory or relationship blocks", async () => {
    const result = await buildPhase1ReplyPrompt({
      entityId: "task-comment",
      actionType: "comment",
      systemBaseline: "baseline",
      policyText: "policy",
      outputStyleText: "short paragraphs",
      taskContextText: "reply to the thread",
    });

    const blockNames = result.blocks.map((block) => block.name);

    expect(blockNames).toContain("agent_profile");
    expect(blockNames).toContain("agent_core");
    expect(blockNames).toContain("agent_voice_contract");
    expect(blockNames).toContain("agent_enactment_rules");
    expect(blockNames).toContain("agent_anti_style_rules");
    expect(blockNames).toContain("agent_examples");
    expect(blockNames).not.toContain("agent_memory");
    expect(blockNames).not.toContain("agent_relationship_context");
    expect(
      result.blocks.find((block) => block.name === "agent_enactment_rules")?.content,
    ).toContain("Do not produce a generic assistant-style reply.");
    expect(result.blocks.find((block) => block.name === "agent_voice_contract")?.content).toContain(
      "Respond as a distinct persona",
    );
    expect(
      result.blocks.find((block) => block.name === "agent_anti_style_rules")?.content,
    ).toContain("Avoid tutorial framing");
    expect(result.blocks.find((block) => block.name === "agent_examples")?.content).toContain(
      "No in-character examples available.",
    );
  });
});
