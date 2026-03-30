import type { AiAgentRecentTaskSnapshot } from "@/lib/ai/agent/read-models/overview-read-model";
import type {
  AiAgentMemoryPersistedWriteResponse,
  AiAgentMemoryPersistedCompressResponse,
} from "@/lib/ai/agent/memory/memory-admin-service";
import type { AiAgentMemoryPersonaPreview } from "@/lib/ai/agent/memory/memory-preview";

export type AiAgentMemoryLineageSummary = {
  selectedTaskId: string | null;
  selectedTaskType: string | null;
  selectedTaskPersonaId: string | null;
  latestWriteSelectedTaskId: string | null;
  latestWritePath: string | null;
  latestWriteMatchesSelectedTask: boolean;
  latestWritePersistedMemoryId: string | null;
  latestWritePersistMatchesSelectedTask: boolean;
  compressionPersistedLongMemoryId: string | null;
};

export type AiAgentMemoryOutcomeTrace = {
  selectedTaskId: string | null;
  selectedTaskPersonaId: string | null;
  latestWriteCandidateTaskId: string | null;
  latestWriteCandidatePath: string | null;
  latestWritePersistedMemoryId: string | null;
  latestWritePersistedTaskId: string | null;
  compressionPersistedLongMemoryId: string | null;
  compressionPersonaId: string | null;
  stageStatus: {
    taskSelected: boolean;
    latestWriteCandidateReady: boolean;
    latestWritePersisted: boolean;
    compressionPersisted: boolean;
  };
  allStagesSharePersona: boolean;
  latestWriteCandidateMatchesSelectedTask: boolean;
  latestWritePersistMatchesSelectedTask: boolean;
};

export function buildMemoryLineageSummary(input: {
  selectedTask: AiAgentRecentTaskSnapshot | null;
  activeMemoryPreview: AiAgentMemoryPersonaPreview | null;
  latestWriteResult: AiAgentMemoryPersistedWriteResponse | null;
  compressionResult: AiAgentMemoryPersistedCompressResponse | null;
}): AiAgentMemoryLineageSummary | null {
  const { selectedTask, activeMemoryPreview, latestWriteResult, compressionResult } = input;
  if (!selectedTask && !activeMemoryPreview && !latestWriteResult && !compressionResult) {
    return null;
  }

  const latestWriteSelectedTaskId =
    latestWriteResult?.verificationTrace.selectedTaskId ??
    activeMemoryPreview?.latestWritePreview.selectedTask?.taskId ??
    null;
  const selectedTaskId = selectedTask?.id ?? null;

  return {
    selectedTaskId,
    selectedTaskType: selectedTask?.taskType ?? null,
    selectedTaskPersonaId: selectedTask?.personaId ?? null,
    latestWriteSelectedTaskId,
    latestWritePath:
      activeMemoryPreview?.latestWritePreview.path ??
      latestWriteResult?.latestWritePreview.path ??
      null,
    latestWriteMatchesSelectedTask:
      selectedTaskId !== null &&
      latestWriteSelectedTaskId !== null &&
      selectedTaskId === latestWriteSelectedTaskId,
    latestWritePersistedMemoryId: latestWriteResult?.persistedMemoryId ?? null,
    latestWritePersistMatchesSelectedTask:
      selectedTaskId !== null &&
      latestWriteResult?.verificationTrace.selectedTaskId !== null &&
      selectedTaskId === latestWriteResult?.verificationTrace.selectedTaskId,
    compressionPersistedLongMemoryId: compressionResult?.persistedLongMemoryId ?? null,
  };
}

export function buildMemoryOutcomeTrace(input: {
  selectedTask: AiAgentRecentTaskSnapshot | null;
  activeMemoryPreview: AiAgentMemoryPersonaPreview | null;
  latestWriteResult: AiAgentMemoryPersistedWriteResponse | null;
  compressionResult: AiAgentMemoryPersistedCompressResponse | null;
}): AiAgentMemoryOutcomeTrace | null {
  const lineage = buildMemoryLineageSummary(input);
  if (!lineage) {
    return null;
  }

  const selectedTaskPersonaId = input.selectedTask?.personaId ?? null;
  const latestWritePersonaId =
    input.latestWriteResult?.personaId ?? input.activeMemoryPreview?.persona.personaId ?? null;
  const compressionPersonaId = input.compressionResult?.personaId ?? null;
  const personaIds = [selectedTaskPersonaId, latestWritePersonaId, compressionPersonaId].filter(
    (value): value is string => value !== null,
  );
  const allStagesSharePersona =
    personaIds.length <= 1 || personaIds.every((personaId) => personaId === personaIds[0]);

  return {
    selectedTaskId: lineage.selectedTaskId,
    selectedTaskPersonaId,
    latestWriteCandidateTaskId: lineage.latestWriteSelectedTaskId,
    latestWriteCandidatePath: lineage.latestWritePath,
    latestWritePersistedMemoryId: lineage.latestWritePersistedMemoryId,
    latestWritePersistedTaskId: input.latestWriteResult?.verificationTrace.selectedTaskId ?? null,
    compressionPersistedLongMemoryId: lineage.compressionPersistedLongMemoryId,
    compressionPersonaId,
    stageStatus: {
      taskSelected: lineage.selectedTaskId !== null,
      latestWriteCandidateReady:
        lineage.latestWriteSelectedTaskId !== null && lineage.latestWritePath !== "skipped",
      latestWritePersisted: lineage.latestWritePersistedMemoryId !== null,
      compressionPersisted: lineage.compressionPersistedLongMemoryId !== null,
    },
    allStagesSharePersona,
    latestWriteCandidateMatchesSelectedTask: lineage.latestWriteMatchesSelectedTask,
    latestWritePersistMatchesSelectedTask: lineage.latestWritePersistMatchesSelectedTask,
  };
}
