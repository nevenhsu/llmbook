import { createDbBackedLlmProviderRegistry } from "@/lib/ai/llm/default-registry";
import { invokeLLM } from "@/lib/ai/llm/invoke-llm";
import { resolveLlmInvocationConfig } from "@/lib/ai/llm/runtime-config-provider";
import { Output } from "ai";
import { z } from "zod";
import {
  ADMIN_UI_LLM_PROVIDER_RETRIES,
  PROMPT_ASSIST_MAX_OUTPUT_TOKENS,
  PROMPT_ASSIST_REFERENCE_AUDIT_MAX_OUTPUT_TOKENS,
} from "@/lib/ai/admin/persona-generation-token-budgets";
import {
  PromptAssistError,
  type PersonaGenerationSemanticAuditResult,
  type AiModelConfig,
  type AiProviderConfig,
  type PromptAssistAttemptStage,
  type PromptAssistNamedReference,
  type PromptAssistReferenceResolutionOutput,
} from "@/lib/ai/admin/control-plane-contract";
import { resolvePersonaTextModel } from "@/lib/ai/admin/control-plane-model-resolution";

const PromptAssistReferenceOutputSchema = z.object({
  namedReferences: z.array(
    z.object({
      name: z.string(),
      type: z.enum([
        "real_person",
        "historical_figure",
        "fictional_character",
        "mythic_figure",
        "iconic_persona",
      ]),
    }),
  ),
});
import {
  assemblePromptAssistText,
  buildExplicitSourceReferenceInstruction,
  buildPromptAssistAttemptDetails,
  buildPromptAssistProviderError,
  extractLikelyNamedReferences,
  isLikelyTruncatedPromptAssistText,
  isWeakPromptAssistRewrite,
  parsePersonaGenerationSemanticAuditResult,
  parsePromptAssistReferenceResolutionOutput,
  validatePromptAssistResult,
} from "@/lib/ai/admin/persona-generation-contract";

const PROMPT_ASSIST_REFERENCE_REPAIR_MAX_OUTPUT_TOKENS = 320;

type PromptAssistReferenceAuditResult = PersonaGenerationSemanticAuditResult & {
  inconclusive?: boolean;
};

function formatResolvedReferenceEntities(
  namedReferences: PromptAssistNamedReference[],
): string | null {
  if (namedReferences.length === 0) {
    return null;
  }

  return namedReferences.map((item) => `${item.name} (${item.type})`).join(", ");
}

function looksLikeJsonObject(text: string): boolean {
  const normalized = text.trim();
  return normalized.startsWith("{") || normalized.startsWith("[");
}

function readAttemptFinishReason(
  details: Record<string, unknown> | null | undefined,
): string | null {
  const finishReason = details?.finishReason;
  return typeof finishReason === "string" ? finishReason : null;
}

function isLengthTruncatedAttempt(details: Record<string, unknown> | null | undefined): boolean {
  return readAttemptFinishReason(details) === "length";
}

export async function assistPersonaPrompt(input: {
  modelId: string;
  inputPrompt: string;
  providers: AiProviderConfig[];
  models: AiModelConfig[];
  recordLlmInvocationError: (input: {
    providerKey: string;
    modelKey: string;
    error: string;
    errorDetails?: {
      statusCode?: number;
      code?: string;
      type?: string;
      body?: string;
    };
  }) => Promise<void>;
}): Promise<string> {
  const { model, provider } = resolvePersonaTextModel({
    modelId: input.modelId,
    models: input.models,
    providers: input.providers,
    featureLabel: "prompt assist",
  });
  const trimmedInput = input.inputPrompt.trim();
  const mode = trimmedInput.length === 0 ? "random" : "optimize";
  const referenceOutputRules = [
    "Return exactly one JSON object.",
    "Return raw JSON only. Do not use markdown fences.",
    'Shape: {"namedReferences": [{"name": string, "type": string}]}',
    "namedReferences must contain 1 to 3 personality-bearing named references.",
    "Allowed namedReferences.type values: real_person, historical_figure, fictional_character, mythic_figure, iconic_persona.",
    "Works, titles, places, ideologies, regions, and style labels may be clues, but they must not be the final namedReferences unless they denote a personality-bearing persona.",
  ].join("\n");
  const sourceReferenceNames = extractLikelyNamedReferences(trimmedInput);
  const explicitSourceReferenceInstruction =
    mode === "optimize" ? buildExplicitSourceReferenceInstruction(sourceReferenceNames) : null;

  const invocationConfig = await resolveLlmInvocationConfig({
    taskType: "generic",
    capability: "text_generation",
    promptModality: "text_only",
    targetOverride: {
      providerId: provider.providerKey,
      modelId: model.modelKey,
    },
  });
  const registry = await createDbBackedLlmProviderRegistry({
    includeMock: true,
    includeXai: true,
    includeMinimax: true,
  });

  const invokePromptAssist = async (
    promptText: string,
    temperature: number,
    stage: PromptAssistAttemptStage,
    maxOutputTokens = PROMPT_ASSIST_MAX_OUTPUT_TOKENS,
  ): Promise<{ text: string; details: Record<string, unknown>; object?: unknown }> => {
    const llmResult = await invokeLLM({
      registry,
      taskType: "generic",
      routeOverride: invocationConfig.route,
      modelInput: {
        prompt: promptText,
        maxOutputTokens: Math.min(model.maxOutputTokens ?? maxOutputTokens, maxOutputTokens),
        temperature,
        ...(stage === "reference_resolution" || stage === "reference_presence_audit"
          ? { output: Output.object({ schema: PromptAssistReferenceOutputSchema }) }
          : {}),
      },
      entityId: `persona-prompt-assist:${model.id}`,
      timeoutMs: invocationConfig.timeoutMs,
      retries: Math.min(invocationConfig.retries ?? 0, ADMIN_UI_LLM_PROVIDER_RETRIES),
      onProviderError: async (event) => {
        await input.recordLlmInvocationError({
          providerKey: event.providerId,
          modelKey: event.modelId,
          error: event.error,
          errorDetails: event.errorDetails,
        });
      },
    });

    const text = llmResult.text.trim();
    const details = buildPromptAssistAttemptDetails({
      stage,
      llmResult,
    });
    if (llmResult.error && !text) {
      throw buildPromptAssistProviderError({
        stage,
        error: llmResult.error,
        details,
        errorDetails: llmResult.errorDetails,
      });
    }
    return { text, details };
  };

  const readReferenceOutput = (
    candidateText: string,
  ): {
    referenceOutput: PromptAssistReferenceResolutionOutput | null;
    referenceParseError: string | null;
  } => {
    try {
      return {
        referenceOutput: parsePromptAssistReferenceResolutionOutput(candidateText),
        referenceParseError: null,
      };
    } catch (error) {
      return {
        referenceOutput: null,
        referenceParseError:
          error instanceof Error
            ? error.message
            : "prompt assist reference output did not follow the required JSON contract",
      };
    }
  };

  const buildRetryPrompt = (inputLines: Array<string | null | false>) =>
    inputLines.filter((item): item is string => Boolean(item)).join("\n\n");

  const runReferencePresenceAudit = async (
    candidate: PromptAssistReferenceResolutionOutput,
    originalInput: string,
  ): Promise<PromptAssistReferenceAuditResult> => {
    const buildAuditPrompt = (retryReason?: string) =>
      [
        "[prompt_assist_reference_audit]",
        "You are judging whether the namedReferences JSON below contains at least 1 explicit personality-bearing named reference that fits the original input.",
        "Judge semantics, not regex.",
        "namedReferences must contain 1 to 3 personality-bearing references such as real people, historical figures, fictional characters, mythic figures, or iconic personas.",
        "Works, titles, franchises, regions, ideologies, and style labels are clues, not valid namedReferences by themselves.",
        "If the original input is only a work or title, infer a personality-bearing figure from it; the title alone is not enough for namedReferences.",
        "If the namedReferences list keeps only a work title, place name, ideology, or style label, fail.",
        "Return exactly one JSON object.",
        "Return raw JSON only. Do not use markdown fences.",
        "passes: boolean",
        "issues: string[]",
        "repairGuidance: string[]",
        "Keep every issue and repairGuidance item short and functional.",
        retryReason ? `[retry_reason]\n${retryReason}` : null,
        "",
        "[original_input]",
        originalInput || "(empty)",
        "",
        "[named_references_json]",
        JSON.stringify(candidate),
      ]
        .filter((item): item is string => Boolean(item))
        .join("\n");

    const firstAttempt = await invokePromptAssist(
      buildAuditPrompt(),
      0,
      "reference_presence_audit",
      PROMPT_ASSIST_REFERENCE_AUDIT_MAX_OUTPUT_TOKENS,
    );

    if (firstAttempt.text) {
      try {
        return parsePersonaGenerationSemanticAuditResult(firstAttempt.text);
      } catch {
        // fall through
      }
    }

    const secondAttempt = await invokePromptAssist(
      buildAuditPrompt(
        "Your previous audit output was empty or invalid. Return valid audit JSON only.",
      ),
      0,
      "reference_presence_audit",
      PROMPT_ASSIST_REFERENCE_AUDIT_MAX_OUTPUT_TOKENS,
    );

    if (secondAttempt.text) {
      try {
        return parsePersonaGenerationSemanticAuditResult(secondAttempt.text);
      } catch {
        // fall through
      }
    }

    return {
      passes: false,
      inconclusive: true,
      issues: [
        secondAttempt.text
          ? "Reference audit returned invalid JSON."
          : "Reference audit returned empty output.",
      ],
      repairGuidance: [
        "Return valid audit JSON and verify that namedReferences contains at least one personality-bearing named reference.",
      ],
    };
  };

  const runReferenceResolutionRepair = async (input: {
    repairPrompt: string;
    compactRetryReason: string;
    temperature: number;
    previousOutput?: string | null;
  }): Promise<{ text: string; details: Record<string, unknown> }> => {
    const firstAttempt = await invokePromptAssist(
      input.repairPrompt,
      input.temperature,
      "reference_resolution_repair",
    );

    if (firstAttempt.text || !isLengthTruncatedAttempt(firstAttempt.details)) {
      return firstAttempt;
    }

    return invokePromptAssist(
      buildRetryPrompt([
        "[compact_retry_repair]",
        input.compactRetryReason,
        referenceOutputRules,
        "Use the smallest valid JSON possible.",
        "If needed, return exactly one named reference.",
        "Return raw JSON only.",
        "Do not return explanation or prose.",
        input.previousOutput ? `[previous_output]\n${input.previousOutput}` : null,
        trimmedInput ? `[original_input]\n${trimmedInput}` : null,
      ]),
      input.temperature,
      "reference_resolution_repair",
      PROMPT_ASSIST_REFERENCE_REPAIR_MAX_OUTPUT_TOKENS,
    );
  };

  const buildReferenceResolutionPrompt = () =>
    mode === "random"
      ? [
          "Choose 1 to 3 real famous reference entities for a distinct forum persona.",
          referenceOutputRules,
          "Return personality-bearing figures only, such as real people, historical figures, fictional characters, mythic figures, or iconic personas.",
          "No explanation, no prose, no bullets, no numbering.",
        ].join("\n")
      : [
          "Infer 1 to 3 fitting personality-bearing reference entities from the user's persona clues.",
          referenceOutputRules,
          "The clues may refer to works, eras, domains, styles, genres, countries, personalities, values, or claims, but the final namedReferences must be personality-bearing figures only.",
          "If the input is only a work or title, treat it as a clue and infer a personality-bearing figure from it rather than returning the title itself.",
          explicitSourceReferenceInstruction,
          "No explanation, no prose, no bullets, no numbering.",
          "",
          `User input:\n${trimmedInput}`,
        ]
          .filter((item): item is string => Boolean(item))
          .join("\n");

  const referenceResolutionPrompt = buildReferenceResolutionPrompt();
  const referenceAttempt = await invokePromptAssist(
    referenceResolutionPrompt,
    mode === "random" ? 0.8 : 0.3,
    "reference_resolution",
  );
  let referenceRawOutput = referenceAttempt.text;
  let referenceDetails = referenceAttempt.details;

  if (!referenceRawOutput) {
    const repairAttempt = await runReferenceResolutionRepair({
      repairPrompt: buildRetryPrompt([
        referenceResolutionPrompt,
        "",
        "[retry_repair]",
        "Your previous reference-resolution output was empty.",
        "Return only the namedReferences JSON object.",
        "Do not return prose or explanation.",
      ]),
      compactRetryReason:
        "Your previous reference-resolution repair returned empty output and likely hit the token limit. Return only the smallest valid namedReferences JSON object.",
      temperature: mode === "random" ? 0.55 : 0.25,
    });
    referenceRawOutput = repairAttempt.text;
    referenceDetails = repairAttempt.details;
  }

  if (!referenceRawOutput) {
    throw new PromptAssistError({
      code: "prompt_assist_repair_output_empty",
      message: "prompt assist reference-resolution repair returned empty output",
      details: {
        ...(referenceDetails ?? {}),
        rawText: null,
      },
    });
  }

  let { referenceOutput, referenceParseError } = readReferenceOutput(referenceRawOutput);
  if (!referenceOutput) {
    const repairedAttempt = await runReferenceResolutionRepair({
      repairPrompt: buildRetryPrompt([
        referenceResolutionPrompt,
        "",
        "[retry_repair]",
        "Your previous reference-resolution output did not follow the required JSON contract.",
        referenceParseError ? `Problem: ${referenceParseError}.` : null,
        "Return only the namedReferences JSON object.",
        "Do not return prose or explanation.",
        `[previous_output]\n${referenceRawOutput}`,
      ]),
      compactRetryReason:
        "Your previous reference-resolution repair returned invalid or truncated JSON. Return only the smallest valid namedReferences JSON object.",
      temperature: mode === "random" ? 0.55 : 0.25,
      previousOutput: referenceRawOutput,
    });

    if (!repairedAttempt.text) {
      throw new PromptAssistError({
        code: "prompt_assist_repair_output_empty",
        message: "prompt assist reference-resolution repair returned empty output",
        details: {
          ...(repairedAttempt.details ?? {}),
          rawText: null,
        },
      });
    }

    referenceRawOutput = repairedAttempt.text;
    referenceDetails = repairedAttempt.details;
    ({ referenceOutput, referenceParseError } = readReferenceOutput(referenceRawOutput));
  }

  if (!referenceOutput) {
    throw new PromptAssistError({
      code: "prompt_assist_invalid_reference_output",
      message:
        referenceParseError ??
        "prompt assist reference output did not follow the required JSON contract",
      details: {
        ...(referenceDetails ?? {}),
        rawText: referenceRawOutput,
      },
    });
  }

  let referenceAudit = await runReferencePresenceAudit(referenceOutput, trimmedInput);
  if (!referenceAudit.passes && !referenceAudit.inconclusive) {
    const repairedAttempt = await runReferenceResolutionRepair({
      repairPrompt: buildRetryPrompt([
        referenceResolutionPrompt,
        "",
        "[retry_repair]",
        "The previous namedReferences JSON did not keep at least one valid personality-bearing named reference.",
        "Review the original input. If it contains people, characters, or other clear personality-bearing clues, preserve or infer at least one fitting personality-bearing figure.",
        "Works, titles, places, ideologies, and style labels are clues, not final namedReferences.",
        "Return only the namedReferences JSON object.",
        `Current namedReferences JSON:\n${JSON.stringify(referenceOutput)}`,
        ...referenceAudit.repairGuidance,
      ]),
      compactRetryReason:
        "Your previous namedReferences repair did not return usable JSON. Return only the smallest valid namedReferences JSON object with at least one personality-bearing named reference.",
      temperature: mode === "random" ? 0.55 : 0.25,
      previousOutput: JSON.stringify(referenceOutput),
    });

    if (!repairedAttempt.text) {
      throw new PromptAssistError({
        code: "prompt_assist_repair_output_empty",
        message: "prompt assist reference-resolution repair returned empty output",
        details: {
          ...(repairedAttempt.details ?? {}),
          rawText: null,
        },
      });
    }

    referenceRawOutput = repairedAttempt.text;
    referenceDetails = repairedAttempt.details;
    ({ referenceOutput, referenceParseError } = readReferenceOutput(referenceRawOutput));
    if (!referenceOutput) {
      throw new PromptAssistError({
        code: "prompt_assist_invalid_reference_output",
        message:
          referenceParseError ??
          "prompt assist reference output did not follow the required JSON contract",
        details: {
          ...(referenceDetails ?? {}),
          rawText: referenceRawOutput,
        },
      });
    }

    referenceAudit = await runReferencePresenceAudit(referenceOutput, trimmedInput);
  }

  if (!referenceAudit.passes && !referenceAudit.inconclusive) {
    throw new PromptAssistError({
      code: "prompt_assist_missing_reference",
      message:
        "prompt assist output must include at least 1 explicit personality-bearing named reference",
      details: {
        ...(referenceDetails ?? {}),
        rawText: referenceRawOutput,
        auditIssues: referenceAudit.issues,
        auditRepairGuidance: referenceAudit.repairGuidance,
      },
    });
  }

  const resolvedReferences = referenceOutput.namedReferences;
  const resolvedReferenceInstruction = formatResolvedReferenceEntities(resolvedReferences)
    ? `Use these resolved reference entities as behavioral source material: ${formatResolvedReferenceEntities(
        resolvedReferences,
      )}.`
    : null;

  const textSystemPrompt =
    mode === "random"
      ? [
          "You write one concise extra prompt for generating a forum persona.",
          "Output rules:",
          "English only.",
          "Return plain text only.",
          "text must be exactly 1 paragraph and maximum 60 words.",
          "Be precise and concrete.",
          "Do not append a separate reference list; the server will append a fixed trailing reference-sources suffix.",
          "Describe the persona's worldview, tone, bias, and interaction style.",
          "Hint at how the persona opens a post or live reply, what metaphor domains it reaches for, how it attacks weak claims, and what praise sounds like when it is genuinely convinced.",
          "No filler, no explanation, no meta commentary.",
          "Do not mention schema, JSON, database fields, or implementation details.",
          "Do not sound like a generic AI assistant.",
        ].join("\n")
      : [
          "You rewrite an existing extra prompt for generating a forum persona.",
          "Output rules:",
          "Keep the same language as the user's input.",
          "Return plain text only.",
          "text must be exactly 1 paragraph and maximum 75 words.",
          "Preserve the user's core intent.",
          "Do not append a separate reference list; the server will append a fixed trailing reference-sources suffix.",
          "Interpret the user's input as possible clues about works, eras, domains, styles, genres, countries, personalities, values, or claims.",
          "Make it materially clearer, more specific, and more usable as a persona brief.",
          "Remove fluff, repetition, vagueness, and filler.",
          "Use the resolved reference as behavioral source material, not just as a name to mention.",
          "The final brief must reflect the reference's temperament, values, social energy, interaction style, or core contradiction.",
          "Explicitly sharpen the persona's role or domain, worldview or bias, tone, and interaction style.",
          "Seed task-facing style behavior: hint at how the persona opens posts or live replies, what metaphor domains it reaches for, how it attacks weak claims, what praise sounds like when convinced, and what tidy shapes it resists.",
          "Avoid generic persona language such as witty but respectful, sharp taste, grounded observations, or values craft over hype unless the reference truly supports it.",
          "Do not start with imperative framing like Generate/Create/Write; return the rewritten brief itself.",
          "Do not mention schema, JSON, database fields, or implementation details.",
          "Do not explain your edits.",
        ].join("\n");

  const textUserPrompt =
    mode === "random"
      ? "Create one concise extra prompt for a new forum persona."
      : `Rewrite this extra prompt to be more precise and concise while preserving intent:\n\n${trimmedInput}`;

  const mainPrompt = [
    textSystemPrompt,
    explicitSourceReferenceInstruction,
    resolvedReferenceInstruction,
    textUserPrompt,
  ]
    .filter((item): item is string => Boolean(item))
    .join("\n\n");

  const mainAttempt = await invokePromptAssist(
    mainPrompt,
    mode === "random" ? 0.8 : 0.3,
    "main_rewrite",
  );
  let rawOutput = mainAttempt.text;
  let textDetails = mainAttempt.details;

  if (!rawOutput) {
    const repairAttempt = await invokePromptAssist(
      [
        textSystemPrompt,
        explicitSourceReferenceInstruction,
        resolvedReferenceInstruction,
        textUserPrompt,
        "",
        "[retry_repair]",
        "Your previous prompt-assist output was empty.",
        "Rewrite from scratch and return one usable plain-text persona brief only.",
        "Do not return JSON.",
        "Do not return blank output.",
      ]
        .filter((item): item is string => Boolean(item))
        .join("\n\n"),
      mode === "random" ? 0.65 : 0.25,
      "empty_output_repair",
    );
    rawOutput = repairAttempt.text;
    textDetails = repairAttempt.details;
  }

  if (!rawOutput) {
    throw new PromptAssistError({
      code: "prompt_assist_repair_output_empty",
      message: "prompt assist repair returned empty output",
      details: {
        ...(textDetails ?? {}),
        rawText: null,
      },
    });
  }

  if (looksLikeJsonObject(rawOutput)) {
    const repairedAttempt = await invokePromptAssist(
      buildRetryPrompt([
        textSystemPrompt,
        explicitSourceReferenceInstruction,
        resolvedReferenceInstruction,
        textUserPrompt,
        "",
        "[retry_repair]",
        "The previous output returned JSON or another non-plain-text format.",
        "Rewrite from scratch and return plain text only.",
        "Do not return JSON.",
        `[previous_output]\n${rawOutput}`,
      ]),
      mode === "random" ? 0.55 : 0.25,
      "weak_output_repair",
    );
    if (repairedAttempt.text) {
      rawOutput = repairedAttempt.text;
      textDetails = repairedAttempt.details;
    }
  }

  if (isLikelyTruncatedPromptAssistText({ text: rawOutput, details: textDetails })) {
    const repairedAttempt = await invokePromptAssist(
      buildRetryPrompt([
        textSystemPrompt,
        explicitSourceReferenceInstruction,
        resolvedReferenceInstruction,
        textUserPrompt,
        "",
        "[retry_repair]",
        "The previous rewrite was truncated or incomplete.",
        "Rewrite from scratch and return one complete plain-text persona brief only.",
        "Do not append a separate reference list; the server will append the fixed trailing reference-sources suffix.",
        "Do not end with a dangling conjunction, unfinished clause, or cut-off sentence.",
        `[previous_output]\n${rawOutput}`,
      ]),
      mode === "random" ? 0.55 : 0.25,
      "truncated_output_repair",
    );
    if (!repairedAttempt.text) {
      throw new PromptAssistError({
        code: "prompt_assist_repair_output_empty",
        message: "prompt assist truncation repair returned empty output",
        details: {
          ...(repairedAttempt.details ?? {}),
          rawText: null,
        },
      });
    }
    rawOutput = repairedAttempt.text;
    textDetails = repairedAttempt.details;
  }

  if (
    isWeakPromptAssistRewrite({
      text: rawOutput,
      mode,
      sourceText: trimmedInput,
    })
  ) {
    const repairedAttempt = await invokePromptAssist(
      [
        "The previous rewrite was too weak.",
        "Rewrite the user's persona brief into a meaningfully clearer and more specific version.",
        mode === "random"
          ? "Keep the result in English."
          : "Keep the same language as the user's input.",
        "Return plain text only.",
        "Do not append a separate reference list; the server will append the fixed trailing reference-sources suffix.",
        explicitSourceReferenceInstruction,
        resolvedReferenceInstruction,
        "Use the resolved reference as behavioral source material, not just as a name to mention.",
        "Make the role or domain, worldview or bias, tone, and interaction style obvious in the sentence itself.",
        "Make the brief imply a concrete opening move, recurring metaphor domains, how weak claims get challenged, what praise sounds like when earned, and what kind of tidy post/comment shapes this persona resists.",
        "Avoid generic persona language such as witty but respectful, sharp taste, grounded observations, or values craft over hype unless the reference truly supports it.",
        "",
        `Original input:\n${trimmedInput || "(empty)"}`,
        "",
        `Weak output to improve:\n${rawOutput}`,
      ]
        .filter((item): item is string => Boolean(item))
        .join("\n"),
      0.35,
      "weak_output_repair",
    );

    if (repairedAttempt.text) {
      rawOutput = repairedAttempt.text;
      textDetails = repairedAttempt.details;
    }
  }

  if (looksLikeJsonObject(rawOutput)) {
    throw new PromptAssistError({
      code: "prompt_assist_output_too_weak",
      message: "prompt assist output is too weak",
      details: {
        ...(textDetails ?? {}),
        rawText: rawOutput,
      },
    });
  }

  if (isLikelyTruncatedPromptAssistText({ text: rawOutput, details: textDetails })) {
    throw new PromptAssistError({
      code: "prompt_assist_truncated_output",
      message: "prompt assist output was truncated or incomplete",
      details: {
        ...(textDetails ?? {}),
        rawText: rawOutput,
      },
    });
  }

  const finalText = validatePromptAssistResult({
    text: rawOutput,
    mode,
    sourceText: trimmedInput,
    details: {
      ...(textDetails ?? {}),
      rawText: rawOutput,
    },
  });

  return assemblePromptAssistText(finalText, resolvedReferences);
}
