import { z } from "zod";

export type ContentLength = "one_liner" | "short" | "medium" | "long";

export type ContentMode = "discussion" | "story";

export type PersonaFlowKind = "post_plan" | "post_frame" | "post_body" | "comment" | "reply";

export type PersonaPacketBudget = {
  minWords: number;
  maxWords: number;
  hardMaxWords: number;
};

function truncatedArray(maxItems: number) {
  return z.array(z.string()).transform((arr) => arr.slice(0, maxItems));
}

const PersonaThinkingProcedureSchema = z.object({
  context_reading: z.array(z.string()).min(2).max(4),
  salience_rules: z.array(z.string()).min(2).max(4),
  interpretation_moves: z.array(z.string()).min(2).max(4),
  response_moves: z.array(z.string()).min(2).max(4),
  omission_rules: z.array(z.string()).min(2).max(4),
});

const IdentitySchema = z.object({
  display_name: z.string(),
  archetype: z.string(),
  core_drive: z.string(),
  bio: z.string(),
  central_tension: z.string(),
  self_image: z.string(),
});

const MindSchema = z.object({
  reasoning_style: z.string(),
  attention_biases: z.array(z.string()).min(2).max(4),
  default_assumptions: z.array(z.string()).min(2).max(4),
  blind_spots: z.array(z.string()).min(1).max(3),
  disagreement_style: z.string(),
  thinking_procedure: PersonaThinkingProcedureSchema,
});

const TasteSchema = z.object({
  values: z.array(z.string()).min(3).max(5),
  respects: z.array(z.string()).min(2).max(4),
  dismisses: z.array(z.string()).min(2).max(4),
  recurring_obsessions: z.array(z.string()).min(2).max(4),
});

const VoiceSchema = z.object({
  register: z.string(),
  rhythm: z.string(),
  opening_habits: z.array(z.string()).min(1).max(3),
  closing_habits: z.array(z.string()).min(1).max(3),
  humor_style: z.string(),
  metaphor_domains: z.array(z.string()).min(2).max(5),
  forbidden_phrases: z.array(z.string()).min(3).max(8),
});

const ContentLengthSchema = z.enum(["one_liner", "short", "medium", "long"]);

const TypicalLengthsSchema = z.object({
  post: ContentLengthSchema,
  comment: ContentLengthSchema,
  reply: ContentLengthSchema,
});

const ForumSchema = z.object({
  participation_mode: z.string(),
  preferred_post_intents: z.array(z.string()).min(1).max(4),
  preferred_comment_intents: z.array(z.string()).min(1).max(4),
  preferred_reply_intents: z.array(z.string()).min(1).max(4),
  typical_lengths: TypicalLengthsSchema,
});

const NarrativeSchema = z.object({
  story_engine: z.string(),
  favored_conflicts: z.array(z.string()).min(2).max(4),
  character_focus: z.array(z.string()).min(2).max(4),
  emotional_palette: z.array(z.string()).min(2).max(5),
  plot_instincts: z.array(z.string()).min(2).max(4),
  scene_detail_biases: z.array(z.string()).min(2).max(5),
  ending_preferences: z.array(z.string()).min(1).max(3),
  avoid_story_shapes: z.array(z.string()).min(3).max(6),
});

const ReferenceStyleSchema = z.object({
  reference_names: truncatedArray(5).pipe(z.array(z.string()).min(1).max(5)),
  abstract_traits: z.array(z.string()).min(2).max(6),
  other_references: truncatedArray(8).pipe(z.array(z.string()).min(0).max(8)),
});

const AntiGenericSchema = z.object({
  avoid_patterns: z.array(z.string()).min(3).max(8),
  failure_mode: z.string(),
});

export const PersonaCoreV2Schema = z.object({
  schema_version: z.literal("v2").default("v2"),
  persona_fit_probability: z.number().int().min(0).max(100),
  identity: IdentitySchema,
  originalization_note: z.string(),
  mind: MindSchema,
  taste: TasteSchema,
  voice: VoiceSchema,
  forum: ForumSchema,
  narrative: NarrativeSchema,
  reference_style: ReferenceStyleSchema,
  anti_generic: AntiGenericSchema,
});

export type PersonaCoreV2 = z.infer<typeof PersonaCoreV2Schema>;

export interface PersonaThinkingProcedure {
  context_reading: string[];
  salience_rules: string[];
  interpretation_moves: string[];
  response_moves: string[];
  omission_rules: string[];
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
  "persona_fit_probability",
  "identity",
  "originalization_note",
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

function normalizeText(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }
  return value.replace(/\s+/g, " ").trim();
}

function normalizeStringArray(value: unknown, minItems: number, maxItems: number): string[] | null {
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
    if (!normalized) {
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

  if (result.length < minItems) {
    return null;
  }

  return result.slice(0, maxItems);
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

function readStringField(
  obj: Record<string, unknown>,
  key: string,
  warnings: string[],
  path: string,
): string | null {
  const value = normalizeText(obj[key]);
  if (!value) {
    warnings.push(`${path}.${key}: missing`);
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

function readStringArrayField(
  obj: Record<string, unknown>,
  key: string,
  minItems: number,
  maxItems: number,
  warnings: string[],
  path: string,
): string[] | null {
  const result = normalizeStringArray(obj[key], minItems, maxItems);
  if (!result) {
    warnings.push(`${path}.${key}: must be array of ${minItems}-${maxItems} strings`);
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

function readProceduralArray(
  obj: Record<string, unknown>,
  key: string,
  minItems: number,
  maxItems: number,
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
    if (!normalized) {
      continue;
    }

    if (normalized.includes("\n")) {
      continue;
    }

    if (checkChainOfThought(normalized)) {
      warnings.push(`${path}.${key}: thinking procedure item contains chain-of-thought language`);
      return null;
    }

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

  if (result.length < minItems) {
    warnings.push(`${path}.${key}: must have ${minItems}-${maxItems} items, got ${result.length}`);
    return null;
  }

  return result.slice(0, maxItems);
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

  const errors: string[] = [];

  // persona_fit_probability
  if (source.persona_fit_probability !== undefined) {
    const prob = source.persona_fit_probability;
    if (typeof prob !== "number" || !Number.isInteger(prob) || prob < 0 || prob > 100) {
      errors.push("persona_fit_probability: must be integer from 0 to 100");
    }
  } else {
    errors.push("persona_fit_probability: required");
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

  // --- identity ---
  const identity = asRecord(source.identity);
  if (!identity) {
    return { error: "identity must be an object" };
  }

  const identityDisplayName = readStringField(identity, "display_name", warnings, "identity");
  const identityBio = readStringField(identity, "bio", warnings, "identity");
  const identityArchetype = readStringField(identity, "archetype", warnings, "identity");
  const identityCoreDrive = readStringField(identity, "core_drive", warnings, "identity");
  const identityCentralTension = readStringField(identity, "central_tension", warnings, "identity");
  const identitySelfImage = readStringField(identity, "self_image", warnings, "identity");
  const originalizationNote = readStringField(
    source,
    "originalization_note",
    warnings,
    "originalization_note",
  );

  if (!identityArchetype || !identityCoreDrive || !identityCentralTension || !identitySelfImage) {
    errors.push("identity: all fields required");
  }

  // --- mind ---
  const mind = asRecord(source.mind);
  if (!mind) {
    return { error: "mind must be an object" };
  }

  const reasoningStyle = readStringField(mind, "reasoning_style", warnings, "mind");
  const disagreementStyle = readStringField(mind, "disagreement_style", warnings, "mind");

  const attentionBiases = readStringArrayField(mind, "attention_biases", 2, 4, warnings, "mind");
  const defaultAssumptions = readStringArrayField(
    mind,
    "default_assumptions",
    2,
    4,
    warnings,
    "mind",
  );
  const blindSpots = readStringArrayField(mind, "blind_spots", 1, 3, warnings, "mind");

  // --- mind.thinking_procedure ---
  const thinkingProcedure = asRecord(mind.thinking_procedure);
  if (!thinkingProcedure) {
    return { error: "mind.thinking_procedure must be an object" };
  }

  const tpContextReading = readProceduralArray(
    thinkingProcedure,
    "context_reading",
    2,
    4,
    warnings,
    "mind.thinking_procedure",
  );
  const tpSalienceRules = readProceduralArray(
    thinkingProcedure,
    "salience_rules",
    2,
    4,
    warnings,
    "mind.thinking_procedure",
  );
  const tpInterpretationMoves = readProceduralArray(
    thinkingProcedure,
    "interpretation_moves",
    2,
    4,
    warnings,
    "mind.thinking_procedure",
  );
  const tpResponseMoves = readProceduralArray(
    thinkingProcedure,
    "response_moves",
    2,
    4,
    warnings,
    "mind.thinking_procedure",
  );
  const tpOmissionRules = readProceduralArray(
    thinkingProcedure,
    "omission_rules",
    2,
    4,
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

  const tasteValues = readStringArrayField(taste, "values", 3, 5, warnings, "taste");
  const tasteRespects = readStringArrayField(taste, "respects", 2, 4, warnings, "taste");
  const tasteDismisses = readStringArrayField(taste, "dismisses", 2, 4, warnings, "taste");
  const tasteObsessions = readStringArrayField(
    taste,
    "recurring_obsessions",
    2,
    4,
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

  const voiceRegister = readStringField(voice, "register", warnings, "voice");
  const voiceRhythm = readStringField(voice, "rhythm", warnings, "voice");
  const humorStyle = readStringField(voice, "humor_style", warnings, "voice");

  const openingHabits = readStringArrayField(voice, "opening_habits", 1, 3, warnings, "voice");
  const closingHabits = readStringArrayField(voice, "closing_habits", 1, 3, warnings, "voice");
  const metaphorDomains = readStringArrayField(voice, "metaphor_domains", 2, 5, warnings, "voice");
  const forbiddenPhrases = readStringArrayField(
    voice,
    "forbidden_phrases",
    3,
    8,
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

  const participationMode = readStringField(forum, "participation_mode", warnings, "forum");

  const preferredPostIntents = readStringArrayField(
    forum,
    "preferred_post_intents",
    1,
    4,
    warnings,
    "forum",
  );
  const preferredCommentIntents = readStringArrayField(
    forum,
    "preferred_comment_intents",
    1,
    4,
    warnings,
    "forum",
  );
  const preferredReplyIntents = readStringArrayField(
    forum,
    "preferred_reply_intents",
    1,
    4,
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
      ALLOWED_CONTENT_LENGTHS,
      "forum.typical_lengths.post",
      warnings,
    );
    const commentLength = validateEnum(
      typicalLengths.comment,
      ALLOWED_CONTENT_LENGTHS,
      "forum.typical_lengths.comment",
      warnings,
    );
    const replyLength = validateEnum(
      typicalLengths.reply,
      ALLOWED_CONTENT_LENGTHS,
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

  const storyEngine = readStringField(narrative, "story_engine", warnings, "narrative");

  const favoredConflicts = readStringArrayField(
    narrative,
    "favored_conflicts",
    2,
    4,
    warnings,
    "narrative",
  );
  const characterFocus = readStringArrayField(
    narrative,
    "character_focus",
    2,
    4,
    warnings,
    "narrative",
  );
  const emotionalPalette = readStringArrayField(
    narrative,
    "emotional_palette",
    2,
    5,
    warnings,
    "narrative",
  );
  const plotInstincts = readStringArrayField(
    narrative,
    "plot_instincts",
    2,
    4,
    warnings,
    "narrative",
  );
  const sceneDetailBiases = readStringArrayField(
    narrative,
    "scene_detail_biases",
    2,
    5,
    warnings,
    "narrative",
  );
  const endingPreferences = readStringArrayField(
    narrative,
    "ending_preferences",
    1,
    3,
    warnings,
    "narrative",
  );
  const avoidStoryShapes = readStringArrayField(
    narrative,
    "avoid_story_shapes",
    3,
    6,
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

  const referenceNames = readStringArrayField(
    referenceStyle,
    "reference_names",
    1,
    5,
    warnings,
    "reference_style",
  );
  const abstractTraits = readStringArrayField(
    referenceStyle,
    "abstract_traits",
    2,
    6,
    warnings,
    "reference_style",
  );
  const otherReferences = readStringArrayField(
    referenceStyle,
    "other_references",
    0,
    8,
    warnings,
    "reference_style",
  );

  if (!referenceNames || !abstractTraits) {
    errors.push("reference_style: required fields missing or invalid");
  }

  // Normalize overlong arrays to first allowed items
  const normalizedReferenceNames = Array.isArray(referenceStyle.reference_names)
    ? (referenceStyle.reference_names as string[]).slice(0, 5)
    : (referenceNames ?? []);
  const normalizedOtherReferences = Array.isArray(referenceStyle.other_references)
    ? (referenceStyle.other_references as string[]).slice(0, 8)
    : (otherReferences ?? []);

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

  const avoidPatterns = readStringArrayField(
    antiGeneric,
    "avoid_patterns",
    3,
    8,
    warnings,
    "anti_generic",
  );
  const failureMode = readStringField(antiGeneric, "failure_mode", warnings, "anti_generic");

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
    persona_fit_probability:
      typeof source.persona_fit_probability === "number" &&
      Number.isInteger(source.persona_fit_probability) &&
      source.persona_fit_probability >= 0 &&
      source.persona_fit_probability <= 100
        ? source.persona_fit_probability
        : 50,
    originalization_note: originalizationNote!,
    identity: {
      display_name: identityDisplayName!,
      archetype: identityArchetype!,
      core_drive: identityCoreDrive!,
      bio: identityBio!,
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
            ALLOWED_CONTENT_LENGTHS,
            "forum.typical_lengths.post",
            warnings,
          ) ?? "medium",
        comment:
          validateEnum(
            (typicalLengths as Record<string, unknown>)?.comment,
            ALLOWED_CONTENT_LENGTHS,
            "forum.typical_lengths.comment",
            warnings,
          ) ?? "short",
        reply:
          validateEnum(
            (typicalLengths as Record<string, unknown>)?.reply,
            ALLOWED_CONTENT_LENGTHS,
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
      reference_names: normalizedReferenceNames,
      abstract_traits: abstractTraits!,
      other_references: normalizedOtherReferences,
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
  persona_fit_probability: 80,
  originalization_note:
    "Clarity against comfort — a useful irritant who punctures vague consensus.",
  identity: {
    display_name: "Mara Ellison",
    archetype: "restless pattern-spotter",
    core_drive: "puncture vague consensus",
    bio: "A sharp-eyed forum contributor who cuts through noise with pointed questions.",
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
    other_references: [],
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
