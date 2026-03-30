import type { AiAgentRecentTaskSnapshot } from "@/lib/ai/agent/read-models/overview-read-model";

export type AiAgentMemoryPersonaOption = {
  personaId: string;
  username: string;
  displayName: string;
  shortMemoryCount: number;
  longMemoryPresent: boolean;
  compressibleCount: number;
  openLoopCount: number;
};

export type AiAgentMemoryEntryPreview = {
  id: string;
  personaId: string;
  username: string;
  displayName: string;
  memoryType: "memory" | "long_memory";
  scope: "persona" | "thread" | "board";
  threadId: string | null;
  boardId: string | null;
  content: string;
  metadata: Record<string, unknown>;
  expiresAt: string | null;
  importance: number | null;
  createdAt: string;
  updatedAt: string;
  sourceKind: string | null;
  continuityKind: string | null;
  hasOpenLoop: boolean;
  promotionCandidate: boolean;
};

export type AiAgentLatestMemoryWritePreview = {
  path: "deterministic_comment" | "llm_post" | "skipped";
  selectedTask: {
    taskId: string;
    taskType: string;
    sourceTable: string | null;
    sourceId: string | null;
    resultType: string | null;
  } | null;
  rowPreview: {
    scope: "thread" | "board";
    memoryType: "memory";
    importance: number;
    content: string;
    metadata: Record<string, unknown>;
  } | null;
  persistedRow: AiAgentMemoryEntryPreview | null;
  summary: string;
};

export type AiAgentCompressionBatchPreview = {
  queueReason: string;
  selectedShortMemoryIds: string[];
  protectedRows: Array<{ id: string; reason: string }>;
  deletableRows: string[];
  currentLongMemory: AiAgentMemoryEntryPreview | null;
};

export type AiAgentCompressionPreview = {
  compressionResult: Record<string, unknown>;
  compressionAuditResult: Record<string, unknown>;
  renderedLongMemory: string;
  cleanupPreview: {
    deleteIds: string[];
    protectedIds: string[];
  };
};

export type AiAgentMemoryPersonaPreview = {
  persona: AiAgentMemoryPersonaOption;
  recentShortMemories: AiAgentMemoryEntryPreview[];
  canonicalLongMemory: AiAgentMemoryEntryPreview | null;
  latestWritePreview: AiAgentLatestMemoryWritePreview;
  compressionBatchPreview: AiAgentCompressionBatchPreview;
  compressionPreview: AiAgentCompressionPreview;
};

function readBoolean(record: Record<string, unknown>, key: string): boolean {
  return record[key] === true;
}

function readString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function renderTaskSummary(task: AiAgentRecentTaskSnapshot): string {
  return `${task.taskType} result from ${task.sourceTable ?? "unknown"}:${task.sourceId ?? task.id}`;
}

export function buildLatestMemoryWritePreview(input: {
  persona: AiAgentMemoryPersonaOption;
  recentTasks: AiAgentRecentTaskSnapshot[];
  recentShortMemories: AiAgentMemoryEntryPreview[];
}): AiAgentLatestMemoryWritePreview {
  const task =
    input.recentTasks.find(
      (candidate) =>
        candidate.personaId === input.persona.personaId &&
        candidate.status === "DONE" &&
        (candidate.taskType === "comment" || candidate.taskType === "post"),
    ) ?? null;
  const persistedRow = input.recentShortMemories[0] ?? null;

  if (!task) {
    return {
      path: "skipped",
      selectedTask: null,
      rowPreview: null,
      persistedRow,
      summary: "No successful post/comment task is available for memory-write preview.",
    };
  }

  const path = task.taskType === "post" ? "llm_post" : "deterministic_comment";
  const scope = task.taskType === "post" ? "board" : "thread";
  const content =
    path === "llm_post"
      ? `Post memory for ${input.persona.displayName}: ${renderTaskSummary(task)}`
      : `Thread memory for ${input.persona.displayName}: ${renderTaskSummary(task)}`;

  return {
    path,
    selectedTask: {
      taskId: task.id,
      taskType: task.taskType,
      sourceTable: task.sourceTable,
      sourceId: task.sourceId,
      resultType: task.resultType,
    },
    rowPreview: {
      scope,
      memoryType: "memory",
      importance: path === "llm_post" ? 0.82 : 0.61,
      content,
      metadata: {
        source_kind: task.taskType,
        continuity_kind: scope === "board" ? "board_arc" : "thread_reply",
        has_open_loop: task.taskType === "post",
        promotion_candidate: task.taskType === "post",
        source_task_id: task.id,
      },
    },
    persistedRow,
    summary:
      path === "llm_post"
        ? "Latest successful post would follow the staged LLM memory-write path."
        : "Latest successful comment would follow the deterministic thread-memory path.",
  };
}

export function buildCompressionBatchPreview(input: {
  persona: AiAgentMemoryPersonaOption;
  recentShortMemories: AiAgentMemoryEntryPreview[];
  canonicalLongMemory: AiAgentMemoryEntryPreview | null;
}): AiAgentCompressionBatchPreview {
  const protectedRows = input.recentShortMemories
    .filter((entry) => entry.hasOpenLoop)
    .map((entry) => ({
      id: entry.id,
      reason: "unresolved_open_loop",
    }));
  const selected = input.recentShortMemories.filter((entry) => !entry.hasOpenLoop).slice(0, 3);

  return {
    queueReason: `${input.persona.compressibleCount} compressible rows for ${input.persona.username}`,
    selectedShortMemoryIds: selected.map((entry) => entry.id),
    protectedRows,
    deletableRows: selected.map((entry) => entry.id),
    currentLongMemory: input.canonicalLongMemory,
  };
}

export function buildCompressionPreview(input: {
  persona: AiAgentMemoryPersonaOption;
  recentShortMemories: AiAgentMemoryEntryPreview[];
  canonicalLongMemory: AiAgentMemoryEntryPreview | null;
  compressionBatchPreview: AiAgentCompressionBatchPreview;
}): AiAgentCompressionPreview {
  const stableFacts = input.recentShortMemories.slice(0, 3).map((entry) => entry.content);
  const openLoops = input.recentShortMemories
    .filter((entry) => entry.hasOpenLoop)
    .map((entry) => entry.content);
  const renderedLongMemory = [
    `# Canonical Memory for ${input.persona.displayName}`,
    "",
    "## Stable Facts",
    ...stableFacts.map((line) => `- ${line}`),
    "",
    "## Open Loops",
    ...(openLoops.length > 0 ? openLoops.map((line) => `- ${line}`) : ["- none"]),
  ].join("\n");

  return {
    compressionResult: {
      persona_id: input.persona.personaId,
      stable_facts: stableFacts,
      open_loops: openLoops,
      promoted_topics: input.recentShortMemories
        .filter((entry) => entry.promotionCandidate)
        .map((entry) => readString(entry.metadata, "continuity_kind") ?? entry.scope),
    },
    compressionAuditResult: {
      pass: true,
      issues: [],
      protected_row_count: input.compressionBatchPreview.protectedRows.length,
      deletable_row_count: input.compressionBatchPreview.deletableRows.length,
    },
    renderedLongMemory,
    cleanupPreview: {
      deleteIds: input.compressionBatchPreview.deletableRows,
      protectedIds: input.compressionBatchPreview.protectedRows.map((row) => row.id),
    },
  };
}

export function buildMemoryPersonaPreview(input: {
  persona: AiAgentMemoryPersonaOption;
  entries: AiAgentMemoryEntryPreview[];
  recentTasks: AiAgentRecentTaskSnapshot[];
}): AiAgentMemoryPersonaPreview {
  const canonicalLongMemory =
    input.entries.find(
      (entry) => entry.memoryType === "long_memory" && entry.scope === "persona",
    ) ?? null;
  const recentShortMemories = input.entries
    .filter((entry) => entry.memoryType === "memory")
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  const latestWritePreview = buildLatestMemoryWritePreview({
    persona: input.persona,
    recentTasks: input.recentTasks,
    recentShortMemories,
  });
  const compressionBatchPreview = buildCompressionBatchPreview({
    persona: input.persona,
    recentShortMemories,
    canonicalLongMemory,
  });

  return {
    persona: input.persona,
    recentShortMemories,
    canonicalLongMemory,
    latestWritePreview,
    compressionBatchPreview,
    compressionPreview: buildCompressionPreview({
      persona: input.persona,
      recentShortMemories,
      canonicalLongMemory,
      compressionBatchPreview,
    }),
  };
}

export function buildMemoryEntryPreview(input: {
  id: string;
  personaId: string;
  username: string;
  displayName: string;
  memoryType: "memory" | "long_memory";
  scope: "persona" | "thread" | "board";
  threadId: string | null;
  boardId: string | null;
  content: string;
  metadata: Record<string, unknown>;
  expiresAt: string | null;
  importance: number | null;
  createdAt: string;
  updatedAt: string;
}): AiAgentMemoryEntryPreview {
  return {
    ...input,
    sourceKind: readString(input.metadata, "source_kind"),
    continuityKind: readString(input.metadata, "continuity_kind"),
    hasOpenLoop: readBoolean(input.metadata, "has_open_loop"),
    promotionCandidate: readBoolean(input.metadata, "promotion_candidate"),
  };
}
