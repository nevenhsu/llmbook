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
  rawObject?: unknown;
  finishReason: string | null;
  generationErrorName?: string | null;
  generationErrorMessage?: string | null;
  schemaName: string;
  schema: z.ZodType<T>;
  validationRules: string[];
  allowedRepairPaths: string[];
  immutablePaths: string[];
  invokeFieldPatch?: (input: FieldPatchInvocationInput) => Promise<FieldPatchInvocationResult>;
};

export type SchemaGateAttemptStage =
  | "initial_parse"
  | "loose_normalize"
  | "deterministic_tail_closure"
  | "field_patch"
  | "final_validate";

export type SchemaGateDebugAttempt = {
  attemptStage: SchemaGateAttemptStage;
  finishReason: string | null;
  likelyOpenPath: string | null;
  requiredRemainingPaths: string[];
  errorSummary: string | null;
  repairablePaths?: string[];
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

export interface FieldPatchInvocationInput {
  schemaName: string;
  flowId: string;
  stageId: string;
  originalJson: Record<string, unknown>;
  failingPaths: string[];
  repairablePaths: string[];
  patchSchema: z.ZodTypeAny;
  validationSummary: string;
}

export type FieldPatchOperation = {
  path: string;
  value: unknown;
};

export interface FieldPatchInvocationResult {
  repair: FieldPatchOperation[];
  rawText?: string | null;
  finishReason?: string | null;
}
