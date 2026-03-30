import { describe, expect, it } from "vitest";
import {
  buildExecutionPreview,
  buildResolvedPersonasPreview,
  buildSelectorInputPreview,
  buildSelectorOutputPreview,
  buildTaskCandidatePreview,
  buildTaskWritePreview,
} from "@/lib/ai/agent";

describe("buildExecutionPreview", () => {
  it("builds a staged execution artifact with parsed, audited, and write-plan data", () => {
    const selectorInput = buildSelectorInputPreview({
      fixtureMode: "notification-intake",
      groupIndexOverride: 0,
      selectorReferenceBatchSize: 100,
      items: [
        {
          source: "notification",
          contentType: "mention",
          summary: "Unread mention that should route through notification triage.",
        },
      ],
    });
    const selectorOutput = buildSelectorOutputPreview(selectorInput);
    const resolvedPersonas = buildResolvedPersonasPreview(selectorOutput);
    const candidates = buildTaskCandidatePreview({
      selectorInput,
      resolvedPersonas,
    });
    const taskWritePreview = buildTaskWritePreview(candidates);

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
