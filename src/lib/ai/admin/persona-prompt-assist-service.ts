import { createDbBackedLlmProviderRegistry } from "@/lib/ai/llm/default-registry";
import { invokeLLM } from "@/lib/ai/llm/invoke-llm";
import { resolveLlmInvocationConfig } from "@/lib/ai/llm/runtime-config-provider";
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
} from "@/lib/ai/admin/control-plane-contract";
import { resolvePersonaTextModel } from "@/lib/ai/admin/control-plane-model-resolution";
import {
  buildExplicitSourceReferenceInstruction,
  buildPromptAssistAttemptDetails,
  buildPromptAssistProviderError,
  extractLikelyNamedReferences,
  hasLikelyNamedReference,
  isLikelyTruncatedPromptAssistText,
  isWeakPromptAssistRewrite,
  parsePersonaGenerationSemanticAuditResult,
  parseResolvedReferenceNames,
  validatePromptAssistResult,
} from "@/lib/ai/admin/persona-generation-contract";

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
  const systemPrompt =
    mode === "random"
      ? [
          "You write one concise extra prompt for generating a forum persona.",
          "Output rules:",
          "English only.",
          "Plain text only.",
          "No markdown, no bullets, no numbering, no labels, no quotes, no JSON.",
          "Maximum 60 words.",
          "Exactly 1 paragraph.",
          "Be precise and concrete.",
          "Include at least 1 explicit real reference name.",
          "Before writing the final prompt, first choose at least 1 real famous reference entity.",
          "Describe the persona's worldview, tone, bias, and interaction style.",
          "Hint at how the persona opens a post or live reply, what metaphor domains it reaches for, how it attacks weak claims, and what praise sounds like when it is genuinely convinced.",
          "Use 1-3 explicit real reference names such as creators, artists, public figures, or fictional characters when they sharpen the persona.",
          "No filler, no explanation, no meta commentary.",
          "Do not mention schema, JSON, database fields, or implementation details.",
          "Do not sound like a generic AI assistant.",
          "Write one fresh prompt only.",
        ].join("\n")
      : [
          "You rewrite an existing extra prompt for generating a forum persona.",
          "Output rules:",
          "Keep the same language as the user's input.",
          "Plain text only.",
          "No markdown, no bullets, no numbering, no labels, no quotes, no JSON.",
          "Maximum 75 words.",
          "Exactly 1 paragraph.",
          "Preserve the user's core intent.",
          "Preserve explicit reference names such as creators, artists, public figures, and fictional characters when the user provides them.",
          "If the user already provided explicit reference names, keep at least 1 of those exact names in the final brief whenever possible; if you swap to a closely related reference, that related name must stay explicit in the final brief.",
          "If the user did not provide any explicit reference name, infer at least 1 fitting real reference entity from the user's clues before writing the final brief.",
          "Interpret the user's input as possible clues about works, eras, domains, styles, genres, countries, personalities, values, or claims.",
          "Make it materially clearer, more specific, and more usable as a persona brief.",
          "Remove fluff, repetition, vagueness, and filler.",
          "Use the resolved reference as behavioral source material, not just as a name to mention.",
          "The final brief must reflect the reference's temperament, values, social energy, interaction style, or core contradiction.",
          "Explicitly sharpen the persona's role or domain, worldview or bias, tone, and interaction style.",
          "Seed task-facing style behavior: hint at how the persona opens posts or live replies, what metaphor domains it reaches for, how it attacks weak claims, what praise sounds like when convinced, and what tidy shapes it resists.",
          "Avoid generic persona language such as witty but respectful, sharp taste, grounded observations, or values craft over hype unless the reference truly supports it.",
          "If the reference name could be swapped with another without changing the rest of the sentence, the result is too generic.",
          "Do not merely append a reference name to the user's original sentence.",
          "Do not start with imperative framing like Generate/Create/Write; return the rewritten brief itself.",
          "Do not mention schema, JSON, database fields, or implementation details.",
          "Do not explain your edits.",
          "Return only the rewritten prompt.",
        ].join("\n");
  const userPrompt =
    mode === "random"
      ? "Create one concise extra prompt for a new forum persona."
      : `Rewrite this extra prompt to be more precise and concise while preserving intent:\n\n${trimmedInput}`;

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
  const sourceReferenceNames = extractLikelyNamedReferences(trimmedInput);
  const explicitSourceReferenceInstruction =
    mode === "optimize" ? buildExplicitSourceReferenceInstruction(sourceReferenceNames) : null;
  const invokePromptAssist = async (
    promptText: string,
    temperature: number,
    stage: PromptAssistAttemptStage,
    maxOutputTokens = PROMPT_ASSIST_MAX_OUTPUT_TOKENS,
  ): Promise<{ text: string; details: Record<string, unknown> }> => {
    const llmResult = await invokeLLM({
      registry,
      taskType: "generic",
      routeOverride: invocationConfig.route,
      modelInput: {
        prompt: promptText,
        maxOutputTokens: Math.min(model.maxOutputTokens ?? maxOutputTokens, maxOutputTokens),
        temperature,
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

  const runReferencePresenceAudit = async (
    candidateText: string,
  ): Promise<PersonaGenerationSemanticAuditResult> => {
    const auditPrompt = [
      "[prompt_assist_reference_audit]",
      "You are judging whether the persona brief below includes at least 1 explicit real reference name in visible text.",
      "Judge semantics, not regex.",
      "A single explicit proper name such as Plato counts.",
      "A phrase like Plato-inspired or inspired by Plato counts.",
      "Anonymous style description without a visible real name does not count.",
      "Return exactly one JSON object.",
      "Return raw JSON only. Do not use markdown fences.",
      "passes: boolean",
      "issues: string[]",
      "repairGuidance: string[]",
      "Keep every issue and repairGuidance item short and functional.",
      "",
      "[persona_brief]",
      candidateText,
    ].join("\n");

    const auditAttempt = await invokePromptAssist(
      auditPrompt,
      0,
      "reference_presence_audit",
      PROMPT_ASSIST_REFERENCE_AUDIT_MAX_OUTPUT_TOKENS,
    );

    if (!auditAttempt.text) {
      return { passes: true, issues: [], repairGuidance: [] };
    }

    try {
      return parsePersonaGenerationSemanticAuditResult(auditAttempt.text);
    } catch {
      return { passes: true, issues: [], repairGuidance: [] };
    }
  };

  const hasExplicitReference = trimmedInput.length > 0 && hasLikelyNamedReference(trimmedInput);
  const resolveReferenceNames = async (): Promise<string[]> => {
    if (hasExplicitReference) {
      return [];
    }

    const resolverPrompt =
      mode === "random"
        ? [
            "Choose 1 to 3 real famous reference entities for a distinct forum persona.",
            "Return only the names, separated by |.",
            "No explanation, no prose, no bullets, no numbering.",
            "Allowed types include creators, artists, public figures, fictional characters, and works.",
          ].join("\n")
        : [
            "Infer 1 to 3 fitting real reference entities from the user's persona clues.",
            "The clues may refer to works, eras, domains, styles, genres, countries, personalities, values, or claims.",
            "Return only the names, separated by |.",
            "No explanation, no prose, no bullets, no numbering.",
            "",
            `User input:\n${trimmedInput}`,
          ].join("\n");

    const firstPass = parseResolvedReferenceNames(
      (
        await invokePromptAssist(
          resolverPrompt,
          mode === "random" ? 0.9 : 0.35,
          "reference_resolution",
        )
      ).text,
    );
    if (firstPass.length > 0) {
      return firstPass;
    }

    const repairResolverPrompt =
      mode === "random"
        ? [
            "Your previous answer did not return valid reference names.",
            "Return 1 to 3 real famous people, characters, or works only.",
            "Use the format: Name | Name | Name",
            "No explanation.",
          ].join("\n")
        : [
            "Your previous answer did not return valid reference names.",
            "Infer 1 to 3 fitting real reference entities from the user's persona clues.",
            "Return only the names in this format: Name | Name | Name",
            "No explanation.",
            "",
            `User input:\n${trimmedInput}`,
          ].join("\n");

    return parseResolvedReferenceNames(
      (
        await invokePromptAssist(
          repairResolverPrompt,
          mode === "random" ? 0.7 : 0.25,
          "reference_resolution",
        )
      ).text,
    );
  };

  const resolvedReferenceNames = await resolveReferenceNames();
  const resolvedReferenceInstruction =
    resolvedReferenceNames.length > 0
      ? mode === "random"
        ? `Use at least 1 of these resolved reference entities: ${resolvedReferenceNames.join(", ")}.`
        : `Use at least 1 of these resolved reference entities if they fit: ${resolvedReferenceNames.join(", ")}.`
      : null;
  const mainPrompt = [
    systemPrompt,
    explicitSourceReferenceInstruction,
    resolvedReferenceInstruction,
    userPrompt,
  ]
    .filter((item): item is string => Boolean(item))
    .join("\n\n");

  let mainAttempt = await invokePromptAssist(
    mainPrompt,
    mode === "random" ? 0.8 : 0.3,
    "main_rewrite",
  );
  let text = mainAttempt.text;
  let textDetails = mainAttempt.details;
  if (!text) {
    const emptyRepairPrompt = [
      systemPrompt,
      explicitSourceReferenceInstruction,
      resolvedReferenceInstruction,
      userPrompt,
      "",
      "[retry_repair]",
      "Your previous prompt-assist output was empty.",
      "Rewrite from scratch and return one usable persona brief only.",
      mode === "random"
        ? "Keep it concise, in English, and explicitly grounded in a real named reference."
        : "Keep the same language as the user's input and include at least 1 explicit real reference name.",
      "Do not explain the failure.",
      "Do not return blank output.",
    ]
      .filter((item): item is string => Boolean(item))
      .join("\n\n");
    const repairAttempt = await invokePromptAssist(
      emptyRepairPrompt,
      mode === "random" ? 0.65 : 0.25,
      "empty_output_repair",
    );
    text = repairAttempt.text;
    textDetails = repairAttempt.details;
  }
  if (!text) {
    throw new PromptAssistError({
      code: "prompt_assist_repair_output_empty",
      message: "prompt assist repair returned empty output",
      details: textDetails,
    });
  }

  if (isWeakPromptAssistRewrite({ text, mode, sourceText: trimmedInput })) {
    const repairPrompt = [
      "The previous rewrite was too weak.",
      "Rewrite the user's persona brief into a meaningfully clearer and more specific version.",
      "Keep the same language as the user's input.",
      "Plain text only.",
      "Exactly 1 paragraph, maximum 75 words.",
      "Preserve the core intent.",
      "Include at least 1 explicit real reference name.",
      explicitSourceReferenceInstruction,
      resolvedReferenceInstruction,
      "If there is no explicit reference in the user input, infer one from the clues before writing.",
      "Treat the input as possible clues about works, eras, domains, styles, genres, countries, personalities, values, or claims.",
      "Use the resolved reference as behavioral source material, not just as a name to mention.",
      "Make the final brief reflect the reference's temperament, values, social energy, interaction style, or core contradiction.",
      "Make the role or domain, worldview or bias, tone, and interaction style obvious in the sentence itself.",
      "Make the brief imply a concrete opening move, recurring metaphor domains, how weak claims get challenged, what praise sounds like when earned, and what kind of tidy post/comment shapes this persona resists.",
      "Avoid generic persona language such as witty but respectful, sharp taste, grounded observations, or values craft over hype unless the reference truly supports it.",
      "If the reference name could be swapped with another without changing the rest of the sentence, the rewrite is still too weak.",
      "Do not simply append a reference name to the original sentence.",
      "Do not start with Generate/Create/Write or similar imperative phrasing.",
      "Return only the rewritten brief.",
      "",
      `Original input:\n${trimmedInput}`,
      "",
      `Weak rewrite to improve:\n${text}`,
    ]
      .filter((item): item is string => Boolean(item))
      .join("\n");

    const repairedAttempt = await invokePromptAssist(repairPrompt, 0.35, "weak_output_repair");
    if (repairedAttempt.text) {
      text = repairedAttempt.text;
      textDetails = repairedAttempt.details;
    }
  }

  if (isLikelyTruncatedPromptAssistText({ text, details: textDetails })) {
    const truncatedRepairPrompt = [
      systemPrompt,
      explicitSourceReferenceInstruction,
      resolvedReferenceInstruction,
      userPrompt,
      "",
      "[retry_repair]",
      "The previous rewrite was truncated or incomplete.",
      "Rewrite from scratch and return one complete persona brief only.",
      "Do not end with a dangling conjunction, unfinished clause, or cut-off sentence.",
      "Return one complete paragraph with a clean ending.",
    ]
      .filter((item): item is string => Boolean(item))
      .join("\n\n");
    const repairedAttempt = await invokePromptAssist(
      truncatedRepairPrompt,
      mode === "random" ? 0.55 : 0.25,
      "truncated_output_repair",
    );
    if (!repairedAttempt.text) {
      throw new PromptAssistError({
        code: "prompt_assist_repair_output_empty",
        message: "prompt assist truncation repair returned empty output",
        details: repairedAttempt.details,
      });
    }
    text = repairedAttempt.text;
    textDetails = repairedAttempt.details;
  }

  if (isLikelyTruncatedPromptAssistText({ text, details: textDetails })) {
    throw new PromptAssistError({
      code: "prompt_assist_truncated_output",
      message: "prompt assist output was truncated or incomplete",
      details: textDetails,
    });
  }

  let referenceAudit = await runReferencePresenceAudit(text);
  if (!referenceAudit.passes) {
    const referenceRepairPrompt = [
      systemPrompt,
      explicitSourceReferenceInstruction,
      resolvedReferenceInstruction,
      userPrompt,
      "",
      "[retry_repair]",
      "The previous rewrite did not keep at least one explicit real reference name visible in the final brief.",
      ...referenceAudit.repairGuidance,
      mode === "optimize" && sourceReferenceNames.length > 0
        ? "Keep at least one original source reference name explicit in the final brief whenever possible."
        : "Keep at least one explicit real reference name visible in the final brief.",
      "If you switch to a closely related reference, keep that related name explicit in the final brief.",
      "Rewrite from scratch and return one complete persona brief only.",
    ]
      .filter((item): item is string => Boolean(item))
      .join("\n\n");
    const repairedAttempt = await invokePromptAssist(
      referenceRepairPrompt,
      mode === "random" ? 0.55 : 0.25,
      "reference_name_repair",
    );
    if (repairedAttempt.text) {
      text = repairedAttempt.text;
      textDetails = repairedAttempt.details;
      referenceAudit = await runReferencePresenceAudit(text);
    }
  }

  if (!referenceAudit.passes) {
    throw new PromptAssistError({
      code: "prompt_assist_missing_reference",
      message: "prompt assist output must include at least 1 explicit real reference name",
      details: {
        ...(textDetails ?? {}),
        auditIssues: referenceAudit.issues,
        auditRepairGuidance: referenceAudit.repairGuidance,
      },
    });
  }

  return validatePromptAssistResult({
    text,
    mode,
    sourceText: trimmedInput,
    details: textDetails,
  });
}
