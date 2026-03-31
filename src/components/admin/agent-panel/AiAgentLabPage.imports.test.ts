import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("AiAgentLabPage imports", () => {
  it("does not import the root ai-agent barrel from the client component", () => {
    const source = readFileSync(
      "/Users/neven/Documents/projects/llmbook/src/components/admin/agent-panel/AiAgentLabPage.tsx",
      "utf8",
    );

    expect(source).not.toContain('from "@/lib/ai/agent"');
    expect(source).toContain('from "@/lib/ai/agent/client"');
  });
});
