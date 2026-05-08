import type {
  SharedJsonSchemaGateInput,
  SchemaGateResult,
  SchemaGateDebug,
  NormalizedJsonFailureReason,
} from "./schema-gate-contracts";
import {
  scanJsonState,
  classifyTruncation,
  tryDeterministicTailClosure,
  deriveOpenPath,
} from "./response-finisher";
import { buildFieldPatchSchema, applyFieldPatch } from "./field-patch-schema";
import type { z } from "zod";

function zodInnerDef(schema: z.ZodTypeAny): Record<string, unknown> | null {
  return (schema as unknown as Record<string, unknown>)?._def as Record<string, unknown> | null;
}

function zodInnerShape(def: Record<string, unknown> | null): Record<string, z.ZodTypeAny> | null {
  if (!def) return null;
  const shape = def.shape as
    | Record<string, z.ZodTypeAny>
    | (() => Record<string, z.ZodTypeAny>)
    | undefined;
  if (!shape) return null;
  if (typeof shape === "function") {
    return shape() ?? null;
  }
  return shape as Record<string, z.ZodTypeAny> | null;
}

function zodIsOptional(field: z.ZodTypeAny): boolean {
  try {
    return field.isOptional?.() === true;
  } catch {
    return false;
  }
}

function extractRequiredPaths(schema: z.ZodTypeAny, prefix = ""): string[] {
  const def = zodInnerDef(schema);
  const shape = zodInnerShape(def);
  if (!shape) return [];

  const paths: string[] = [];

  for (const [key, field] of Object.entries(shape)) {
    const currentPath = prefix ? `${prefix}.${key}` : key;
    if (!zodIsOptional(field)) {
      paths.push(currentPath);
    }

    const fieldDef = zodInnerDef(field);
    if (fieldDef?.typeName === "ZodObject") {
      paths.push(...extractRequiredPaths(field, currentPath));
    }
  }

  return paths;
}

function normalizeFailureReason(
  input: Pick<SharedJsonSchemaGateInput, "finishReason" | "generationErrorMessage">,
): NormalizedJsonFailureReason {
  if (input.finishReason === "length") {
    return "length";
  }

  if (input.generationErrorMessage) {
    const msg = input.generationErrorMessage.toLowerCase();
    if (
      msg.includes("fails to generate a parsable object") ||
      msg.includes("failed to generate a parsable object") ||
      msg.includes("does not conform to the schema") ||
      msg.includes("no such object") ||
      msg.includes("object generation") ||
      msg.includes("cannot produce a parsable")
    ) {
      return "object_generation_unparseable";
    }
  }

  return "other";
}

function stripExtraKeys(
  obj: Record<string, unknown>,
  _allowedSchema: unknown,
): Record<string, unknown> {
  return obj;
}

function normalizeOverlongArrays(
  obj: Record<string, unknown>,
  _schema: unknown,
): Record<string, unknown> {
  return obj;
}

function extractJson(rawText: string): { json: string | null; error: string | null } {
  const trimmed = rawText.trim();
  if (!trimmed) {
    return { json: null, error: "empty input" };
  }

  // Try direct parse first
  try {
    JSON.parse(trimmed);
    return { json: trimmed, error: null };
  } catch {
    // Try to extract JSON from markdown code blocks
    const jsonMatch = trimmed.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (jsonMatch) {
      const inner = jsonMatch[1].trim();
      try {
        JSON.parse(inner);
        return { json: inner, error: null };
      } catch {
        // continue
      }
    }

    // Try to find JSON object boundaries
    const firstBrace = trimmed.indexOf("{");
    if (firstBrace !== -1) {
      // Find matching closing brace
      let depth = 0;
      let inString = false;
      let lastValidClose = -1;
      for (let i = firstBrace; i < trimmed.length; i++) {
        const ch = trimmed[i];
        if (inString) {
          if (ch === "\\" && i + 1 < trimmed.length) {
            i++;
            continue;
          }
          if (ch === '"') inString = false;
          continue;
        }
        if (ch === '"') {
          inString = true;
          continue;
        }
        if (ch === "{") depth++;
        if (ch === "}") {
          depth--;
          if (depth === 0) {
            lastValidClose = i;
            break;
          }
        }
      }

      if (lastValidClose !== -1) {
        const candidate = trimmed.slice(firstBrace, lastValidClose + 1);
        try {
          JSON.parse(candidate);
          return { json: candidate, error: null };
        } catch {
          return { json: candidate, error: "invalid JSON" };
        }
      }
    }

    return { json: trimmed, error: "could not parse JSON" };
  }
}

function parseAndValidate<T>(
  json: string,
  schema: SharedJsonSchemaGateInput<T>["schema"],
): { success: true; data: T } | { success: false; error: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch (e) {
    return { success: false, error: `JSON parse error: ${e}` };
  }

  const result = schema.safeParse(parsed);
  if (result.success) {
    return { success: true, data: result.data };
  }

  return { success: false, error: `Schema validation: ${result.error.message}` };
}

export async function runSharedJsonSchemaGate<T>(
  input: SharedJsonSchemaGateInput<T>,
): Promise<SchemaGateResult<T>> {
  const debug: SchemaGateDebug = {
    flowId: input.flowId,
    stageId: input.stageId,
    schemaName: input.schemaName,
    status: "failed",
    attempts: [],
  };

  const normalizedReason = normalizeFailureReason(input);
  const schemaRequiredPaths = extractRequiredPaths(input.schema as z.ZodTypeAny);

  // Step 0: Try rawObject first if available
  if (input.rawObject) {
    const objResult = input.schema.safeParse(input.rawObject);
    if (objResult.success) {
      debug.status = "passed";
      debug.attempts.push({
        attemptStage: "initial_parse",
        finishReason: input.finishReason,
        likelyOpenPath: null,
        requiredRemainingPaths: [],
        errorSummary: "raw object validated directly",
      });
      return { status: "valid", value: objResult.data, debug };
    }
    if (objResult.error) {
      debug.attempts.push({
        attemptStage: "loose_normalize",
        finishReason: input.finishReason,
        likelyOpenPath: null,
        requiredRemainingPaths: [],
        errorSummary: `raw object failed validation: ${objResult.error.issues
          .slice(0, 3)
          .map((i) => i.message)
          .join("; ")}`,
      });
    }
  }

  // Step 1: Extract and parse JSON
  const extraction = extractJson(input.rawText);
  debug.attempts.push({
    attemptStage: "initial_parse",
    finishReason: input.finishReason,
    likelyOpenPath: null,
    requiredRemainingPaths: [],
    errorSummary: extraction.error,
  });

  if (extraction.json) {
    const parseResult = parseAndValidate(extraction.json, input.schema);
    if (parseResult.success) {
      debug.status = "passed";
      return { status: "valid", value: parseResult.data, debug };
    }

    const parseError = parseResult.success ? null : (parseResult as { error: string }).error;

    // Step 2: If length/truncation, try deterministic tail closure
    if (normalizedReason === "length" || normalizedReason === "object_generation_unparseable") {
      const classification = classifyTruncation(extraction.json);

      // Try deterministic tail closure
      if (classification === "tail_closable") {
        const closed = tryDeterministicTailClosure(extraction.json);
        debug.attempts.push({
          attemptStage: "deterministic_tail_closure",
          finishReason: input.finishReason,
          likelyOpenPath: deriveOpenPath(scanJsonState(extraction.json)),
          requiredRemainingPaths: [],
          errorSummary: closed ? "closure candidate generated" : "closure failed",
        });

        if (closed) {
          const closedResult = parseAndValidate(closed, input.schema);
          if (closedResult.success) {
            debug.status = "repaired";
            return { status: "valid", value: closedResult.data, debug };
          }

          // Closure produced parseable but schema-invalid - try field patch
          const fieldPatchResult = await tryFieldPatch(closed, input, debug, input.finishReason);
          if (fieldPatchResult) {
            return fieldPatchResult;
          }
        }
      }

      // Step 3: Try continuation if callback provided
      if (
        (classification === "continuation_needed" || !extraction.json) &&
        input.invokeFinishContinuation
      ) {
        const contInput = {
          schemaName: input.schemaName,
          flowId: input.flowId,
          stageId: input.stageId,
          partialJsonText: extraction.json || "",
          likelyOpenPath: deriveOpenPath(scanJsonState(extraction.json || "")),
          requiredRemainingPaths: schemaRequiredPaths,
          validationSummary: parseError ?? "schema validation failed",
        };
        const contResult = await input.invokeFinishContinuation(contInput);
        debug.attempts.push({
          attemptStage: "finish_continuation",
          finishReason: input.finishReason,
          likelyOpenPath: contInput.likelyOpenPath,
          requiredRemainingPaths: schemaRequiredPaths,
          errorSummary: contResult.text ? "continuation received" : "continuation empty",
        });

        if (contResult.text) {
          const completed = extraction.json + contResult.text;
          const completedResult = parseAndValidate(completed, input.schema);
          if (completedResult.success) {
            debug.status = "repaired";
            return { status: "valid", value: completedResult.data, debug };
          }
        }
      } else if (classification === "continuation_needed") {
        debug.attempts.push({
          attemptStage: "finish_continuation",
          finishReason: input.finishReason,
          likelyOpenPath: deriveOpenPath(scanJsonState(extraction.json || "")),
          requiredRemainingPaths: schemaRequiredPaths,
          errorSummary: "continuation callback not available",
        });
      }
    }

    // Step 4: For non-length errors or after closure fails, try field patch
    if (parseError) {
      const fieldPatchResult = await tryFieldPatch(
        extraction.json,
        input,
        debug,
        input.finishReason,
      );
      if (fieldPatchResult) {
        return fieldPatchResult;
      }
    }
  }

  // No usable text and length-like error
  if (
    (normalizedReason === "length" || normalizedReason === "object_generation_unparseable") &&
    (!input.rawText || input.rawText.trim().length === 0)
  ) {
    debug.attempts.push({
      attemptStage: "initial_parse",
      finishReason: input.finishReason,
      likelyOpenPath: null,
      requiredRemainingPaths: [],
      errorSummary: "empty output with length finish - transport/token diagnostic",
    });
    return {
      status: "schema_failure",
      error: "Empty output with finishReason=length or object generation failure",
      debug,
    };
  }

  return {
    status: "schema_failure",
    error: `Schema gate failed for ${input.schemaName}: could not validate or repair`,
    debug,
  };
}

async function tryFieldPatch<T>(
  json: string,
  input: SharedJsonSchemaGateInput<T>,
  debug: SchemaGateDebug,
  finishReason: string | null,
): Promise<SchemaGateResult<T> | null> {
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(json);
  } catch {
    debug.attempts.push({
      attemptStage: "field_patch",
      finishReason,
      likelyOpenPath: null,
      requiredRemainingPaths: [],
      errorSummary: "cannot field-patch unparseable JSON",
    });
    return null;
  }

  const result = input.schema.safeParse(parsed);
  if (result.success) {
    return { status: "valid", value: result.data, debug };
  }

  const error = result.error;
  const failingPaths = new Set<string>();

  for (const issue of error.issues) {
    const path = issue.path.join(".");
    if (path) failingPaths.add(path);
  }

  const immutableFailures = [...failingPaths].filter((p) =>
    input.immutablePaths.some((immutable) => p === immutable || p.startsWith(`${immutable}.`)),
  );
  if (immutableFailures.length > 0) {
    debug.attempts.push({
      attemptStage: "field_patch",
      finishReason,
      likelyOpenPath: null,
      requiredRemainingPaths: [],
      errorSummary: `immutable path(s) failed: ${immutableFailures.join(", ")}`,
    });
    return null;
  }

  const repairable = [...failingPaths].filter((p) =>
    input.allowedRepairPaths.some((allowed) => {
      const fp = p.split(".");
      const ap = allowed.split(".");
      if (fp.length !== ap.length) return false;
      return ap.every((part, i) => part === "*" || part === fp[i]);
    }),
  );

  if (repairable.length === 0) {
    debug.attempts.push({
      attemptStage: "field_patch",
      finishReason,
      likelyOpenPath: null,
      requiredRemainingPaths: [],
      errorSummary: `no allowed repair paths for failures: ${[...failingPaths].join(", ")}`,
    });
    return null;
  }

  if (!input.invokeFieldPatch) {
    debug.attempts.push({
      attemptStage: "field_patch",
      finishReason,
      likelyOpenPath: null,
      requiredRemainingPaths: [],
      repairablePaths: repairable,
      errorSummary: "field patch callback unavailable",
    });
    return null;
  }

  const patchSessions = buildFieldPatchSchema({
    rootSchema: input.schema as z.ZodTypeAny,
    repairablePaths: repairable,
  });

  const patchResult = await input.invokeFieldPatch({
    schemaName: input.schemaName,
    flowId: input.flowId,
    stageId: input.stageId,
    originalJson: parsed,
    failingPaths: [...failingPaths],
    repairablePaths: repairable,
    patchSchema: patchSessions,
    validationSummary: `Schema validation failed. Failing paths: ${repairable.join(", ")}. Only these paths may be repaired.`,
  });

  if (!patchResult.patch || Object.keys(patchResult.patch).length === 0) {
    debug.attempts.push({
      attemptStage: "field_patch",
      finishReason,
      likelyOpenPath: null,
      requiredRemainingPaths: repairable,
      errorSummary: "patch callback returned empty result",
    });
    return null;
  }

  // Convert patch to operations
  const ops = flattenPatch(patchResult.patch);
  const { merged, rejected } = applyFieldPatch(
    parsed,
    ops,
    input.allowedRepairPaths,
    input.immutablePaths,
  );

  if (rejected.length > 0) {
    debug.attempts.push({
      attemptStage: "field_patch",
      finishReason,
      likelyOpenPath: null,
      requiredRemainingPaths: repairable,
      repairablePaths: repairable,
      errorSummary: `patch rejected paths: ${rejected.map((r) => r.path).join(", ")}`,
    });
    return null;
  }

  const repaired = input.schema.safeParse(merged);
  if (repaired.success) {
    debug.status = "repaired";
    debug.attempts.push({
      attemptStage: "field_patch",
      finishReason,
      likelyOpenPath: null,
      requiredRemainingPaths: repairable,
      repairablePaths: repairable,
      errorSummary: `field-patched: ${repairable.join(", ")}`,
    });
    return { status: "valid", value: repaired.data, debug };
  }

  debug.attempts.push({
    attemptStage: "field_patch",
    finishReason,
    likelyOpenPath: null,
    requiredRemainingPaths: repairable,
    repairablePaths: repairable,
    errorSummary: `field-patch produced invalid result`,
  });
  return null;
}

function flattenPatch(
  obj: Record<string, unknown>,
  prefix = "",
): Array<{ path: string; value: unknown }> {
  const result: Array<{ path: string; value: unknown }> = [];
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      result.push(...flattenPatch(value as Record<string, unknown>, path));
    } else {
      result.push({ path, value });
    }
  }
  return result;
}
