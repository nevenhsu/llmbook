import type { PreviewResult, PreviewTokenBudget } from "@/lib/ai/admin/control-plane-contract";
import {
  mockInteractionPreview,
  mockInteractionPreviewComment,
} from "@/lib/ai/admin/interaction-preview-mock";
import {
  parseMarkdownActionOutput,
  parsePostActionOutput,
} from "@/lib/ai/prompt-runtime/action-output";
import type { AiAgentRecentTaskSnapshot } from "@/lib/ai/agent/read-models/overview-read-model";
import type {
  ResolvedPersonaPreview,
  SelectorInputPreview,
  TaskCandidatePreview,
  TaskWritePreview,
} from "@/lib/ai/agent/intake/intake-preview";
import { buildSelectorInputPreview } from "@/lib/ai/agent/intake/intake-preview";

export type AiAgentExecutionParsedOutput =
  | {
      kind: "comment";
      schemaValid: boolean;
      markdown: string;
      imageRequest: {
        needImage: boolean;
        imagePrompt: string | null;
        imageAlt: string | null;
      };
      error: string | null;
    }
  | {
      kind: "post";
      schemaValid: boolean;
      title: string | null;
      body: string;
      tags: string[];
      normalizedTags: string[];
      imageRequest: {
        needImage: boolean;
        imagePrompt: string | null;
        imageAlt: string | null;
      };
      error: string | null;
    };

export type AiAgentDeterministicCheckResult = {
  stage: "schema_validate" | "deterministic_checks";
  pass: boolean;
  issues: string[];
};

export type AiAgentExecutionWritePlan = {
  primaryWrite: Record<string, unknown>;
  mediaWrite: Record<string, unknown> | null;
  memoryWrite: Record<string, unknown>;
  taskResultMetadata: Record<string, unknown>;
};

export type AiAgentExecutionPreview = {
  taskCandidate: TaskCandidatePreview;
  writeExpectation: TaskWritePreview | null;
  personaContext: {
    personaId: string;
    username: string;
    displayName: string;
    referenceSource: string;
    memorySummary: {
      shortTerm: string[];
      longTerm: string[];
    };
  };
  sourceContext: {
    sourceTable: TaskCandidatePreview["sourceTable"];
    sourceId: string;
    dispatchKind: TaskCandidatePreview["dispatchKind"];
    contentType: string;
    summary: string;
    fixtureMode: SelectorInputPreview["fixtureMode"];
  };
  promptInput: {
    stage: "main";
    actionType: "comment" | "post";
    taskContext: string;
    personaSummary: string;
    sourceSummary: string;
  };
  actualModelPayload: {
    assembledPrompt: string;
    maxOutputTokens: number;
    temperature: number;
  };
  rawOutput: string;
  parsedOutput: AiAgentExecutionParsedOutput;
  deterministicChecks: AiAgentDeterministicCheckResult[];
  writePlan: AiAgentExecutionWritePlan;
  previewSurface: PreviewResult;
};

const PERSONA_REFERENCE_SOURCE_BY_USERNAME: Record<string, string> = {
  ai_orchid: "Yayoi Kusama",
  ai_marlowe: "David Bowie",
  ai_sable: "Grace Jones",
  ai_vesper: "Octavia Butler",
};

function buildMemorySummary(persona: ResolvedPersonaPreview, candidate: TaskCandidatePreview) {
  return {
    shortTerm: [
      `${persona.displayName} has recent affinity for ${candidate.payload.contentType} opportunities.`,
      `Last intake path: ${candidate.dispatchKind} / ${candidate.sourceTable}.`,
    ],
    longTerm: [
      `${persona.displayName} keeps orbiting ${persona.referenceSource} as a stable voice anchor.`,
      "Operator preview mode is using fixture-backed execution artifacts only.",
    ],
  };
}

function buildPreviewSurface(input: {
  candidate: TaskCandidatePreview;
  persona: ResolvedPersonaPreview;
}): PreviewResult {
  const basePreview =
    input.candidate.payload.contentType === "post"
      ? mockInteractionPreview
      : mockInteractionPreviewComment;
  const previewHeader = [
    "[ai_agent_execution_preview]",
    `persona_username: ${input.persona.username}`,
    `reference_source: ${input.persona.referenceSource}`,
    `source_table: ${input.candidate.sourceTable}`,
    `source_id: ${input.candidate.sourceId}`,
    `dispatch_kind: ${input.candidate.dispatchKind}`,
    `fixture_mode: ${input.candidate.payload.fixtureMode}`,
    `summary: ${input.candidate.payload.summary}`,
  ].join("\n");

  return {
    ...basePreview,
    assembledPrompt: `${previewHeader}\n\n${basePreview.assembledPrompt}`,
    markdown:
      input.candidate.payload.contentType === "post"
        ? basePreview.markdown.replace(
            "Deep-Sea Gods",
            `${input.persona.displayName}'s Deep-Sea Gods`,
          )
        : `@${input.persona.username} preview reply on ${input.candidate.sourceId}\n\n${basePreview.markdown}`,
  };
}

function buildPromptInput(input: {
  candidate: TaskCandidatePreview;
  persona: ResolvedPersonaPreview;
}): AiAgentExecutionPreview["promptInput"] {
  return {
    stage: "main",
    actionType: input.candidate.payload.contentType === "post" ? "post" : "comment",
    taskContext: [
      `Respond to ${input.candidate.sourceTable}:${input.candidate.sourceId} as ${input.persona.username}.`,
      `Dispatch kind: ${input.candidate.dispatchKind}.`,
    ].join(" "),
    personaSummary: `${input.persona.displayName} / ${input.persona.username} anchored by ${input.persona.referenceSource}.`,
    sourceSummary: input.candidate.payload.summary,
  };
}

function buildActualModelPayload(
  previewSurface: PreviewResult,
  tokenBudget: PreviewTokenBudget,
): AiAgentExecutionPreview["actualModelPayload"] {
  return {
    assembledPrompt: previewSurface.assembledPrompt,
    maxOutputTokens: tokenBudget.maxOutputTokens,
    temperature: 0.3,
  };
}

function buildParsedOutput(input: {
  candidate: TaskCandidatePreview;
  rawOutput: string;
}): AiAgentExecutionParsedOutput {
  if (input.candidate.payload.contentType === "post") {
    const parsed = parsePostActionOutput(input.rawOutput);
    return {
      kind: "post",
      schemaValid: parsed.error === null,
      title: parsed.title,
      body: parsed.body,
      tags: parsed.tags,
      normalizedTags: parsed.normalizedTags,
      imageRequest: parsed.imageRequest,
      error: parsed.error,
    };
  }

  const parsed = parseMarkdownActionOutput(input.rawOutput);
  const markdown = parsed.output?.markdown ?? "";
  const imageRequest = parsed.output?.imageRequest ?? {
    needImage: false,
    imagePrompt: null,
    imageAlt: null,
  };
  return {
    kind: "comment",
    schemaValid: markdown.trim().length > 0,
    markdown,
    imageRequest,
    error: markdown.trim().length > 0 ? null : "interaction preview returned empty markdown",
  };
}

function buildDeterministicChecks(
  parsedOutput: AiAgentExecutionParsedOutput,
): AiAgentDeterministicCheckResult[] {
  const schemaIssue = parsedOutput.error ? [parsedOutput.error] : [];
  const deterministicIssues: string[] = [];

  if (parsedOutput.kind === "post") {
    if (!parsedOutput.title) {
      deterministicIssues.push("title is required for post execution.");
    }
    if (parsedOutput.normalizedTags.length < 1 || parsedOutput.normalizedTags.length > 5) {
      deterministicIssues.push("post tags must normalize to between 1 and 5 values.");
    }
  } else if (!parsedOutput.markdown.trim()) {
    deterministicIssues.push("comment markdown must be non-empty after parsing.");
  }

  return [
    {
      stage: "schema_validate",
      pass: schemaIssue.length === 0,
      issues: schemaIssue,
    },
    {
      stage: "deterministic_checks",
      pass: deterministicIssues.length === 0,
      issues: deterministicIssues,
    },
  ];
}

function buildWritePlan(input: {
  candidate: TaskCandidatePreview;
  writeExpectation: TaskWritePreview | null;
  parsedOutput: AiAgentExecutionParsedOutput;
}): AiAgentExecutionWritePlan {
  const primaryWrite =
    input.parsedOutput.kind === "post"
      ? {
          table: "posts",
          operation: "insert_preview",
          payload: {
            persona_username: input.candidate.username,
            title: input.parsedOutput.title,
            body: input.parsedOutput.body,
            tags: input.parsedOutput.normalizedTags,
            source_table: input.candidate.sourceTable,
            source_id: input.candidate.sourceId,
          },
        }
      : {
          table: "comments",
          operation: "insert_preview",
          payload: {
            persona_username: input.candidate.username,
            markdown: input.parsedOutput.markdown,
            source_table: input.candidate.sourceTable,
            source_id: input.candidate.sourceId,
          },
        };

  const imageRequest = input.parsedOutput.imageRequest;
  const mediaWrite = imageRequest.needImage
    ? {
        table: "generated_images",
        operation: "insert_preview",
        payload: {
          image_prompt: imageRequest.imagePrompt,
          image_alt: imageRequest.imageAlt,
          owner_task_source: input.candidate.sourceId,
        },
      }
    : null;

  return {
    primaryWrite,
    mediaWrite,
    memoryWrite: {
      table: "persona_memories",
      operation: "insert_preview",
      payload: {
        scope: "persona",
        memory_type: "memory",
        content: `Execution preview for ${input.candidate.username} on ${input.candidate.sourceId}`,
        source_summary: input.candidate.payload.summary,
      },
    },
    taskResultMetadata: {
      preview_status: "ready",
      expected_task_id: input.writeExpectation?.taskId ?? null,
      dedupe_expectation: input.writeExpectation?.dedupeExpectation ?? "insert",
      cooldown_expectation: input.writeExpectation?.cooldownExpectation ?? "eligible",
      skip_reason: input.writeExpectation?.skipReason ?? null,
    },
  };
}

export function buildExecutionPreview(input: {
  selectorInput: SelectorInputPreview;
  resolvedPersonas: ResolvedPersonaPreview[];
  candidates: TaskCandidatePreview[];
  taskWritePreview: TaskWritePreview[];
  candidateIndex?: number;
}): AiAgentExecutionPreview | null {
  const candidate =
    input.candidates.find((item) => item.candidateIndex === input.candidateIndex) ??
    input.candidates[0] ??
    null;

  if (!candidate) {
    return null;
  }

  const persona =
    input.resolvedPersonas.find((item) => item.personaId === candidate.personaId) ?? null;
  if (!persona) {
    return null;
  }

  const writeExpectation =
    input.taskWritePreview.find((item) => item.candidateIndex === candidate.candidateIndex) ?? null;
  const previewSurface = buildPreviewSurface({ candidate, persona });
  const rawOutput = previewSurface.rawResponse ?? previewSurface.markdown;
  const parsedOutput = buildParsedOutput({ candidate, rawOutput });
  const deterministicChecks = buildDeterministicChecks(parsedOutput);

  return {
    taskCandidate: candidate,
    writeExpectation,
    personaContext: {
      personaId: persona.personaId,
      username: persona.username,
      displayName: persona.displayName,
      referenceSource: persona.referenceSource,
      memorySummary: buildMemorySummary(persona, candidate),
    },
    sourceContext: {
      sourceTable: candidate.sourceTable,
      sourceId: candidate.sourceId,
      dispatchKind: candidate.dispatchKind,
      contentType: candidate.payload.contentType,
      summary: candidate.payload.summary,
      fixtureMode: input.selectorInput.fixtureMode,
    },
    promptInput: buildPromptInput({ candidate, persona }),
    actualModelPayload: buildActualModelPayload(previewSurface, previewSurface.tokenBudget),
    rawOutput,
    parsedOutput,
    deterministicChecks,
    writePlan: buildWritePlan({
      candidate,
      writeExpectation,
      parsedOutput,
    }),
    previewSurface,
  };
}

export function buildExecutionPreviewFromTask(
  task: AiAgentRecentTaskSnapshot,
): AiAgentExecutionPreview {
  const fixtureMode =
    task.dispatchKind === "notification" ? "notification-intake" : "mixed-public-opportunity";
  const candidate: TaskCandidatePreview = {
    candidateIndex: 0,
    opportunityKey: task.sourceId ?? task.id,
    personaId: task.personaId,
    username: task.personaUsername ?? "ai_unknown",
    dispatchKind: task.dispatchKind as "notification" | "public",
    sourceTable: (task.sourceTable as "notifications" | "posts" | "comments") ?? "comments",
    sourceId: task.sourceId ?? task.id,
    dedupeKey:
      task.dedupeKey ?? `${task.personaUsername ?? task.personaId}:${task.id}:${task.taskType}`,
    cooldownUntil: task.cooldownUntil ?? "2026-03-29T06:00:00.000Z",
    payload: {
      contentType: task.taskType,
      contentMode:
        typeof task.payload.contentMode === "string" ? task.payload.contentMode : "discussion",
      source: task.dispatchKind,
      summary:
        typeof task.payload.summary === "string"
          ? task.payload.summary
          : `${task.taskType} execution preview sourced from persona_tasks.`,
      fixtureMode,
      boardId: typeof task.payload.boardId === "string" ? task.payload.boardId : null,
      postId: typeof task.payload.postId === "string" ? task.payload.postId : null,
      commentId: typeof task.payload.commentId === "string" ? task.payload.commentId : null,
      parentCommentId:
        typeof task.payload.parentCommentId === "string" ? task.payload.parentCommentId : null,
      context: typeof task.payload.context === "string" ? task.payload.context : null,
      notificationType:
        typeof task.payload.notificationType === "string" ? task.payload.notificationType : null,
    },
  };
  const persona: ResolvedPersonaPreview = {
    personaId: task.personaId,
    username: task.personaUsername ?? "ai_unknown",
    displayName: task.personaDisplayName ?? task.personaUsername ?? task.personaId,
    active: true,
    referenceSource:
      PERSONA_REFERENCE_SOURCE_BY_USERNAME[task.personaUsername ?? ""] ??
      "Unknown reference source",
  };
  const selectorInput: SelectorInputPreview = buildSelectorInputPreview({
    fixtureMode,
    groupIndexOverride: 0,
    selectorReferenceBatchSize: 1,
    items: [
      {
        source: candidate.dispatchKind,
        contentType: candidate.payload.contentType,
        summary: candidate.payload.summary,
        sourceId: candidate.sourceId,
        metadata:
          candidate.dispatchKind === "notification"
            ? {
                recipientPersonaId: candidate.personaId,
                boardId: candidate.payload.boardId,
                postId: candidate.payload.postId,
                commentId: candidate.payload.commentId,
                parentCommentId: candidate.payload.parentCommentId,
                context: candidate.payload.context,
                notificationType: candidate.payload.notificationType,
              }
            : undefined,
      },
    ],
  });
  const taskWritePreview: TaskWritePreview[] = [
    {
      candidateIndex: 0,
      inserted: task.status !== "FAILED" && task.status !== "SKIPPED",
      skipReason: task.status === "SKIPPED" ? "task_marked_skipped" : null,
      taskId: task.id,
      dedupeExpectation: "insert",
      cooldownExpectation: task.cooldownUntil ? "cooldown_active" : "eligible",
      expectationSummary:
        "Task snapshot adapter is previewing the current queue row without persistence.",
    },
  ];

  return buildExecutionPreview({
    selectorInput,
    resolvedPersonas: [persona],
    candidates: [candidate],
    taskWritePreview,
    candidateIndex: 0,
  }) as AiAgentExecutionPreview;
}
