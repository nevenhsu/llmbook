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

export type OpportunitySelectionPreview = {
  opportunityProbabilities: Array<{
    opportunityKey: string;
    probability: number;
  }>;
  selectedOpportunities: Array<{
    opportunityKey: string;
  }>;
  promptPreview: string;
  actualModelPayload: {
    assembledPrompt: string;
    compactContext: {
      fixtureMode: IntakeFixtureMode;
      opportunities: Array<{
        opportunityKey: string;
        source: string;
        contentType: string;
      }>;
    };
  };
};

export type CandidateSelectionPreview = {
  referenceWindow: {
    start: number;
    endExclusive: number;
    totalReferences: number;
  };
  candidateSelections: Array<{
    opportunityKey: string;
    selectedReferences: string[];
  }>;
  promptPreview: string;
  actualModelPayload: {
    assembledPrompt: string;
    compactContext: {
      fixtureMode: IntakeFixtureMode;
      groupIndex: number;
      batchSize: number;
      selectedOpportunities: Array<{
        opportunityKey: string;
        source: string;
        contentType: string;
      }>;
      referenceBatch: string[];
    };
  };
};

export type ResolvedPersonaPreview = {
  personaId: string;
  username: string;
  displayName: string;
  active: boolean;
  referenceSource: string;
};

export type ResolvedCandidatePreview = {
  opportunityKey: string;
  personaIds: Array<{
    referenceName: string;
    personaId: string;
    status: "active" | "inactive";
  }>;
};

export type SelectorOutputPreview = {
  referenceWindow: {
    start: number;
    endExclusive: number;
    totalReferences: number;
  };
  selectedReferences: Array<{
    referenceName: string;
    rank: number;
    reason: string;
  }>;
  promptPreview: string;
  actualModelPayload: {
    assembledPrompt: string;
    compactContext: {
      fixtureMode: IntakeFixtureMode;
      groupIndex: number;
      batchSize: number;
      opportunities: Array<{
        opportunityKey: string;
        source: string;
        contentType: string;
      }>;
    };
  };
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
  decisionReason: string;
  payload: {
    contentType: string;
    source: string;
    summary: string;
    fixtureMode: IntakeFixtureMode;
    notificationTarget?: {
      postId: string | null;
      commentId: string | null;
      parentCommentId: string | null;
      context: string | null;
      notificationType: string | null;
    } | null;
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

const REFERENCE_LIBRARY = [
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

type IntakePromptBlock = {
  name: string;
  content: string;
};

function formatIntakePrompt(blocks: IntakePromptBlock[]) {
  return blocks.map((block) => `[${block.name}]\n${block.content || "(empty)"}`).join("\n\n");
}

function buildOpportunityStagePrompt(input: SelectorInputPreview) {
  const outputSchema = [
    "{",
    '  "opportunity_probabilities": [',
    '    { "opportunity_key": "O01", "probability": 0.82 },',
    '    { "opportunity_key": "O02", "probability": 0.61 },',
    '    { "opportunity_key": "O03", "probability": 0.24 }',
    "  ]",
    "}",
  ].join("\n");

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
      name: "snapshot_scope",
      content: `fixture_mode: ${input.fixtureMode}`,
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
        "Prioritize opportunities with a clear reply/posting target or an obvious next action.",
        "Prioritize opportunities where a persona response is likely to add value, context, or momentum.",
        "Prefer high-signal public threads over low-context chatter, duplicate noise, or stale items.",
        "Deprioritize opportunities that are ambiguous, low-value, already handled, or missing enough context to act responsibly.",
      ].join("\n"),
    },
    {
      name: "available_opportunities",
      content:
        input.opportunities
          .map(
            (opportunity) =>
              `${opportunity.opportunityKey}: ${opportunity.source} / ${opportunity.contentType} / ${opportunity.summary}`,
          )
          .join("\n") || "(empty)",
    },
    {
      name: "required_output_json",
      content: [
        "Return valid JSON only using this exact top-level shape:",
        outputSchema,
        "",
        "Requirements:",
        "- Return exactly one JSON object.",
        "- `opportunity_probabilities` must be an array with one object for every provided opportunity.",
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

function buildCandidateStagePrompt(input: {
  selectorInput: SelectorInputPreview;
  opportunitySelection: OpportunitySelectionPreview;
  referenceBatch: string[];
}) {
  const outputSchema = [
    "{",
    '  "candidate_selections": [',
    "    {",
    '      "opportunity_key": "O01",',
    '      "selected_references": ["Yayoi Kusama", "David Bowie"]',
    "    },",
    "    {",
    '      "opportunity_key": "O02",',
    '      "selected_references": ["Octavia Butler", "Grace Jones"]',
    "    }",
    "  ]",
    "}",
  ].join("\n");

  const selectedOpportunities =
    input.opportunitySelection.selectedOpportunities
      .map((opportunity) => {
        const sourceOpportunity =
          input.selectorInput.opportunities.find(
            (item) => item.opportunityKey === opportunity.opportunityKey,
          ) ?? null;
        return sourceOpportunity
          ? `${sourceOpportunity.opportunityKey}: ${sourceOpportunity.source} / ${sourceOpportunity.contentType} / ${sourceOpportunity.summary}`
          : opportunity.opportunityKey;
      })
      .join("\n") || "(empty)";

  const blocks: IntakePromptBlock[] = [
    {
      name: "stage",
      content: "candidates_selector",
    },
    {
      name: "goal",
      content:
        "For each selected opportunity, choose the most suitable reference names to carry that task forward.",
    },
    {
      name: "candidate_scope",
      content: [
        `fixture_mode: ${input.selectorInput.fixtureMode}`,
        `selector_reference_batch_size: ${input.selectorInput.selectorReferenceBatchSize}`,
        `group_index_override: ${input.selectorInput.groupIndexOverride}`,
      ].join("\n"),
    },
    {
      name: "selected_opportunities",
      content: selectedOpportunities,
    },
    {
      name: "reference_batch",
      content: input.referenceBatch.join("\n") || "(empty)",
    },
    {
      name: "selection_rules",
      content: [
        "Pick only reference names from the provided reference batch.",
        "Choose the smallest suitable shortlist per selected opportunity.",
        "Do not invent names outside the batch.",
        "Do not resolve personas, statuses, or task payloads in this stage.",
      ].join("\n"),
    },
    {
      name: "decision_criteria",
      content: [
        "Choose reference names whose known voice, posture, and perspective fit the selected opportunity.",
        "Prefer references that can respond naturally to the opportunity without forcing the tone.",
        "Prefer diversity only when multiple references are genuinely plausible for different angles of the same task.",
        "Deprioritize references that are off-tone, redundant, too generic, or mismatched to the opportunity context.",
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
        "- `candidate_selections` must be an array of zero or more objects.",
        "- Each object must contain exactly `opportunity_key` and `selected_references`.",
        "- `selected_references` must be an array of zero or more strings.",
        "- Each opportunity_key must match one provided selected opportunity key exactly.",
        "- Each selected_references entry must match one provided reference name exactly.",
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

function findPersonaById(personaId: string) {
  return PERSONA_LIBRARY.find((persona) => persona.personaId === personaId) ?? null;
}

function findLookupByOpportunityKey(input: SelectorInputPreview, opportunityKey: string) {
  return input.opportunityLookup.find((item) => item.opportunityKey === opportunityKey) ?? null;
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
  const references = input.references ?? REFERENCE_LIBRARY;
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
  const personas = input.personas ?? PERSONA_LIBRARY;
  const selectedNames = new Set(input.selectedReferences.map((item) => item.referenceName));
  return personas.filter((persona) => selectedNames.has(persona.referenceSource));
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

export function buildOpportunitySelectionPreview(
  input: SelectorInputPreview,
): OpportunitySelectionPreview {
  const assembledPrompt = buildOpportunityStagePrompt(input);
  const opportunityProbabilities = input.opportunities.map((opportunity, index) => ({
    opportunityKey: opportunity.opportunityKey,
    probability:
      input.fixtureMode === "notification-intake"
        ? Number(Math.max(0.65, 0.92 - index * 0.08).toFixed(2))
        : Number(Math.max(0.35, 0.81 - index * 0.16).toFixed(2)),
  }));
  const selectedOpportunities = opportunityProbabilities
    .filter((opportunity) => opportunity.probability > 0.5)
    .map((opportunity) => ({
      opportunityKey: opportunity.opportunityKey,
    }));

  return {
    opportunityProbabilities,
    selectedOpportunities,
    promptPreview: assembledPrompt,
    actualModelPayload: {
      assembledPrompt,
      compactContext: {
        fixtureMode: input.fixtureMode,
        opportunities: input.opportunities.map((opportunity) => ({
          opportunityKey: opportunity.opportunityKey,
          source: opportunity.source,
          contentType: opportunity.contentType,
        })),
      },
    },
  };
}

export function buildCandidateSelectionPreview(input: {
  selectorInput: SelectorInputPreview;
  opportunitySelection: OpportunitySelectionPreview;
}): CandidateSelectionPreview {
  const referenceWindow = buildReferenceWindow({
    batchSize: input.selectorInput.referenceWindow.batchSize,
    groupIndex: input.selectorInput.referenceWindow.groupIndex,
  });
  const selectableReferences =
    input.selectorInput.fixtureMode === "notification-intake"
      ? referenceWindow.window
      : referenceWindow.window.filter((referenceName) =>
          PERSONA_LIBRARY.some(
            (persona) => persona.referenceSource === referenceName && persona.active,
          ),
        );
  const assembledPrompt = buildCandidateStagePrompt({
    selectorInput: input.selectorInput,
    opportunitySelection: input.opportunitySelection,
    referenceBatch: referenceWindow.window,
  });

  const candidateSelections = input.opportunitySelection.selectedOpportunities.map(
    (opportunity, index) => {
      const selectedCount =
        input.selectorInput.fixtureMode === "notification-intake"
          ? 0
          : Math.min(
              2,
              selectableReferences.length > 0
                ? selectableReferences.length
                : referenceWindow.window.length,
            );
      const selectionPool =
        selectableReferences.length > 0 ? selectableReferences : referenceWindow.window;

      const selectedReferences =
        selectedCount === 0
          ? []
          : Array.from({ length: selectedCount }, (_, offset) => {
              const batchIndex =
                selectionPool.length >=
                input.opportunitySelection.selectedOpportunities.length * selectedCount
                  ? index * selectedCount + offset
                  : (index * selectedCount + offset) % selectionPool.length;
              return selectionPool[batchIndex] ?? selectionPool[0]!;
            });

      return {
        opportunityKey: opportunity.opportunityKey,
        selectedReferences,
      };
    },
  );

  if (input.selectorInput.fixtureMode === "mixed-public-opportunity") {
    const inactiveReference =
      referenceWindow.window.find((referenceName) =>
        PERSONA_LIBRARY.some(
          (persona) => persona.referenceSource === referenceName && !persona.active,
        ),
      ) ?? null;

    if (inactiveReference && candidateSelections.length > 0) {
      const targetIndex = Math.min(1, candidateSelections.length - 1);
      const existing = candidateSelections[targetIndex]?.selectedReferences ?? [];

      if (!existing.includes(inactiveReference)) {
        candidateSelections[targetIndex] = {
          ...candidateSelections[targetIndex]!,
          selectedReferences:
            existing.length > 0
              ? [...existing.slice(0, Math.max(0, existing.length - 1)), inactiveReference]
              : [inactiveReference],
        };
      }
    }
  }

  return {
    referenceWindow: {
      start: referenceWindow.start,
      endExclusive: referenceWindow.endExclusive,
      totalReferences: referenceWindow.totalReferences,
    },
    candidateSelections,
    promptPreview: assembledPrompt,
    actualModelPayload: {
      assembledPrompt,
      compactContext: {
        fixtureMode: input.selectorInput.fixtureMode,
        groupIndex: input.selectorInput.referenceWindow.groupIndex,
        batchSize: input.selectorInput.referenceWindow.batchSize,
        selectedOpportunities: input.opportunitySelection.selectedOpportunities.map(
          (opportunity) => {
            const sourceOpportunity =
              input.selectorInput.opportunities.find(
                (item) => item.opportunityKey === opportunity.opportunityKey,
              ) ?? null;
            return {
              opportunityKey: opportunity.opportunityKey,
              source: sourceOpportunity?.source ?? "unknown",
              contentType: sourceOpportunity?.contentType ?? "unknown",
            };
          },
        ),
        referenceBatch: referenceWindow.window,
      },
    },
  };
}

export function buildResolvedCandidatesPreview(
  candidateSelection: CandidateSelectionPreview,
): ResolvedCandidatePreview[] {
  return candidateSelection.candidateSelections.map((selection) => ({
    opportunityKey: selection.opportunityKey,
    personaIds: selection.selectedReferences.flatMap((referenceName) =>
      PERSONA_LIBRARY.filter((persona) => persona.referenceSource === referenceName).map(
        (persona) => ({
          referenceName,
          personaId: persona.personaId,
          status: persona.active ? ("active" as const) : ("inactive" as const),
        }),
      ),
    ),
  }));
}

export function buildResolvedPersonasPreview(
  input: SelectorOutputPreview | CandidateSelectionPreview | ResolvedCandidatePreview[],
): ResolvedPersonaPreview[] {
  if (Array.isArray(input)) {
    const personaIds = new Set(
      input.flatMap((candidate) => candidate.personaIds.map((item) => item.personaId)),
    );
    return PERSONA_LIBRARY.filter((persona) => personaIds.has(persona.personaId));
  }

  if ("candidateSelections" in input) {
    return resolvePersonasForReferences({
      selectedReferences: input.candidateSelections.flatMap((selection) =>
        selection.selectedReferences.map((referenceName) => ({
          referenceName,
        })),
      ),
    });
  }

  return resolvePersonasForReferences({
    selectedReferences: input.selectedReferences,
  });
}

export function buildSelectorOutputPreview(input: SelectorInputPreview): SelectorOutputPreview {
  const opportunitySelection = buildOpportunitySelectionPreview(input);
  const candidateSelection = buildCandidateSelectionPreview({
    selectorInput: input,
    opportunitySelection,
  });

  return {
    referenceWindow: candidateSelection.referenceWindow,
    selectedReferences: candidateSelection.candidateSelections.flatMap((selection) =>
      selection.selectedReferences.map((referenceName, index) => ({
        referenceName,
        rank: index + 1,
        reason:
          input.fixtureMode === "notification-intake"
            ? "Notification tone and direct-response fit."
            : "Public opportunity fit and reference diversity.",
      })),
    ),
    promptPreview: candidateSelection.promptPreview,
    actualModelPayload: {
      assembledPrompt: candidateSelection.actualModelPayload.assembledPrompt,
      compactContext: {
        fixtureMode: candidateSelection.actualModelPayload.compactContext.fixtureMode,
        groupIndex: candidateSelection.actualModelPayload.compactContext.groupIndex,
        batchSize: candidateSelection.actualModelPayload.compactContext.batchSize,
        opportunities: candidateSelection.actualModelPayload.compactContext.selectedOpportunities,
      },
    },
  };
}

export function buildTaskCandidatePreview(input: {
  selectorInput: SelectorInputPreview;
  resolvedPersonas?: ResolvedPersonaPreview[];
  resolvedCandidates?: ResolvedCandidatePreview[];
  opportunitySelection?: OpportunitySelectionPreview;
}): TaskCandidatePreview[] {
  if (input.selectorInput.fixtureMode === "notification-intake") {
    const selectedOpportunities =
      input.opportunitySelection?.selectedOpportunities ?? input.selectorInput.opportunities;

    return selectedOpportunities.flatMap((opportunity, candidateIndex) => {
      const lookup = findLookupByOpportunityKey(input.selectorInput, opportunity.opportunityKey);
      const recipientPersonaId =
        typeof lookup?.metadata?.recipientPersonaId === "string"
          ? lookup.metadata.recipientPersonaId
          : null;
      const persona = recipientPersonaId
        ? findPersonaById(recipientPersonaId)
        : (PERSONA_LIBRARY[0] ?? null);

      if (!lookup || !persona) {
        return [];
      }

      return [
        {
          candidateIndex,
          opportunityKey: opportunity.opportunityKey,
          personaId: persona.personaId,
          username: persona.username,
          dispatchKind: "notification",
          sourceTable: "notifications",
          sourceId: lookup.sourceId,
          dedupeKey: `${persona.username}:${lookup.sourceId}:${lookup.contentType}`,
          cooldownUntil: "2026-03-29T06:00:00.000Z",
          decisionReason: "Notification selected for direct recipient handling.",
          payload: {
            contentType: lookup.contentType,
            source: lookup.source,
            summary: lookup.summary,
            fixtureMode: input.selectorInput.fixtureMode,
            notificationTarget: {
              postId: typeof lookup.metadata?.postId === "string" ? lookup.metadata.postId : null,
              commentId:
                typeof lookup.metadata?.commentId === "string" ? lookup.metadata.commentId : null,
              parentCommentId:
                typeof lookup.metadata?.parentCommentId === "string"
                  ? lookup.metadata.parentCommentId
                  : null,
              context:
                typeof lookup.metadata?.context === "string" ? lookup.metadata.context : null,
              notificationType:
                typeof lookup.metadata?.notificationType === "string"
                  ? lookup.metadata.notificationType
                  : null,
            },
          },
        } satisfies TaskCandidatePreview,
      ];
    });
  }

  if (input.resolvedCandidates) {
    const activeAssignments = input.resolvedCandidates.flatMap((candidate) =>
      candidate.personaIds
        .filter((persona) => persona.status === "active")
        .map((persona) => ({
          opportunityKey: candidate.opportunityKey,
          referenceName: persona.referenceName,
          personaId: persona.personaId,
        })),
    );

    return activeAssignments.map((assignment, candidateIndex) => {
      const lookup = findLookupByOpportunityKey(input.selectorInput, assignment.opportunityKey);
      const persona = findPersonaById(assignment.personaId);

      if (!lookup || !persona) {
        throw new Error("resolved candidate could not be materialized into a task candidate");
      }

      return {
        candidateIndex,
        opportunityKey: assignment.opportunityKey,
        personaId: persona.personaId,
        username: persona.username,
        dispatchKind: "public",
        sourceTable: lookup.sourceTable === "notifications" ? "comments" : lookup.sourceTable,
        sourceId: lookup.sourceId,
        dedupeKey: `${persona.username}:${lookup.sourceId}:${lookup.contentType}`,
        cooldownUntil: "2026-03-29T06:00:00.000Z",
        decisionReason: `${assignment.referenceName} matched ${lookup.contentType} opportunity`,
        payload: {
          contentType: lookup.contentType,
          source: lookup.source,
          summary: lookup.summary,
          fixtureMode: input.selectorInput.fixtureMode,
          notificationTarget: null,
        },
      } satisfies TaskCandidatePreview;
    });
  }

  const resolvedPersonas = input.resolvedPersonas ?? [];

  return resolvedPersonas
    .filter((persona) => persona.active)
    .flatMap((persona, personaIndex) =>
      input.selectorInput.opportunities.map((opportunity, opportunityIndex) => {
        const lookup = findLookupByOpportunityKey(input.selectorInput, opportunity.opportunityKey);
        return {
          candidateIndex:
            personaIndex * input.selectorInput.opportunities.length + opportunityIndex,
          opportunityKey: opportunity.opportunityKey,
          personaId: persona.personaId,
          username: persona.username,
          dispatchKind:
            input.selectorInput.fixtureMode === "notification-intake" ? "notification" : "public",
          sourceTable: lookup?.sourceTable ?? "comments",
          sourceId: lookup?.sourceId ?? opportunity.opportunityKey,
          dedupeKey: `${persona.username}:${lookup?.sourceId ?? opportunity.opportunityKey}:${opportunity.contentType}`,
          cooldownUntil: "2026-03-29T06:00:00.000Z",
          decisionReason: `${persona.referenceSource} matched ${opportunity.contentType} opportunity`,
          payload: {
            contentType: opportunity.contentType,
            source: opportunity.source,
            summary: opportunity.summary,
            fixtureMode: input.selectorInput.fixtureMode,
            notificationTarget:
              input.selectorInput.fixtureMode === "notification-intake"
                ? {
                    postId:
                      typeof lookup?.metadata?.postId === "string" ? lookup.metadata.postId : null,
                    commentId:
                      typeof lookup?.metadata?.commentId === "string"
                        ? lookup.metadata.commentId
                        : null,
                    parentCommentId:
                      typeof lookup?.metadata?.parentCommentId === "string"
                        ? lookup.metadata.parentCommentId
                        : null,
                    context:
                      typeof lookup?.metadata?.context === "string"
                        ? lookup.metadata.context
                        : null,
                    notificationType:
                      typeof lookup?.metadata?.notificationType === "string"
                        ? lookup.metadata.notificationType
                        : null,
                  }
                : null,
          },
        } satisfies TaskCandidatePreview;
      }),
    );
}

export function buildTaskWritePreview(candidates: TaskCandidatePreview[]): TaskWritePreview[] {
  return candidates.map((candidate) => {
    const isNotification = candidate.dispatchKind === "notification";
    const cooldownActive =
      candidate.username === "ai_vesper" && candidate.dispatchKind === "public";
    const duplicate = candidate.username === "ai_marlowe" && isNotification;

    const inserted = !cooldownActive && !duplicate;
    const skipReason = cooldownActive
      ? "cooldown_active"
      : duplicate
        ? "duplicate_candidate"
        : null;

    return {
      candidateIndex: candidate.candidateIndex,
      inserted,
      skipReason,
      taskId: inserted ? `task-preview-${candidate.candidateIndex + 1}` : null,
      dedupeExpectation: duplicate ? "skip_duplicate" : "insert",
      cooldownExpectation: cooldownActive ? "cooldown_active" : "eligible",
      expectationSummary: inserted
        ? "Candidate is expected to insert cleanly."
        : duplicate
          ? "Candidate is expected to skip on notification dedupe."
          : "Candidate is expected to skip on public cooldown.",
    };
  });
}

export function buildTaskInjectionPreview(input: {
  candidates: TaskCandidatePreview[];
  taskWritePreview: TaskWritePreview[];
}): TaskInjectionPreview {
  const results = input.candidates.map((candidate) => {
    const writePreview =
      input.taskWritePreview.find((item) => item.candidateIndex === candidate.candidateIndex) ??
      null;
    return {
      candidateIndex: candidate.candidateIndex,
      inserted: writePreview?.inserted ?? false,
      skipReason: writePreview ? writePreview.skipReason : "preview_missing",
      taskId: writePreview?.taskId ?? null,
      taskType: candidate.payload.contentType,
      dispatchKind: candidate.dispatchKind,
      personaUsername: candidate.username,
      sourceTable: candidate.sourceTable,
      sourceId: candidate.sourceId,
    };
  });

  const skippedReasonCounts = results.reduce<Record<string, number>>((acc, result) => {
    if (result.skipReason) {
      acc[result.skipReason] = (acc[result.skipReason] ?? 0) + 1;
    }
    return acc;
  }, {});

  return {
    rpcName: "inject_persona_tasks",
    summary: {
      candidateCount: results.length,
      insertedCount: results.filter((result) => result.inserted).length,
      skippedCount: results.filter((result) => !result.inserted).length,
      insertedTaskIds: results
        .map((result) => result.taskId)
        .filter((taskId): taskId is string => Boolean(taskId)),
      skippedReasonCounts,
    },
    results,
  };
}
