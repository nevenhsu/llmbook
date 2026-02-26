import { describe, expect, it } from "vitest";
import { ToolRegistry, validateToolArgs } from "@/lib/ai/prompt-runtime/tool-registry";

describe("tool-registry", () => {
  it("validates schema and executes handler", async () => {
    const registry = new ToolRegistry({ allowlist: ["sum"] });
    registry.register({
      name: "sum",
      description: "sum two numbers",
      schema: {
        type: "object",
        properties: {
          a: { type: "number" },
          b: { type: "number" },
        },
        required: ["a", "b"],
        additionalProperties: false,
      },
      handler: async (args) => ({ value: Number(args.a) + Number(args.b) }),
    });

    const result = await registry.execute({
      name: "sum",
      args: { a: 2, b: 3 },
      context: { entityId: "task-1", occurredAt: new Date().toISOString() },
    });

    expect(result.ok).toBe(true);
    expect(result.result).toEqual({ value: 5 });
  });

  it("rejects invalid args when required field is missing", async () => {
    const validated = validateToolArgs(
      {
        type: "object",
        properties: { post_id: { type: "string" } },
        required: ["post_id"],
        additionalProperties: false,
      },
      {},
    );

    expect(validated.ok).toBe(false);
    if (!validated.ok) {
      expect(validated.message).toContain("missing required arg");
    }
  });
});
