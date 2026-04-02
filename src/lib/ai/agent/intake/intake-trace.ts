import type {
  AiAgentRuntimeIntakeKind,
  AiAgentRuntimeSourceSnapshot,
} from "@/lib/ai/agent/intake/intake-read-model";
import {
  buildCandidateSelectionPreview,
  buildOpportunitySelectionPreview,
  buildResolvedCandidatesPreview,
  buildResolvedPersonasPreview,
  buildTaskCandidatePreview,
  type CandidateSelectionPreview,
  type OpportunitySelectionPreview,
  type ResolvedCandidatePreview,
  type ResolvedPersonaPreview,
  type SelectorInputPreview,
  type TaskCandidatePreview,
} from "@/lib/ai/agent/intake/intake-preview";

export type AiAgentIntakeTrace = {
  kind: AiAgentRuntimeIntakeKind;
  snapshot: AiAgentRuntimeSourceSnapshot;
  opportunities: {
    input: {
      sourceItems: AiAgentRuntimeSourceSnapshot["items"];
      selectorInput: SelectorInputPreview | null;
    };
    result: {
      selectedOpportunities: OpportunitySelectionPreview | null;
    };
  };
  candidates: {
    input: {
      selectorInput: SelectorInputPreview | null;
      selectedOpportunities: OpportunitySelectionPreview | null;
    };
    result: {
      candidateSelection: CandidateSelectionPreview | null;
    };
  };
  resolvedPersonas: {
    input: {
      candidateSelection: CandidateSelectionPreview | null;
    };
    result: {
      resolvedCandidates: ResolvedCandidatePreview[];
      resolvedPersonas: ResolvedPersonaPreview[];
    };
  };
  tasks: {
    input: {
      taskCandidates: TaskCandidatePreview[];
    };
    result: {
      taskCandidates: TaskCandidatePreview[];
    };
  };
};

export type AiAgentIntakeTraceOverrides = {
  selectorReferenceBatchSize?: number;
  groupIndexOverride?: number;
};

function invariant(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

export function assertValidAiAgentIntakeTrace(trace: AiAgentIntakeTrace): AiAgentIntakeTrace {
  const selectorInput = trace.opportunities.input.selectorInput;
  const selectedOpportunities = trace.opportunities.result.selectedOpportunities;
  const candidateSelection = trace.candidates.result.candidateSelection;
  const resolvedCandidates = trace.resolvedPersonas.result.resolvedCandidates;
  const resolvedPersonas = trace.resolvedPersonas.result.resolvedPersonas;
  const taskCandidates = trace.tasks.result.taskCandidates;
  const inputTaskCandidates = trace.tasks.input.taskCandidates;

  invariant(trace.kind === trace.snapshot.kind, "trace kind must match snapshot kind");

  if (!selectorInput) {
    invariant(
      selectedOpportunities === null,
      "selectedOpportunities must be null when selectorInput is null",
    );
    invariant(
      candidateSelection === null,
      "candidateSelection must be null when selectorInput is null",
    );
    invariant(
      resolvedCandidates.length === 0,
      "resolved candidates must be empty when selectorInput is null",
    );
    invariant(
      resolvedPersonas.length === 0,
      "resolved personas must be empty when selectorInput is null",
    );
    invariant(
      taskCandidates.length === 0,
      "task candidates must be empty when selectorInput is null",
    );
    return trace;
  }

  invariant(
    selectedOpportunities !== null,
    "selectedOpportunities is required when selectorInput is present",
  );

  const opportunityKeys = new Set(selectorInput.opportunities.map((item) => item.opportunityKey));
  const probabilityKeys = new Set(
    selectedOpportunities.opportunityProbabilities.map((item) => item.opportunityKey),
  );

  invariant(
    selectedOpportunities.opportunityProbabilities.length === selectorInput.opportunities.length,
    "opportunity probabilities must contain one row per selectorInput opportunity",
  );

  for (const opportunityKey of opportunityKeys) {
    invariant(
      probabilityKeys.has(opportunityKey),
      "opportunity probability key is not present in selectorInput opportunities",
    );
  }

  for (const selected of selectedOpportunities.selectedOpportunities) {
    invariant(
      opportunityKeys.has(selected.opportunityKey),
      "selected opportunity key is not present in selectorInput opportunities",
    );
  }

  if (trace.kind === "public") {
    invariant(candidateSelection !== null, "candidateSelection is required for public traces");
  }

  if (candidateSelection) {
    const selectedOpportunityKeys = new Set(
      selectedOpportunities.selectedOpportunities.map((item) => item.opportunityKey),
    );
    for (const selection of candidateSelection.candidateSelections) {
      invariant(
        selectedOpportunityKeys.has(selection.opportunityKey),
        "candidate selection opportunity key is not present in selected opportunities",
      );
    }
  }

  const resolvedPersonaIds = new Set(resolvedPersonas.map((item) => item.personaId));

  for (const candidate of resolvedCandidates) {
    invariant(
      opportunityKeys.has(candidate.opportunityKey),
      "resolved candidate opportunity key is not present in selectorInput opportunities",
    );
    for (const persona of candidate.personaIds) {
      invariant(
        resolvedPersonaIds.has(persona.personaId),
        "resolved candidate personaId is not present in resolved personas",
      );
    }
  }

  const candidateIndexes = new Set<number>();

  invariant(
    inputTaskCandidates.length === taskCandidates.length,
    "tasks input and result candidate lengths must match",
  );

  for (const candidate of taskCandidates) {
    invariant(
      opportunityKeys.has(candidate.opportunityKey),
      "task candidate opportunityKey is not present in selectorInput opportunities",
    );
    invariant(
      resolvedPersonaIds.has(candidate.personaId),
      "task candidate personaId is not present in resolved personas",
    );
    invariant(
      !candidateIndexes.has(candidate.candidateIndex),
      "task candidate candidateIndex must be unique",
    );
    candidateIndexes.add(candidate.candidateIndex);
  }

  for (const candidate of inputTaskCandidates) {
    invariant(
      candidateIndexes.has(candidate.candidateIndex),
      "tasks input candidateIndex is not present in tasks result",
    );
  }

  return trace;
}

export function buildAiAgentIntakeTrace(
  snapshot: AiAgentRuntimeSourceSnapshot,
  overrides?: AiAgentIntakeTraceOverrides,
): AiAgentIntakeTrace {
  const selectorInput = snapshot.selectorInput
    ? {
        ...snapshot.selectorInput,
        groupIndexOverride:
          overrides?.groupIndexOverride ?? snapshot.selectorInput.groupIndexOverride,
        selectorReferenceBatchSize:
          overrides?.selectorReferenceBatchSize ??
          snapshot.selectorInput.selectorReferenceBatchSize,
        referenceWindow: {
          batchSize:
            overrides?.selectorReferenceBatchSize ??
            snapshot.selectorInput.referenceWindow.batchSize,
          groupIndex:
            overrides?.groupIndexOverride ?? snapshot.selectorInput.referenceWindow.groupIndex,
        },
      }
    : null;
  const selectedOpportunities = selectorInput
    ? buildOpportunitySelectionPreview(selectorInput)
    : null;
  const candidateSelection =
    selectorInput && snapshot.kind === "public" && selectedOpportunities
      ? buildCandidateSelectionPreview({
          selectorInput,
          opportunitySelection: selectedOpportunities,
        })
      : null;
  const resolvedCandidates = candidateSelection
    ? buildResolvedCandidatesPreview(candidateSelection)
    : [];
  const resolvedPersonas =
    snapshot.kind === "public"
      ? buildResolvedPersonasPreview(resolvedCandidates)
      : selectorInput
        ? buildTaskCandidatePreview({
            selectorInput,
            opportunitySelection: selectedOpportunities ?? undefined,
          }).flatMap((candidate) => {
            const persona = buildResolvedPersonasPreview([
              {
                opportunityKey: candidate.sourceId,
                personaIds: [
                  {
                    referenceName: candidate.username,
                    personaId: candidate.personaId,
                    status: "active",
                  },
                ],
              },
            ]);
            return persona;
          })
        : [];

  const taskCandidates =
    selectorInput && selectedOpportunities
      ? snapshot.kind === "notification"
        ? buildTaskCandidatePreview({
            selectorInput,
            opportunitySelection: selectedOpportunities,
          })
        : buildTaskCandidatePreview({
            selectorInput,
            resolvedCandidates,
          })
      : [];

  return assertValidAiAgentIntakeTrace({
    kind: snapshot.kind,
    snapshot,
    opportunities: {
      input: {
        sourceItems: snapshot.items,
        selectorInput,
      },
      result: {
        selectedOpportunities,
      },
    },
    candidates: {
      input: {
        selectorInput,
        selectedOpportunities,
      },
      result: {
        candidateSelection,
      },
    },
    resolvedPersonas: {
      input: {
        candidateSelection,
      },
      result: {
        resolvedCandidates,
        resolvedPersonas,
      },
    },
    tasks: {
      input: {
        taskCandidates,
      },
      result: {
        taskCandidates,
      },
    },
  });
}
