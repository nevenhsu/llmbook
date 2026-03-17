import type { PromptActionType } from "@/lib/ai/prompt-runtime/prompt-builder";
import type { RuntimeSoulProfile } from "@/lib/ai/soul/runtime-soul-profile";

export type PromptPersonaExample = {
  scenario: string;
  response: string;
};

export type PromptPersonaDirectives = {
  voiceContract: string[];
  antiStyleRules: string[];
  enactmentRules: string[];
  inCharacterExamples: PromptPersonaExample[];
  referenceRoleGuidance: string[];
  framingSignals: string[];
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function uniqueNonEmpty(values: Array<string | null | undefined>, limit?: number): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    if (typeof value !== "string") {
      continue;
    }
    const normalized = normalizeText(value);
    if (!normalized) {
      continue;
    }
    const key = normalized.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(normalized);
    if (typeof limit === "number" && result.length >= limit) {
      break;
    }
  }

  return result;
}

function readPersonaIdentity(personaCore?: Record<string, unknown> | null): string | null {
  const identitySummary = asRecord(personaCore?.identity_summary);
  const oneSentence =
    typeof identitySummary?.one_sentence_identity === "string"
      ? identitySummary.one_sentence_identity
      : null;
  const archetype =
    typeof identitySummary?.archetype === "string" ? identitySummary.archetype : null;
  return uniqueNonEmpty([oneSentence, archetype], 1)[0] ?? null;
}

function readPersonaNonGenericTraits(personaCore?: Record<string, unknown> | null): string[] {
  const interactionDefaults = asRecord(personaCore?.interaction_defaults);
  return Array.isArray(interactionDefaults?.non_generic_traits)
    ? uniqueNonEmpty(
        interactionDefaults.non_generic_traits.filter(
          (item): item is string => typeof item === "string",
        ),
        6,
      )
    : [];
}

function readPersonaDiscussionStrengths(personaCore?: Record<string, unknown> | null): string[] {
  const interactionDefaults = asRecord(personaCore?.interaction_defaults);
  return Array.isArray(interactionDefaults?.discussion_strengths)
    ? uniqueNonEmpty(
        interactionDefaults.discussion_strengths.filter(
          (item): item is string => typeof item === "string",
        ),
        6,
      )
    : [];
}

function readPersonaDislikedPatterns(personaCore?: Record<string, unknown> | null): string[] {
  const aestheticProfile = asRecord(personaCore?.aesthetic_profile);
  return Array.isArray(aestheticProfile?.disliked_patterns)
    ? uniqueNonEmpty(
        aestheticProfile.disliked_patterns.filter(
          (item): item is string => typeof item === "string",
        ),
        6,
      )
    : [];
}

function readPersonaReferences(personaCore?: Record<string, unknown> | null): string[] {
  const referenceSources = Array.isArray(personaCore?.reference_sources)
    ? personaCore.reference_sources
    : [];
  return uniqueNonEmpty(
    referenceSources
      .map((item) => {
        const record = asRecord(item);
        return typeof record?.name === "string" ? record.name : null;
      })
      .filter((item): item is string => Boolean(item)),
    3,
  );
}

function deriveReferenceRoleGuidance(personaCore?: Record<string, unknown> | null): string[] {
  const referenceSources = Array.isArray(personaCore?.reference_sources)
    ? personaCore.reference_sources
    : [];

  return uniqueNonEmpty(
    referenceSources
      .map((item) => {
        const record = asRecord(item);
        const name = typeof record?.name === "string" ? normalizeText(record.name) : "";
        const type = typeof record?.type === "string" ? record.type.trim().toLowerCase() : "";
        if (!name) {
          return null;
        }
        if (type.includes("organization") || type.includes("group") || type.includes("team")) {
          return `Use ${name} as a group-loyalty role model for belonging language, in-group protection, and trust-first conflict framing.`;
        }
        if (
          type.includes("source_material") ||
          type.includes("franchise") ||
          type.includes("series") ||
          type.includes("world") ||
          type.includes("setting")
        ) {
          return `Use ${name} as a worldview role model for how conflict, stakes, and pressure should be framed, not as decoration or name-dropping.`;
        }
        if (type.includes("character") || type.includes("figure") || type.includes("person")) {
          return `Use ${name} as a behavioral role model for stance, immediate reaction, and how the persona reads loyalty, conflict, and authority.`;
        }
        return `Use ${name} as behavioral source material for what the persona notices first, protects first, and challenges first.`;
      })
      .filter((item): item is string => Boolean(item)),
    3,
  );
}

function buildReferenceRoleImpulse(referenceRoleGuidance: string[]): string | null {
  const guidance = referenceRoleGuidance[0];
  if (!guidance) {
    return null;
  }
  if (/group-loyalty role model/i.test(guidance)) {
    return "I notice who is backing their people and who is just hiding behind rank.";
  }
  if (/behavioral role model/i.test(guidance)) {
    return "I care about what you do when pressure hits, not how impressive the speech sounds.";
  }
  if (/worldview role model/i.test(guidance)) {
    return "Pressure should reveal the real stakes, not flatten everything into safe explanation.";
  }
  return "I start from what matters under pressure, not from what sounds tidy on the surface.";
}

function derivePersonaFramingSignals(input: {
  topValue: string;
  promptHint: string;
  defaultStance: string;
  nonGenericTraits: string[];
  frictionTriggers: string[];
  referenceRoleGuidance: string[];
}): string[] {
  const sourceText = [
    input.topValue,
    input.promptHint,
    input.defaultStance,
    ...input.nonGenericTraits,
    ...input.frictionTriggers,
    ...input.referenceRoleGuidance,
  ].join(" ");

  return uniqueNonEmpty(
    [
      containsAnyText(sourceText, ["loyal", "crew", "found family", "trust-first"]) ? "crew" : null,
      containsAnyText(sourceText, ["loyal", "crew", "found family", "trust-first"])
        ? "loyalty"
        : null,
      containsAnyText(sourceText, ["protect", "back", "promise", "honor"]) ? "protect" : null,
      containsAnyText(sourceText, ["authority", "hierarchy", "rank", "admiral"])
        ? "authority"
        : null,
      containsAnyText(sourceText, ["authority", "hierarchy", "rank", "admiral"]) ? "rank" : null,
      containsAnyText(sourceText, ["pressure", "stakes", "conflict", "fight"]) ? "pressure" : null,
      containsAnyText(sourceText, ["evidence", "proof", "action", "what you do"]) ? "proof" : null,
      containsAnyText(sourceText, ["loyal", "crew", "found family", "trust-first"]) ? "船員" : null,
      containsAnyText(sourceText, ["loyal", "crew", "found family", "trust-first"]) ? "忠誠" : null,
      containsAnyText(sourceText, ["authority", "hierarchy", "rank", "admiral"]) ? "權威" : null,
      containsAnyText(sourceText, ["authority", "hierarchy", "rank", "admiral"]) ? "階級" : null,
      containsAnyText(sourceText, ["pressure", "stakes", "conflict", "fight"]) ? "壓力" : null,
      containsAnyText(sourceText, ["protect", "back", "promise", "honor"]) ? "保護" : null,
      containsAnyText(sourceText, ["evidence", "proof", "action", "what you do"]) ? "證據" : null,
    ],
    10,
  );
}

function containsAnyText(text: string, patterns: string[]): boolean {
  const normalized = text.toLowerCase();
  return patterns.some((pattern) => normalized.includes(pattern.toLowerCase()));
}

function buildExampleResponse(input: {
  trigger: string;
  topValue: string;
  trait: string;
  referenceRoleImpulse?: string | null;
}): string {
  const topValue = input.topValue.toLowerCase().replace(/\.$/, "");
  const trigger = input.trigger.toLowerCase().replace(/\.$/, "");
  const trait = normalizeText(input.trait).replace(/\.+$/, "");
  const reaction =
    input.referenceRoleImpulse ?? "I want to know who actually showed up when pressure hit.";
  return normalizeText(
    `Nah, that reads like ${trigger} and I am not saluting it like some admiral speech. I care more about ${topValue} and who actually backed the crew than how polished the line sounds. ${reaction} ${trait}. Show the concrete move, the proof, or the damage.`,
  );
}

function buildCreativeFeedbackResponse(input: {
  stance: string;
  feedbackPrinciple: string;
  referenceRoleImpulse?: string | null;
}): string {
  const emphasis = input.feedbackPrinciple.toLowerCase().replace(/\.+$/, "");
  const stance = normalizeText(input.stance).replace(/\.+$/, "");
  const reaction =
    input.referenceRoleImpulse ?? "Keep the part that still feels alive when the pressure hits.";
  return normalizeText(
    `The raw part works. Keep that. Push the edge with ${emphasis}, but do not polish the life out of it just to impress people hiding behind taste. Make the wrong part feel wrong in your gut, not neat on a mood board. ${reaction} ${stance}.`,
  );
}

export function derivePromptPersonaDirectives(input: {
  profile: RuntimeSoulProfile;
  personaCore?: Record<string, unknown> | null;
}): PromptPersonaDirectives {
  const identity = readPersonaIdentity(input.personaCore) ?? input.profile.identityCore.archetype;
  const topValue = input.profile.valueHierarchy[0]?.value ?? "the persona's priorities";
  const defaultStance =
    input.profile.relationshipTendencies.defaultStance || "the persona's default stance";
  const promptHint = input.profile.reasoningLens.promptHint;
  const tones = uniqueNonEmpty(input.profile.responseStyle.tone, 3);
  const frictions = uniqueNonEmpty(input.profile.relationshipTendencies.frictionTriggers, 3);
  const avoidPatterns = uniqueNonEmpty(
    [
      ...input.profile.responseStyle.avoid,
      ...input.profile.decisionPolicy.antiPatterns,
      ...readPersonaDislikedPatterns(input.personaCore),
    ],
    7,
  );
  const lexicalTaboos = uniqueNonEmpty(input.profile.languageSignature.lexicalTaboos, 3);
  const nonGenericTraits = uniqueNonEmpty(
    [...input.profile.agentEnactmentRules, ...readPersonaNonGenericTraits(input.personaCore)],
    6,
  );
  const discussionStrengths = uniqueNonEmpty(
    [
      ...input.profile.interactionDoctrine.feedbackPrinciples,
      ...readPersonaDiscussionStrengths(input.personaCore),
    ],
    4,
  );
  const references = readPersonaReferences(input.personaCore);
  const referenceRoleGuidance = deriveReferenceRoleGuidance(input.personaCore);
  const referenceRoleImpulse = buildReferenceRoleImpulse(referenceRoleGuidance);
  const framingSignals = derivePersonaFramingSignals({
    topValue,
    promptHint,
    defaultStance,
    nonGenericTraits,
    frictionTriggers: frictions,
    referenceRoleGuidance,
  });

  const voiceContract = uniqueNonEmpty(
    [
      `Respond in a way that is recognizably this persona: ${identity}.`,
      "Lead with the persona's immediate reaction before smoothing it into explanation.",
      `Let ${topValue} visibly shape what the response defends, challenges, or protects.`,
      `Keep this relational stance on the page: ${defaultStance}.`,
      promptHint ? `Anchor the response in this cue: ${promptHint}.` : null,
      referenceRoleGuidance.length > 0
        ? `Reason through the persona's reference roles before writing: ${referenceRoleGuidance.join(" ")}`
        : null,
      tones.length > 0 ? `Tonal mix to preserve: ${tones.join(", ")}.` : null,
    ],
    6,
  );

  const antiStyleRules = uniqueNonEmpty(
    [
      "Do not sound like a generic assistant, calm workshop moderator, writing coach, or polished editorial critic.",
      "Do not default to balanced essay framing, tutorial structure, or advice-list formatting unless the task explicitly requires it.",
      avoidPatterns.length > 0
        ? `Avoid persona-breaking patterns like: ${avoidPatterns.join("; ")}.`
        : null,
      lexicalTaboos.length > 0
        ? `Avoid language that feels like: ${lexicalTaboos.join("; ")}.`
        : null,
    ],
    6,
  );

  const enactmentRules = uniqueNonEmpty(
    [
      `React as ${identity}, not as a neutral assistant.`,
      `Favor ${topValue} over detached balance when choosing what to praise, defend, or attack.`,
      nonGenericTraits[0] ? `Keep this trait visible: ${nonGenericTraits[0]}.` : null,
      frictions[0]
        ? `If the context triggers ${frictions[0].toLowerCase()}, let the impatience show instead of sanding it down.`
        : null,
      discussionStrengths[0]
        ? `When making a point, lean into this strength: ${discussionStrengths[0]}.`
        : null,
      referenceRoleGuidance[0]
        ? `Use this reference-role lens to decide what the response notices first, protects first, and challenges first: ${referenceRoleGuidance[0]}`
        : null,
      `Keep the wording in this rhythm: ${input.profile.languageSignature.rhythm}.`,
    ],
    6,
  );

  const primaryTrait = nonGenericTraits[0] ?? "Cut to the real point quickly.";
  const feedbackPrinciple = discussionStrengths[0] ?? "specificity";
  const exampleTrigger =
    frictions[0] ?? "someone using vague confidence to dominate the conversation";
  const inCharacterExamples = [
    {
      scenario: `Someone leans on ${exampleTrigger.toLowerCase()} instead of backing up the claim.`,
      response: buildExampleResponse({
        trigger: exampleTrigger,
        topValue,
        trait: primaryTrait,
        referenceRoleImpulse,
      }),
    },
    {
      scenario: "Someone shares rough creative work with obvious sincerity and asks if it works.",
      response: buildCreativeFeedbackResponse({
        stance: defaultStance,
        feedbackPrinciple,
        referenceRoleImpulse,
      }),
    },
  ];

  return {
    voiceContract,
    antiStyleRules,
    enactmentRules,
    inCharacterExamples,
    referenceRoleGuidance,
    framingSignals,
  };
}

export function detectPersonaVoiceDrift(
  markdown: string,
  options?: { framingSignals?: string[] },
): string[] {
  const normalized = markdown.replace(/\r\n/g, "\n").trim();
  if (!normalized) {
    return [];
  }

  return uniqueNonEmpty([
    ...detectBasePersonaVoiceDrift(normalized),
    ...detectEnglishPersonaVoiceDrift(normalized),
    ...detectChinesePersonaVoiceDrift(normalized),
    ...detectPersonaFramingDrift(normalized, options?.framingSignals ?? []),
  ]);
}

function detectBasePersonaVoiceDrift(normalized: string): string[] {
  const issues: string[] = [];
  const bulletLines = normalized
    .split("\n")
    .filter((line) => /^(\s*[-*]\s+|\s*\d+\.\s+)/.test(line)).length;

  if (/What works:/i.test(normalized) || /What doesn't work:/i.test(normalized)) {
    issues.push("workshop_critique_headings");
  }
  if (bulletLines >= 3) {
    issues.push("advice_list_structure");
  }

  return issues;
}

function detectEnglishPersonaVoiceDrift(normalized: string): string[] {
  const issues: string[] = [];
  if (
    /\b(I recommend|Consider\b|Here are\b|The key is\b|Step by step\b|In summary\b)/i.test(
      normalized,
    )
  ) {
    issues.push("generic_explainer_tone");
  }
  if (
    /^(Okay so|Here'?s the thing|When designing|Instead of|The best|One approach is)/i.test(
      normalized,
    )
  ) {
    issues.push("missing_immediate_reaction");
  }
  if (
    /\b(When designing|Instead of just|One approach is|The best .* is|This works because)\b/i.test(
      normalized,
    )
  ) {
    issues.push("too_clean_editorial_tone");
  }

  return issues;
}

function detectChinesePersonaVoiceDrift(normalized: string): string[] {
  const issues: string[] = [];
  if (/(建議|可以先|以下幾點|總結來說|關鍵在於|首先|其次|最後)/.test(normalized)) {
    issues.push("generic_explainer_tone");
  }
  if (/^(這裡想聊|先聊一下|今天想談|在設計|如果要談|當你在)/.test(normalized)) {
    issues.push("missing_immediate_reaction");
  }
  if (/(在設計|可以先從|建立一個清楚的框架|逐步補上細節|總結來說|關鍵在於)/.test(normalized)) {
    issues.push("too_clean_editorial_tone");
  }

  return issues;
}

function detectPersonaFramingDrift(normalized: string, framingSignals: string[]): string[] {
  if (framingSignals.length === 0) {
    return [];
  }

  const hasSignal = framingSignals.some((signal) => {
    if (!signal) {
      return false;
    }
    return normalized.toLowerCase().includes(signal.toLowerCase()) || normalized.includes(signal);
  });

  return hasSignal ? [] : ["missing_persona_conflict_frame"];
}

export function buildPersonaVoiceRepairPrompt(input: {
  assembledPrompt: string;
  rawOutput: string;
  actionType: Extract<PromptActionType, "post" | "comment">;
  directives: PromptPersonaDirectives;
  issues: string[];
}): string {
  const exampleText = input.directives.inCharacterExamples
    .map((example) => [`Scenario: ${example.scenario}`, `Response: ${example.response}`].join("\n"))
    .join("\n\n");
  const repairInstructions = [
    input.issues.includes("missing_immediate_reaction")
      ? "Let the opening hit with immediate gut reaction instead of a tidy setup."
      : null,
    input.issues.includes("missing_persona_conflict_frame")
      ? "Make loyalty, pressure, protection, betrayal, or authority visible in what the response attacks or defends."
      : null,
    input.issues.includes("too_clean_editorial_tone")
      ? "Do not write like a clean creator newsletter, calm forum explainer, or tasteful editorial post."
      : null,
    input.issues.includes("generic_explainer_tone")
      ? "Strip out generic teaching language and replace it with stance, heat, and consequence."
      : null,
  ]
    .filter((item): item is string => Boolean(item))
    .join("\n");

  return [
    input.assembledPrompt,
    "",
    "[retry_persona_repair]",
    `Your previous ${input.actionType} output drifted away from the persona voice.`,
    `Detected issues: ${input.issues.join(", ")}.`,
    "Rewrite the same response from scratch using the exact same JSON contract and the same language.",
    "Preserve the underlying intent, but make the wording unmistakably in-character.",
    "Reason through the persona's reference roles before rewriting; use them as behavioral source material, not as names to mention.",
    repairInstructions,
    "",
    "[agent_voice_contract]",
    input.directives.voiceContract.join("\n"),
    "",
    "[reference_role_guidance]",
    input.directives.referenceRoleGuidance.join("\n") ||
      "No explicit reference-role guidance available.",
    "",
    "[agent_anti_style_rules]",
    input.directives.antiStyleRules.join("\n"),
    "",
    "[agent_examples]",
    exampleText,
    "",
    "[previous_output]",
    input.rawOutput,
  ].join("\n");
}
