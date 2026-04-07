import { describe, expect, it } from "vitest";
import { buildExecutionPreview } from "@/lib/ai/agent/execution/execution-preview";
import {
  buildSelectorInputPreview,
  type ResolvedPersonaPreview,
  type TaskCandidatePreview,
  type TaskWritePreview,
} from "@/lib/ai/agent/intake/intake-preview";

describe("buildExecutionPreview", () => {
  it("builds a staged execution artifact from the current task-facing contract", () => {
    const selectorInput = buildSelectorInputPreview({
      fixtureMode: "notification-intake",
      groupIndexOverride: 0,
      selectorReferenceBatchSize: 1,
      items: [
        {
          source: "notification",
          contentType: "mention",
          summary: "Unread mention that should route through notification triage.",
          sourceId: "notification-intake-1",
          metadata: {
            recipientPersonaId: "persona-orchid",
            postId: "post-1",
            notificationType: "mention",
          },
        },
      ],
    });
    const resolvedPersonas: ResolvedPersonaPreview[] = [
      {
        personaId: "persona-orchid",
        username: "ai_orchid",
        displayName: "Orchid",
        active: true,
        referenceSource: "Yayoi Kusama",
      },
    ];
    const candidates: TaskCandidatePreview[] = [
      {
        candidateIndex: 0,
        opportunityKey: "N01",
        personaId: "persona-orchid",
        username: "ai_orchid",
        dispatchKind: "notification",
        sourceTable: "notifications",
        sourceId: "notification-intake-1",
        dedupeKey: "ai_orchid:notification-intake-1:mention",
        cooldownUntil: "2026-03-29T06:00:00.000Z",
        payload: {
          contentType: "mention",
          source: "notification",
          summary: "Unread mention that should route through notification triage.",
          fixtureMode: "notification-intake",
          boardId: null,
          postId: "post-1",
          commentId: null,
          parentCommentId: null,
          context: "post",
          notificationType: "mention",
        },
      },
    ];
    const taskWritePreview: TaskWritePreview[] = [
      {
        candidateIndex: 0,
        inserted: true,
        skipReason: null,
        taskId: "task-preview-1",
        dedupeExpectation: "insert",
        cooldownExpectation: "eligible",
        expectationSummary: "Task would insert cleanly.",
      },
    ];

    const executionPreview = buildExecutionPreview({
      selectorInput,
      resolvedPersonas,
      candidates,
      taskWritePreview,
    });

    expect(executionPreview).not.toBeNull();
    expect(executionPreview?.personaContext.username).toBe("ai_orchid");
    expect(executionPreview?.sourceContext.sourceId).toBe("notification-intake-1");
    expect(executionPreview?.promptInput.actionType).toBe("comment");
    expect(executionPreview?.actualModelPayload.assembledPrompt).toContain(
      "[ai_agent_execution_preview]",
    );
    expect(executionPreview?.actualModelPayload.assembledPrompt).toContain(
      "persona_username: ai_orchid",
    );
    expect(executionPreview?.parsedOutput).toMatchObject({
      kind: "comment",
      schemaValid: true,
    });
    expect(executionPreview?.deterministicChecks).toEqual([
      {
        stage: "schema_validate",
        pass: true,
        issues: [],
      },
      {
        stage: "deterministic_checks",
        pass: true,
        issues: [],
      },
    ]);
    expect(executionPreview?.auditedOutput).toMatchObject({
      contract: "persona_output_audit",
      pass: true,
      status: "passed",
    });
    expect(executionPreview?.writePlan.primaryWrite).toMatchObject({
      table: "comments",
      operation: "insert_preview",
    });
    expect(executionPreview?.writePlan.taskResultMetadata).toMatchObject({
      preview_status: "ready",
      expected_task_id: "task-preview-1",
    });
  });
});
