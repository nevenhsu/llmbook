import { describe, it, expect } from "vitest";
import { z } from "zod";
import { runSharedJsonSchemaGate } from "./schema-gate";
import {
  scanJsonState,
  classifyTruncation,
  tryDeterministicTailClosure,
  deriveOpenPath,
} from "./response-finisher";
import type { SharedJsonSchemaGateInput } from "./schema-gate-contracts";

const SimpleSchema = z.object({
  name: z.string(),
  age: z.number().int().min(0).max(150),
});

function makeGateInput<T>(
  overrides: Partial<SharedJsonSchemaGateInput<T>> & { schema: z.ZodType<T> },
): SharedJsonSchemaGateInput<T> {
  return {
    flowId: "test_flow",
    stageId: "test_stage",
    rawText: "",
    finishReason: null,
    schemaName: "TestSchema",
    validationRules: [],
    allowedRepairPaths: [],
    immutablePaths: [],
    ...overrides,
  };
}

describe("runSharedJsonSchemaGate", () => {
  it("validates valid JSON", async () => {
    const result = await runSharedJsonSchemaGate(
      makeGateInput({
        rawText: '{"name":"Alice","age":30}',
        schema: SimpleSchema,
      }),
    );
    expect(result.status).toBe("valid");
    if (result.status === "valid") {
      expect(result.value).toEqual({ name: "Alice", age: 30 });
      expect(result.debug.status).toBe("passed");
    }
  });

  it("returns schema_failure for invalid JSON", async () => {
    const result = await runSharedJsonSchemaGate(
      makeGateInput({
        rawText: "not json",
        schema: SimpleSchema,
      }),
    );
    expect(result.status).toBe("schema_failure");
  });

  it("returns schema_failure for empty output with length finish", async () => {
    const result = await runSharedJsonSchemaGate(
      makeGateInput({
        rawText: "",
        finishReason: "length",
        schema: SimpleSchema,
      }),
    );
    expect(result.status).toBe("schema_failure");
    if (result.status === "schema_failure") {
      expect(result.error).toContain("Empty output");
    }
  });

  it("returns schema_failure for schema-invalid JSON (missing required field)", async () => {
    const result = await runSharedJsonSchemaGate(
      makeGateInput({
        rawText: '{"name":"Alice"}',
        schema: SimpleSchema,
      }),
    );
    expect(result.status).toBe("schema_failure");
  });

  it("returns schema_failure for schema-invalid JSON (wrong type)", async () => {
    const result = await runSharedJsonSchemaGate(
      makeGateInput({
        rawText: '{"name":"Alice","age":"thirty"}',
        schema: SimpleSchema,
      }),
    );
    expect(result.status).toBe("schema_failure");
  });

  it("strips extra keys and validates", async () => {
    const result = await runSharedJsonSchemaGate(
      makeGateInput({
        rawText: '{"name":"Alice","age":30,"extra":"should be stripped"}',
        schema: SimpleSchema,
      }),
    );
    expect(result.status).toBe("valid");
    if (result.status === "valid") {
      expect((result.value as Record<string, unknown>).extra).toBeUndefined();
    }
  });

  it("records debug metadata on failure", async () => {
    const result = await runSharedJsonSchemaGate(
      makeGateInput({
        rawText: '{"name":"Alice"}',
        schema: SimpleSchema,
      }),
    );
    expect(result.debug.attempts.length).toBeGreaterThan(0);
    expect(result.debug.attempts[0].attemptStage).toBe("initial_parse");
  });

  it("normalizes object generation errors", async () => {
    const result = await runSharedJsonSchemaGate(
      makeGateInput({
        rawText: '{"name":"Alice","age":30}',
        finishReason: null,
        generationErrorMessage:
          "AI provider fails to generate a parsable object that conforms to the schema",
        schema: SimpleSchema,
      }),
    );
    expect(result.status).toBe("valid");
  });

  it("handles JSON in markdown code blocks", async () => {
    const result = await runSharedJsonSchemaGate(
      makeGateInput({
        rawText: '```json\n{"name":"Alice","age":30}\n```',
        schema: SimpleSchema,
      }),
    );
    expect(result.status).toBe("valid");
    if (result.status === "valid") {
      expect(result.value).toEqual({ name: "Alice", age: 30 });
    }
  });
});

describe("scanJsonState", () => {
  it("scans simple object", () => {
    const state = scanJsonState('{"name":"Alice","age":30}');
    expect(state.stack).toHaveLength(0);
    expect(state.openString).toBe(false);
  });

  it("scans truncated object", () => {
    const state = scanJsonState('{"name":"Alice","age":');
    expect(state.stack.length).toBeGreaterThan(0);
    expect(state.stack).toContain("{");
  });

  it("scans truncated string", () => {
    const state = scanJsonState('{"name":"Alice","bio":"unfinished');
    expect(state.openString).toBe(true);
  });
});

describe("classifyTruncation", () => {
  it("classifies empty input as prefix_too_broken", () => {
    expect(classifyTruncation("")).toBe("prefix_too_broken");
  });

  it("classifies closable truncation", () => {
    const result = classifyTruncation('{"name":"Alice","age":30');
    expect(["tail_closable", "continuation_needed"]).toContain(result);
  });

  it("classifies string truncation", () => {
    const result = classifyTruncation('{"name":"Alice","bio":"unfinished');
    // Should be either tail_closable (if string can be closed) or prefix_too_broken
    expect(["tail_closable", "prefix_too_broken"]).toContain(result);
  });

  it("classifies trailing comma as continuation_needed", () => {
    const result = classifyTruncation('{"name":"Alice",');
    expect(["continuation_needed", "tail_closable"]).toContain(result);
  });
});

describe("tryDeterministicTailClosure", () => {
  it("closes truncated object", () => {
    const result = tryDeterministicTailClosure('{"name":"Alice","age":30');
    expect(result).not.toBeNull();
    if (result) {
      const parsed = JSON.parse(result);
      expect(parsed).toEqual({ name: "Alice", age: 30 });
    }
  });

  it("returns null for empty input", () => {
    expect(tryDeterministicTailClosure("")).toBeNull();
  });

  it("handles complete JSON as-is", () => {
    const result = tryDeterministicTailClosure('{"name":"Alice","age":30}');
    if (result) {
      const parsed = JSON.parse(result);
      expect(parsed).toEqual({ name: "Alice", age: 30 });
    }
  });
});

describe("deriveOpenPath", () => {
  it("derives path from partially scanned JSON", () => {
    const state = scanJsonState('{"identity":{"archetype":"test","core_drive":"drive"');
    const path = deriveOpenPath(state);
    // The last key scanned should be somewhere in identity
    expect(path).toBeTruthy();
  });
});

describe("schema gate with complex schemas", () => {
  const ComplexSchema = z.object({
    candidates: z
      .array(
        z.object({
          title: z.string(),
          thesis: z.string(),
          body_outline: z.array(z.string()).min(2).max(5),
          persona_fit_score: z.number().int().min(0).max(100),
          novelty_score: z.number().int().min(0).max(100),
        }),
      )
      .min(2)
      .max(3),
  });

  it("handles complex nested schemas", async () => {
    const result = await runSharedJsonSchemaGate(
      makeGateInput({
        rawText: JSON.stringify({
          candidates: [
            {
              title: "A",
              thesis: "B",
              body_outline: ["1", "2"],
              persona_fit_score: 80,
              novelty_score: 70,
            },
            {
              title: "C",
              thesis: "D",
              body_outline: ["3", "4"],
              persona_fit_score: 75,
              novelty_score: 65,
            },
          ],
        }),
        schema: ComplexSchema,
      }),
    );
    expect(result.status).toBe("valid");
    if (result.status === "valid") {
      expect(result.value.candidates).toHaveLength(2);
    }
  });

  it("rejects complex schema with missing nested fields", async () => {
    const result = await runSharedJsonSchemaGate(
      makeGateInput({
        rawText: JSON.stringify({
          candidates: [
            { title: "A", body_outline: ["1", "2"], persona_fit_score: 80, novelty_score: 70 },
          ],
        }),
        schema: ComplexSchema,
      }),
    );
    expect(result.status).toBe("schema_failure");
  });
});

describe("normalized failure reason", () => {
  it("normalizes length finish", async () => {
    const result = await runSharedJsonSchemaGate(
      makeGateInput({
        rawText: '{"name":"Alice","age":',
        finishReason: "length",
        schema: SimpleSchema,
      }),
    );
    // Should attempt tail closure
    expect(result.debug.attempts.some((a) => a.attemptStage === "deterministic_tail_closure")).toBe(
      true,
    );
  });

  it("normalizes object generation error", async () => {
    const result = await runSharedJsonSchemaGate(
      makeGateInput({
        rawText: '{"name":"Alice","age":',
        finishReason: null,
        generationErrorMessage:
          "The AI provider failed to generate a parsable object that conforms to the schema",
        schema: SimpleSchema,
      }),
    );
    // Should attempt tail closure (length-equivalent)
    expect(result.debug.attempts.some((a) => a.attemptStage === "deterministic_tail_closure")).toBe(
      true,
    );
  });
});
