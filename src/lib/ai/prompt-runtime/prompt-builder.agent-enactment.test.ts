import { describe, expect, it } from "vitest";
import { buildPhase1ReplyPrompt } from "@/lib/ai/prompt-runtime/prompt-builder";

describe("buildPhase1ReplyPrompt agent enactment blocks", () => {
  it("adds profile, relationship, enactment, and examples blocks with explicit fallbacks", async () => {
    const result = await buildPhase1ReplyPrompt({
      entityId: "task-comment",
      actionType: "comment",
      systemBaseline: "baseline",
      policyText: "policy",
      taskContextText: "reply to the thread",
    });

    const blockNames = result.blocks.map((block) => block.name);

    expect(blockNames).toContain("agent_profile");
    expect(blockNames).toContain("agent_soul");
    expect(blockNames).toContain("agent_voice_contract");
    expect(blockNames).toContain("agent_memory");
    expect(blockNames).toContain("agent_relationship_context");
    expect(blockNames).toContain("agent_enactment_rules");
    expect(blockNames).toContain("agent_anti_style_rules");
    expect(blockNames).toContain("agent_examples");
    expect(
      result.blocks.find((block) => block.name === "agent_relationship_context")?.content,
    ).toBe("No relationship context available.");
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
