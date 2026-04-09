import { describe, expect, it, vi } from "vitest";
import type { AiAgentPersonaTaskGenerationResult } from "@/lib/ai/agent/execution/persona-task-generator";
import {
  AiAgentPersonaTaskExecutor,
  type AiAgentTextExecutionPersistedResult,
} from "@/lib/ai/agent/execution/persona-task-executor";
import { buildMockAiAgentOverviewSnapshot } from "@/lib/ai/agent/testing/mock-overview-snapshot";

describe("AiAgentPersonaTaskExecutor", () => {
  it("generates and persists one persona_task through the shared text path", async () => {
    const task = buildMockAiAgentOverviewSnapshot().recentTasks[0];
    const generated = {
      task,
      mode: "runtime",
      promptContext: {
        taskType: "comment",
        taskContext: "Generate a reply",
        boardContextText: "[board]",
        targetContextText: "[target]",
      },
      preview: {
        markdown: "reply body",
        html: "<p>reply body</p>",
        rawResponse: "reply body",
        prompt: "[prompt]",
        promptBlocks: [],
        modelId: "model-1",
        diagnostics: {
          promptVersion: "v1",
        },
      } as any,
      parsedOutput: {
        kind: "comment",
        body: "reply body",
      },
      modelMetadata: {
        schema_version: 1,
      },
      modelSelection: {
        modelId: "model-1",
        providerKey: "openai",
        modelKey: "gpt-4.1",
      },
    } satisfies AiAgentPersonaTaskGenerationResult;
    const persistResult = {
      taskId: task.id,
      persistedTable: "comments",
      persistedId: "comment-1",
      resultType: "comment",
      writeMode: "inserted",
      historyId: null,
      updatedTask: {
        ...task,
        status: "DONE",
        resultId: "comment-1",
        resultType: "comment",
      },
    } satisfies AiAgentTextExecutionPersistedResult;
    const loadTaskById = vi.fn(async () => task);
    const generateTaskContent = vi.fn(async () => generated);
    const persistGeneratedTaskResult = vi.fn(async () => persistResult);

    const service = new AiAgentPersonaTaskExecutor({
      deps: {
        loadTaskById,
        generateTaskContent,
        persistGeneratedTaskResult,
      },
    });

    const result = await service.executeTask({
      taskId: task.id,
      sourceRuntime: "text_runtime",
    });

    expect(loadTaskById).toHaveBeenCalledWith(task.id);
    expect(generateTaskContent).toHaveBeenCalledWith({
      task,
      mode: "runtime",
    });
    expect(persistGeneratedTaskResult).toHaveBeenCalledWith({
      generated,
      sourceRuntime: "text_runtime",
      jobTaskId: null,
      createdBy: null,
    });
    expect(result).toEqual(persistResult);
  });
});
