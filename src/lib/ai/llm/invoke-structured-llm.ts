import { Output } from "ai";
import type { z } from "zod";
import type {
  InvokeLlmOutput,
  InvokeStructuredLlmOutput,
  LlmGenerateTextInput,
  LlmProviderErrorEvent,
  LlmTaskType,
} from "@/lib/ai/llm/types";
import type { LlmProviderRegistry } from "@/lib/ai/llm/registry";
import type { ProviderRouteTarget } from "@/lib/ai/llm/types";
import type { PromptRuntimeEventRecorder } from "@/lib/ai/prompt-runtime/runtime-events";
import { invokeLLMRaw } from "@/lib/ai/llm/invoke-llm";
import { runSharedJsonSchemaGate } from "@/lib/ai/json-repair/schema-gate";
import {
  createFieldPatchAdapter,
  type PatchLlmInvoker,
} from "@/lib/ai/json-repair/schema-gate-adapters";

export type InvokeStructuredLlmInput<T = unknown> = {
  registry: LlmProviderRegistry;
  taskType?: LlmTaskType;
  routeOverride?: { targets?: ProviderRouteTarget[] };
  modelInput: Omit<LlmGenerateTextInput, "modelId">;
  entityId: string;
  timeoutMs?: number;
  retries?: number;
  manualMode?: "auto" | "never";
  recorder?: PromptRuntimeEventRecorder;
  onProviderError?: (event: LlmProviderErrorEvent) => Promise<void> | void;
  schemaGate: {
    schemaName: string;
    schema: z.ZodType<T>;
    allowedRepairPaths: string[];
    immutablePaths: string[];
    compactRetryAllowed?: boolean;
  };
};

export async function invokeStructuredLLM<T>(
  input: InvokeStructuredLlmInput<T>,
): Promise<InvokeStructuredLlmOutput<T>> {
  const { schemaGate, ...rawInput } = input;

  const structuredModelInput: Omit<LlmGenerateTextInput, "modelId"> = {
    ...rawInput.modelInput,
    output: Output.object({ schema: input.schemaGate.schema }),
  };

  const firstResult = await invokeLLMRaw({
    ...rawInput,
    modelInput: structuredModelInput,
  });
  const raw = firstResult;

  const repairRawInvoker: PatchLlmInvoker = async (repairInput) => {
    return invokeLLMRaw({
      registry: input.registry,
      taskType: input.taskType ?? "generic",
      routeOverride: input.routeOverride,
      modelInput: {
        prompt: repairInput.prompt,
        maxOutputTokens: repairInput.maxOutputTokens,
        temperature: repairInput.temperature,
        output: repairInput.output,
      },
      entityId: repairInput.entityId,
      timeoutMs: input.timeoutMs,
      retries: 0,
      manualMode: input.manualMode,
      recorder: input.recorder,
      onProviderError: input.onProviderError,
    });
  };

  const fieldPatchAdapter = createFieldPatchAdapter(repairRawInvoker, input.entityId);

  const rawObject = raw.object as Record<string, unknown> | undefined;
  const errorMessage = typeof raw.error === "string" ? raw.error : (raw.errorDetails?.body ?? null);

  const gateResult = await runSharedJsonSchemaGate({
    flowId: input.entityId,
    stageId: "structured",
    rawText: raw.text,
    finishReason: raw.finishReason,
    generationErrorName: raw.error ?? undefined,
    generationErrorMessage: errorMessage ?? undefined,
    schemaName: input.schemaGate.schemaName,
    schema: input.schemaGate.schema,
    allowedRepairPaths: input.schemaGate.allowedRepairPaths,
    immutablePaths: input.schemaGate.immutablePaths,
    invokeFieldPatch: fieldPatchAdapter,
    rawObject,
  });

  if (gateResult.status === "valid") {
    return {
      status: "valid",
      value: gateResult.value,
      raw,
      schemaGateDebug: gateResult.debug as InvokeStructuredLlmOutput<T>["schemaGateDebug"],
    };
  }

  return {
    status: "schema_failure",
    error: gateResult.error,
    raw,
    schemaGateDebug: gateResult.debug as InvokeStructuredLlmOutput<unknown>["schemaGateDebug"],
  };
}
