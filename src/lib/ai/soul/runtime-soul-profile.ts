import { SoulReasonCode } from "@/lib/ai/reason-codes";
import { createAdminClient } from "@/lib/supabase/admin";

type SoulValuePriority = 1 | 2 | 3;

export type RuntimeSoulProfile = {
  identityCore: {
    archetype: string;
    mbti: string;
    coreMotivation: string;
  };
  valueHierarchy: Array<{ value: string; priority: SoulValuePriority }>;
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
  guardrails: {
    hardNo: string[];
    deescalationRules: string[];
  };
};

export type RuntimeSoulSummary = {
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

export type RuntimeSoulContext = {
  profile: RuntimeSoulProfile;
  summary: RuntimeSoulSummary;
  normalized: boolean;
  source: "db" | "fallback_empty";
};

export type RuntimeSoulReasonCodeValue = (typeof SoulReasonCode)[keyof typeof SoulReasonCode];

export type RuntimeSoulAuditEvent = {
  layer: "soul_runtime" | "generation" | "dispatch_precheck";
  operation: "LOAD" | "FALLBACK" | "APPLY";
  reasonCode: RuntimeSoulReasonCodeValue;
  entityId: string;
  occurredAt: string;
  metadata?: Record<string, unknown>;
};

export interface RuntimeSoulEventSink {
  record(event: RuntimeSoulAuditEvent): Promise<void>;
}

export class InMemoryRuntimeSoulEventSink implements RuntimeSoulEventSink {
  public readonly events: RuntimeSoulAuditEvent[] = [];

  public async record(event: RuntimeSoulAuditEvent): Promise<void> {
    this.events.push(event);
  }
}

type RuntimeSoulDeps = {
  getSoulProfile: (input: { personaId: string }) => Promise<unknown>;
  eventSink?: RuntimeSoulEventSink;
};

type CacheEntry<T> = {
  value: T;
  expiresAtMs: number;
};

type PersonaCoreRow = {
  core_profile: unknown;
};

export type RuntimeSoulProviderStatus = {
  ttlMs: number;
  personas: Record<string, RuntimeSoulPersonaStatus>;
  lastFallbackEvent: RuntimeSoulAuditEvent | null;
  lastAppliedEvent: RuntimeSoulAuditEvent | null;
};

export type RuntimeSoulPersonaStatus = {
  cacheExpiresAt: string | null;
  lastReasonCode: RuntimeSoulReasonCodeValue | null;
  lastLoadError: string | null;
  lastOccurredAt: string | null;
  lastSummary: RuntimeSoulSummary | null;
};

const DEFAULT_TTL_MS = 30_000;
const DEFAULT_SOUL_PROFILE: RuntimeSoulProfile = {
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

function normalizePriority(value: unknown): SoulValuePriority | null {
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
  return DEFAULT_SOUL_PROFILE.languageSignature.rhythm;
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

function adaptPersonaCoreToSoulProfile(input: unknown): RuntimeSoulProfile | null {
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
    .filter((item): item is { value: string; priority: SoulValuePriority } => item !== null)
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
    DEFAULT_SOUL_PROFILE.guardrails.hardNo,
  );
  const derivedTone = derivePersonaTone({
    defaultStance: normalizeText(
      interactionDefaults?.default_stance,
      DEFAULT_SOUL_PROFILE.relationshipTendencies.defaultStance,
    ),
    nonGenericTraits,
    creatorBiases,
    humorPreferences,
  });
  const derivedRhythm = derivePersonaRhythm({
    defaultStance: normalizeText(
      interactionDefaults?.default_stance,
      DEFAULT_SOUL_PROFILE.relationshipTendencies.defaultStance,
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

  const tradeoffStyle = judgmentStyle || DEFAULT_SOUL_PROFILE.decisionPolicy.tradeoffStyle;
  const riskPreference = deriveRiskPreference({
    tradeoffStyle,
    riskPreference: values?.risk_preference,
  });

  return {
    identityCore: {
      archetype: normalizeText(
        identitySummary?.archetype ?? identitySummary?.one_sentence_identity,
        DEFAULT_SOUL_PROFILE.identityCore.archetype,
      ),
      mbti: normalizeMbti(identitySummary?.mbti, DEFAULT_SOUL_PROFILE.identityCore.mbti),
      coreMotivation: normalizeText(
        identitySummary?.core_motivation,
        DEFAULT_SOUL_PROFILE.identityCore.coreMotivation,
      ),
    },
    valueHierarchy:
      valueHierarchy.length > 0 ? valueHierarchy.slice(0, 6) : DEFAULT_SOUL_PROFILE.valueHierarchy,
    reasoningLens: {
      primary:
        creatorStructuralPreferences.length > 0
          ? creatorStructuralPreferences.slice(0, 6)
          : creativePreferences.length > 0
            ? creativePreferences.slice(0, 6)
            : DEFAULT_SOUL_PROFILE.reasoningLens.primary,
      secondary:
        humorPreferences.length > 0
          ? humorPreferences.slice(0, 6)
          : narrativePreferences.length > 0
            ? narrativePreferences.slice(0, 6)
            : DEFAULT_SOUL_PROFILE.reasoningLens.secondary,
      promptHint: normalizeText(
        nonGenericTraits[0] ??
          creatorBiases[0] ??
          worldview[0] ??
          identitySummary?.one_sentence_identity,
        DEFAULT_SOUL_PROFILE.reasoningLens.promptHint,
      ),
    },
    responseStyle: {
      tone: derivedTone.length > 0 ? derivedTone : DEFAULT_SOUL_PROFILE.responseStyle.tone,
      patterns:
        creatorDetails.length > 0
          ? creatorDetails.slice(0, 6)
          : creativePreferences.length > 0
            ? creativePreferences.slice(0, 6)
            : DEFAULT_SOUL_PROFILE.responseStyle.patterns,
      avoid:
        dislikedPatterns.length > 0
          ? dislikedPatterns.slice(0, 6)
          : DEFAULT_SOUL_PROFILE.responseStyle.avoid,
    },
    relationshipTendencies: {
      defaultStance: normalizeText(
        interactionDefaults?.default_stance,
        DEFAULT_SOUL_PROFILE.relationshipTendencies.defaultStance,
      ),
      trustSignals:
        discussionStrengths.length > 0
          ? discussionStrengths.slice(0, 6)
          : DEFAULT_SOUL_PROFILE.relationshipTendencies.trustSignals,
      frictionTriggers:
        frictionTriggers.length > 0
          ? frictionTriggers.slice(0, 6)
          : DEFAULT_SOUL_PROFILE.relationshipTendencies.frictionTriggers,
    },
    agentEnactmentRules:
      nonGenericTraits.length > 0
        ? nonGenericTraits.slice(0, 6)
        : discussionStrengths.length > 0
          ? discussionStrengths.slice(0, 6)
          : DEFAULT_SOUL_PROFILE.agentEnactmentRules,
    inCharacterExamples: DEFAULT_SOUL_PROFILE.inCharacterExamples,
    decisionPolicy: {
      evidenceStandard: normalizeText(
        topicsRequiringRetrieval.length > 0
          ? "use runtime retrieval when context-specific support is weak"
          : livedContext?.topics_with_confident_grounding,
        DEFAULT_SOUL_PROFILE.decisionPolicy.evidenceStandard,
      ),
      tradeoffStyle,
      uncertaintyHandling:
        topicsRequiringRetrieval.length > 0
          ? `Narrow claims when support is weak; retrieve for: ${topicsRequiringRetrieval.join(", ")}`
          : DEFAULT_SOUL_PROFILE.decisionPolicy.uncertaintyHandling,
      antiPatterns:
        dislikedPatterns.length > 0
          ? dislikedPatterns.slice(0, 8)
          : DEFAULT_SOUL_PROFILE.decisionPolicy.antiPatterns,
      riskPreference,
    },
    interactionDoctrine: {
      askVsTellRatio: DEFAULT_SOUL_PROFILE.interactionDoctrine.askVsTellRatio,
      feedbackPrinciples:
        derivedFeedbackPrinciples.length > 0
          ? derivedFeedbackPrinciples
          : DEFAULT_SOUL_PROFILE.interactionDoctrine.feedbackPrinciples,
      collaborationStance: normalizeText(
        interactionDefaults?.default_stance,
        DEFAULT_SOUL_PROFILE.interactionDoctrine.collaborationStance,
      ),
    },
    languageSignature: {
      rhythm: derivedRhythm,
      preferredStructures:
        narrativePreferences.length > 0
          ? narrativePreferences.slice(0, 6)
          : DEFAULT_SOUL_PROFILE.languageSignature.preferredStructures,
      lexicalTaboos: derivedLexicalTaboos,
    },
    guardrails: {
      hardNo: guardrailHardNo,
      deescalationRules: normalizeStringArray(
        guardrails?.deescalation_style,
        DEFAULT_SOUL_PROFILE.guardrails.deescalationRules,
      ),
    },
  };
}

export function normalizeSoulProfile(input: unknown): {
  profile: RuntimeSoulProfile;
  normalized: boolean;
} {
  const adaptedCore = adaptPersonaCoreToSoulProfile(input);
  if (adaptedCore) {
    return { profile: adaptedCore, normalized: true };
  }

  const source = asRecord(input);
  if (!source) {
    return { profile: DEFAULT_SOUL_PROFILE, normalized: true };
  }

  const valueHierarchyRaw = Array.isArray(source.valueHierarchy) ? source.valueHierarchy : [];
  const valueHierarchy: Array<{ value: string; priority: SoulValuePriority }> = [];
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
    DEFAULT_SOUL_PROFILE.decisionPolicy.tradeoffStyle,
  );

  const profile: RuntimeSoulProfile = {
    identityCore: {
      archetype: normalizeText(
        identityCore?.archetype ?? source.identityCore,
        DEFAULT_SOUL_PROFILE.identityCore.archetype,
      ),
      mbti: normalizeMbti(identityCore?.mbti, DEFAULT_SOUL_PROFILE.identityCore.mbti),
      coreMotivation: normalizeText(
        identityCore?.coreMotivation,
        DEFAULT_SOUL_PROFILE.identityCore.coreMotivation,
      ),
    },
    valueHierarchy:
      valueHierarchy.length > 0 ? valueHierarchy.slice(0, 6) : DEFAULT_SOUL_PROFILE.valueHierarchy,
    reasoningLens: {
      primary: normalizeStringArray(
        reasoningLens?.primary,
        DEFAULT_SOUL_PROFILE.reasoningLens.primary,
      ),
      secondary: normalizeStringArray(
        reasoningLens?.secondary,
        DEFAULT_SOUL_PROFILE.reasoningLens.secondary,
      ),
      promptHint: normalizeText(
        reasoningLens?.promptHint,
        DEFAULT_SOUL_PROFILE.reasoningLens.promptHint,
      ),
    },
    responseStyle: {
      tone: normalizeStringArray(responseStyle?.tone, DEFAULT_SOUL_PROFILE.responseStyle.tone),
      patterns: normalizeStringArray(
        responseStyle?.patterns,
        DEFAULT_SOUL_PROFILE.responseStyle.patterns,
      ),
      avoid: normalizeStringArray(responseStyle?.avoid, DEFAULT_SOUL_PROFILE.responseStyle.avoid),
    },
    relationshipTendencies: {
      defaultStance: normalizeText(
        relationshipTendencies?.defaultStance,
        DEFAULT_SOUL_PROFILE.relationshipTendencies.defaultStance,
      ),
      trustSignals: normalizeStringArray(
        relationshipTendencies?.trustSignals,
        DEFAULT_SOUL_PROFILE.relationshipTendencies.trustSignals,
      ),
      frictionTriggers: normalizeStringArray(
        relationshipTendencies?.frictionTriggers,
        DEFAULT_SOUL_PROFILE.relationshipTendencies.frictionTriggers,
      ),
    },
    agentEnactmentRules: normalizeStringArray(
      source.agentEnactmentRules,
      DEFAULT_SOUL_PROFILE.agentEnactmentRules,
    ),
    inCharacterExamples:
      inCharacterExamples.length > 0
        ? inCharacterExamples.slice(0, 4)
        : DEFAULT_SOUL_PROFILE.inCharacterExamples,
    decisionPolicy: {
      evidenceStandard: normalizeText(
        decisionPolicy?.evidenceStandard,
        DEFAULT_SOUL_PROFILE.decisionPolicy.evidenceStandard,
      ),
      tradeoffStyle,
      uncertaintyHandling: normalizeText(
        decisionPolicy?.uncertaintyHandling,
        DEFAULT_SOUL_PROFILE.decisionPolicy.uncertaintyHandling,
      ),
      antiPatterns: normalizeStringArray(
        decisionPolicy?.antiPatterns,
        DEFAULT_SOUL_PROFILE.decisionPolicy.antiPatterns,
      ),
      riskPreference: deriveRiskPreference({
        riskPreference: decisionPolicy?.riskPreference,
        tradeoffStyle,
      }),
    },
    interactionDoctrine: {
      askVsTellRatio: normalizeText(
        interactionDoctrine?.askVsTellRatio,
        DEFAULT_SOUL_PROFILE.interactionDoctrine.askVsTellRatio,
      ),
      feedbackPrinciples: normalizeStringArray(
        interactionDoctrine?.feedbackPrinciples,
        DEFAULT_SOUL_PROFILE.interactionDoctrine.feedbackPrinciples,
      ),
      collaborationStance: normalizeText(
        interactionDoctrine?.collaborationStance,
        DEFAULT_SOUL_PROFILE.interactionDoctrine.collaborationStance,
      ),
    },
    languageSignature: {
      rhythm: normalizeText(
        languageSignature?.rhythm,
        DEFAULT_SOUL_PROFILE.languageSignature.rhythm,
      ),
      preferredStructures: normalizeStringArray(
        languageSignature?.preferredStructures,
        DEFAULT_SOUL_PROFILE.languageSignature.preferredStructures,
      ),
      lexicalTaboos: normalizeStringArray(languageSignature?.lexicalTaboos, []),
    },
    guardrails: {
      hardNo: normalizeStringArray(guardrails?.hardNo, DEFAULT_SOUL_PROFILE.guardrails.hardNo),
      deescalationRules: normalizeStringArray(
        guardrails?.deescalationRules,
        DEFAULT_SOUL_PROFILE.guardrails.deescalationRules,
      ),
    },
  };

  const normalized = JSON.stringify(profile) !== JSON.stringify(source);
  return { profile, normalized };
}

export function summarizeSoulProfile(profile: RuntimeSoulProfile): RuntimeSoulSummary {
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

function createSupabaseRuntimeSoulDeps(): RuntimeSoulDeps {
  return {
    getSoulProfile: async ({ personaId }) => {
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

export class CachedRuntimeSoulProvider {
  private readonly deps: RuntimeSoulDeps;
  private readonly ttlMs: number;
  private readonly now: () => Date;

  private cache = new Map<string, CacheEntry<RuntimeSoulContext>>();

  private personaStatus = new Map<string, RuntimeSoulPersonaStatus>();
  private lastFallbackEvent: RuntimeSoulAuditEvent | null = null;
  private lastAppliedEvent: RuntimeSoulAuditEvent | null = null;

  public constructor(options?: {
    deps?: Partial<RuntimeSoulDeps>;
    ttlMs?: number;
    now?: () => Date;
  }) {
    this.deps = { ...createSupabaseRuntimeSoulDeps(), ...(options?.deps ?? {}) };
    this.ttlMs = Math.max(1_000, options?.ttlMs ?? DEFAULT_TTL_MS);
    this.now = options?.now ?? (() => new Date());
  }

  private async emit(event: Omit<RuntimeSoulAuditEvent, "occurredAt">, now: Date): Promise<void> {
    const occurredAt = now.toISOString();
    const auditEvent: RuntimeSoulAuditEvent = {
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
          ? (metadataSummary as RuntimeSoulSummary)
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

  public async getRuntimeSoul(input: {
    personaId: string;
    now?: Date;
    tolerateFailure?: boolean;
  }): Promise<RuntimeSoulContext> {
    const now = input.now ?? this.now();
    const nowMs = now.getTime();

    const cached = this.cache.get(input.personaId);
    if (cached && nowMs < cached.expiresAtMs) {
      return cached.value;
    }

    try {
      const rawSoul = await this.deps.getSoulProfile({ personaId: input.personaId });

      if (!rawSoul) {
        const context: RuntimeSoulContext = {
          profile: DEFAULT_SOUL_PROFILE,
          summary: summarizeSoulProfile(DEFAULT_SOUL_PROFILE),
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

      const normalizedSoul = normalizeSoulProfile(rawSoul);
      const summary = summarizeSoulProfile(normalizedSoul.profile);
      const context: RuntimeSoulContext = {
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

      const fallback: RuntimeSoulContext = {
        profile: DEFAULT_SOUL_PROFILE,
        summary: summarizeSoulProfile(DEFAULT_SOUL_PROFILE),
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

  public getStatus(): RuntimeSoulProviderStatus {
    const personas: Record<string, RuntimeSoulPersonaStatus> = {};
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

export function createRuntimeSoulBuilder(
  customDeps?: Partial<RuntimeSoulDeps>,
  options?: {
    ttlMs?: number;
    now?: () => Date;
  },
) {
  const provider = new CachedRuntimeSoulProvider({
    deps: customDeps,
    ttlMs: options?.ttlMs,
    now: options?.now,
  });

  return async function buildRuntimeSoul(input: {
    personaId: string;
    now?: Date;
    tolerateFailure?: boolean;
  }): Promise<RuntimeSoulContext> {
    return provider.getRuntimeSoul(input);
  };
}

const defaultRuntimeSoulProvider = new CachedRuntimeSoulProvider();

export const buildRuntimeSoulProfile = async (input: {
  personaId: string;
  now?: Date;
  tolerateFailure?: boolean;
}) => defaultRuntimeSoulProvider.getRuntimeSoul(input);

export const recordRuntimeSoulApplied = async (input: {
  personaId: string;
  layer?: "generation" | "dispatch_precheck";
  metadata?: Record<string, unknown>;
  now?: Date;
}) => defaultRuntimeSoulProvider.recordApplied(input);

export function getRuntimeSoulProviderStatus(): RuntimeSoulProviderStatus {
  return defaultRuntimeSoulProvider.getStatus();
}

export function buildSoulPrecheckHints(input: {
  summary: RuntimeSoulSummary;
  existingHints?: string[];
}): string[] {
  const hints = new Set<string>(input.existingHints ?? []);
  hints.add(`[soul:risk:${input.summary.riskPreference}]`);
  hints.add(`[soul:tradeoff:${input.summary.tradeoffStyle}]`);
  return Array.from(hints).slice(0, 20);
}
