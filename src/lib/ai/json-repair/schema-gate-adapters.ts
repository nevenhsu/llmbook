import type { InvokeLlmOutput } from "@/lib/ai/llm/types";
import { Output } from "ai";
import type { z } from "zod";
import type {
  FieldPatchInvocationInput,
  FieldPatchInvocationResult,
  FinishContinuationInvocationInput,
  FinishContinuationInvocationResult,
} from "./schema-gate-contracts";
import { FieldPatchRepairSchema } from "./field-patch-schema";

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
      `Repair only the missing or invalid fields listed below.`,
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
      "Return a repair object containing only the fields that need fixing.",
      "Structure is enforced by the code-owned Zod schema through AI SDK Output.object.",
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
      const patch = result.object as Record<string, unknown>;
      const repair = patch.repair as Array<{ path: string; value: unknown }> | undefined;
      if (repair && Array.isArray(repair)) {
        const merged: Record<string, unknown> = {};
        for (const op of repair) {
          merged[op.path] = op.value;
        }
        return {
          patch: merged,
          rawText: result.text,
          finishReason: result.finishReason,
        };
      }
      return {
        patch: (patch.repair ?? patch) as Record<string, unknown>,
        rawText: result.text,
        finishReason: result.finishReason,
      };
    }

    return {
      patch: {} as Record<string, unknown>,
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
      `The previous JSON output was cut off before completion.`,
      `Schema: ${input.schemaName}`,
      "",
      `Required remaining: ${input.requiredRemainingPaths.join(", ") || "unknown"}`,
      `Likely open at: ${input.likelyOpenPath ?? "unknown"}`,
      "",
      "Continue only the missing JSON suffix.",
      "Do not rewrite the full JSON object.",
      "Do not add commentary or markdown.",
      "The full schema is enforced in code by Zod structured output.",
      "",
      "Previous output:",
      input.partialJsonText,
    ].join("\n");

    const result = await invokeLlm({
      prompt,
      maxOutputTokens: 800,
      temperature: 0.1,
      output: Output.object({
        schema: FieldPatchRepairSchema,
      }),
      entityId: `${entityPrefix}:finish-continuation`,
    });

    return {
      text: result.text,
      finishReason: result.finishReason,
    };
  };
}
