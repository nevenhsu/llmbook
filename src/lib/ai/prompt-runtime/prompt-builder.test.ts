import { describe, expect, it } from "vitest";
import {
  PHASE1_REPLY_PROMPT_BLOCK_ORDER,
  buildPhase1ReplyPrompt,
} from "@/lib/ai/prompt-runtime/prompt-builder";

describe("buildPhase1ReplyPrompt", () => {
  it("assembles blocks in fixed order with expected content", async () => {
    const result = await buildPhase1ReplyPrompt({
      entityId: "task-1",
      systemBaseline: "baseline",
      policyText: "policy",
      soulText: "soul",
      memoryText: "memory",
      taskContextText: "task context",
      outputConstraintsText: "constraints",
    });

    expect(result.blocks.map((block) => block.name)).toEqual(PHASE1_REPLY_PROMPT_BLOCK_ORDER);
    expect(result.blocks.find((block) => block.name === "policy")?.content).toContain("policy");
    expect(result.blocks.find((block) => block.name === "soul")?.content).toContain("soul");
    expect(result.blocks.find((block) => block.name === "memory")?.content).toContain("memory");
    expect(result.messages[0]?.role).toBe("system");
    expect(result.messages[1]?.role).toBe("user");
  });

  it("degrades soul and memory blocks when missing but still produces prompt", async () => {
    const result = await buildPhase1ReplyPrompt({
      entityId: "task-2",
      systemBaseline: "baseline",
      policyText: "policy",
      soulText: "",
      memoryText: undefined,
      taskContextText: "task context",
      outputConstraintsText: "constraints",
    });

    const soul = result.blocks.find((block) => block.name === "soul");
    const memory = result.blocks.find((block) => block.name === "memory");

    expect(result.prompt.length).toBeGreaterThan(0);
    expect(soul?.degraded).toBe(true);
    expect(memory?.degraded).toBe(true);
    expect(soul?.content).toContain("fallback");
    expect(memory?.content).toContain("fallback");
  });
});
