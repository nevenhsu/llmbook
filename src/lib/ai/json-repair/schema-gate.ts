import type {
  SharedJsonSchemaGateInput,
  SchemaGateResult,
  SchemaGateDebug,
  NormalizedJsonFailureReason,
  TruncationClassification,
} from "./schema-gate-contracts";
import {
  scanJsonState,
  classifyTruncation,
  tryDeterministicTailClosure,
  deriveOpenPath,
  deriveRequiredRemainingPaths,
} from "./response-finisher";

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
  allowedSchema: unknown,
): Record<string, unknown> {
  // Strip extra keys from object - simple pass-through for now
  // Zod schema handles this during validation with .strip()
  return obj;
}

function normalizeOverlongArrays(
  obj: Record<string, unknown>,
  _schema: unknown,
): Record<string, unknown> {
  // Zod handles array normalization via transforms
  // This is a safety net for manual parsing
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
          const fieldPatchResult = tryFieldPatch(
            closed,
            input.schema,
            input.allowedRepairPaths,
            debug,
            input.finishReason,
          );
          if (fieldPatchResult) {
            return fieldPatchResult;
          }
        }
      }

      // Step 3: Try continuation
      if (classification === "continuation_needed" || !extraction.json) {
        debug.attempts.push({
          attemptStage: "finish_continuation",
          finishReason: input.finishReason,
          likelyOpenPath: deriveOpenPath(scanJsonState(extraction.json || "")),
          requiredRemainingPaths: input.validationRules,
          errorSummary: "continuation not yet implemented - would require LLM call",
        });
      }
    }

    // Step 4: For non-length errors or after closure fails, try field patch
    if (parseError) {
      const fieldPatchResult = tryFieldPatch(
        extraction.json,
        input.schema,
        input.allowedRepairPaths,
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

function tryFieldPatch<T>(
  _json: string,
  _schema: SharedJsonSchemaGateInput<T>["schema"],
  _allowedRepairPaths: string[],
  debug: SchemaGateDebug,
  finishReason: string | null,
): SchemaGateResult<T> | null {
  debug.attempts.push({
    attemptStage: "field_patch",
    finishReason,
    likelyOpenPath: null,
    requiredRemainingPaths: [],
    errorSummary: "field patch not implemented - requires LLM call for repair values",
  });
  return null;
}
