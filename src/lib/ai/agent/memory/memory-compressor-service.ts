import { loadAiAgentConfig, type AiAgentConfig } from "@/lib/ai/agent/config/agent-config";
import {
  AiAgentMemoryAdminService,
  type AiAgentMemoryPersistedCompressResponse,
} from "@/lib/ai/agent/memory/memory-admin-service";
import type { AiAgentMemoryPersonaPreview } from "@/lib/ai/agent/memory/memory-preview";
import { AiAgentMemoryPreviewStore } from "@/lib/ai/agent/memory/memory-read-model";
import {
  AiAgentRuntimeStateService,
  type AiAgentRuntimeStateSnapshot,
} from "@/lib/ai/agent/runtime-state-service";
import { createAdminClient } from "@/lib/supabase/admin";

const MEMORY_COUNT_THRESHOLD = 3;
const OLDEST_MEMORY_THRESHOLD_DAYS = 7;

export type AiAgentMemoryCompressionQueueReason =
  | "token_threshold"
  | "memory_count_threshold"
  | "oldest_memory_threshold";

export type AiAgentMemoryCompressionDecisionReasonCode =
  | AiAgentMemoryCompressionQueueReason
  | "no_compressible_rows"
  | "below_threshold"
  | "deferred_interval_active";

export type AiAgentMemoryCompressionDecision = "compressed" | "deferred" | "skipped";

export type AiAgentPersonaCompressionState = {
  lastEvaluatedAt: string | null;
  lastDecision: AiAgentMemoryCompressionDecision | null;
  deferUntil: string | null;
  reasonCode: AiAgentMemoryCompressionDecisionReasonCode | null;
  priorityScore: number | null;
  queueReason: AiAgentMemoryCompressionQueueReason | null;
  selectedShortMemoryIds: string[];
  inputFingerprint: string | null;
};

export type AiAgentMemoryCompressionQueueItem = {
  personaId: string;
  personaUsername: string;
  personaDisplayName: string;
  queueReason: AiAgentMemoryCompressionQueueReason;
  priorityScore: number;
  selectedShortMemoryIds: string[];
  oldestCompressibleMemoryAt: string | null;
  eligibleShortMemoryCount: number;
  openLoopCount: number;
  tokenOverflow: number;
  inputFingerprint: string;
  preview: AiAgentMemoryPersonaPreview;
};

export type AiAgentMemoryCompressionSkippedEvaluation = {
  personaId: string;
  personaUsername: string;
  personaDisplayName: string;
  reasonCode: AiAgentMemoryCompressionDecisionReasonCode;
  summary: string;
  priorityScore: number | null;
  queueReason: AiAgentMemoryCompressionQueueReason | null;
  inputFingerprint: string;
};

export type AiAgentMemoryCompressorBlockedResult = {
  mode: "blocked";
  reasonCode: "runtime_not_idle" | "text_lane_busy";
  summary: string;
  runtimeState: AiAgentRuntimeStateSnapshot;
  activeTextTasks: number;
};

export type AiAgentMemoryCompressorIdleResult = {
  mode: "idle";
  summary: string;
  runtimeState: AiAgentRuntimeStateSnapshot;
  activeTextTasks: number;
  deferredPersonas: AiAgentMemoryCompressionSkippedEvaluation[];
  queueLength: number;
};

export type AiAgentMemoryCompressorExecutedResult = {
  mode: "executed";
  summary: string;
  runtimeState: AiAgentRuntimeStateSnapshot;
  activeTextTasks: number;
  selected: AiAgentMemoryCompressionQueueItem;
  deferredPersonas: AiAgentMemoryCompressionSkippedEvaluation[];
  compressionResult: AiAgentMemoryPersistedCompressResponse;
};

export type AiAgentMemoryCompressorRunResult =
  | AiAgentMemoryCompressorBlockedResult
  | AiAgentMemoryCompressorIdleResult
  | AiAgentMemoryCompressorExecutedResult;

type PersonaCompressionStateRow = {
  id: string;
  compression_state: Record<string, unknown> | null;
};

type MemoryCompressorServiceDeps = {
  loadConfig: () => Promise<AiAgentConfig>;
  loadRuntimeState: () => Promise<AiAgentRuntimeStateSnapshot>;
  countActiveTextTasks: () => Promise<number>;
  getRuntimePreviewSet: () => Promise<{
    previews: AiAgentMemoryPersonaPreview[];
  }>;
  loadCompressionStates: (
    personaIds: string[],
  ) => Promise<Map<string, AiAgentPersonaCompressionState>>;
  persistCompressionState: (
    personaId: string,
    state: AiAgentPersonaCompressionState,
  ) => Promise<void>;
  compressPersona: (personaId: string) => Promise<AiAgentMemoryPersistedCompressResponse>;
  sleep: (ms: number) => Promise<void>;
  now: () => Date;
};

function readString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function readNumber(record: Record<string, unknown>, key: string): number | null {
  const value = record[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readStringArray(record: Record<string, unknown>, key: string): string[] {
  const value = record[key];
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

export function parsePersonaCompressionState(
  record: Record<string, unknown> | null | undefined,
): AiAgentPersonaCompressionState {
  const source = record ?? {};
  const lastDecision = readString(source, "lastDecision");
  const reasonCode = readString(source, "reasonCode");
  const queueReason = readString(source, "queueReason");

  return {
    lastEvaluatedAt: readString(source, "lastEvaluatedAt"),
    lastDecision:
      lastDecision === "compressed" || lastDecision === "deferred" || lastDecision === "skipped"
        ? lastDecision
        : null,
    deferUntil: readString(source, "deferUntil"),
    reasonCode:
      reasonCode === "token_threshold" ||
      reasonCode === "memory_count_threshold" ||
      reasonCode === "oldest_memory_threshold" ||
      reasonCode === "no_compressible_rows" ||
      reasonCode === "below_threshold" ||
      reasonCode === "deferred_interval_active"
        ? reasonCode
        : null,
    priorityScore: readNumber(source, "priorityScore"),
    queueReason:
      queueReason === "token_threshold" ||
      queueReason === "memory_count_threshold" ||
      queueReason === "oldest_memory_threshold"
        ? queueReason
        : null,
    selectedShortMemoryIds: readStringArray(source, "selectedShortMemoryIds"),
    inputFingerprint: readString(source, "inputFingerprint"),
  };
}

function estimateTokenCount(input: AiAgentMemoryPersonaPreview): number {
  const totalChars = [
    input.canonicalLongMemory?.content ?? "",
    ...input.recentShortMemories.map((entry) => entry.content),
  ].join("\n").length;
  return Math.ceil(totalChars / 4);
}

function buildInputFingerprint(input: AiAgentMemoryPersonaPreview): string {
  const latestShortUpdate = input.recentShortMemories[0]?.updatedAt ?? "none";
  const longMemoryUpdate = input.canonicalLongMemory?.updatedAt ?? "none";
  return [
    input.persona.personaId,
    input.persona.shortMemoryCount,
    input.persona.compressibleCount,
    input.persona.openLoopCount,
    latestShortUpdate,
    longMemoryUpdate,
  ].join(":");
}

function buildDeferredUntil(now: Date, intervalHours: number): string {
  return new Date(now.getTime() + intervalHours * 60 * 60 * 1000).toISOString();
}

function buildCompressionState(input: {
  now: Date;
  intervalHours: number;
  decision: AiAgentMemoryCompressionDecision;
  reasonCode: AiAgentMemoryCompressionDecisionReasonCode;
  queueReason: AiAgentMemoryCompressionQueueReason | null;
  priorityScore: number | null;
  selectedShortMemoryIds: string[];
  inputFingerprint: string;
}): AiAgentPersonaCompressionState {
  return {
    lastEvaluatedAt: input.now.toISOString(),
    lastDecision: input.decision,
    deferUntil: buildDeferredUntil(input.now, input.intervalHours),
    reasonCode: input.reasonCode,
    priorityScore: input.priorityScore,
    queueReason: input.queueReason,
    selectedShortMemoryIds: [...input.selectedShortMemoryIds],
    inputFingerprint: input.inputFingerprint,
  };
}

function compareQueueItems(
  left: AiAgentMemoryCompressionQueueItem,
  right: AiAgentMemoryCompressionQueueItem,
): number {
  const leftHasOpenLoops = left.openLoopCount > 0 ? 1 : 0;
  const rightHasOpenLoops = right.openLoopCount > 0 ? 1 : 0;
  if (leftHasOpenLoops !== rightHasOpenLoops) {
    return rightHasOpenLoops - leftHasOpenLoops;
  }

  if (left.priorityScore !== right.priorityScore) {
    return right.priorityScore - left.priorityScore;
  }

  const leftOldest = left.oldestCompressibleMemoryAt
    ? Date.parse(left.oldestCompressibleMemoryAt)
    : 0;
  const rightOldest = right.oldestCompressibleMemoryAt
    ? Date.parse(right.oldestCompressibleMemoryAt)
    : 0;
  if (leftOldest !== rightOldest) {
    return leftOldest - rightOldest;
  }

  if (left.eligibleShortMemoryCount !== right.eligibleShortMemoryCount) {
    return right.eligibleShortMemoryCount - left.eligibleShortMemoryCount;
  }

  return left.personaId.localeCompare(right.personaId);
}

export function buildMemoryCompressionSelection(input: {
  previews: AiAgentMemoryPersonaPreview[];
  compressionStates: Map<string, AiAgentPersonaCompressionState>;
  config: Pick<AiAgentConfig, "memoryCompressIntervalHours" | "memoryCompressTokenThreshold">;
  now: Date;
}): {
  queue: AiAgentMemoryCompressionQueueItem[];
  deferred: AiAgentMemoryCompressionSkippedEvaluation[];
  activeDeferrals: string[];
} {
  const queue: AiAgentMemoryCompressionQueueItem[] = [];
  const deferred: AiAgentMemoryCompressionSkippedEvaluation[] = [];
  const activeDeferrals: string[] = [];

  for (const preview of input.previews) {
    const personaId = preview.persona.personaId;
    const inputFingerprint = buildInputFingerprint(preview);
    const currentState = input.compressionStates.get(personaId) ?? null;
    const deferUntil = currentState?.deferUntil ? Date.parse(currentState.deferUntil) : Number.NaN;

    if (
      currentState?.deferUntil &&
      Number.isFinite(deferUntil) &&
      deferUntil > input.now.getTime() &&
      currentState.inputFingerprint === inputFingerprint
    ) {
      activeDeferrals.push(personaId);
      continue;
    }

    const compressibleEntries = preview.recentShortMemories.filter((entry) => !entry.hasOpenLoop);
    if (compressibleEntries.length === 0) {
      deferred.push({
        personaId,
        personaUsername: preview.persona.username,
        personaDisplayName: preview.persona.displayName,
        reasonCode: "no_compressible_rows",
        summary: `No compressible short-memory rows are available for ${preview.persona.username}.`,
        priorityScore: null,
        queueReason: null,
        inputFingerprint,
      });
      continue;
    }

    const estimatedTokenCount = estimateTokenCount(preview);
    const tokenOverflow = Math.max(
      0,
      estimatedTokenCount - input.config.memoryCompressTokenThreshold,
    );
    const oldestCompressibleMemoryAt =
      [...compressibleEntries].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))[0]
        ?.createdAt ?? null;
    const oldestAgeDays = oldestCompressibleMemoryAt
      ? Math.max(
          0,
          Math.floor((input.now.getTime() - Date.parse(oldestCompressibleMemoryAt)) / 86_400_000),
        )
      : 0;
    const promotionSignalScore = compressibleEntries.some((entry) => entry.promotionCandidate)
      ? 10
      : 0;
    const priorityScore =
      (preview.persona.openLoopCount > 0 ? 100 : 0) +
      Math.min(tokenOverflow, 50) +
      Math.min(oldestAgeDays, 30) +
      Math.min(compressibleEntries.length, 20) +
      promotionSignalScore;

    const queueReason: AiAgentMemoryCompressionQueueReason | null =
      tokenOverflow > 0
        ? "token_threshold"
        : compressibleEntries.length >= MEMORY_COUNT_THRESHOLD
          ? "memory_count_threshold"
          : oldestAgeDays >= OLDEST_MEMORY_THRESHOLD_DAYS
            ? "oldest_memory_threshold"
            : null;

    if (!queueReason) {
      deferred.push({
        personaId,
        personaUsername: preview.persona.username,
        personaDisplayName: preview.persona.displayName,
        reasonCode: "below_threshold",
        summary: `${preview.persona.username} was evaluated for compression, but it is still below the current token/count/age thresholds.`,
        priorityScore,
        queueReason: null,
        inputFingerprint,
      });
      continue;
    }

    queue.push({
      personaId,
      personaUsername: preview.persona.username,
      personaDisplayName: preview.persona.displayName,
      queueReason,
      priorityScore,
      selectedShortMemoryIds: preview.compressionBatchPreview.selectedShortMemoryIds,
      oldestCompressibleMemoryAt,
      eligibleShortMemoryCount: compressibleEntries.length,
      openLoopCount: preview.persona.openLoopCount,
      tokenOverflow,
      inputFingerprint,
      preview,
    });
  }

  queue.sort(compareQueueItems);

  return {
    queue,
    deferred,
    activeDeferrals,
  };
}

export class AiAgentMemoryCompressorService {
  private readonly deps: MemoryCompressorServiceDeps;

  public constructor(options?: { deps?: Partial<MemoryCompressorServiceDeps> }) {
    const previewStore = new AiAgentMemoryPreviewStore();
    const runtimeStateService = new AiAgentRuntimeStateService();
    const memoryAdminService = new AiAgentMemoryAdminService();

    this.deps = {
      loadConfig:
        options?.deps?.loadConfig ??
        (async () => {
          const snapshot = await loadAiAgentConfig();
          return snapshot.values;
        }),
      loadRuntimeState:
        options?.deps?.loadRuntimeState ?? (() => runtimeStateService.loadSnapshot()),
      countActiveTextTasks:
        options?.deps?.countActiveTextTasks ??
        (async () => {
          const supabase = createAdminClient();
          const { count, error } = await supabase
            .from("persona_tasks")
            .select("id", { count: "exact", head: true })
            .in("status", ["PENDING", "RUNNING"])
            .in("task_type", ["reply", "comment", "post"]);

          if (error) {
            throw new Error(`count active text tasks failed: ${error.message}`);
          }

          return count ?? 0;
        }),
      getRuntimePreviewSet:
        options?.deps?.getRuntimePreviewSet ?? (() => previewStore.getRuntimePreviewSet()),
      loadCompressionStates:
        options?.deps?.loadCompressionStates ??
        (async (personaIds) => {
          if (personaIds.length === 0) {
            return new Map();
          }

          const supabase = createAdminClient();
          const { data, error } = await supabase
            .from("personas")
            .select("id, compression_state")
            .in("id", personaIds)
            .returns<PersonaCompressionStateRow[]>();

          if (error) {
            throw new Error(`load persona compression_state failed: ${error.message}`);
          }

          return new Map(
            (data ?? []).map((row) => [
              row.id,
              parsePersonaCompressionState(row.compression_state),
            ]),
          );
        }),
      persistCompressionState:
        options?.deps?.persistCompressionState ??
        (async (personaId, state) => {
          const supabase = createAdminClient();
          const { error } = await supabase
            .from("personas")
            .update({
              compression_state: {
                lastEvaluatedAt: state.lastEvaluatedAt,
                lastDecision: state.lastDecision,
                deferUntil: state.deferUntil,
                reasonCode: state.reasonCode,
                priorityScore: state.priorityScore,
                queueReason: state.queueReason,
                selectedShortMemoryIds: state.selectedShortMemoryIds,
                inputFingerprint: state.inputFingerprint,
              },
            })
            .eq("id", personaId);

          if (error) {
            throw new Error(`persist persona compression_state failed: ${error.message}`);
          }
        }),
      compressPersona:
        options?.deps?.compressPersona ??
        (async (personaId) => {
          const result = await memoryAdminService.compressPersona(personaId);
          if (result.mode !== "persisted") {
            throw new Error(`compression did not persist for ${personaId}`);
          }
          return result;
        }),
      sleep: options?.deps?.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms))),
      now: options?.deps?.now ?? (() => new Date()),
    };
  }

  public async runNext(): Promise<AiAgentMemoryCompressorRunResult> {
    const now = this.deps.now();
    const [runtimeState, activeTextTasks, config, previewSet] = await Promise.all([
      this.deps.loadRuntimeState(),
      this.deps.countActiveTextTasks(),
      this.deps.loadConfig(),
      this.deps.getRuntimePreviewSet(),
    ]);

    if (runtimeState.paused || runtimeState.statusLabel !== "Cooling Down") {
      return {
        mode: "blocked",
        reasonCode: "runtime_not_idle",
        summary:
          "Memory compressor only runs during the idle cooldown window after an orchestrator cycle completes.",
        runtimeState,
        activeTextTasks,
      };
    }

    if (activeTextTasks > 0) {
      return {
        mode: "blocked",
        reasonCode: "text_lane_busy",
        summary:
          "Memory compressor yielded because notification/public text tasks are still pending or running.",
        runtimeState,
        activeTextTasks,
      };
    }

    const compressionStates = await this.deps.loadCompressionStates(
      previewSet.previews.map((preview) => preview.persona.personaId),
    );
    const selection = buildMemoryCompressionSelection({
      previews: previewSet.previews,
      compressionStates,
      config,
      now,
    });

    await Promise.all(
      selection.deferred.map((deferredItem) =>
        this.deps.persistCompressionState(
          deferredItem.personaId,
          buildCompressionState({
            now,
            intervalHours: config.memoryCompressIntervalHours,
            decision: "deferred",
            reasonCode: deferredItem.reasonCode,
            queueReason: deferredItem.queueReason,
            priorityScore: deferredItem.priorityScore,
            selectedShortMemoryIds: [],
            inputFingerprint: deferredItem.inputFingerprint,
          }),
        ),
      ),
    );

    const nextItem = selection.queue[0] ?? null;
    if (!nextItem) {
      return {
        mode: "idle",
        summary:
          selection.deferred.length > 0
            ? `Evaluated ${selection.deferred.length} personas for compression and deferred all of them until the next interval.`
            : "No persona currently needs compression work.",
        runtimeState,
        activeTextTasks,
        deferredPersonas: selection.deferred,
        queueLength: 0,
      };
    }

    const runtimeStateBeforeCompression = await this.deps.loadRuntimeState();
    if (
      runtimeStateBeforeCompression.paused ||
      runtimeStateBeforeCompression.statusLabel !== "Cooling Down"
    ) {
      return {
        mode: "blocked",
        reasonCode: "runtime_not_idle",
        summary:
          "Memory compressor yielded before starting the next persona because the orchestrator cooldown window is no longer idle.",
        runtimeState: runtimeStateBeforeCompression,
        activeTextTasks,
      };
    }

    const compressionResult = await this.deps.compressPersona(nextItem.personaId);
    await this.deps.persistCompressionState(
      nextItem.personaId,
      buildCompressionState({
        now: this.deps.now(),
        intervalHours: config.memoryCompressIntervalHours,
        decision: "compressed",
        reasonCode: nextItem.queueReason,
        queueReason: nextItem.queueReason,
        priorityScore: nextItem.priorityScore,
        selectedShortMemoryIds: nextItem.selectedShortMemoryIds,
        inputFingerprint: nextItem.inputFingerprint,
      }),
    );

    return {
      mode: "executed",
      summary: `Compressed ${nextItem.personaUsername} with priority ${nextItem.priorityScore} via ${nextItem.queueReason}.`,
      runtimeState: runtimeStateBeforeCompression,
      activeTextTasks,
      selected: nextItem,
      deferredPersonas: selection.deferred,
      compressionResult,
    };
  }

  public async runLoop(input: {
    pollMs: number;
    maxIterations?: number;
    signal?: AbortSignal;
  }): Promise<{
    attempts: number;
    executedIterations: number;
    lastResult: AiAgentMemoryCompressorRunResult | null;
  }> {
    let attempts = 0;
    let executedIterations = 0;
    let lastResult: AiAgentMemoryCompressorRunResult | null = null;

    while (!input.signal?.aborted) {
      if (typeof input.maxIterations === "number" && attempts >= input.maxIterations) {
        break;
      }

      attempts += 1;
      lastResult = await this.runNext();
      if (lastResult.mode === "executed") {
        executedIterations += 1;
      }

      if (input.signal?.aborted) {
        break;
      }

      await this.deps.sleep(input.pollMs);
    }

    return {
      attempts,
      executedIterations,
      lastResult,
    };
  }
}
