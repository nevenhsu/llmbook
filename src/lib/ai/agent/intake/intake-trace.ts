import type {
  AiAgentRuntimeIntakeKind,
  AiAgentRuntimeSourceSnapshot,
} from "@/lib/ai/agent/intake/intake-read-model";
import {
  buildResolvedPersonasPreview,
  buildSelectorOutputPreview,
  buildTaskCandidatePreview,
  type ResolvedPersonaPreview,
  type SelectorInputPreview,
  type SelectorOutputPreview,
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
      selectorOutput: SelectorOutputPreview | null;
    };
  };
  candidates: {
    input: {
      selectorInput: SelectorInputPreview | null;
      selectorOutput: SelectorOutputPreview | null;
    };
    result: {
      resolvedPersonas: ResolvedPersonaPreview[];
      taskCandidates: TaskCandidatePreview[];
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

function invariant(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

export function assertValidAiAgentIntakeTrace(trace: AiAgentIntakeTrace): AiAgentIntakeTrace {
  const selectorInput = trace.opportunities.input.selectorInput;
  const selectorOutput = trace.opportunities.result.selectorOutput;
  const taskCandidates = trace.tasks.result.taskCandidates;
  const inputTaskCandidates = trace.tasks.input.taskCandidates;
  const resolvedPersonas = trace.candidates.result.resolvedPersonas;

  invariant(trace.kind === trace.snapshot.kind, "trace kind must match snapshot kind");

  if (!selectorInput) {
    invariant(selectorOutput === null, "selectorOutput must be null when selectorInput is null");
    invariant(
      trace.candidates.result.resolvedPersonas.length === 0,
      "resolved personas must be empty when selectorInput is null",
    );
    invariant(
      taskCandidates.length === 0,
      "task candidates must be empty when selectorInput is null",
    );
    return trace;
  }

  invariant(selectorOutput !== null, "selectorOutput is required when selectorInput is present");

  const opportunityKeys = new Set(selectorInput.opportunities.map((item) => item.opportunityKey));
  const personaIds = new Set(resolvedPersonas.map((item) => item.personaId));
  const candidateIndexes = new Set<number>();

  invariant(
    inputTaskCandidates.length === taskCandidates.length,
    "tasks input and result candidate lengths must match",
  );

  for (const candidate of taskCandidates) {
    invariant(
      opportunityKeys.has(candidate.sourceId),
      "task candidate sourceId is not present in selectorInput opportunities",
    );
    invariant(
      personaIds.has(candidate.personaId),
      "task candidate personaId is not present in resolvedPersonas",
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
): AiAgentIntakeTrace {
  const selectorInput = snapshot.selectorInput;
  const selectorOutput = selectorInput ? buildSelectorOutputPreview(selectorInput) : null;
  const resolvedPersonas = selectorOutput ? buildResolvedPersonasPreview(selectorOutput) : [];
  const taskCandidates =
    selectorInput && selectorOutput
      ? buildTaskCandidatePreview({
          selectorInput,
          resolvedPersonas,
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
        selectorOutput,
      },
    },
    candidates: {
      input: {
        selectorInput,
        selectorOutput,
      },
      result: {
        resolvedPersonas,
        taskCandidates,
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
