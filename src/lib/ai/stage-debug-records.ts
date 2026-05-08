import type { SchemaGateDebug } from "@/lib/ai/json-repair/schema-gate-contracts";

export type StageDebugRecord = {
  name: string;
  displayPrompt: string;
  outputMaxTokens: number;
  attempts: StageDebugAttemptRecord[];
};

export type StageDebugAttemptRecord = {
  attempt: string;
  text: string;
  finishReason: string | null;
  providerId: string | null;
  modelId: string | null;
  hadError: boolean;
  schemaGateDebug?: SchemaGateDebug;
};
