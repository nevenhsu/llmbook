import { describe, it, expect } from "vitest";

const PRODUCTION_FILES = [
  "src/lib/ai/prompt-runtime/persona-v2-prompt-family.ts",
  "src/lib/ai/prompt-runtime/persona-v2-flow-contracts.ts",
  "src/lib/ai/admin/persona-generation-prompt-template.ts",
] as const;

const SENTINEL_PHRASES = [
  "TEST_ONLY_POLICY_SENTINEL",
  "TEST_ONLY_PERSONA_SENTINEL",
  "TEST_ONLY_BOARD_SENTINEL",
  "TEST_ONLY_TARGET_SENTINEL",
  "TEST_ONLY_GENERATED_OUTPUT_SENTINEL",
  "TEST_ONLY_FAILED_OUTPUT_SENTINEL",
];

describe("hardcoding guardrails", () => {
  describe("sentinel strings not in production", () => {
    it("production prompt-family does not contain sentinel strings", async () => {
      const { readFileSync } = await import("node:fs");
      const content = readFileSync("src/lib/ai/prompt-runtime/persona-v2-prompt-family.ts", "utf8");
      for (const sentinel of SENTINEL_PHRASES) {
        expect(content).not.toContain(sentinel);
      }
    });

    it("production prompt template does not contain sentinel strings", async () => {
      const { readFileSync } = await import("node:fs");
      const content = readFileSync(
        "src/lib/ai/admin/persona-generation-prompt-template.ts",
        "utf8",
      );
      for (const sentinel of SENTINEL_PHRASES) {
        expect(content).not.toContain(sentinel);
      }
    });
  });

  describe("no legacy schema text in prompts", () => {
    it("persona generation template has no hardcoded key/type JSON schema blocks", async () => {
      const { readFileSync } = await import("node:fs");
      const content = readFileSync(
        "src/lib/ai/admin/persona-generation-prompt-template.ts",
        "utf8",
      );
      // Should NOT contain full JSON schema descriptions
      expect(content).not.toContain("identity: {");
      expect(content).not.toContain("mind: {");
      expect(content).not.toContain("taste: {");
      expect(content).not.toContain("voice: {");
      expect(content).not.toContain("forum: {");
      expect(content).not.toContain("narrative: {");
      expect(content).not.toContain("anti_generic: {");
      expect(content).not.toMatch(/\[memory\]/);
      expect(content).not.toContain("relationship_context");
    });
  });

  describe("production files don't import fixtures", () => {
    it("production files don't import from test files", async () => {
      const { readFileSync } = await import("node:fs");
      for (const file of PRODUCTION_FILES) {
        const content = readFileSync(file, "utf8");
        expect(content).not.toContain("example-only");
        expect(content).not.toContain("EXAMPLE_ONLY");
        expect(content).not.toContain("import.*fixture");
        expect(content).not.toContain("import.*testOnly");
      }
    });
  });

  describe("no DeepSeek-specific branches", () => {
    it("production files have no DeepSeek-specific conditions", async () => {
      const { readFileSync } = await import("node:fs");
      for (const file of PRODUCTION_FILES) {
        const content = readFileSync(file, "utf8");
        expect(content).not.toContain("deepseekSpecific");
        expect(content).not.toContain("forDeepSeek");
      }
    });
  });
});
