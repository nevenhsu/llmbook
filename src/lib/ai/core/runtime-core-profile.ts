import { SoulReasonCode } from "@/lib/ai/reason-codes";
import { createAdminClient } from "@/lib/supabase/admin";

type CoreValuePriority = 1 | 2 | 3;

export type RuntimeCoreProfile = {
  identityCore: {
    archetype: string;
    mbti: string;
    coreMotivation: string;
  };
  valueHierarchy: Array<{ value: string; priority: CoreValuePriority }>;
  reasoningLens: {
    primary: string[];
    secondary: string[];
    promptHint: string;
  };
  responseStyle: {
    tone: string[];
    patterns: string[];
    avoid: string[];
  };
  relationshipTendencies: {
    defaultStance: string;
    trustSignals: string[];
    frictionTriggers: string[];
  };
  agentEnactmentRules: string[];
  inCharacterExamples: Array<{
    scenario: string;
    response: string;
  }>;
  decisionPolicy: {
    evidenceStandard: string;
    tradeoffStyle: string;
    uncertaintyHandling: string;
    antiPatterns: string[];
    riskPreference: "conservative" | "balanced" | "progressive";
  };
  interactionDoctrine: {
    askVsTellRatio: string;
    feedbackPrinciples: string[];
    collaborationStance: string;
  };
  languageSignature: {
    rhythm: string;
    preferredStructures: string[];
    lexicalTaboos: string[];
  };
  voiceFingerprint: {
    openingMove: string;
    metaphorDomains: string[];
    attackStyle: string;
    praiseStyle: string;
    closingMove: string;
    forbiddenShapes: string[];
  };
  taskStyleMatrix: {
    post: {
      entryShape: string;
      bodyShape: string;
      closeShape: string;
      forbiddenShapes: string[];
    };
    comment: {
      entryShape: string;
      feedbackShape: string;
      closeShape: string;
      forbiddenShapes: string[];
    };
  };
  guardrails: {
    hardNo: string[];
    deescalationRules: string[];
  };
};

export type RuntimeCoreSummary = {
  identity: string;
  mbti: string;
  topValues: string[];
  tradeoffStyle: string;
  riskPreference: "conservative" | "balanced" | "progressive";
  collaborationStance: string;
  rhythm: string;
  defaultRelationshipStance: string;
  promptHint: string;
  enactmentRuleCount: number;
  exampleCount: number;
  guardrailCount: number;
};

export type RuntimeCoreContext = {
  profile: RuntimeCoreProfile;
  summary: RuntimeCoreSummary;
  normalized: boolean;
  source: "db" | "fallback_empty";
};

export type InteractionCoreSummaryActionType = "post" | "comment" | "reply";

export type RuntimeCoreReasonCodeValue = (typeof SoulReasonCode)[keyof typeof SoulReasonCode];

export type RuntimeCoreAuditEvent = {
  layer: "soul_runtime" | "generation" | "dispatch_precheck";
  operation: "LOAD" | "FALLBACK" | "APPLY";
  reasonCode: RuntimeCoreReasonCodeValue;
  entityId: string;
  occurredAt: string;
  metadata?: Record<string, unknown>;
};

export interface RuntimeCoreEventSink {
  record(event: RuntimeCoreAuditEvent): Promise<void>;
}

export class InMemoryRuntimeCoreEventSink implements RuntimeCoreEventSink {
  public readonly events: RuntimeCoreAuditEvent[] = [];

  public async record(event: RuntimeCoreAuditEvent): Promise<void> {
    this.events.push(event);
  }
}

type RuntimeCoreDeps = {
  getCoreProfile: (input: { personaId: string }) => Promise<unknown>;
  eventSink?: RuntimeCoreEventSink;
};

type CacheEntry<T> = {
  value: T;
  expiresAtMs: number;
};

type PersonaCoreRow = {
  core_profile: unknown;
};

export type RuntimeCoreProviderStatus = {
  ttlMs: number;
  personas: Record<string, RuntimeCorePersonaStatus>;
  lastFallbackEvent: RuntimeCoreAuditEvent | null;
  lastAppliedEvent: RuntimeCoreAuditEvent | null;
};

export type RuntimeCorePersonaStatus = {
  cacheExpiresAt: string | null;
  lastReasonCode: RuntimeCoreReasonCodeValue | null;
  lastLoadError: string | null;
  lastOccurredAt: string | null;
  lastSummary: RuntimeCoreSummary | null;
};

const DEFAULT_TTL_MS = 30_000;
const DEFAULT_CORE_PROFILE: RuntimeCoreProfile = {
  identityCore: {
    archetype: "A pragmatic collaborator who keeps discussion constructive and useful.",
    mbti: "INTJ",
    coreMotivation: "Move discussion toward clear, practical progress.",
  },
  valueHierarchy: [
    { value: "clarity", priority: 1 },
    { value: "accuracy", priority: 2 },
    { value: "forward progress", priority: 3 },
  ],
  reasoningLens: {
    primary: ["clarity", "risk", "feasibility"],
    secondary: ["evidence", "novelty"],
    promptHint: "Assess claims through clarity and practical risk before style or hype.",
  },
  responseStyle: {
    tone: ["direct", "conversational"],
    patterns: ["short paragraphs", "lead with reaction"],
    avoid: ["tutorial lists", "generic encouragement"],
  },
  relationshipTendencies: {
    defaultStance: "supportive_but_blunt",
    trustSignals: ["specificity", "good faith"],
    frictionTriggers: ["hype", "manipulation", "vagueness"],
  },
  agentEnactmentRules: [
    "Infer the agent's real reaction before writing.",
    "Reflect the agent's values and biases in stance and wording.",
    "Do not sound like a generic assistant.",
  ],
  inCharacterExamples: [
    {
      scenario: "Someone makes a vague but confident claim.",
      response: "I am not convinced yet. Show the concrete trade-offs and evidence.",
    },
  ],
  decisionPolicy: {
    evidenceStandard: "medium",
    tradeoffStyle: "balanced",
    uncertaintyHandling: "state assumptions and suggest a safe next step",
    antiPatterns: ["overconfident claims", "false certainty"],
    riskPreference: "balanced",
  },
  interactionDoctrine: {
    askVsTellRatio: "balanced",
    feedbackPrinciples: ["identify assumptions", "compare trade-offs", "propose next step"],
    collaborationStance: "coach",
  },
  languageSignature: {
    rhythm: "concise",
    preferredStructures: ["context", "analysis", "next step"],
    lexicalTaboos: [],
  },
  voiceFingerprint: {
    openingMove: "Lead with a real reaction, not a sterile setup.",
    metaphorDomains: ["pressure point", "stakes", "trade-off"],
    attackStyle: "direct and evidence-oriented",
    praiseStyle: "specific praise only after substance earns it",
    closingMove: "Close with a concrete takeaway, not a motivational sign-off.",
    forbiddenShapes: ["balanced explainer", "support macro"],
  },
  taskStyleMatrix: {
    post: {
      entryShape: "Plant the angle early.",
      bodyShape: "Build a clear argument instead of a tutorial.",
      closeShape: "Land on a sting, concession, or concrete takeaway.",
      forbiddenShapes: ["newsletter tone", "advice list"],
    },
    comment: {
      entryShape: "Sound like a live thread reply.",
      feedbackShape: "reaction -> concrete note -> pointed close",
      closeShape: "Keep the close short and thread-native.",
      forbiddenShapes: ["sectioned critique", "support-macro tone"],
    },
  },
  guardrails: {
    hardNo: ["fabricate facts", "unsafe instructions"],
    deescalationRules: ["acknowledge uncertainty and reduce risk"],
  },
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function normalizeText(value: unknown, fallback: string): string {
  if (typeof value !== "string") {
    return fallback;
  }
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > 0 ? normalized : fallback;
}

function normalizeMbti(value: unknown, fallback: string): string {
  if (typeof value !== "string") {
    return fallback;
  }
  const normalized = value.replace(/\s+/g, "").toUpperCase();
  return /^[EI][SN][TF][JP](?:-[AT])?$/.test(normalized) ? normalized : fallback;
}

function normalizeStringArray(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) {
    return fallback;
  }

  const unique: string[] = [];
  const seen = new Set<string>();

  for (const item of value) {
    if (typeof item !== "string") {
      continue;
    }
    const normalized = item.replace(/\s+/g, " ").trim();
    if (!normalized) {
      continue;
    }
    const key = normalized.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push(normalized);
  }

  return unique.length > 0 ? unique : fallback;
}

function normalizePriority(value: unknown): CoreValuePriority | null {
  if (value === 1 || value === 2 || value === 3) {
    return value;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    if (value <= 1) return 1;
    if (value >= 3) return 3;
    return 2;
  }
  return null;
}

function deriveRiskPreference(input: {
  riskPreference?: unknown;
  tradeoffStyle: string;
}): "conservative" | "balanced" | "progressive" {
  const explicit =
    typeof input.riskPreference === "string" ? input.riskPreference.trim().toLowerCase() : "";
  if (explicit === "conservative" || explicit === "balanced" || explicit === "progressive") {
    return explicit;
  }

  const style = input.tradeoffStyle.toLowerCase();
  if (style.includes("safe") || style.includes("conservative") || style.includes("risk-averse")) {
    return "conservative";
  }
  if (style.includes("bold") || style.includes("aggressive") || style.includes("explore")) {
    return "progressive";
  }
  return "balanced";
}

function containsAny(text: string, patterns: string[]): boolean {
  const normalized = text.toLowerCase();
  return patterns.some((pattern) => normalized.includes(pattern));
}

function derivePersonaTone(input: {
  defaultStance: string;
  nonGenericTraits: string[];
  creatorBiases: string[];
  humorPreferences: string[];
}): string[] {
  const sourceText = [
    input.defaultStance,
    ...input.nonGenericTraits,
    ...input.humorPreferences,
  ].join(" ");

  const tone = uniqueStrings([
    containsAny(sourceText, ["impuls", "speaks before thinking"]) ? "impulsive" : null,
    containsAny(sourceText, ["emotionally direct", "raw emotional honesty"])
      ? "emotionally direct"
      : null,
    containsAny(sourceText, ["reckless optimism", "optimism"]) ? "reckless optimism" : null,
    containsAny(sourceText, ["blunt conviction", "blunt"]) ? "blunt conviction" : null,
    containsAny(sourceText, ["fight against authority", "anti-authority", "authority"])
      ? "anti-authority"
      : null,
  ]);

  return tone.length > 0 ? tone.slice(0, 6) : input.creatorBiases.slice(0, 6);
}

function derivePersonaRhythm(input: {
  defaultStance: string;
  nonGenericTraits: string[];
  humorPreferences: string[];
}): string {
  const sourceText = [
    input.defaultStance,
    ...input.nonGenericTraits,
    ...input.humorPreferences,
  ].join(" ");

  if (
    containsAny(sourceText, [
      "speaks before thinking",
      "impuls",
      "explosive",
      "exaggerated reactions",
      "chaotic",
      "reckless",
    ])
  ) {
    return "bursty and reactive";
  }
  if (containsAny(sourceText, ["measured", "deliberate", "carefully worded"])) {
    return "measured and deliberate";
  }
  if (containsAny(sourceText, ["blunt", "direct"])) {
    return "direct and clipped";
  }
  return DEFAULT_CORE_PROFILE.languageSignature.rhythm;
}

function derivePersonaLexicalTaboos(input: {
  hardNo: string[];
  tasteBoundaries: string[];
  dislikedPatterns: string[];
}): string[] {
  const sourceText = [...input.hardNo, ...input.tasteBoundaries, ...input.dislikedPatterns].join(
    " ",
  );
  const taboos = uniqueStrings([
    containsAny(sourceText, ["fake outrage"]) ? "fake outrage" : null,
    containsAny(sourceText, ["manufactured drama"]) ? "manufactured drama" : null,
    containsAny(sourceText, ["bootlicking authority", "bootlicking"])
      ? "bootlicking authority"
      : null,
    containsAny(sourceText, ["performative politeness", "虚伪的politeness"])
      ? "performative politeness"
      : null,
    containsAny(sourceText, ["passive-aggressive"]) ? "passive-aggressive behavior" : null,
    containsAny(sourceText, ["credentialism", "hide behind titles"]) ? "credentialism" : null,
  ]);

  return taboos.length > 0 ? taboos.slice(0, 6) : input.tasteBoundaries.slice(0, 6);
}

function derivePersonaFeedbackPrinciples(input: {
  creativePreferences: string[];
  creatorDetails: string[];
  discussionStrengths: string[];
}): string[] {
  const sourceText = [
    ...input.creativePreferences,
    ...input.creatorDetails,
    ...input.discussionStrengths,
  ].join(" ");

  const principles = uniqueStrings([
    containsAny(sourceText, [
      "sincerity over polish",
      "rough but genuine",
      "honest part",
      "genuine",
    ])
      ? "protect the honest core before polishing"
      : null,
    containsAny(sourceText, ["empty rhetoric", "fake authority", "obvious power trips"])
      ? "cut through empty rhetoric fast"
      : null,
    containsAny(sourceText, [
      "visceral moments",
      "bold, direct creative expression",
      "direct creative expression",
    ])
      ? "push for vivid stakes and concrete detail"
      : null,
    containsAny(sourceText, ["character bonds", "crew dynamics", "found family"])
      ? "notice the live emotional bond before the clever surface"
      : null,
  ]);

  return principles.length > 0 ? principles.slice(0, 6) : input.discussionStrengths.slice(0, 6);
}

function normalizeVoiceFingerprint(value: unknown): RuntimeCoreProfile["voiceFingerprint"] {
  const record = asRecord(value);
  return {
    openingMove: normalizeText(
      record?.opening_move ?? record?.openingMove,
      DEFAULT_CORE_PROFILE.voiceFingerprint.openingMove,
    ),
    metaphorDomains: normalizeStringArray(
      record?.metaphor_domains ?? record?.metaphorDomains,
      DEFAULT_CORE_PROFILE.voiceFingerprint.metaphorDomains,
    ),
    attackStyle: normalizeText(
      record?.attack_style ?? record?.attackStyle,
      DEFAULT_CORE_PROFILE.voiceFingerprint.attackStyle,
    ),
    praiseStyle: normalizeText(
      record?.praise_style ?? record?.praiseStyle,
      DEFAULT_CORE_PROFILE.voiceFingerprint.praiseStyle,
    ),
    closingMove: normalizeText(
      record?.closing_move ?? record?.closingMove,
      DEFAULT_CORE_PROFILE.voiceFingerprint.closingMove,
    ),
    forbiddenShapes: normalizeStringArray(
      record?.forbidden_shapes ?? record?.forbiddenShapes,
      DEFAULT_CORE_PROFILE.voiceFingerprint.forbiddenShapes,
    ),
  };
}

function normalizePostTaskStyle(value: unknown): RuntimeCoreProfile["taskStyleMatrix"]["post"] {
  const record = asRecord(value);
  return {
    entryShape: normalizeText(
      record?.entry_shape ?? record?.entryShape,
      DEFAULT_CORE_PROFILE.taskStyleMatrix.post.entryShape,
    ),
    bodyShape: normalizeText(
      record?.body_shape ?? record?.bodyShape,
      DEFAULT_CORE_PROFILE.taskStyleMatrix.post.bodyShape,
    ),
    closeShape: normalizeText(
      record?.close_shape ?? record?.closeShape,
      DEFAULT_CORE_PROFILE.taskStyleMatrix.post.closeShape,
    ),
    forbiddenShapes: normalizeStringArray(
      record?.forbidden_shapes ?? record?.forbiddenShapes,
      DEFAULT_CORE_PROFILE.taskStyleMatrix.post.forbiddenShapes,
    ),
  };
}

function normalizeCommentTaskStyle(
  value: unknown,
): RuntimeCoreProfile["taskStyleMatrix"]["comment"] {
  const record = asRecord(value);
  return {
    entryShape: normalizeText(
      record?.entry_shape ?? record?.entryShape,
      DEFAULT_CORE_PROFILE.taskStyleMatrix.comment.entryShape,
    ),
    feedbackShape: normalizeText(
      record?.feedback_shape ?? record?.feedbackShape,
      DEFAULT_CORE_PROFILE.taskStyleMatrix.comment.feedbackShape,
    ),
    closeShape: normalizeText(
      record?.close_shape ?? record?.closeShape,
      DEFAULT_CORE_PROFILE.taskStyleMatrix.comment.closeShape,
    ),
    forbiddenShapes: normalizeStringArray(
      record?.forbidden_shapes ?? record?.forbiddenShapes,
      DEFAULT_CORE_PROFILE.taskStyleMatrix.comment.forbiddenShapes,
    ),
  };
}

function normalizeTaskStyleMatrix(value: unknown): RuntimeCoreProfile["taskStyleMatrix"] {
  const record = asRecord(value);
  return {
    post: normalizePostTaskStyle(record?.post),
    comment: normalizeCommentTaskStyle(record?.comment),
  };
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    if (typeof value !== "string") {
      continue;
    }
    const normalized = value.trim();
    if (!normalized) {
      continue;
    }
    const key = normalized.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(normalized);
  }

  return result;
}

function truncateCompactSummaryValue(value: string, maxLength = 220): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, Math.max(0, maxLength - 14)).trimEnd()} [truncated]`;
}

function formatCompactSummarySection(
  label: string,
  values: string[],
  emptyLabel = "(none)",
): string {
  return [
    `${label}:`,
    ...(values.length > 0
      ? values.map((value) => `- ${truncateCompactSummaryValue(value)}`)
      : [`- ${emptyLabel}`]),
  ].join("\n");
}

function readCompactPersonaCoreStrings(
  personaCore: Record<string, unknown> | null | undefined,
  key: string,
): string[] {
  const record = asRecord(personaCore?.[key]);
  if (!record) {
    return [];
  }
  return Object.values(record)
    .flatMap((value) => {
      if (typeof value === "string") {
        return [value];
      }
      if (Array.isArray(value)) {
        return value.filter((item): item is string => typeof item === "string");
      }
      return [];
    })
    .map((value) => value.replace(/\s+/g, " ").trim())
    .filter((value) => value.length > 0);
}

function readCompactReferenceSources(
  personaCore: Record<string, unknown> | null | undefined,
): string[] {
  const referenceSources = Array.isArray(personaCore?.reference_sources)
    ? personaCore.reference_sources
    : [];
  return uniqueStrings(
    referenceSources
      .map((item) => {
        const record = asRecord(item);
        const name = typeof record?.name === "string" ? record.name.trim() : "";
        const type = typeof record?.type === "string" ? record.type.trim() : "";
        if (!name) {
          return null;
        }
        return type ? `${name} (${type})` : name;
      })
      .filter((item): item is string => Boolean(item)),
  ).slice(0, 4);
}

export function buildInteractionCoreSummary(input: {
  actionType: InteractionCoreSummaryActionType;
  profile: RuntimeCoreProfile;
  personaCore?: Record<string, unknown> | null;
  shortTermMemory?: string | null;
  longTermMemory?: string | null;
}): string {
  const actionType = input.actionType === "reply" ? "comment" : input.actionType;
  const identitySummary = asRecord(input.personaCore?.identity_summary);
  const values = asRecord(input.personaCore?.values);
  const aestheticProfile = asRecord(input.personaCore?.aesthetic_profile);
  const interactionDefaults = asRecord(input.personaCore?.interaction_defaults);
  const guardrails = asRecord(input.personaCore?.guardrails);
  const voiceFingerprint = input.profile.voiceFingerprint;
  const taskStyle = input.profile.taskStyleMatrix;
  const discussionDefaultStance =
    typeof interactionDefaults?.default_stance === "string" &&
    interactionDefaults.default_stance.trim().length > 0
      ? interactionDefaults.default_stance.trim()
      : input.profile.interactionDoctrine.collaborationStance;

  const identityLines = uniqueStrings([
    typeof identitySummary?.one_sentence_identity === "string"
      ? identitySummary.one_sentence_identity
      : null,
    `Archetype: ${input.profile.identityCore.archetype}`,
    `Core motivation: ${input.profile.identityCore.coreMotivation}`,
  ]).slice(0, 3);

  const priorityLines = uniqueStrings([
    ...input.profile.valueHierarchy
      .slice()
      .sort((a, b) => a.priority - b.priority)
      .slice(0, 3)
      .map((entry) => `${entry.value} (priority ${String(entry.priority)})`),
    ...normalizeStringArray(values?.worldview, []).slice(0, 2),
  ]).slice(0, 5);

  const referenceLines = readCompactReferenceSources(input.personaCore);

  if (actionType === "post") {
    const aestheticLines = uniqueStrings([
      ...normalizeStringArray(aestheticProfile?.creative_preferences, []).slice(0, 2),
      ...normalizeStringArray(aestheticProfile?.narrative_preferences, []).slice(0, 2),
      ...normalizeStringArray(aestheticProfile?.humor_preferences, []).slice(0, 1),
    ]).slice(0, 4);
    const interactionLines = uniqueStrings([
      `Default stance: ${discussionDefaultStance}`,
      ...normalizeStringArray(interactionDefaults?.discussion_strengths, []).slice(0, 2),
      ...normalizeStringArray(interactionDefaults?.non_generic_traits, []).slice(0, 2),
    ]).slice(0, 5);

    return [
      "Compact persona summary for post generation:",
      formatCompactSummarySection("Identity", identityLines),
      formatCompactSummarySection("Values and worldview pressure", priorityLines),
      formatCompactSummarySection(
        "Aesthetic and storytelling pull",
        aestheticLines.length > 0
          ? aestheticLines
          : input.profile.responseStyle.patterns.slice(0, 3),
      ),
      formatCompactSummarySection("Posting stance", interactionLines),
      formatCompactSummarySection("Voice fingerprint", [
        `Opening move: ${voiceFingerprint.openingMove}`,
        `Attack style: ${voiceFingerprint.attackStyle}`,
        `Praise style: ${voiceFingerprint.praiseStyle}`,
        `Metaphor domains: ${voiceFingerprint.metaphorDomains.join(", ")}`,
      ]),
      formatCompactSummarySection("Post shape expectations", [
        `Entry: ${taskStyle.post.entryShape}`,
        `Body: ${taskStyle.post.bodyShape}`,
        `Close: ${taskStyle.post.closeShape}`,
        `Avoid: ${taskStyle.post.forbiddenShapes.join(", ")}`,
      ]),
      formatCompactSummarySection("Reference roles", referenceLines),
      formatCompactSummarySection("Language signature", [
        `Rhythm: ${input.profile.languageSignature.rhythm}`,
        ...input.profile.responseStyle.tone.slice(0, 3),
      ]),
    ].join("\n\n");
  }

  const replyLines = uniqueStrings([
    `Default stance: ${discussionDefaultStance}`,
    ...normalizeStringArray(interactionDefaults?.friction_triggers, []).slice(0, 2),
    ...normalizeStringArray(interactionDefaults?.discussion_strengths, []).slice(0, 2),
  ]).slice(0, 5);
  const guardrailLines = uniqueStrings([
    ...normalizeStringArray(guardrails?.hard_no, []).slice(0, 2),
    ...normalizeStringArray(guardrails?.deescalation_style, []).slice(0, 2),
    ...input.profile.interactionDoctrine.feedbackPrinciples.slice(0, 2),
  ]).slice(0, 5);

  return [
    "Compact persona summary for reply generation:",
    formatCompactSummarySection("Identity", identityLines),
    formatCompactSummarySection("Reply stance and live pressure", replyLines),
    formatCompactSummarySection("Guardrails and feedback doctrine", guardrailLines),
    formatCompactSummarySection("Voice fingerprint", [
      `Opening move: ${voiceFingerprint.openingMove}`,
      `Attack style: ${voiceFingerprint.attackStyle}`,
      `Praise style: ${voiceFingerprint.praiseStyle}`,
      `Metaphor domains: ${voiceFingerprint.metaphorDomains.join(", ")}`,
    ]),
    formatCompactSummarySection("Comment shape expectations", [
      `Entry: ${taskStyle.comment.entryShape}`,
      `Feedback: ${taskStyle.comment.feedbackShape}`,
      `Close: ${taskStyle.comment.closeShape}`,
      `Avoid: ${taskStyle.comment.forbiddenShapes.join(", ")}`,
    ]),
    formatCompactSummarySection("Reference roles", referenceLines),
    formatCompactSummarySection("Language signature", [
      `Rhythm: ${input.profile.languageSignature.rhythm}`,
      ...input.profile.responseStyle.tone.slice(0, 3),
    ]),
  ].join("\n\n");
}

function adaptPersonaCoreToCoreProfile(input: unknown): RuntimeCoreProfile | null {
  const source = asRecord(input);
  if (!source) {
    return null;
  }

  const identitySummary = asRecord(source.identity_summary);
  const values = asRecord(source.values);
  const aestheticProfile = asRecord(source.aesthetic_profile);
  const creatorAffinity = asRecord(source.creator_affinity);
  const interactionDefaults = asRecord(source.interaction_defaults);
  const guardrails = asRecord(source.guardrails);
  const livedContext = asRecord(source.lived_context);
  const voiceFingerprint = normalizeVoiceFingerprint(source.voice_fingerprint);
  const taskStyleMatrix = normalizeTaskStyleMatrix(source.task_style_matrix);

  if (
    !identitySummary &&
    !values &&
    !aestheticProfile &&
    !creatorAffinity &&
    !interactionDefaults
  ) {
    return null;
  }

  const valueHierarchyRaw = Array.isArray(values?.value_hierarchy) ? values?.value_hierarchy : [];
  const valueHierarchy = valueHierarchyRaw
    .map((item) => {
      const record = asRecord(item);
      if (!record) {
        return null;
      }
      const value = normalizeText(record.value, "");
      const priority = normalizePriority(record.priority);
      if (!value || !priority) {
        return null;
      }
      return { value, priority };
    })
    .filter((item): item is { value: string; priority: CoreValuePriority } => item !== null)
    .sort((a, b) => a.priority - b.priority || a.value.localeCompare(b.value));

  const judgmentStyle = normalizeText(values?.judgment_style, "");
  const creatorStructuralPreferences = normalizeStringArray(
    creatorAffinity?.structural_preferences,
    [],
  );
  const creatorBiases = normalizeStringArray(creatorAffinity?.creative_biases, []);
  const creatorDetails = normalizeStringArray(creatorAffinity?.detail_selection_habits, []);
  const creativePreferences = normalizeStringArray(aestheticProfile?.creative_preferences, []);
  const narrativePreferences = normalizeStringArray(aestheticProfile?.narrative_preferences, []);
  const humorPreferences = normalizeStringArray(aestheticProfile?.humor_preferences, []);
  const dislikedPatterns = normalizeStringArray(aestheticProfile?.disliked_patterns, []);
  const tasteBoundaries = normalizeStringArray(aestheticProfile?.taste_boundaries, []);
  const discussionStrengths = normalizeStringArray(interactionDefaults?.discussion_strengths, []);
  const frictionTriggers = normalizeStringArray(interactionDefaults?.friction_triggers, []);
  const nonGenericTraits = normalizeStringArray(interactionDefaults?.non_generic_traits, []);
  const worldview = normalizeStringArray(values?.worldview, []);
  const topicsRequiringRetrieval = normalizeStringArray(
    livedContext?.topics_requiring_runtime_retrieval,
    [],
  );
  const guardrailHardNo = normalizeStringArray(
    guardrails?.hard_no,
    DEFAULT_CORE_PROFILE.guardrails.hardNo,
  );
  const derivedTone = derivePersonaTone({
    defaultStance: normalizeText(
      interactionDefaults?.default_stance,
      DEFAULT_CORE_PROFILE.relationshipTendencies.defaultStance,
    ),
    nonGenericTraits,
    creatorBiases,
    humorPreferences,
  });
  const derivedRhythm = derivePersonaRhythm({
    defaultStance: normalizeText(
      interactionDefaults?.default_stance,
      DEFAULT_CORE_PROFILE.relationshipTendencies.defaultStance,
    ),
    nonGenericTraits,
    humorPreferences,
  });
  const derivedLexicalTaboos = derivePersonaLexicalTaboos({
    hardNo: guardrailHardNo,
    tasteBoundaries,
    dislikedPatterns,
  });
  const derivedFeedbackPrinciples = derivePersonaFeedbackPrinciples({
    creativePreferences,
    creatorDetails,
    discussionStrengths,
  });
  const derivedAvoidPatterns = uniqueStrings([
    ...dislikedPatterns,
    ...voiceFingerprint.forbiddenShapes,
    ...taskStyleMatrix.post.forbiddenShapes,
    ...taskStyleMatrix.comment.forbiddenShapes,
  ]).slice(0, 8);
  const derivedPreferredStructures = uniqueStrings([
    taskStyleMatrix.post.entryShape,
    taskStyleMatrix.post.bodyShape,
    taskStyleMatrix.comment.feedbackShape,
    taskStyleMatrix.comment.closeShape,
    ...narrativePreferences,
    ...DEFAULT_CORE_PROFILE.languageSignature.preferredStructures,
  ]).slice(0, 6);
  const mergedFeedbackPrinciples = uniqueStrings([
    taskStyleMatrix.comment.feedbackShape,
    voiceFingerprint.praiseStyle,
    ...derivedFeedbackPrinciples,
  ]).slice(0, 6);
  const mergedResponsePatterns = uniqueStrings([
    voiceFingerprint.openingMove,
    voiceFingerprint.closingMove,
    ...creatorDetails,
    ...creativePreferences,
  ]).slice(0, 6);

  const tradeoffStyle = judgmentStyle || DEFAULT_CORE_PROFILE.decisionPolicy.tradeoffStyle;
  const riskPreference = deriveRiskPreference({
    tradeoffStyle,
    riskPreference: values?.risk_preference,
  });

  return {
    identityCore: {
      archetype: normalizeText(
        identitySummary?.archetype ?? identitySummary?.one_sentence_identity,
        DEFAULT_CORE_PROFILE.identityCore.archetype,
      ),
      mbti: normalizeMbti(identitySummary?.mbti, DEFAULT_CORE_PROFILE.identityCore.mbti),
      coreMotivation: normalizeText(
        identitySummary?.core_motivation,
        DEFAULT_CORE_PROFILE.identityCore.coreMotivation,
      ),
    },
    valueHierarchy:
      valueHierarchy.length > 0 ? valueHierarchy.slice(0, 6) : DEFAULT_CORE_PROFILE.valueHierarchy,
    reasoningLens: {
      primary:
        creatorStructuralPreferences.length > 0
          ? creatorStructuralPreferences.slice(0, 6)
          : creativePreferences.length > 0
            ? creativePreferences.slice(0, 6)
            : DEFAULT_CORE_PROFILE.reasoningLens.primary,
      secondary:
        humorPreferences.length > 0
          ? humorPreferences.slice(0, 6)
          : narrativePreferences.length > 0
            ? narrativePreferences.slice(0, 6)
            : DEFAULT_CORE_PROFILE.reasoningLens.secondary,
      promptHint: normalizeText(
        nonGenericTraits[0] ??
          creatorBiases[0] ??
          worldview[0] ??
          identitySummary?.one_sentence_identity,
        DEFAULT_CORE_PROFILE.reasoningLens.promptHint,
      ),
    },
    responseStyle: {
      tone: derivedTone.length > 0 ? derivedTone : DEFAULT_CORE_PROFILE.responseStyle.tone,
      patterns:
        mergedResponsePatterns.length > 0
          ? mergedResponsePatterns
          : DEFAULT_CORE_PROFILE.responseStyle.patterns,
      avoid:
        derivedAvoidPatterns.length > 0
          ? derivedAvoidPatterns
          : DEFAULT_CORE_PROFILE.responseStyle.avoid,
    },
    relationshipTendencies: {
      defaultStance: normalizeText(
        interactionDefaults?.default_stance,
        DEFAULT_CORE_PROFILE.relationshipTendencies.defaultStance,
      ),
      trustSignals:
        discussionStrengths.length > 0
          ? discussionStrengths.slice(0, 6)
          : DEFAULT_CORE_PROFILE.relationshipTendencies.trustSignals,
      frictionTriggers:
        frictionTriggers.length > 0
          ? frictionTriggers.slice(0, 6)
          : DEFAULT_CORE_PROFILE.relationshipTendencies.frictionTriggers,
    },
    agentEnactmentRules:
      nonGenericTraits.length > 0
        ? nonGenericTraits.slice(0, 6)
        : discussionStrengths.length > 0
          ? discussionStrengths.slice(0, 6)
          : DEFAULT_CORE_PROFILE.agentEnactmentRules,
    inCharacterExamples: DEFAULT_CORE_PROFILE.inCharacterExamples,
    decisionPolicy: {
      evidenceStandard: normalizeText(
        topicsRequiringRetrieval.length > 0
          ? "use runtime retrieval when context-specific support is weak"
          : livedContext?.topics_with_confident_grounding,
        DEFAULT_CORE_PROFILE.decisionPolicy.evidenceStandard,
      ),
      tradeoffStyle,
      uncertaintyHandling:
        topicsRequiringRetrieval.length > 0
          ? `Narrow claims when support is weak; retrieve for: ${topicsRequiringRetrieval.join(", ")}`
          : DEFAULT_CORE_PROFILE.decisionPolicy.uncertaintyHandling,
      antiPatterns:
        dislikedPatterns.length > 0
          ? dislikedPatterns.slice(0, 8)
          : DEFAULT_CORE_PROFILE.decisionPolicy.antiPatterns,
      riskPreference,
    },
    interactionDoctrine: {
      askVsTellRatio: DEFAULT_CORE_PROFILE.interactionDoctrine.askVsTellRatio,
      feedbackPrinciples:
        mergedFeedbackPrinciples.length > 0
          ? mergedFeedbackPrinciples
          : DEFAULT_CORE_PROFILE.interactionDoctrine.feedbackPrinciples,
      collaborationStance: normalizeText(
        interactionDefaults?.default_stance,
        DEFAULT_CORE_PROFILE.interactionDoctrine.collaborationStance,
      ),
    },
    languageSignature: {
      rhythm: derivedRhythm,
      preferredStructures:
        derivedPreferredStructures.length > 0
          ? derivedPreferredStructures
          : DEFAULT_CORE_PROFILE.languageSignature.preferredStructures,
      lexicalTaboos: derivedLexicalTaboos,
    },
    voiceFingerprint,
    taskStyleMatrix,
    guardrails: {
      hardNo: guardrailHardNo,
      deescalationRules: normalizeStringArray(
        guardrails?.deescalation_style,
        DEFAULT_CORE_PROFILE.guardrails.deescalationRules,
      ),
    },
  };
}

export function normalizeCoreProfile(input: unknown): {
  profile: RuntimeCoreProfile;
  normalized: boolean;
} {
  const adaptedCore = adaptPersonaCoreToCoreProfile(input);
  if (adaptedCore) {
    return { profile: adaptedCore, normalized: true };
  }

  const source = asRecord(input);
  if (!source) {
    return { profile: DEFAULT_CORE_PROFILE, normalized: true };
  }

  const valueHierarchyRaw = Array.isArray(source.valueHierarchy) ? source.valueHierarchy : [];
  const valueHierarchy: Array<{ value: string; priority: CoreValuePriority }> = [];
  for (const item of valueHierarchyRaw) {
    const record = asRecord(item);
    if (!record) {
      continue;
    }

    const value = typeof record.value === "string" ? record.value.replace(/\s+/g, " ").trim() : "";
    const priority = normalizePriority(record.priority);
    if (!value || !priority) {
      continue;
    }
    valueHierarchy.push({ value, priority });
  }

  valueHierarchy.sort((a, b) => a.priority - b.priority || a.value.localeCompare(b.value));

  const identityCore = asRecord(source.identityCore);
  const reasoningLens = asRecord(source.reasoningLens);
  const responseStyle = asRecord(source.responseStyle);
  const relationshipTendencies = asRecord(source.relationshipTendencies);
  const decisionPolicy = asRecord(source.decisionPolicy);
  const interactionDoctrine = asRecord(source.interactionDoctrine);
  const languageSignature = asRecord(source.languageSignature);
  const voiceFingerprint = asRecord(source.voiceFingerprint);
  const taskStyleMatrix = asRecord(source.taskStyleMatrix);
  const guardrails = asRecord(source.guardrails);
  const inCharacterExamplesRaw = Array.isArray(source.inCharacterExamples)
    ? source.inCharacterExamples
    : [];
  const inCharacterExamples = inCharacterExamplesRaw
    .map((item) => {
      const record = asRecord(item);
      if (!record) {
        return null;
      }
      const scenario = normalizeText(record.scenario, "");
      const response = normalizeText(record.response, "");
      if (!scenario || !response) {
        return null;
      }
      return { scenario, response };
    })
    .filter(
      (
        item,
      ): item is {
        scenario: string;
        response: string;
      } => item !== null,
    );

  const tradeoffStyle = normalizeText(
    decisionPolicy?.tradeoffStyle,
    DEFAULT_CORE_PROFILE.decisionPolicy.tradeoffStyle,
  );

  const profile: RuntimeCoreProfile = {
    identityCore: {
      archetype: normalizeText(
        identityCore?.archetype ?? source.identityCore,
        DEFAULT_CORE_PROFILE.identityCore.archetype,
      ),
      mbti: normalizeMbti(identityCore?.mbti, DEFAULT_CORE_PROFILE.identityCore.mbti),
      coreMotivation: normalizeText(
        identityCore?.coreMotivation,
        DEFAULT_CORE_PROFILE.identityCore.coreMotivation,
      ),
    },
    valueHierarchy:
      valueHierarchy.length > 0 ? valueHierarchy.slice(0, 6) : DEFAULT_CORE_PROFILE.valueHierarchy,
    reasoningLens: {
      primary: normalizeStringArray(
        reasoningLens?.primary,
        DEFAULT_CORE_PROFILE.reasoningLens.primary,
      ),
      secondary: normalizeStringArray(
        reasoningLens?.secondary,
        DEFAULT_CORE_PROFILE.reasoningLens.secondary,
      ),
      promptHint: normalizeText(
        reasoningLens?.promptHint,
        DEFAULT_CORE_PROFILE.reasoningLens.promptHint,
      ),
    },
    responseStyle: {
      tone: normalizeStringArray(responseStyle?.tone, DEFAULT_CORE_PROFILE.responseStyle.tone),
      patterns: normalizeStringArray(
        responseStyle?.patterns,
        DEFAULT_CORE_PROFILE.responseStyle.patterns,
      ),
      avoid: normalizeStringArray(responseStyle?.avoid, DEFAULT_CORE_PROFILE.responseStyle.avoid),
    },
    relationshipTendencies: {
      defaultStance: normalizeText(
        relationshipTendencies?.defaultStance,
        DEFAULT_CORE_PROFILE.relationshipTendencies.defaultStance,
      ),
      trustSignals: normalizeStringArray(
        relationshipTendencies?.trustSignals,
        DEFAULT_CORE_PROFILE.relationshipTendencies.trustSignals,
      ),
      frictionTriggers: normalizeStringArray(
        relationshipTendencies?.frictionTriggers,
        DEFAULT_CORE_PROFILE.relationshipTendencies.frictionTriggers,
      ),
    },
    agentEnactmentRules: normalizeStringArray(
      source.agentEnactmentRules,
      DEFAULT_CORE_PROFILE.agentEnactmentRules,
    ),
    inCharacterExamples:
      inCharacterExamples.length > 0
        ? inCharacterExamples.slice(0, 4)
        : DEFAULT_CORE_PROFILE.inCharacterExamples,
    decisionPolicy: {
      evidenceStandard: normalizeText(
        decisionPolicy?.evidenceStandard,
        DEFAULT_CORE_PROFILE.decisionPolicy.evidenceStandard,
      ),
      tradeoffStyle,
      uncertaintyHandling: normalizeText(
        decisionPolicy?.uncertaintyHandling,
        DEFAULT_CORE_PROFILE.decisionPolicy.uncertaintyHandling,
      ),
      antiPatterns: normalizeStringArray(
        decisionPolicy?.antiPatterns,
        DEFAULT_CORE_PROFILE.decisionPolicy.antiPatterns,
      ),
      riskPreference: deriveRiskPreference({
        riskPreference: decisionPolicy?.riskPreference,
        tradeoffStyle,
      }),
    },
    interactionDoctrine: {
      askVsTellRatio: normalizeText(
        interactionDoctrine?.askVsTellRatio,
        DEFAULT_CORE_PROFILE.interactionDoctrine.askVsTellRatio,
      ),
      feedbackPrinciples: normalizeStringArray(
        interactionDoctrine?.feedbackPrinciples,
        DEFAULT_CORE_PROFILE.interactionDoctrine.feedbackPrinciples,
      ),
      collaborationStance: normalizeText(
        interactionDoctrine?.collaborationStance,
        DEFAULT_CORE_PROFILE.interactionDoctrine.collaborationStance,
      ),
    },
    languageSignature: {
      rhythm: normalizeText(
        languageSignature?.rhythm,
        DEFAULT_CORE_PROFILE.languageSignature.rhythm,
      ),
      preferredStructures: normalizeStringArray(
        languageSignature?.preferredStructures,
        DEFAULT_CORE_PROFILE.languageSignature.preferredStructures,
      ),
      lexicalTaboos: normalizeStringArray(languageSignature?.lexicalTaboos, []),
    },
    voiceFingerprint: normalizeVoiceFingerprint(voiceFingerprint),
    taskStyleMatrix: normalizeTaskStyleMatrix(taskStyleMatrix),
    guardrails: {
      hardNo: normalizeStringArray(guardrails?.hardNo, DEFAULT_CORE_PROFILE.guardrails.hardNo),
      deescalationRules: normalizeStringArray(
        guardrails?.deescalationRules,
        DEFAULT_CORE_PROFILE.guardrails.deescalationRules,
      ),
    },
  };

  const normalized = JSON.stringify(profile) !== JSON.stringify(source);
  return { profile, normalized };
}

export function summarizeCoreProfile(profile: RuntimeCoreProfile): RuntimeCoreSummary {
  return {
    identity: profile.identityCore.archetype,
    mbti: profile.identityCore.mbti,
    topValues: profile.valueHierarchy
      .slice()
      .sort((a, b) => a.priority - b.priority)
      .slice(0, 3)
      .map((entry) => entry.value),
    tradeoffStyle: profile.decisionPolicy.tradeoffStyle,
    riskPreference: profile.decisionPolicy.riskPreference,
    collaborationStance: profile.interactionDoctrine.collaborationStance,
    rhythm: profile.languageSignature.rhythm,
    defaultRelationshipStance: profile.relationshipTendencies.defaultStance,
    promptHint: profile.reasoningLens.promptHint,
    enactmentRuleCount: profile.agentEnactmentRules.length,
    exampleCount: profile.inCharacterExamples.length,
    guardrailCount: profile.guardrails.hardNo.length + profile.guardrails.deescalationRules.length,
  };
}

function createSupabaseRuntimeCoreDeps(): RuntimeCoreDeps {
  return {
    getCoreProfile: async ({ personaId }) => {
      const supabase = createAdminClient();
      const { data, error } = await supabase
        .from("persona_cores")
        .select("core_profile")
        .eq("persona_id", personaId)
        .limit(1)
        .maybeSingle<PersonaCoreRow>();

      if (error) {
        throw new Error(`load persona core failed: ${error.message}`);
      }

      return data?.core_profile ?? null;
    },
  };
}

export class CachedRuntimeCoreProvider {
  private readonly deps: RuntimeCoreDeps;
  private readonly ttlMs: number;
  private readonly now: () => Date;

  private cache = new Map<string, CacheEntry<RuntimeCoreContext>>();

  private personaStatus = new Map<string, RuntimeCorePersonaStatus>();
  private lastFallbackEvent: RuntimeCoreAuditEvent | null = null;
  private lastAppliedEvent: RuntimeCoreAuditEvent | null = null;

  public constructor(options?: {
    deps?: Partial<RuntimeCoreDeps>;
    ttlMs?: number;
    now?: () => Date;
  }) {
    this.deps = { ...createSupabaseRuntimeCoreDeps(), ...(options?.deps ?? {}) };
    this.ttlMs = Math.max(1_000, options?.ttlMs ?? DEFAULT_TTL_MS);
    this.now = options?.now ?? (() => new Date());
  }

  private async emit(event: Omit<RuntimeCoreAuditEvent, "occurredAt">, now: Date): Promise<void> {
    const occurredAt = now.toISOString();
    const auditEvent: RuntimeCoreAuditEvent = {
      ...event,
      occurredAt,
    };

    const prevStatus = this.personaStatus.get(event.entityId) ?? {
      cacheExpiresAt: null,
      lastReasonCode: null,
      lastLoadError: null,
      lastOccurredAt: null,
      lastSummary: null,
    };

    const metadataSummary = asRecord(event.metadata)?.summary;

    this.personaStatus.set(event.entityId, {
      ...prevStatus,
      lastReasonCode: event.reasonCode,
      lastOccurredAt: occurredAt,
      lastLoadError:
        event.reasonCode === SoulReasonCode.loadFailed && typeof event.metadata?.error === "string"
          ? String(event.metadata.error)
          : prevStatus.lastLoadError,
      lastSummary:
        metadataSummary && typeof metadataSummary === "object"
          ? (metadataSummary as RuntimeCoreSummary)
          : prevStatus.lastSummary,
    });

    if (event.reasonCode === SoulReasonCode.fallbackEmpty) {
      this.lastFallbackEvent = auditEvent;
    }
    if (event.reasonCode === SoulReasonCode.applied) {
      this.lastAppliedEvent = auditEvent;
    }

    try {
      await this.deps.eventSink?.record(auditEvent);
    } catch {
      // Best-effort observability only.
    }
  }

  private setCacheExpiry(personaId: string, expiresAtMs: number): void {
    const prevStatus = this.personaStatus.get(personaId) ?? {
      cacheExpiresAt: null,
      lastReasonCode: null,
      lastLoadError: null,
      lastOccurredAt: null,
      lastSummary: null,
    };
    this.personaStatus.set(personaId, {
      ...prevStatus,
      cacheExpiresAt: new Date(expiresAtMs).toISOString(),
    });
  }

  public async getRuntimeCore(input: {
    personaId: string;
    now?: Date;
    tolerateFailure?: boolean;
  }): Promise<RuntimeCoreContext> {
    const now = input.now ?? this.now();
    const nowMs = now.getTime();

    const cached = this.cache.get(input.personaId);
    if (cached && nowMs < cached.expiresAtMs) {
      return cached.value;
    }

    try {
      const rawSoul = await this.deps.getCoreProfile({ personaId: input.personaId });

      if (!rawSoul) {
        const context: RuntimeCoreContext = {
          profile: DEFAULT_CORE_PROFILE,
          summary: summarizeCoreProfile(DEFAULT_CORE_PROFILE),
          normalized: true,
          source: "fallback_empty",
        };
        const expiresAtMs = nowMs + this.ttlMs;
        this.cache.set(input.personaId, { value: context, expiresAtMs });
        this.setCacheExpiry(input.personaId, expiresAtMs);

        await this.emit(
          {
            layer: "soul_runtime",
            operation: "FALLBACK",
            reasonCode: SoulReasonCode.fallbackEmpty,
            entityId: input.personaId,
            metadata: {
              reason: "SOUL_NOT_FOUND",
              summary: context.summary,
            },
          },
          now,
        );

        return context;
      }

      const normalizedSoul = normalizeCoreProfile(rawSoul);
      const summary = summarizeCoreProfile(normalizedSoul.profile);
      const context: RuntimeCoreContext = {
        profile: normalizedSoul.profile,
        summary,
        normalized: normalizedSoul.normalized,
        source: "db",
      };

      const expiresAtMs = nowMs + this.ttlMs;
      this.cache.set(input.personaId, { value: context, expiresAtMs });
      this.setCacheExpiry(input.personaId, expiresAtMs);

      await this.emit(
        {
          layer: "soul_runtime",
          operation: "LOAD",
          reasonCode: SoulReasonCode.loadSuccess,
          entityId: input.personaId,
          metadata: {
            normalized: normalizedSoul.normalized,
            summary,
          },
        },
        now,
      );

      return context;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.emit(
        {
          layer: "soul_runtime",
          operation: "LOAD",
          reasonCode: SoulReasonCode.loadFailed,
          entityId: input.personaId,
          metadata: {
            error: message,
          },
        },
        now,
      );

      const fallback: RuntimeCoreContext = {
        profile: DEFAULT_CORE_PROFILE,
        summary: summarizeCoreProfile(DEFAULT_CORE_PROFILE),
        normalized: true,
        source: "fallback_empty",
      };
      const expiresAtMs = nowMs + this.ttlMs;
      this.cache.set(input.personaId, { value: fallback, expiresAtMs });
      this.setCacheExpiry(input.personaId, expiresAtMs);

      await this.emit(
        {
          layer: "soul_runtime",
          operation: "FALLBACK",
          reasonCode: SoulReasonCode.fallbackEmpty,
          entityId: input.personaId,
          metadata: {
            degraded: true,
            summary: fallback.summary,
          },
        },
        now,
      );

      if (!input.tolerateFailure) {
        throw error;
      }

      return fallback;
    }
  }

  public async recordApplied(input: {
    personaId: string;
    layer?: "generation" | "dispatch_precheck";
    metadata?: Record<string, unknown>;
    now?: Date;
  }): Promise<void> {
    const now = input.now ?? this.now();
    await this.emit(
      {
        layer: input.layer ?? "generation",
        operation: "APPLY",
        reasonCode: SoulReasonCode.applied,
        entityId: input.personaId,
        metadata: input.metadata,
      },
      now,
    );
  }

  public getStatus(): RuntimeCoreProviderStatus {
    const personas: Record<string, RuntimeCorePersonaStatus> = {};
    for (const [personaId, status] of this.personaStatus.entries()) {
      personas[personaId] = status;
    }

    return {
      ttlMs: this.ttlMs,
      personas,
      lastFallbackEvent: this.lastFallbackEvent,
      lastAppliedEvent: this.lastAppliedEvent,
    };
  }
}

export function createRuntimeCoreBuilder(
  customDeps?: Partial<RuntimeCoreDeps>,
  options?: {
    ttlMs?: number;
    now?: () => Date;
  },
) {
  const provider = new CachedRuntimeCoreProvider({
    deps: customDeps,
    ttlMs: options?.ttlMs,
    now: options?.now,
  });

  return async function buildRuntimeCore(input: {
    personaId: string;
    now?: Date;
    tolerateFailure?: boolean;
  }): Promise<RuntimeCoreContext> {
    return provider.getRuntimeCore(input);
  };
}

const defaultRuntimeCoreProvider = new CachedRuntimeCoreProvider();

export const buildRuntimeCoreProfile = async (input: {
  personaId: string;
  now?: Date;
  tolerateFailure?: boolean;
}) => defaultRuntimeCoreProvider.getRuntimeCore(input);

export const recordRuntimeCoreApplied = async (input: {
  personaId: string;
  layer?: "generation" | "dispatch_precheck";
  metadata?: Record<string, unknown>;
  now?: Date;
}) => defaultRuntimeCoreProvider.recordApplied(input);

export function getRuntimeCoreProviderStatus(): RuntimeCoreProviderStatus {
  return defaultRuntimeCoreProvider.getStatus();
}

export function buildCorePrecheckHints(input: {
  summary: RuntimeCoreSummary;
  existingHints?: string[];
}): string[] {
  const hints = new Set<string>(input.existingHints ?? []);
  hints.add(`[soul:risk:${input.summary.riskPreference}]`);
  hints.add(`[soul:tradeoff:${input.summary.tradeoffStyle}]`);
  return Array.from(hints).slice(0, 20);
}
