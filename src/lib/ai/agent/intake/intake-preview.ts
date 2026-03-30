import { buildPromptBlocks, formatPrompt } from "@/lib/ai/admin/control-plane-shared";

export type IntakeFixtureMode = "mixed-public-opportunity" | "notification-intake";

export type IntakeOpportunityFixture = {
  source: string;
  contentType: string;
  summary: string;
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
    metadata?: Record<string, unknown>;
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
        metadata?: Record<string, unknown>;
      }>;
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

export type TaskCandidatePreview = {
  candidateIndex: number;
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
  "Björk",
  "Nina Simone",
  "Leiji Matsumoto",
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
];

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
  items: IntakeOpportunityFixture[];
}): SelectorInputPreview {
  return {
    fixtureMode: input.fixtureMode,
    groupIndexOverride: input.groupIndexOverride,
    selectorReferenceBatchSize: input.selectorReferenceBatchSize,
    referenceWindow: {
      batchSize: input.selectorReferenceBatchSize,
      groupIndex: input.groupIndexOverride,
    },
    opportunities: input.items.map((item, index) => ({
      opportunityKey: `${input.fixtureMode}-${index + 1}`,
      source: item.source,
      contentType: item.contentType,
      summary: item.summary,
      metadata: item.metadata,
    })),
  };
}

export function buildSelectorOutputPreview(input: SelectorInputPreview): SelectorOutputPreview {
  const blocks = buildPromptBlocks({
    actionType: "comment",
    globalDraft: {
      systemBaseline: "Operator-visible selector prompt for ai-agent intake preview.",
      globalPolicy:
        "Choose the smallest high-signal set of references that best match the current opportunity set.",
      styleGuide: "Prefer concrete reasoning over generic genre labels.",
      forbiddenRules: "Do not invent references outside the provided working set.",
    },
    agentProfile: `fixture_mode: ${input.fixtureMode}`,
    outputStyle: "Return a ranked shortlist of references with concise reasons.",
    agentCore: [
      `selector_reference_batch_size: ${input.selectorReferenceBatchSize}`,
      `group_index_override: ${input.groupIndexOverride}`,
    ].join("\n"),
    agentMemory: input.opportunities
      .map(
        (opportunity) =>
          `${opportunity.opportunityKey}: ${opportunity.source} / ${opportunity.contentType} / ${opportunity.summary}`,
      )
      .join("\n"),
    taskContext: [
      "Select references for the current intake opportunities.",
      `opportunity_count: ${input.opportunities.length}`,
    ].join("\n"),
  });
  const referenceWindow = buildReferenceWindow({
    batchSize: Math.max(2, Math.min(input.referenceWindow.batchSize, 4)),
    groupIndex: input.referenceWindow.groupIndex,
  });
  const selectedReferences = referenceWindow.window.map((referenceName, index) => ({
    referenceName,
    rank: index + 1,
    reason:
      input.fixtureMode === "notification-intake"
        ? "Notification tone and direct-response fit."
        : "Public opportunity fit and reference diversity.",
  }));

  return {
    referenceWindow: {
      start: referenceWindow.start,
      endExclusive: referenceWindow.endExclusive,
      totalReferences: referenceWindow.totalReferences,
    },
    selectedReferences,
    promptPreview: formatPrompt(blocks),
    actualModelPayload: {
      assembledPrompt: formatPrompt(blocks),
      compactContext: {
        fixtureMode: input.fixtureMode,
        groupIndex: input.referenceWindow.groupIndex,
        batchSize: input.referenceWindow.batchSize,
        opportunities: input.opportunities.map((opportunity) => ({
          opportunityKey: opportunity.opportunityKey,
          source: opportunity.source,
          contentType: opportunity.contentType,
          metadata: opportunity.metadata,
        })),
      },
    },
  };
}

export function buildResolvedPersonasPreview(
  selectorOutput: SelectorOutputPreview,
): ResolvedPersonaPreview[] {
  return resolvePersonasForReferences({
    selectedReferences: selectorOutput.selectedReferences,
  });
}

export function buildTaskCandidatePreview(input: {
  selectorInput: SelectorInputPreview;
  resolvedPersonas: ResolvedPersonaPreview[];
}): TaskCandidatePreview[] {
  return input.resolvedPersonas
    .filter((persona) => persona.active)
    .flatMap((persona, personaIndex) =>
      input.selectorInput.opportunities.map((opportunity, opportunityIndex) => {
        const sourceTable =
          opportunity.source === "notification"
            ? "notifications"
            : opportunity.contentType === "post"
              ? "posts"
              : "comments";
        const dispatchKind = opportunity.source === "notification" ? "notification" : "public";
        return {
          candidateIndex:
            personaIndex * input.selectorInput.opportunities.length + opportunityIndex,
          personaId: persona.personaId,
          username: persona.username,
          dispatchKind,
          sourceTable,
          sourceId: opportunity.opportunityKey,
          dedupeKey: `${persona.username}:${opportunity.opportunityKey}:${opportunity.contentType}`,
          cooldownUntil: "2026-03-29T06:00:00.000Z",
          decisionReason: `${persona.referenceSource} matched ${opportunity.contentType} opportunity`,
          payload: {
            contentType: opportunity.contentType,
            source: opportunity.source,
            summary: opportunity.summary,
            fixtureMode: input.selectorInput.fixtureMode,
            notificationTarget:
              dispatchKind === "notification"
                ? {
                    postId:
                      typeof opportunity.metadata?.postId === "string"
                        ? opportunity.metadata.postId
                        : null,
                    commentId:
                      typeof opportunity.metadata?.commentId === "string"
                        ? opportunity.metadata.commentId
                        : null,
                    parentCommentId:
                      typeof opportunity.metadata?.parentCommentId === "string"
                        ? opportunity.metadata.parentCommentId
                        : null,
                    context:
                      typeof opportunity.metadata?.context === "string"
                        ? opportunity.metadata.context
                        : null,
                    notificationType:
                      typeof opportunity.metadata?.notificationType === "string"
                        ? opportunity.metadata.notificationType
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
