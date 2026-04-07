export type IntakeFixtureMode = "mixed-public-opportunity" | "notification-intake";

export type IntakeOpportunityFixture = {
  source: string;
  contentType: string;
  summary: string;
  metadata?: Record<string, unknown>;
};

export type OpportunityLookupPreview = {
  opportunityKey: string;
  source: string;
  contentType: string;
  summary: string;
  sourceTable: "notifications" | "posts" | "comments";
  sourceId: string;
  metadata?: Record<string, unknown>;
};

export type SelectorInputPreview = {
  fixtureMode: IntakeFixtureMode;
  groupIndexOverride: number;
  selectorReferenceBatchSize: number;
  referenceWindow: {
    batchSize: number;
    groupIndex: number;
  };
  opportunities: Array<{
    opportunityKey: string;
    source: string;
    contentType: string;
    summary: string;
  }>;
  opportunityLookup: OpportunityLookupPreview[];
};

export type ResolvedPersonaPreview = {
  personaId: string;
  username: string;
  displayName: string;
  active: boolean;
  referenceSource: string;
};

export type TaskCandidatePreview = {
  candidateIndex: number;
  opportunityKey: string;
  personaId: string;
  username: string;
  dispatchKind: "notification" | "public";
  sourceTable: "notifications" | "posts" | "comments";
  sourceId: string;
  dedupeKey: string;
  cooldownUntil: string;
  payload: {
    contentType: string;
    source: string;
    summary: string;
    fixtureMode: IntakeFixtureMode;
    boardId: string | null;
    postId: string | null;
    commentId: string | null;
    parentCommentId: string | null;
    context: string | null;
    notificationType: string | null;
  };
};

export type TaskWritePreview = {
  candidateIndex: number;
  inserted: boolean;
  skipReason: string | null;
  taskId: string | null;
  dedupeExpectation: "insert" | "skip_duplicate";
  cooldownExpectation: "eligible" | "cooldown_active";
  expectationSummary: string;
};

export type TaskInjectionPreview = {
  rpcName: "inject_persona_tasks";
  summary: {
    candidateCount: number;
    insertedCount: number;
    skippedCount: number;
    insertedTaskIds: string[];
    skippedReasonCounts: Record<string, number>;
  };
  results: Array<{
    candidateIndex: number;
    inserted: boolean;
    skipReason: string | null;
    taskId: string | null;
    taskType: string;
    dispatchKind: "notification" | "public";
    personaUsername: string;
    sourceTable: "notifications" | "posts" | "comments";
    sourceId: string;
  }>;
};

export const DEFAULT_REFERENCE_LIBRARY = [
  "Yayoi Kusama",
  "David Bowie",
  "Octavia Butler",
  "Grace Jones",
  "Wong Kar-wai",
  "Bjork",
  "Nina Simone",
  "Leiji Matsumoto",
  "Ursula K. Le Guin",
  "Laurie Anderson",
  "Ryuichi Sakamoto",
  "Toni Morrison",
];

const PERSONA_LIBRARY = [
  {
    personaId: "persona-orchid",
    username: "ai_orchid",
    displayName: "Orchid",
    active: true,
    referenceSource: "Yayoi Kusama",
  },
  {
    personaId: "persona-marlowe",
    username: "ai_marlowe",
    displayName: "Marlowe",
    active: true,
    referenceSource: "David Bowie",
  },
  {
    personaId: "persona-sable",
    username: "ai_sable",
    displayName: "Sable",
    active: false,
    referenceSource: "Grace Jones",
  },
  {
    personaId: "persona-vesper",
    username: "ai_vesper",
    displayName: "Vesper",
    active: true,
    referenceSource: "Octavia Butler",
  },
  {
    personaId: "persona-cinder",
    username: "ai_cinder",
    displayName: "Cinder",
    active: true,
    referenceSource: "Wong Kar-wai",
  },
  {
    personaId: "persona-lumen",
    username: "ai_lumen",
    displayName: "Lumen",
    active: true,
    referenceSource: "Bjork",
  },
  {
    personaId: "persona-reverie",
    username: "ai_reverie",
    displayName: "Reverie",
    active: true,
    referenceSource: "Nina Simone",
  },
  {
    personaId: "persona-cascade",
    username: "ai_cascade",
    displayName: "Cascade",
    active: false,
    referenceSource: "Leiji Matsumoto",
  },
  {
    personaId: "persona-sylvan",
    username: "ai_sylvan",
    displayName: "Sylvan",
    active: true,
    referenceSource: "Ursula K. Le Guin",
  },
  {
    personaId: "persona-halo",
    username: "ai_halo",
    displayName: "Halo",
    active: true,
    referenceSource: "Laurie Anderson",
  },
  {
    personaId: "persona-minuet",
    username: "ai_minuet",
    displayName: "Minuet",
    active: true,
    referenceSource: "Ryuichi Sakamoto",
  },
  {
    personaId: "persona-nocturne",
    username: "ai_nocturne",
    displayName: "Nocturne",
    active: true,
    referenceSource: "Toni Morrison",
  },
];

const PERSONA_REFERENCE_OVERRIDES: Record<string, ResolvedPersonaPreview[]> = {
  "Laurie Anderson": [
    {
      personaId: "persona-marlowe",
      username: "ai_marlowe",
      displayName: "Marlowe",
      active: true,
      referenceSource: "Laurie Anderson",
    },
  ],
};

type IntakePromptBlock = {
  name: string;
  content: string;
};

function formatIntakePrompt(blocks: IntakePromptBlock[]) {
  return blocks.map((block) => `[${block.name}]\n${block.content || "(empty)"}`).join("\n\n");
}

export function buildOpportunityStagePrompt(input: SelectorInputPreview) {
  const outputSchema = [
    "{",
    '  "scores": [',
    '    { "opportunity_key": "O01", "probability": 0.82 },',
    '    { "opportunity_key": "O02", "probability": 0.61 },',
    '    { "opportunity_key": "O03", "probability": 0.24 }',
    "  ]",
    "}",
  ].join("\n");

  const availableOpportunities =
    input.opportunities
      .map((opportunity) =>
        [
          `- opportunity_key: ${opportunity.opportunityKey}`,
          `  content_type: ${opportunity.contentType}`,
          `  summary: ${opportunity.summary}`,
        ].join("\n"),
      )
      .join("\n") || "(empty)";

  const blocks: IntakePromptBlock[] = [
    {
      name: "stage",
      content: "opportunities_selector",
    },
    {
      name: "goal",
      content:
        "Review the current source snapshot and assign a probability to every opportunity for whether it should continue into downstream task selection.",
    },
    {
      name: "selection_rules",
      content: [
        "Return one probability row for every provided opportunity.",
        "Use higher probabilities only when the opportunity is clearly worth further action.",
        "Use lower probabilities when the opportunity should likely be skipped or deferred.",
        "Use only the provided prompt-local opportunity keys.",
        "Do not omit opportunities from the output.",
      ].join("\n"),
    },
    {
      name: "decision_criteria",
      content: [
        "Score each opportunity with a probability between 0 and 1 for whether it should move forward.",
        "Use 0.8 to 1.0 when the opportunity is clearly worth acting on now and has a strong next step.",
        "Use 0.5 to 0.79 when the opportunity looks promising but still has some uncertainty or weaker upside.",
        "Use 0.0 to 0.49 when the opportunity is low-value, unclear, stale, repetitive, or not worth acting on now.",
        "Give higher scores to opportunities with a clear reply/post target and where a persona response would likely add value.",
        "Give lower scores to opportunities that are ambiguous, low-context, already handled, or unlikely to benefit from a persona response.",
      ].join("\n"),
    },
    {
      name: "available_opportunities",
      content: availableOpportunities,
    },
    {
      name: "required_output_json",
      content: [
        "Return valid JSON only using this exact top-level shape:",
        outputSchema,
        "",
        "Requirements:",
        "- Return exactly one JSON object.",
        "- `scores` must be an array with one object for every provided opportunity.",
        "- Each object must contain exactly `opportunity_key` and `probability`.",
        "- `probability` must be a number between 0 and 1.",
        "- Each opportunity_key must match one provided prompt-local opportunity key exactly.",
        "- The application will treat `probability > 0.5` as selected and `probability <= 0.5` as not selected.",
        "- Do not output markdown, prose, reasons, reference names, selection codes, or any extra fields.",
      ].join("\n"),
    },
  ];

  return formatIntakePrompt(blocks);
}

export function buildCandidateStagePrompt(input: {
  selectedOpportunities: Array<{
    opportunityKey: string;
    contentType: string;
    summary: string;
  }>;
  referenceBatch: string[];
}) {
  const outputSchema = [
    "{",
    '  "speaker_candidates": [',
    "    {",
    '      "opportunity_key": "O01",',
    '      "selected_speakers": [',
    '        { "name": "David Bowie", "probability": 0.82 },',
    '        { "name": "Laurie Anderson", "probability": 0.71 }',
    "      ]",
    "    },",
    "    {",
    '      "opportunity_key": "O02",',
    '      "selected_speakers": [{ "name": "Grace Jones", "probability": 0.64 }]',
    "    }",
    "  ]",
    "}",
  ].join("\n");

  const selectedOpportunities =
    input.selectedOpportunities
      .map((opportunity) =>
        [
          `- opportunity_key: ${opportunity.opportunityKey}`,
          `  content_type: ${opportunity.contentType}`,
          `  summary: ${opportunity.summary}`,
        ].join("\n"),
      )
      .join("\n") || "(empty)";

  const blocks: IntakePromptBlock[] = [
    {
      name: "stage",
      content: "candidates_selector",
    },
    {
      name: "goal",
      content:
        "For each selected opportunity, choose the most suitable speaker candidates to carry that task forward.",
    },
    {
      name: "selected_opportunities",
      content: selectedOpportunities,
    },
    {
      name: "speaker_batch",
      content: input.referenceBatch.join("\n") || "(empty)",
    },
    {
      name: "selection_rules",
      content: [
        "Pick speakers only from the provided speaker batch.",
        "Return only the selected speakers in the output.",
        "For each selected opportunity, choose at least 1 speaker and at most 3 speakers.",
        "Do not invent names outside the batch.",
      ].join("\n"),
    },
    {
      name: "decision_criteria",
      content: [
        "Score possible speaker candidates with probabilities between 0 and 1 based on how suitable they are for the opportunity.",
        "Choose the most suitable speakers whose voice, posture, and perspective fit the opportunity naturally.",
        "For each selected opportunity, return at least 1 speaker and at most 3 speakers.",
        "Use higher probabilities for stronger speaking fits and lower probabilities for weaker but still selected fits.",
        "Deprioritize speakers that are off-tone, redundant, too generic, or mismatched to the opportunity context.",
      ].join("\n"),
    },
    {
      name: "required_output_json",
      content: [
        "Return valid JSON only using this exact top-level shape:",
        outputSchema,
        "",
        "Requirements:",
        "- Return exactly one JSON object.",
        "- `speaker_candidates` must be an array of zero or more objects.",
        "- Each object must contain exactly `opportunity_key` and `selected_speakers`.",
        "- `selected_speakers` must contain at least 1 object and at most 3 objects for each selected opportunity.",
        "- Each selected speaker object must contain exactly `name` and `probability`.",
        "- `probability` must be a number between 0 and 1.",
        "- Each opportunity_key must match one provided selected opportunity key exactly.",
        "- Each `name` must match one provided speaker name exactly.",
        "- Do not output prose, markdown, persona ids, reasons, statuses, or any extra fields.",
      ].join("\n"),
    },
  ];

  return formatIntakePrompt(blocks);
}

function getOpportunityPrefix(fixtureMode: IntakeFixtureMode) {
  return fixtureMode === "notification-intake" ? "N" : "O";
}

function buildSourceTable(source: string, contentType: string) {
  if (source === "notification") {
    return "notifications";
  }

  return contentType === "post" ? "posts" : "comments";
}

function resolveReferencePersonas(referenceName: string): ResolvedPersonaPreview[] {
  return (
    PERSONA_REFERENCE_OVERRIDES[referenceName] ??
    PERSONA_LIBRARY.filter((persona) => persona.referenceSource === referenceName)
  );
}

export function buildReferenceWindow(input: {
  batchSize: number;
  groupIndex: number;
  references?: string[];
}): {
  start: number;
  endExclusive: number;
  totalReferences: number;
  window: string[];
} {
  const references = input.references ?? DEFAULT_REFERENCE_LIBRARY;
  const totalReferences = references.length;

  if (totalReferences === 0) {
    return {
      start: 0,
      endExclusive: 0,
      totalReferences: 0,
      window: [],
    };
  }

  const safeBatchSize = Math.max(1, Math.min(input.batchSize, totalReferences));
  const maxStart = Math.max(0, totalReferences - safeBatchSize);
  const rawStart = input.groupIndex * safeBatchSize;
  const start = Math.min(rawStart, maxStart);
  const endExclusive = start + safeBatchSize;

  return {
    start,
    endExclusive,
    totalReferences,
    window: references.slice(start, endExclusive),
  };
}

export function resolvePersonasForReferences(input: {
  selectedReferences: Array<{ referenceName: string }>;
  personas?: ResolvedPersonaPreview[];
}): ResolvedPersonaPreview[] {
  if (input.personas) {
    const selectedNames = new Set(input.selectedReferences.map((item) => item.referenceName));
    return input.personas.filter((persona) => selectedNames.has(persona.referenceSource));
  }

  return input.selectedReferences.flatMap((item) => resolveReferencePersonas(item.referenceName));
}

export function buildSelectorInputPreview(input: {
  fixtureMode: IntakeFixtureMode;
  groupIndexOverride: number;
  selectorReferenceBatchSize: number;
  items: Array<
    IntakeOpportunityFixture & {
      sourceId?: string;
      createdAt?: string;
    }
  >;
}): SelectorInputPreview {
  const prefix = getOpportunityPrefix(input.fixtureMode);
  return {
    fixtureMode: input.fixtureMode,
    groupIndexOverride: input.groupIndexOverride,
    selectorReferenceBatchSize: input.selectorReferenceBatchSize,
    referenceWindow: {
      batchSize: input.selectorReferenceBatchSize,
      groupIndex: input.groupIndexOverride,
    },
    opportunities: input.items.map((item, index) => ({
      opportunityKey: `${prefix}${String(index + 1).padStart(2, "0")}`,
      source: item.source,
      contentType: item.contentType,
      summary: item.summary,
    })),
    opportunityLookup: input.items.map((item, index) => ({
      opportunityKey: `${prefix}${String(index + 1).padStart(2, "0")}`,
      source: item.source,
      contentType: item.contentType,
      summary: item.summary,
      sourceTable: buildSourceTable(item.source, item.contentType),
      sourceId: item.sourceId ?? `${item.source}-${index + 1}`,
      metadata: item.metadata,
    })),
  };
}
