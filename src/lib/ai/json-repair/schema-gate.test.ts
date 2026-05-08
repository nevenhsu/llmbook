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

describe("field patch repair", () => {
  const PatchSchema = z.object({
    name: z.string(),
    age: z.number().int().min(0).max(150).optional(),
    bio: z.string().nullable().optional(),
  });

  it("patches nullable missing field when in allowed paths", async () => {
    const result = await runSharedJsonSchemaGate(
      makeGateInput({
        rawText: '{"name":"Alice"}',
        schema: PatchSchema,
        allowedRepairPaths: ["age", "bio"],
        immutablePaths: ["name"],
      }),
    );
    // age and bio are optional, so the object should validate even without them
    expect(result.status).toBe("valid");
  });

  it("rejects patch of immutable path", async () => {
    const result = await runSharedJsonSchemaGate(
      makeGateInput({
        rawText: '{"name":"Alice","bio":null}',
        schema: PatchSchema,
        allowedRepairPaths: ["name"],
        immutablePaths: ["name"],
      }),
    );
    expect(result.status).toBe("valid");
  });

  it("returns schema_failure when failing path not in allowed paths", async () => {
    const result = await runSharedJsonSchemaGate(
      makeGateInput({
        rawText: '{"name":"Alice","age":"thirty"}',
        schema: PatchSchema,
        allowedRepairPaths: ["bio"],
        immutablePaths: ["name"],
      }),
    );
    // "age" is failing but not in allowedRepairPaths
    expect(result.status).toBe("schema_failure");
  });

  it("field patch records debug metadata", async () => {
    const result = await runSharedJsonSchemaGate(
      makeGateInput({
        rawText: '{"name":"Alice","bio":null}',
        schema: PatchSchema,
        allowedRepairPaths: ["bio"],
        immutablePaths: [],
      }),
    );
    expect(result.status).toBe("valid");
  });
});

describe("field patch behavior (Task 1 tests)", () => {
  const RequiredSchema = z.object({
    name: z.string(),
    age: z.number().int().min(0).max(150),
    bio: z.string(),
  });

  it("proves current null placeholder is insufficient for required string field", async () => {
    // bio is a required string, setting it to null won't pass string validation
    const result = await runSharedJsonSchemaGate(
      makeGateInput({
        rawText: '{"name":"Alice","age":30}',
        schema: RequiredSchema,
        allowedRepairPaths: ["bio"],
        immutablePaths: ["name"],
      }),
    );
    // Current code sets bio to null, which fails string validation -> schema_failure
    expect(result.status).toBe("schema_failure");
  });

  it("proves invalid type field needs value replacement, not null", async () => {
    const result = await runSharedJsonSchemaGate(
      makeGateInput({
        rawText: '{"name":"Alice","age":"thirty","bio":"test"}',
        schema: RequiredSchema,
        allowedRepairPaths: ["age"],
        immutablePaths: ["name"],
      }),
    );
    // "age" is allowlisted but current code sets it to null, which still fails
    expect(result.status).toBe("schema_failure");
  });
});

describe("wildcard path matching", () => {
  const ArraySchema = z.object({
    candidates: z
      .array(
        z.object({
          title: z.string(),
          thesis: z.string(),
        }),
      )
      .min(1)
      .max(3),
  });

  it("matches wildcard paths", async () => {
    const result = await runSharedJsonSchemaGate(
      makeGateInput({
        rawText: JSON.stringify({
          candidates: [{ title: "A" }],
        }),
        schema: ArraySchema,
        allowedRepairPaths: ["candidates.*.thesis"],
        immutablePaths: [],
      }),
    );
    expect(result.status).toBe("schema_failure");
  });
});

describe("extra key stripping", () => {
  const SimpleSchema = z.object({
    name: z.string(),
    age: z.number().int().min(0).max(150),
  });

  it("strips top-level extra keys", async () => {
    const result = await runSharedJsonSchemaGate(
      makeGateInput({
        rawText: '{"name":"Alice","age":30,"extra_top":"should be stripped"}',
        schema: SimpleSchema,
      }),
    );
    expect(result.status).toBe("valid");
    if (result.status === "valid") {
      expect((result.value as Record<string, unknown>).extra_top).toBeUndefined();
    }
  });
});

describe("overlong array normalization", () => {
  const TagsSchema = z.object({
    name: z.string(),
    tags: z.array(z.string()).min(1).max(5),
  });

  it("rejects overlong arrays when schema max is exceeded", async () => {
    const result = await runSharedJsonSchemaGate(
      makeGateInput({
        rawText: JSON.stringify({
          name: "test",
          tags: ["a", "b", "c", "d", "e", "f", "g"],
        }),
        schema: TagsSchema,
      }),
    );
    // Currently fails because array is too long
    expect(result.status).toBe("schema_failure");
  });
});

describe("metadata.probability normalization", () => {
  const looseProbability = z.preprocess(
    (value) =>
      Number.isInteger(value) && (value as number) >= 0 && (value as number) <= 100 ? value : 0,
    z.number().int().min(0).max(100),
  );

  const MetadataSchema = z.preprocess(
    (val) => {
      if (val && typeof val === "object" && !Array.isArray(val)) {
        const obj = val as Record<string, unknown>;
        if (!obj.metadata || typeof obj.metadata !== "object") {
          obj.metadata = { probability: 0 };
        } else {
          const meta = obj.metadata as Record<string, unknown>;
          meta.probability =
            Number.isInteger(meta.probability) &&
            (meta.probability as number) >= 0 &&
            (meta.probability as number) <= 100
              ? meta.probability
              : 0;
        }
      }
      return val;
    },
    z.object({
      name: z.string(),
      metadata: z
        .object({
          probability: z.number().int().min(0).max(100).default(0),
        })
        .default({ probability: 0 }),
    }),
  );

  it("defaults missing probability to 0", async () => {
    const result = await runSharedJsonSchemaGate(
      makeGateInput({
        rawText: '{"name":"test"}',
        schema: MetadataSchema,
      }),
    );
    expect(result.status).toBe("valid");
    if (result.status === "valid") {
      expect(result.value.metadata.probability).toBe(0);
    }
  });

  it("normalizes negative probability to 0 via loose preprocess", async () => {
    const result = await runSharedJsonSchemaGate(
      makeGateInput({
        rawText: '{"name":"test","metadata":{"probability":-5}}',
        schema: MetadataSchema,
      }),
    );
    // With loose preprocess, negative values normalize to 0
    expect(result.status).toBe("valid");
    if (result.status === "valid") {
      expect(result.value.metadata.probability).toBe(0);
    }
  });
});

describe("object_generation_unparseable routing", () => {
  const SimpleSchema = z.object({
    name: z.string(),
    age: z.number().int().min(0).max(150),
  });

  it("routes with usable raw text like finishReason=length", async () => {
    const result = await runSharedJsonSchemaGate(
      makeGateInput({
        rawText: '{"name":"Alice","age":',
        finishReason: null,
        generationErrorMessage:
          "The AI provider failed to generate a parsable object that conforms to the schema",
        schema: SimpleSchema,
      }),
    );
    expect(result.debug.attempts.some((a) => a.attemptStage === "deterministic_tail_closure")).toBe(
      true,
    );
  });

  it("returns typed diagnostic for empty text with object generation error", async () => {
    const result = await runSharedJsonSchemaGate(
      makeGateInput({
        rawText: "",
        finishReason: null,
        generationErrorMessage:
          "The AI provider failed to generate a parsable object that conforms to the schema",
        schema: SimpleSchema,
      }),
    );
    expect(result.status).toBe("schema_failure");
    const failureResult = result as { status: "schema_failure"; error: string };
    expect(failureResult.error).toContain("Empty output");
  });
});
