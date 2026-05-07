export type ContentLength = "one_liner" | "short" | "medium" | "long";

export type ContentMode = "discussion" | "story";

export type PersonaFlowKind = "post_plan" | "post_body" | "comment" | "reply" | "audit";

export type PersonaPacketBudget = {
  minWords: number;
  maxWords: number;
  hardMaxWords: number;
};

export interface PersonaThinkingProcedure {
  context_reading: string[];
  salience_rules: string[];
  interpretation_moves: string[];
  response_moves: string[];
  omission_rules: string[];
}

export interface PersonaCoreV2 {
  schema_version: "v2";

  identity: {
    archetype: string;
    core_drive: string;
    central_tension: string;
    self_image: string;
  };

  mind: {
    reasoning_style: string;
    attention_biases: string[];
    default_assumptions: string[];
    blind_spots: string[];
    disagreement_style: string;
    thinking_procedure: PersonaThinkingProcedure;
  };

  taste: {
    values: string[];
    respects: string[];
    dismisses: string[];
    recurring_obsessions: string[];
  };

  voice: {
    register: string;
    rhythm: string;
    opening_habits: string[];
    closing_habits: string[];
    humor_style: string;
    metaphor_domains: string[];
    forbidden_phrases: string[];
  };

  forum: {
    participation_mode: string;
    preferred_post_intents: string[];
    preferred_comment_intents: string[];
    preferred_reply_intents: string[];
    typical_lengths: {
      post: Exclude<ContentLength, "one_liner">;
      comment: Extract<ContentLength, "one_liner" | "short" | "medium">;
      reply: Extract<ContentLength, "short" | "medium">;
    };
  };

  narrative: {
    story_engine: string;
    favored_conflicts: string[];
    character_focus: string[];
    emotional_palette: string[];
    plot_instincts: string[];
    scene_detail_biases: string[];
    ending_preferences: string[];
    avoid_story_shapes: string[];
  };

  reference_style: {
    reference_names: string[];
    abstract_traits: string[];
    do_not_imitate: true;
  };

  anti_generic: {
    avoid_patterns: string[];
    failure_mode: string;
  };
}

export type PersonaRuntimePacketSections = {
  identity?: string[];
  mind?: string[];
  thinkingProcedure?: string[];
  taste?: string[];
  voice?: string[];
  forum?: string[];
  narrative?: string[];
  referenceStyle?: string[];
  antiGeneric?: string[];
};

export type PersonaRuntimePacket = {
  flow: PersonaFlowKind;
  contentMode: ContentMode;
  personaId: string;
  displayName: string | null;
  schemaVersion: "v2" | "v1_adapted";
  budget: PersonaPacketBudget;
  sections: PersonaRuntimePacketSections;
  renderedText: string;
  wordCount: number;
  omittedSections: string[];
  warnings: string[];
};

export type PersonaAuditTarget =
  | "value_fit"
  | "reasoning_fit"
  | "discourse_fit"
  | "expression_fit"
  | "procedure_fit"
  | "narrative_fit"
  | "anti_generic"
  | "reference_non_imitation";

export type PersonaAuditEvidencePacket = PersonaRuntimePacket & {
  flow: "audit";
  auditTargets: PersonaAuditTarget[];
};

const ALLOWED_TOP_LEVEL_KEYS = new Set([
  "schema_version",
  "identity",
  "mind",
  "taste",
  "voice",
  "forum",
  "narrative",
  "reference_style",
  "anti_generic",
]);

const ALLOWED_CONTENT_LENGTHS = new Set<ContentLength>(["one_liner", "short", "medium", "long"]);

const CHAIN_OF_THOUGHT_PATTERNS = [
  /step.by.step.reasoning/i,
  /hidden.thoughts/i,
  /scratchpad/i,
  /show.your.reasoning/i,
  /think.aloud/i,
  /explain.your.thinking/i,
  /step-by-step/i,
  /reasoning.process/i,
];

const ASSISTANT_ROLE_PATTERNS = [
  /as an AI/i,
  /help users/i,
  /provide balanced insight/i,
  /be helpful/i,
  /as a language model/i,
];

const GENERIC_FILLER_PHRASES = [
  /^be engaging$/i,
  /^be helpful$/i,
  /^provide value$/i,
  /^stay authentic$/i,
  /^be concise$/i,
  /^be clear$/i,
];

const STORY_ADVICE_PATTERNS = [
  /^write compelling characters$/i,
  /^make the story interesting$/i,
  /^create engaging plots$/i,
  /^build suspense$/i,
  /^hook the reader$/i,
];

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function normalizeText(value: unknown, maxChars?: number): string {
  if (typeof value !== "string") {
    return "";
  }
  const normalized = value.replace(/\s+/g, " ").trim();
  if (maxChars && normalized.length > maxChars) {
    return "";
  }
  return normalized;
}

function normalizeStringArray(
  value: unknown,
  minItems: number,
  maxItems: number,
  maxChars: number,
): string[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const seen = new Set<string>();
  const result: string[] = [];

  for (const item of value) {
    if (typeof item !== "string") {
      continue;
    }

    // Reject markdown
    if (item.includes("#") || item.includes("**") || item.includes("```")) {
      return null;
    }

    const normalized = item.replace(/\s+/g, " ").trim();
    if (!normalized || normalized.length > maxChars) {
      continue;
    }

    // Reject paragraphs
    if (normalized.includes("\n")) {
      return null;
    }

    const key = normalized.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(normalized);
  }

  if (result.length < minItems || result.length > maxItems) {
    return null;
  }

  return result;
}

function checkChainOfThought(text: string): boolean {
  return CHAIN_OF_THOUGHT_PATTERNS.some((pattern) => pattern.test(text));
}

function checkAssistantRole(text: string): boolean {
  return ASSISTANT_ROLE_PATTERNS.some((pattern) => pattern.test(text));
}

function checkGenericFiller(text: string): boolean {
  return GENERIC_FILLER_PHRASES.some((pattern) => pattern.test(text));
}

function checkStoryAdvice(text: string): boolean {
  return STORY_ADVICE_PATTERNS.some((pattern) => pattern.test(text));
}

function validateRequiredString(
  obj: Record<string, unknown>,
  key: string,
  maxChars: number,
  warnings: string[],
  path: string,
): string | null {
  const value = normalizeText(obj[key], maxChars);
  if (!value) {
    warnings.push(`${path}.${key}: missing or exceeds ${maxChars} chars`);
    return null;
  }
  if (checkChainOfThought(value)) {
    warnings.push(`${path}.${key}: contains chain-of-thought language`);
    return null;
  }
  if (checkAssistantRole(value)) {
    warnings.push(`${path}.${key}: contains assistant-role wording`);
    return null;
  }
  return value;
}

function validateStringArray(
  obj: Record<string, unknown>,
  key: string,
  minItems: number,
  maxItems: number,
  maxChars: number,
  warnings: string[],
  path: string,
): string[] | null {
  const result = normalizeStringArray(obj[key], minItems, maxItems, maxChars);
  if (!result) {
    warnings.push(
      `${path}.${key}: must be array of ${minItems}-${maxItems} strings, each <=${maxChars} chars`,
    );
    return null;
  }

  for (const item of result) {
    if (checkChainOfThought(item)) {
      warnings.push(`${path}.${key}: item contains chain-of-thought language`);
      return null;
    }
    if (checkAssistantRole(item)) {
      warnings.push(`${path}.${key}: item contains assistant-role wording`);
      return null;
    }
    if (checkGenericFiller(item)) {
      warnings.push(`${path}.${key}: item is a generic filler phrase`);
      return null;
    }
  }

  return result;
}

function validateProceduralArray(
  obj: Record<string, unknown>,
  key: string,
  minItems: number,
  maxItems: number,
  maxChars: number,
  warnings: string[],
  path: string,
): string[] | null {
  if (!Array.isArray(obj[key])) {
    warnings.push(`${path}.${key}: must be an array`);
    return null;
  }

  const arr = obj[key] as unknown[];
  const seen = new Set<string>();
  const result: string[] = [];

  for (const item of arr) {
    if (typeof item !== "string") {
      continue;
    }

    const normalized = item.replace(/\s+/g, " ").trim();
    if (!normalized || normalized.length > maxChars) {
      continue;
    }

    if (normalized.includes("\n")) {
      continue;
    }

    // Reject chain-of-thought language in thinking procedure
    if (checkChainOfThought(normalized)) {
      warnings.push(`${path}.${key}: thinking procedure item contains chain-of-thought language`);
      return null;
    }

    // Reject items that only describe tone rather than interpretation logic
    if (/^tone:?\s/i.test(normalized) || /^voice:?\s/i.test(normalized)) {
      warnings.push(
        `${path}.${key}: thinking procedure item describes tone, not interpretation logic`,
      );
      return null;
    }

    const lowerKey = normalized.toLowerCase();
    if (seen.has(lowerKey)) {
      continue;
    }
    seen.add(lowerKey);
    result.push(normalized);
  }

  if (result.length < minItems || result.length > maxItems) {
    warnings.push(`${path}.${key}: must have ${minItems}-${maxItems} items, got ${result.length}`);
    return null;
  }

  return result;
}

function validateEnum<T extends string>(
  value: unknown,
  allowed: Set<T>,
  path: string,
  warnings: string[],
): T | null {
  if (typeof value !== "string") {
    warnings.push(`${path}: must be a string`);
    return null;
  }
  if (!allowed.has(value as T)) {
    warnings.push(`${path}: unknown value "${value}"`);
    return null;
  }
  return value as T;
}

export function validatePersonaCoreV2(
  input: unknown,
): { core: PersonaCoreV2; warnings: string[] } | { error: string } {
  const warnings: string[] = [];
  const source = asRecord(input);

  if (!source) {
    return { error: "input must be an object" };
  }

  // schema_version
  if (source.schema_version !== "v2") {
    return { error: "schema_version must be 'v2'" };
  }

  // Check for disallowed top-level keys
  for (const key of Object.keys(source)) {
    if (!ALLOWED_TOP_LEVEL_KEYS.has(key)) {
      if (key === "examples") {
        warnings.push("top-level: examples not enabled in this iteration");
        return { error: "examples must be disabled" };
      }
      // Ignore non-v2 keys (per user instruction: pick keys, ignore others)
      // Only fail on explicitly forbidden things like memory/relationship keys
      if (key.includes("memory") || key.includes("relationship")) {
        return { error: `memory/relationship key "${key}" not allowed in v2` };
      }
    }
  }

  const errors: string[] = [];

  // --- identity ---
  const identity = asRecord(source.identity);
  if (!identity) {
    return { error: "identity must be an object" };
  }

  const identityArchetype = validateRequiredString(
    identity,
    "archetype",
    120,
    warnings,
    "identity",
  );
  const identityCoreDrive = validateRequiredString(
    identity,
    "core_drive",
    120,
    warnings,
    "identity",
  );
  const identityCentralTension = validateRequiredString(
    identity,
    "central_tension",
    120,
    warnings,
    "identity",
  );
  const identitySelfImage = validateRequiredString(
    identity,
    "self_image",
    120,
    warnings,
    "identity",
  );

  if (!identityArchetype || !identityCoreDrive || !identityCentralTension || !identitySelfImage) {
    errors.push("identity: all fields required");
  }

  // --- mind ---
  const mind = asRecord(source.mind);
  if (!mind) {
    return { error: "mind must be an object" };
  }

  const reasoningStyle = validateRequiredString(mind, "reasoning_style", 120, warnings, "mind");
  const disagreementStyle = validateRequiredString(
    mind,
    "disagreement_style",
    120,
    warnings,
    "mind",
  );

  const attentionBiases = validateStringArray(mind, "attention_biases", 2, 4, 90, warnings, "mind");
  const defaultAssumptions = validateStringArray(
    mind,
    "default_assumptions",
    2,
    4,
    90,
    warnings,
    "mind",
  );
  const blindSpots = validateStringArray(mind, "blind_spots", 1, 3, 90, warnings, "mind");

  // --- mind.thinking_procedure ---
  const thinkingProcedure = asRecord(mind.thinking_procedure);
  if (!thinkingProcedure) {
    return { error: "mind.thinking_procedure must be an object" };
  }

  const tpContextReading = validateProceduralArray(
    thinkingProcedure,
    "context_reading",
    2,
    4,
    80,
    warnings,
    "mind.thinking_procedure",
  );
  const tpSalienceRules = validateProceduralArray(
    thinkingProcedure,
    "salience_rules",
    2,
    4,
    80,
    warnings,
    "mind.thinking_procedure",
  );
  const tpInterpretationMoves = validateProceduralArray(
    thinkingProcedure,
    "interpretation_moves",
    2,
    4,
    80,
    warnings,
    "mind.thinking_procedure",
  );
  const tpResponseMoves = validateProceduralArray(
    thinkingProcedure,
    "response_moves",
    2,
    4,
    80,
    warnings,
    "mind.thinking_procedure",
  );
  const tpOmissionRules = validateProceduralArray(
    thinkingProcedure,
    "omission_rules",
    2,
    4,
    80,
    warnings,
    "mind.thinking_procedure",
  );

  if (
    !reasoningStyle ||
    !disagreementStyle ||
    !attentionBiases ||
    !defaultAssumptions ||
    !blindSpots ||
    !tpContextReading ||
    !tpSalienceRules ||
    !tpInterpretationMoves ||
    !tpResponseMoves ||
    !tpOmissionRules
  ) {
    errors.push("mind: required fields missing or invalid");
  }

  // --- taste ---
  const taste = asRecord(source.taste);
  if (!taste) {
    return { error: "taste must be an object" };
  }

  const tasteValues = validateStringArray(taste, "values", 3, 5, 90, warnings, "taste");
  const tasteRespects = validateStringArray(taste, "respects", 2, 4, 90, warnings, "taste");
  const tasteDismisses = validateStringArray(taste, "dismisses", 2, 4, 90, warnings, "taste");
  const tasteObsessions = validateStringArray(
    taste,
    "recurring_obsessions",
    2,
    4,
    90,
    warnings,
    "taste",
  );

  if (!tasteValues || !tasteRespects || !tasteDismisses || !tasteObsessions) {
    errors.push("taste: required fields missing or invalid");
  }

  // --- voice ---
  const voice = asRecord(source.voice);
  if (!voice) {
    return { error: "voice must be an object" };
  }

  const voiceRegister = validateRequiredString(voice, "register", 120, warnings, "voice");
  const voiceRhythm = validateRequiredString(voice, "rhythm", 80, warnings, "voice");
  const humorStyle = validateRequiredString(voice, "humor_style", 80, warnings, "voice");

  const openingHabits = validateStringArray(voice, "opening_habits", 1, 3, 90, warnings, "voice");
  const closingHabits = validateStringArray(voice, "closing_habits", 1, 3, 90, warnings, "voice");
  const metaphorDomains = validateStringArray(
    voice,
    "metaphor_domains",
    2,
    5,
    90,
    warnings,
    "voice",
  );
  const forbiddenPhrases = validateStringArray(
    voice,
    "forbidden_phrases",
    3,
    8,
    90,
    warnings,
    "voice",
  );

  if (
    !voiceRegister ||
    !voiceRhythm ||
    !humorStyle ||
    !openingHabits ||
    !closingHabits ||
    !metaphorDomains ||
    !forbiddenPhrases
  ) {
    errors.push("voice: required fields missing or invalid");
  }

  // --- forum ---
  const forum = asRecord(source.forum);
  if (!forum) {
    return { error: "forum must be an object" };
  }

  const participationMode = validateRequiredString(
    forum,
    "participation_mode",
    90,
    warnings,
    "forum",
  );

  const preferredPostIntents = validateStringArray(
    forum,
    "preferred_post_intents",
    1,
    4,
    90,
    warnings,
    "forum",
  );
  const preferredCommentIntents = validateStringArray(
    forum,
    "preferred_comment_intents",
    1,
    4,
    90,
    warnings,
    "forum",
  );
  const preferredReplyIntents = validateStringArray(
    forum,
    "preferred_reply_intents",
    1,
    4,
    90,
    warnings,
    "forum",
  );

  const typicalLengths = asRecord(forum.typical_lengths);
  if (!typicalLengths) {
    warnings.push("forum.typical_lengths: must be an object");
    errors.push("forum.typical_lengths: missing");
  } else {
    const postLength = validateEnum(
      typicalLengths.post,
      new Set<ContentLength>(["short", "medium", "long"]),
      "forum.typical_lengths.post",
      warnings,
    );
    const commentLength = validateEnum(
      typicalLengths.comment,
      new Set<ContentLength>(["one_liner", "short", "medium"]),
      "forum.typical_lengths.comment",
      warnings,
    );
    const replyLength = validateEnum(
      typicalLengths.reply,
      new Set<ContentLength>(["short", "medium"]),
      "forum.typical_lengths.reply",
      warnings,
    );

    if (!postLength || !commentLength || !replyLength) {
      errors.push("forum.typical_lengths: invalid length values");
    }
  }

  if (
    !participationMode ||
    !preferredPostIntents ||
    !preferredCommentIntents ||
    !preferredReplyIntents
  ) {
    errors.push("forum: required fields missing or invalid");
  }

  // --- narrative ---
  const narrative = asRecord(source.narrative);
  if (!narrative) {
    return { error: "narrative must be an object" };
  }

  const storyEngine = validateRequiredString(narrative, "story_engine", 80, warnings, "narrative");

  const favoredConflicts = validateStringArray(
    narrative,
    "favored_conflicts",
    2,
    4,
    70,
    warnings,
    "narrative",
  );
  const characterFocus = validateStringArray(
    narrative,
    "character_focus",
    2,
    4,
    70,
    warnings,
    "narrative",
  );
  const emotionalPalette = validateStringArray(
    narrative,
    "emotional_palette",
    2,
    5,
    70,
    warnings,
    "narrative",
  );
  const plotInstincts = validateStringArray(
    narrative,
    "plot_instincts",
    2,
    4,
    70,
    warnings,
    "narrative",
  );
  const sceneDetailBiases = validateStringArray(
    narrative,
    "scene_detail_biases",
    2,
    5,
    70,
    warnings,
    "narrative",
  );
  const endingPreferences = validateStringArray(
    narrative,
    "ending_preferences",
    1,
    3,
    70,
    warnings,
    "narrative",
  );
  const avoidStoryShapes = validateStringArray(
    narrative,
    "avoid_story_shapes",
    3,
    6,
    70,
    warnings,
    "narrative",
  );

  if (
    !storyEngine ||
    !favoredConflicts ||
    !characterFocus ||
    !emotionalPalette ||
    !plotInstincts ||
    !sceneDetailBiases ||
    !endingPreferences ||
    !avoidStoryShapes
  ) {
    errors.push("narrative: required fields missing or invalid");
  }

  // Reject genre-only narrative profiles
  const genreOnlyWords = new Set([
    "fantasy",
    "sci-fi",
    "romance",
    "horror",
    "mystery",
    "thriller",
    "comedy",
    "drama",
    "action",
    "adventure",
    "literary fiction",
  ]);

  const narrativeCheckText = [
    storyEngine,
    ...(favoredConflicts ?? []),
    ...(characterFocus ?? []),
    ...(plotInstincts ?? []),
    ...(endingPreferences ?? []),
  ]
    .join(" ")
    .toLowerCase();

  if (
    narrativeCheckText.split(/\s+/).length <= 6 &&
    genreOnlyWords.has(narrativeCheckText.trim())
  ) {
    warnings.push("narrative: appears to be genre-only without persona-specific story logic");
    errors.push("narrative: genre-only profile rejected");
  }

  // Reject story advice phrasing in narrative strings
  for (const field of [
    storyEngine,
    ...(favoredConflicts ?? []),
    ...(characterFocus ?? []),
    ...(emotionalPalette ?? []),
    ...(plotInstincts ?? []),
    ...(sceneDetailBiases ?? []),
    ...(endingPreferences ?? []),
    ...(avoidStoryShapes ?? []),
  ]) {
    if (field && checkStoryAdvice(field)) {
      warnings.push("narrative: contains story advice phrasing instead of persona-specific logic");
      errors.push("narrative: story advice phrasing rejected");
      break;
    }
  }

  // --- reference_style ---
  const referenceStyle = asRecord(source.reference_style);
  if (!referenceStyle) {
    return { error: "reference_style must be an object" };
  }

  if (referenceStyle.do_not_imitate !== true) {
    return { error: "reference_style.do_not_imitate must be true" };
  }

  const referenceNames = validateStringArray(
    referenceStyle,
    "reference_names",
    1,
    5,
    90,
    warnings,
    "reference_style",
  );
  const abstractTraits = validateStringArray(
    referenceStyle,
    "abstract_traits",
    2,
    6,
    90,
    warnings,
    "reference_style",
  );

  if (!referenceNames || !abstractTraits) {
    errors.push("reference_style: required fields missing or invalid");
  }

  // Check abstract_traits for direct imitation instructions
  if (abstractTraits) {
    for (const trait of abstractTraits) {
      if (/write like|imitate|copy the style of|emulate/i.test(trait)) {
        warnings.push("reference_style.abstract_traits: contains direct imitation instruction");
        errors.push("reference_style.abstract_traits: do not include imitation instructions");
        break;
      }
    }
  }

  // --- anti_generic ---
  const antiGeneric = asRecord(source.anti_generic);
  if (!antiGeneric) {
    return { error: "anti_generic must be an object" };
  }

  const avoidPatterns = validateStringArray(
    antiGeneric,
    "avoid_patterns",
    3,
    8,
    90,
    warnings,
    "anti_generic",
  );
  const failureMode = validateRequiredString(
    antiGeneric,
    "failure_mode",
    140,
    warnings,
    "anti_generic",
  );

  if (!avoidPatterns || !failureMode) {
    errors.push("anti_generic: required fields missing or invalid");
  }

  // If we collected field-level errors during validation, reject
  if (errors.length > 0) {
    return {
      error: `validation failed: ${errors.join("; ")}`,
    };
  }

  // Build canonical v2
  const core: PersonaCoreV2 = {
    schema_version: "v2",
    identity: {
      archetype: identityArchetype!,
      core_drive: identityCoreDrive!,
      central_tension: identityCentralTension!,
      self_image: identitySelfImage!,
    },
    mind: {
      reasoning_style: reasoningStyle!,
      attention_biases: attentionBiases!,
      default_assumptions: defaultAssumptions!,
      blind_spots: blindSpots!,
      disagreement_style: disagreementStyle!,
      thinking_procedure: {
        context_reading: tpContextReading!,
        salience_rules: tpSalienceRules!,
        interpretation_moves: tpInterpretationMoves!,
        response_moves: tpResponseMoves!,
        omission_rules: tpOmissionRules!,
      },
    },
    taste: {
      values: tasteValues!,
      respects: tasteRespects!,
      dismisses: tasteDismisses!,
      recurring_obsessions: tasteObsessions!,
    },
    voice: {
      register: voiceRegister!,
      rhythm: voiceRhythm!,
      opening_habits: openingHabits!,
      closing_habits: closingHabits!,
      humor_style: humorStyle!,
      metaphor_domains: metaphorDomains!,
      forbidden_phrases: forbiddenPhrases!,
    },
    forum: {
      participation_mode: participationMode!,
      preferred_post_intents: preferredPostIntents!,
      preferred_comment_intents: preferredCommentIntents!,
      preferred_reply_intents: preferredReplyIntents!,
      typical_lengths: {
        post:
          validateEnum(
            (typicalLengths as Record<string, unknown>)?.post,
            new Set<ContentLength>(["short", "medium", "long"]),
            "forum.typical_lengths.post",
            warnings,
          ) ?? "medium",
        comment:
          validateEnum(
            (typicalLengths as Record<string, unknown>)?.comment,
            new Set<ContentLength>(["one_liner", "short", "medium"]),
            "forum.typical_lengths.comment",
            warnings,
          ) ?? "short",
        reply:
          validateEnum(
            (typicalLengths as Record<string, unknown>)?.reply,
            new Set<ContentLength>(["short", "medium"]),
            "forum.typical_lengths.reply",
            warnings,
          ) ?? "short",
      },
    },
    narrative: {
      story_engine: storyEngine!,
      favored_conflicts: favoredConflicts!,
      character_focus: characterFocus!,
      emotional_palette: emotionalPalette!,
      plot_instincts: plotInstincts!,
      scene_detail_biases: sceneDetailBiases!,
      ending_preferences: endingPreferences!,
      avoid_story_shapes: avoidStoryShapes!,
    },
    reference_style: {
      reference_names: referenceNames!,
      abstract_traits: abstractTraits!,
      do_not_imitate: true,
    },
    anti_generic: {
      avoid_patterns: avoidPatterns!,
      failure_mode: failureMode!,
    },
  };

  return { core, warnings };
}

export const FALLBACK_PERSONA_CORE_V2: PersonaCoreV2 = {
  schema_version: "v2",
  identity: {
    archetype: "restless pattern-spotter",
    core_drive: "puncture vague consensus",
    central_tension: "clarity against comfort",
    self_image: "a useful irritant",
  },
  mind: {
    reasoning_style: "pattern_matching",
    attention_biases: ["status games", "missing consequences"],
    default_assumptions: ["most claims hide an interest", "complexity is undersold"],
    blind_spots: ["emotional cost of directness"],
    disagreement_style: "pointed counterpoint",
    thinking_procedure: {
      context_reading: ["scan for unstated assumptions", "note who benefits"],
      salience_rules: ["flag missing cost", "flag evasive abstraction"],
      interpretation_moves: ["counterpoint the strongest claim", "surface hidden trade-off"],
      response_moves: ["lead with concrete objection", "close with pointed ask"],
      omission_rules: ["ignore generic encouragement", "skip balanced explainer framing"],
    },
  },
  taste: {
    values: ["clarity", "consequences", "unvarnished trade-offs"],
    respects: ["direct argument", "falsifiable claims"],
    dismisses: ["vague consensus", "advice-list structure"],
    recurring_obsessions: ["hidden costs", "who pays for comfort"],
  },
  voice: {
    register: "dry wit",
    rhythm: "clipped",
    opening_habits: ["concrete objection"],
    closing_habits: ["pointed ask"],
    humor_style: "dark understatement",
    metaphor_domains: ["pressure", "ledgers", "scaffolding"],
    forbidden_phrases: ["balanced perspective", "on the other hand", "it depends"],
  },
  forum: {
    participation_mode: "counterpoint",
    preferred_post_intents: ["critique", "clarification"],
    preferred_comment_intents: ["counterpoint", "pressure test"],
    preferred_reply_intents: ["rebuttal", "focused ask"],
    typical_lengths: {
      post: "medium",
      comment: "short",
      reply: "short",
    },
  },
  narrative: {
    story_engine: "pressure people until the mask slips",
    favored_conflicts: ["status against integrity", "truth against comfort"],
    character_focus: ["frauds", "witnesses"],
    emotional_palette: ["tension", "disgust", "reluctant respect"],
    plot_instincts: ["raise stakes through exposure", "reward honest failure"],
    scene_detail_biases: ["social micro-signals", "objects with history"],
    ending_preferences: ["uncomfortable clarity", "cost made visible"],
    avoid_story_shapes: ["redemption arc", "heroic triumph", "moral lesson"],
  },
  reference_style: {
    reference_names: ["(none)"],
    abstract_traits: ["theatrical pressure", "outsider poise"],
    do_not_imitate: true,
  },
  anti_generic: {
    avoid_patterns: ["balanced explainer tone", "advice-list structure", "polite support macro"],
    failure_mode: "defaults to measured editorial voice when uncertain",
  },
};

export function parsePersonaCoreV2(input: unknown): {
  core: PersonaCoreV2;
  warnings: string[];
} {
  const result = validatePersonaCoreV2(input);

  if ("error" in result) {
    return {
      core: FALLBACK_PERSONA_CORE_V2,
      warnings: [`parsePersonaCoreV2: ${result.error}; using fallback`],
    };
  }

  return result;
}
