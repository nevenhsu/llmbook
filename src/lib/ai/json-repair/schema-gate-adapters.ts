import type { InvokeLlmOutput } from "@/lib/ai/llm/types";
import { Output } from "ai";
import type { z } from "zod";
import type {
  FieldPatchInvocationInput,
  FieldPatchInvocationResult,
  FinishContinuationInvocationInput,
  FinishContinuationInvocationResult,
} from "./schema-gate-contracts";
import { FieldPatchRepairSchema, FinishContinuationSchema } from "./field-patch-schema";

export type PatchLlmInvoker = (input: {
  prompt: string;
  maxOutputTokens: number;
  temperature: number;
  output: ReturnType<typeof Output.object>;
  entityId: string;
}) => Promise<InvokeLlmOutput>;

export function createFieldPatchAdapter(
  invokeLlm: PatchLlmInvoker,
  entityPrefix: string,
): (input: FieldPatchInvocationInput) => Promise<FieldPatchInvocationResult> {
  return async (input) => {
    const prompt = [
      "[field_patch_repair]",
      "Repair only the missing or invalid fields listed below.",
      `Schema: ${input.schemaName}`,
      "",
      "Failing paths:",
      ...input.failingPaths.map((p) => `- ${p}`),
      "",
      "Repairable paths (only these may be changed):",
      ...input.repairablePaths.map((p) => `- ${p}`),
      "",
      "Original JSON:",
      JSON.stringify(input.originalJson, null, 2),
      "",
      "Return a repair object containing repair operations.",
      "The structure is an array of {path, value} under a `repair` key.",
      "Only return the paths that need fixing.",
      "Do not add commentary, markdown, or explanation.",
    ].join("\n");

    const result = await invokeLlm({
      prompt,
      maxOutputTokens: 1200,
      temperature: 0.1,
      output: Output.object({ schema: input.patchSchema as z.ZodTypeAny }),
      entityId: `${entityPrefix}:field-patch`,
    });

    if (result.object) {
      const parsed = result.object as Record<string, unknown>;
      const repair = parsed.repair as Array<{ path: string; value: unknown }> | undefined;
      if (repair && Array.isArray(repair)) {
        return {
          repair: repair.filter((op) => typeof op.path === "string" && op.path.length > 0),
          rawText: result.text,
          finishReason: result.finishReason,
        };
      }
      return {
        repair: [],
        rawText: result.text,
        finishReason: result.finishReason,
      };
    }

    return {
      repair: [],
      rawText: result.text,
      finishReason: result.finishReason,
    };
  };
}

export function createFinishContinuationAdapter(
  invokeLlm: PatchLlmInvoker,
  entityPrefix: string,
): (input: FinishContinuationInvocationInput) => Promise<FinishContinuationInvocationResult> {
  return async (input) => {
    const prompt = [
      "[finish_continuation]",
      "The previous JSON output was cut off before completion.",
      `Schema: ${input.schemaName}`,
      "",
      `Required remaining: ${input.requiredRemainingPaths.join(", ") || "unknown"}`,
      `Likely open at: ${input.likelyOpenPath ?? "unknown"}`,
      "",
      "Continue only the missing JSON suffix from where the previous output was cut off.",
      "Return the suffix as the `suffix` field.",
      "Do not rewrite the full JSON object.",
      "Do not include the previous output prefix in your response.",
      "Do not add commentary or markdown.",
      "",
      "Previous output:",
      input.partialJsonText,
    ].join("\n");

    const result = await invokeLlm({
      prompt,
      maxOutputTokens: 800,
      temperature: 0.1,
      output: Output.object({
        schema: FinishContinuationSchema,
      }),
      entityId: `${entityPrefix}:finish-continuation`,
    });

    if (result.object) {
      const parsed = result.object as Record<string, unknown>;
      const suffix = typeof parsed.suffix === "string" ? parsed.suffix : "";
      return {
        suffix,
        completed_fragment: parsed.completed_fragment,
        finishReason: result.finishReason,
      };
    }

    // Fallback: use text as suffix
    return {
      suffix: result.text.trim(),
      finishReason: result.finishReason,
    };
  };
}
