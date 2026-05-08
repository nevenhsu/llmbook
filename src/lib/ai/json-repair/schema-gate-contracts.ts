import type { z } from "zod";

export type NormalizedJsonFailureReason = "length" | "object_generation_unparseable" | "other";

export type TruncationClassification =
  | "tail_closable"
  | "continuation_needed"
  | "prefix_too_broken";

export type SharedJsonSchemaGateInput<T = unknown> = {
  flowId: string;
  stageId: string;
  rawText: string;
  finishReason: string | null;
  generationErrorName?: string | null;
  generationErrorMessage?: string | null;
  schemaName: string;
  schema: z.ZodType<T>;
  validationRules: string[];
  allowedRepairPaths: string[];
  immutablePaths: string[];
};

export type SchemaGateDebugAttempt = {
  attemptStage:
    | "initial_parse"
    | "deterministic_tail_closure"
    | "finish_continuation"
    | "finish_salvage"
    | "field_patch";
  finishReason: string | null;
  likelyOpenPath: string | null;
  requiredRemainingPaths: string[];
  errorSummary: string | null;
};

export type SchemaGateDebug = {
  flowId: string;
  stageId: string;
  schemaName: string;
  status: "passed" | "repaired" | "failed";
  attempts: SchemaGateDebugAttempt[];
};

export type SchemaGateSuccess<T> = {
  status: "valid";
  value: T;
  debug: SchemaGateDebug;
};

export type SchemaGateFailure = {
  status: "schema_failure";
  error: string;
  debug: SchemaGateDebug;
};

export type SchemaGateResult<T> = SchemaGateSuccess<T> | SchemaGateFailure;

export type BracketState = {
  stack: Array<"{" | "[" | '"' | "string">;
  openString: boolean;
  lastKey: string | null;
  lastPath: string | null;
  depth: number;
};
