import type { PromptActionType } from "@/lib/ai/prompt-runtime/prompt-builder";
import type { RuntimeCoreProfile } from "@/lib/ai/core/runtime-core-profile";

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
};

export type PromptPersonaEvidence = {
  displayName: string | null;
  identity: string | null;
  referenceSourceNames: string[];
  doctrine: {
    valueFit: string[];
    reasoningFit: string[];
    discourseFit: string[];
    expressionFit: string[];
  };
};

type PersonaDirectiveActionType = Extract<PromptActionType, "post" | "comment">;

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

function readPersonaDefaultStance(personaCore?: Record<string, unknown> | null): string | null {
  const interactionDefaults = asRecord(personaCore?.interaction_defaults);
  return typeof interactionDefaults?.default_stance === "string"
    ? normalizeText(interactionDefaults.default_stance)
    : null;
}

function readPersonaFrictionTriggers(personaCore?: Record<string, unknown> | null): string[] {
  const interactionDefaults = asRecord(personaCore?.interaction_defaults);
  return Array.isArray(interactionDefaults?.friction_triggers)
    ? uniqueNonEmpty(
        interactionDefaults.friction_triggers.filter(
          (item): item is string => typeof item === "string",
        ),
        4,
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
    return "I notice who shows up for others and who hides behind status.";
  }
  if (/behavioral role model/i.test(guidance)) {
    return "I care about what someone does when pressure hits, not just how polished the language sounds.";
  }
  if (/worldview role model/i.test(guidance)) {
    return "Pressure should reveal the real stakes, not flatten everything into safe explanation.";
  }
  return "I start from what matters under pressure, not from what sounds tidy on the surface.";
}

function buildExampleResponse(input: {
  trigger: string;
  topValue: string;
  trait: string;
  openingMove: string;
  attackStyle: string;
  referenceRoleImpulse?: string | null;
}): string {
  const topValue = input.topValue.toLowerCase().replace(/\.$/, "");
  const trigger = input.trigger.toLowerCase().replace(/\.$/, "");
  const trait = normalizeText(input.trait).replace(/\.+$/, "");
  const reaction =
    input.referenceRoleImpulse ?? "I care about what actually happened once the pressure hit.";
  return normalizeText(
    `${input.openingMove} That reads like ${trigger}, and I do not buy it yet. I care more about ${topValue} and what someone actually did than how polished the line sounds. ${reaction} ${input.attackStyle}. ${trait}. Show the concrete move, the proof, or the consequence.`,
  );
}

function buildCreativeFeedbackResponse(input: {
  stance: string;
  feedbackPrinciple: string;
  praiseStyle: string;
  referenceRoleImpulse?: string | null;
}): string {
  const emphasis = input.feedbackPrinciple.toLowerCase().replace(/\.+$/, "");
  const stance = normalizeText(input.stance).replace(/\.+$/, "");
  const reaction =
    input.referenceRoleImpulse ?? "Keep the live part intact when the pressure hits.";
  return normalizeText(
    `The live part works. Keep that. ${input.praiseStyle}. Push the edge with ${emphasis}, but do not polish the core away just to impress people chasing surface-level taste. Make the weak edge feel resolved in the gut, not merely tidy on the surface. ${reaction} ${stance}.`,
  );
}

function buildPostOpeningResponse(input: {
  thesisFocus: string;
  topValue: string;
  openingMove: string;
  referenceRoleImpulse?: string | null;
}): string {
  const thesisFocus = normalizeText(input.thesisFocus).replace(/\.+$/, "");
  const topValue = input.topValue.toLowerCase().replace(/\.$/, "");
  const reaction =
    input.referenceRoleImpulse ??
    "Start from the pressure point instead of easing into a safe summary.";
  return normalizeText(
    `${input.openingMove} My first take is simple: ${thesisFocus}. Let ${topValue} decide what gets defended, challenged, or dragged into the light. ${reaction}`,
  );
}

function buildPostWorldviewResponse(input: {
  worldviewFocus: string;
  stance: string;
  closeShape: string;
  referenceRoleImpulse?: string | null;
}): string {
  const worldviewFocus = normalizeText(input.worldviewFocus).replace(/\.+$/, "");
  const stance = normalizeText(input.stance).replace(/\.+$/, "");
  const reaction =
    input.referenceRoleImpulse ??
    "Keep the worldview visible through what the post notices first, not through neat exposition.";
  return normalizeText(
    `If I am posting about it, I am not flattening it into neutral commentary. I would frame it through ${worldviewFocus}. ${reaction} ${stance}. ${input.closeShape}`,
  );
}

export function buildPlannerPostingLens(input: {
  profile: RuntimeCoreProfile;
  personaCore?: Record<string, unknown> | null;
}): string[] {
  const stance =
    readPersonaDefaultStance(input.personaCore) ??
    input.profile.interactionDoctrine.collaborationStance;
  const discussionStrengths = readPersonaDiscussionStrengths(input.personaCore);
  const nonGenericTraits = readPersonaNonGenericTraits(input.personaCore);
  const references = readPersonaReferences(input.personaCore);

  return uniqueNonEmpty(
    [
      `This persona tends to post when ${discussionStrengths[0] ?? "a hidden assumption or weak framing needs to be exposed"}.`,
      `Natural post framing: ${input.profile.taskStyleMatrix.post.entryShape}`,
      `Discussion stance: ${stance}.`,
      nonGenericTraits[0] ? `Keep this posting trait visible: ${nonGenericTraits[0]}.` : null,
      references.length > 0
        ? `Reference roles to keep in view while planning: ${references.join(", ")}.`
        : null,
      "Make the title feel like a pointed intervention from this persona, not a neutral explainer.",
    ],
    6,
  );
}

export function buildPersonaEvidence(input: {
  displayName?: string | null;
  profile: RuntimeCoreProfile;
  personaCore?: Record<string, unknown> | null;
}): PromptPersonaEvidence {
  const identity = readPersonaIdentity(input.personaCore) ?? input.profile.identityCore.archetype;
  const defaultStance =
    readPersonaDefaultStance(input.personaCore) ??
    input.profile.interactionDoctrine.collaborationStance;
  const discussionStrengths = readPersonaDiscussionStrengths(input.personaCore);
  const nonGenericTraits = readPersonaNonGenericTraits(input.personaCore);
  const referenceSourceNames = readPersonaReferences(input.personaCore);

  return {
    displayName: input.displayName?.trim() || null,
    identity,
    referenceSourceNames,
    doctrine: {
      valueFit: uniqueNonEmpty(
        [
          ...input.profile.valueHierarchy
            .slice()
            .sort((a, b) => a.priority - b.priority)
            .slice(0, 3)
            .map((entry) => entry.value),
          ...discussionStrengths.slice(0, 2),
        ],
        5,
      ),
      reasoningFit: uniqueNonEmpty(
        [
          ...input.profile.reasoningLens.primary.slice(0, 3),
          input.profile.reasoningLens.promptHint,
          ...readPersonaFrictionTriggers(input.personaCore).slice(0, 2),
        ],
        6,
      ),
      discourseFit: uniqueNonEmpty(
        [
          input.profile.taskStyleMatrix.post.entryShape,
          input.profile.taskStyleMatrix.comment.feedbackShape,
          input.profile.taskStyleMatrix.comment.closeShape,
          ...discussionStrengths.slice(0, 2),
        ],
        5,
      ),
      expressionFit: uniqueNonEmpty(
        [
          input.profile.voiceFingerprint.openingMove,
          input.profile.voiceFingerprint.attackStyle,
          input.profile.voiceFingerprint.closingMove,
          defaultStance,
          ...nonGenericTraits.slice(0, 2),
        ],
        6,
      ),
    },
  };
}

export function derivePromptPersonaDirectives(input: {
  actionType: PersonaDirectiveActionType;
  profile: RuntimeCoreProfile;
  personaCore?: Record<string, unknown> | null;
}): PromptPersonaDirectives {
  const isPost = input.actionType === "post";
  const identity = readPersonaIdentity(input.personaCore) ?? input.profile.identityCore.archetype;
  const topValue = input.profile.valueHierarchy[0]?.value ?? "the persona's priorities";
  const defaultStance =
    readPersonaDefaultStance(input.personaCore) ??
    input.profile.interactionDoctrine.collaborationStance ??
    "the persona's discussion stance";
  const promptHint = input.profile.reasoningLens.promptHint;
  const tones = uniqueNonEmpty(input.profile.responseStyle.tone, 3);
  const frictions = readPersonaFrictionTriggers(input.personaCore);
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
  const voiceFingerprint = input.profile.voiceFingerprint;
  const taskStyle = isPost
    ? input.profile.taskStyleMatrix.post
    : input.profile.taskStyleMatrix.comment;
  const forbiddenShapes = uniqueNonEmpty(
    [...voiceFingerprint.forbiddenShapes, ...taskStyle.forbiddenShapes],
    6,
  );

  const voiceContract = uniqueNonEmpty(
    [
      `Respond in a way that is recognizably this persona: ${identity}.`,
      `Use this opening move: ${voiceFingerprint.openingMove}`,
      `Let ${topValue} visibly shape what the response defends, challenges, or protects.`,
      `Keep this discussion stance on the page: ${defaultStance}.`,
      `When the response needs imagery or analogy, prefer these metaphor domains: ${voiceFingerprint.metaphorDomains.join(", ")}.`,
      promptHint ? `Anchor the response in this cue: ${promptHint}.` : null,
      referenceRoleGuidance.length > 0
        ? `Reason through the persona's reference roles before writing: ${referenceRoleGuidance.join(" ")}`
        : null,
      isPost
        ? `Shape the post so the thesis stays unmistakable: entry ${input.profile.taskStyleMatrix.post.entryShape} Body ${input.profile.taskStyleMatrix.post.bodyShape} Close ${input.profile.taskStyleMatrix.post.closeShape}`
        : `Shape the reply like this: entry ${input.profile.taskStyleMatrix.comment.entryShape} Feedback ${input.profile.taskStyleMatrix.comment.feedbackShape} Close ${input.profile.taskStyleMatrix.comment.closeShape}`,
      tones.length > 0 ? `Tonal mix to preserve: ${tones.join(", ")}.` : null,
    ],
    8,
  );

  const antiStyleRules = uniqueNonEmpty(
    [
      "Do not sound like a generic assistant, calm workshop moderator, writing coach, or polished editorial critic.",
      isPost
        ? "Do not default to balanced essay framing, op-ed neatness, tutorial structure, or advice-list formatting unless the task explicitly requires it."
        : "Do not default to generic helpfulness, detached summary, tutorial structure, or advice-list formatting unless the task explicitly requires it.",
      forbiddenShapes.length > 0
        ? `Do not fall into forbidden shapes like: ${forbiddenShapes.join("; ")}.`
        : null,
      avoidPatterns.length > 0
        ? `Avoid persona-breaking patterns like: ${avoidPatterns.join("; ")}.`
        : null,
      lexicalTaboos.length > 0
        ? `Avoid language that feels like: ${lexicalTaboos.join("; ")}.`
        : null,
      isPost
        ? "Do not write like a tidy newsletter, tasteful explainer, or clean product brief."
        : "Do not write like a sanitized moderator reply or a helpful support macro.",
    ],
    7,
  );

  const enactmentRules = uniqueNonEmpty(
    [
      `React as ${identity}, not as a neutral assistant.`,
      `Favor ${topValue} over detached balance when choosing what to praise, defend, or attack.`,
      `Attack weak claims in this style: ${voiceFingerprint.attackStyle}.`,
      `When something earns praise, use this praise style: ${voiceFingerprint.praiseStyle}.`,
      referenceRoleGuidance[0]
        ? `Use this reference-role lens to decide what the response notices first, protects first, and challenges first: ${referenceRoleGuidance[0]}`
        : null,
      nonGenericTraits[0] ? `Keep this trait visible: ${nonGenericTraits[0]}.` : null,
      frictions[0]
        ? `If the context triggers ${frictions[0].toLowerCase()}, let the impatience show instead of sanding it down.`
        : null,
      discussionStrengths[0]
        ? `When making a point, lean into this strength: ${discussionStrengths[0]}.`
        : null,
      isPost
        ? `Keep the thesis visible early through this post structure: ${input.profile.taskStyleMatrix.post.entryShape} Then ${input.profile.taskStyleMatrix.post.bodyShape} Then ${input.profile.taskStyleMatrix.post.closeShape}`
        : `Reply to the live tension in the thread with this shape: ${input.profile.taskStyleMatrix.comment.feedbackShape}. Close like this: ${input.profile.taskStyleMatrix.comment.closeShape}`,
      `Keep the wording in this rhythm: ${input.profile.languageSignature.rhythm}.`,
    ],
    9,
  );

  const primaryTrait = nonGenericTraits[0] ?? "Cut to the real point quickly.";
  const feedbackPrinciple = discussionStrengths[0] ?? "specificity";
  const exampleTrigger =
    frictions[0] ?? "someone using vague confidence to dominate the conversation";
  const inCharacterExamples = isPost
    ? [
        {
          scenario:
            "Writing a new forum post about a topic that feels overhyped, misunderstood, or too safely framed.",
          response: buildPostOpeningResponse({
            thesisFocus:
              input.profile.taskStyleMatrix.post.entryShape ??
              discussionStrengths[0] ??
              promptHint ??
              "state the real angle fast",
            topValue,
            openingMove: voiceFingerprint.openingMove,
            referenceRoleImpulse,
          }),
        },
        {
          scenario:
            "Writing a post that should show the persona's worldview instead of sounding like tidy commentary.",
          response: buildPostWorldviewResponse({
            worldviewFocus: input.profile.taskStyleMatrix.post.bodyShape,
            stance: defaultStance,
            closeShape: input.profile.taskStyleMatrix.post.closeShape,
            referenceRoleImpulse,
          }),
        },
      ]
    : [
        {
          scenario: `Someone leans on ${exampleTrigger.toLowerCase()} instead of backing up the claim.`,
          response: buildExampleResponse({
            trigger: exampleTrigger,
            topValue,
            trait: primaryTrait,
            openingMove: voiceFingerprint.openingMove,
            attackStyle: voiceFingerprint.attackStyle,
            referenceRoleImpulse,
          }),
        },
        {
          scenario:
            "Someone shares rough creative work with obvious sincerity and asks if it works.",
          response: buildCreativeFeedbackResponse({
            stance: defaultStance,
            feedbackPrinciple,
            praiseStyle: voiceFingerprint.praiseStyle,
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
  };
}

export function detectPersonaVoiceDrift(markdown: string): string[] {
  const normalized = markdown.replace(/\r\n/g, "\n").trim();
  if (!normalized) {
    return [];
  }

  return uniqueNonEmpty([
    ...detectBasePersonaVoiceDrift(normalized),
    ...detectEnglishPersonaVoiceDrift(normalized),
    ...detectChinesePersonaVoiceDrift(normalized),
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

export function buildPersonaVoiceRepairPrompt(input: {
  assembledPrompt: string;
  rawOutput: string;
  actionType: Extract<PromptActionType, "post" | "comment">;
  directives: PromptPersonaDirectives;
  issues: string[];
  repairGuidance: string[];
  severity?: "low" | "medium" | "high";
  missingSignals?: string[];
}): string {
  const exampleText = input.directives.inCharacterExamples
    .map((example) => [`Scenario: ${example.scenario}`, `Response: ${example.response}`].join("\n"))
    .join("\n\n");
  const repairInstructions =
    input.repairGuidance.length > 0
      ? input.repairGuidance.join("\n")
      : "Rewrite the content so the persona voice is unmistakable and policy-compliant.";

  return [
    input.assembledPrompt,
    "",
    "[retry_persona_repair]",
    `Your previous ${input.actionType} output drifted away from the persona voice.`,
    `Detected issues: ${input.issues.join(", ")}.`,
    `Audit severity: ${input.severity ?? "medium"}.`,
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
    "[repair_guidance]",
    repairInstructions,
    "",
    "[missing_signals]",
    input.missingSignals && input.missingSignals.length > 0
      ? input.missingSignals.join("\n")
      : "No additional missing signals provided.",
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
