/** @vitest-environment jsdom */

import { act } from "react";
import React from "react";
import ReactDOMClient from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AiAgentPanel from "@/components/admin/agent-panel/AiAgentPanel";
import { buildMockIntakeRuntimePreviews } from "@/lib/ai/agent/testing/mock-intake-runtime-previews";
import { buildMockMemoryPreviewSet } from "@/lib/ai/agent/testing/mock-memory-preview";
import { buildMockAiAgentOverviewSnapshot } from "@/lib/ai/agent/testing/mock-overview-snapshot";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("AiAgentPanel", () => {
  let container: HTMLDivElement;
  let root: ReactDOMClient.Root;
  let fetchMock: ReturnType<typeof vi.fn>;
  let clipboardWriteTextMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = ReactDOMClient.createRoot(container);
    fetchMock = vi.fn();
    clipboardWriteTextMock = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("fetch", fetchMock);
    Object.defineProperty(globalThis.navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: clipboardWriteTextMock,
      },
    });
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.unstubAllGlobals();
  });

  it("covers the Phase 6 operator walkthrough from intake through memory verification", async () => {
    await act(async () => {
      root.render(
        React.createElement(AiAgentPanel, {
          initialSnapshot: buildMockAiAgentOverviewSnapshot(),
          runtimePreviews: buildMockIntakeRuntimePreviews(),
          runtimeMemoryPreviews: buildMockMemoryPreviewSet(),
        }),
      );
    });

    expect(container.textContent).toContain("AI Agent Panel");
    expect(container.textContent).toContain("Queue Total");
    expect(container.textContent).toContain("8");
    expect(container.textContent).toContain("Selector Batch Size");
    expect(container.textContent).toContain("100");
    expect(container.textContent).toContain("Runtime State");
    expect(container.textContent).toContain("Unavailable");
    expect(container.textContent).toContain("Operator Readiness");
    expect(container.textContent).toContain("Blocked");
    expect(container.textContent).toContain("Continuous Runtime Checkpoint");
    expect(container.textContent).toContain("Not Ready For Continuous Runtime");
    expect(container.textContent).toContain("PM Walkthrough Checklist");
    expect(container.textContent).toContain("Walkthrough Partially Verified");
    expect(container.textContent).toContain("PM Acceptance Summary");
    expect(container.textContent).toContain("Not Ready For PM Acceptance");
    expect(container.textContent).toContain("Outstanding For PM");
    expect(container.textContent).toContain("runtime state");
    expect(container.textContent).toContain("queue backlog");
    expect(container.textContent).toContain("Pause runtime");
    expect(container.textContent).toContain("Resume runtime");
    expect(container.textContent).toContain("Run Phase A");

    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 409,
      json: async () => ({
        mode: "blocked_execute",
        action: "pause",
        actionLabel: "Pause runtime",
        reasonCode: "runtime_state_unavailable",
        summary: "orchestrator_runtime_state is not implemented yet in this repo slice.",
        runtimeState: {
          available: false,
          statusLabel: "Unavailable",
          detail: "orchestrator_runtime_state is not implemented yet in this repo slice.",
          publicCandidateGroupIndex: null,
          publicCandidateEpoch: null,
        },
      }),
      headers: new Headers({ "Content-Type": "application/json" }),
    });

    const pauseRuntimeButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Pause runtime"),
    );
    expect(pauseRuntimeButton).toBeDefined();

    await act(async () => {
      pauseRuntimeButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/ai/agent/runtime/pause",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({}),
      }),
    );
    expect(container.textContent).toContain("Runtime Control Result");
    expect(container.textContent).toContain('"reasonCode": "runtime_state_unavailable"');

    const tasksButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Tasks"),
    );
    expect(tasksButton).not.toBeUndefined();

    await act(async () => {
      tasksButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).toContain("Queue inspection is now drill-down capable");
    expect(container.textContent).toContain("ai_orchid");
    expect(container.textContent).toContain("Task Detail");
    expect(container.textContent).toContain("Dedupe Key");
    expect(container.textContent).toContain("ai_orchid:comment-1:comment");
    expect(container.textContent).toContain("Payload JSON");
    expect(container.textContent).toContain('"contentType": "comment"');
    expect(container.textContent).toContain("Queue Actions");
    expect(container.textContent).toContain("Queue Action Preview");
    expect(container.textContent).toContain("retry_task");
    expect(container.textContent).toContain("requeue_task");
    expect(container.textContent).toContain("mark_dead");
    expect(container.textContent).toContain("Queue Action API Result");
    expect(container.textContent).toContain("Preview");
    expect(container.textContent).toContain("Execute");

    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        mode: "guarded_preview",
        taskId: "task-1",
        action: "retry_task",
        actionPreview: {
          action: "retry_task",
          enabled: false,
          reason: "Retry is only allowed for FAILED rows.",
          statusTransition: { from: "PENDING", to: "PENDING" },
          payload: {
            task_id: "task-1",
            preserve_retry_count: true,
            current_retry_count: 0,
          },
        },
        message: "Queue mutation is still guarded in this slice; preview only.",
      }),
      headers: new Headers({ "Content-Type": "application/json" }),
    });

    const previewButtons = Array.from(container.querySelectorAll("button")).filter((button) =>
      button.textContent?.includes("Preview"),
    );
    const retryPreviewButton = previewButtons[0];
    expect(retryPreviewButton).toBeDefined();

    await act(async () => {
      retryPreviewButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/ai/agent/tasks/task-1/actions",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ action: "retry_task", mode: "preview" }),
      }),
    );
    expect(container.textContent).toContain(
      "Queue mutation is still guarded in this slice; preview only.",
    );
    expect(container.textContent).toContain('"mode": "guarded_preview"');

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        mode: "executed",
        taskId: "task-1",
        action: "mark_dead",
        actionPreview: {
          action: "mark_dead",
          enabled: true,
          reason:
            "Mark dead would terminally skip the row and remove it from runnable queue states.",
          statusTransition: { from: "PENDING", to: "SKIPPED" },
          payload: {
            task_id: "task-1",
            preserve_result_metadata: false,
            terminal_reason: "admin_marked_dead",
          },
        },
        previousStatus: "PENDING",
        updatedTask: {
          ...buildMockAiAgentOverviewSnapshot().recentTasks[0],
          status: "SKIPPED",
          completedAt: "2026-03-29T02:00:00.000Z",
          errorMessage: "admin_marked_dead",
          resultId: null,
          resultType: null,
        },
        message: "mark_dead executed against persona_tasks.",
      }),
      headers: new Headers({ "Content-Type": "application/json" }),
    });

    const executeButtons = Array.from(container.querySelectorAll("button")).filter((button) =>
      button.textContent?.includes("Execute"),
    );
    const markDeadExecuteButton = executeButtons[2];
    expect(markDeadExecuteButton?.hasAttribute("disabled")).toBe(false);

    await act(async () => {
      markDeadExecuteButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/ai/agent/tasks/task-1/actions",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ action: "mark_dead", mode: "execute" }),
      }),
    );
    expect(container.textContent).toContain("mark_dead executed against persona_tasks.");
    expect(container.textContent).toContain('"previousStatus": "PENDING"');
    expect(container.textContent).toContain("SKIPPED");

    const memoryButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Memory"),
    );
    expect(memoryButton).toBeDefined();

    await act(async () => {
      memoryButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).toContain("Latest Write Preview");
    expect(container.textContent).toContain("Compression Batch Preview");
    expect(container.textContent).toContain("Compression Output Preview");
    expect(container.textContent).toContain("View latest write detail");
    expect(container.textContent).toContain("View compression batch detail");
    expect(container.textContent).toContain("View compression output detail");
    expect(container.textContent).toContain("View rendered long memory");
    expect(container.textContent).toContain("Persist latest write");

    const renderedLongMemoryButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.includes("View rendered long memory"),
    );
    expect(renderedLongMemoryButton).toBeDefined();

    await act(async () => {
      renderedLongMemoryButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).toContain("Rendered Long Memory");
    expect(container.textContent).toContain("Cleanup Consequences");
    expect(container.textContent).toContain("Canonical Memory for");

    const intakeButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Intake"),
    );

    await act(async () => {
      intakeButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).toContain("Notification Intake Snapshot");
    expect(container.textContent).toContain("notification-1");
    expect(container.textContent).toContain("Unread mention from runtime snapshot");
    expect(container.textContent).toContain("Public Intake Snapshot");
    expect(container.textContent).toContain("comment-1");
    expect(container.textContent).toContain("post-1");
    expect(container.textContent).toContain(
      "Board: Creative Lab | Recent comment: Can anyone share concrete workflow examples for this tool stack?",
    );
    expect(container.textContent).toContain(
      "Board: Creative Lab | Recent post title: Best prompting workflows this week",
    );
    expect(container.textContent).toContain("Notification Injection Preview");
    expect(container.textContent).toContain("Public Injection Preview");
    expect(container.textContent).toContain('"persona_tasks_rows"');

    const intakeViewPromptButtons = Array.from(container.querySelectorAll("button")).filter(
      (button) => button.textContent?.includes("View Prompt"),
    );
    const notificationIntakeViewPromptButton = intakeViewPromptButtons[0];
    expect(notificationIntakeViewPromptButton).toBeDefined();

    await act(async () => {
      notificationIntakeViewPromptButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).toContain("Intake Prompt Detail");
    expect(container.textContent).toContain("notification-intake");
    expect(container.textContent).toContain("Assembled Prompt");
    expect(container.textContent).toContain("Prompt Input");

    const intakeCopyPromptButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Copy Prompt"),
    );
    expect(intakeCopyPromptButton).toBeDefined();

    await act(async () => {
      intakeCopyPromptButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(clipboardWriteTextMock).toHaveBeenCalledWith(expect.stringContaining("[stage]"));

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        mode: "executed",
        kind: "notification",
        message: "Inserted 1 persona_tasks rows for notification intake.",
        injectionPreview: {
          rpcName: "inject_persona_tasks",
          summary: {
            candidateCount: 2,
            insertedCount: 1,
            skippedCount: 1,
            insertedTaskIds: ["task-new-1"],
            skippedReasonCounts: { duplicate_candidate: 1 },
          },
          results: [],
        },
        insertedTasks: [
          {
            ...buildMockAiAgentOverviewSnapshot().recentTasks[0],
            id: "task-new-1",
            status: "PENDING",
            createdAt: "2026-03-30T00:00:00.000Z",
          },
        ],
      }),
      headers: new Headers({ "Content-Type": "application/json" }),
    });

    const injectNotificationButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.includes("Inject notification tasks"),
    );
    expect(injectNotificationButton).toBeDefined();

    await act(async () => {
      injectNotificationButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/ai/agent/intake/notification/inject",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({}),
      }),
    );
    expect(container.textContent).toContain(
      "Inserted 1 persona_tasks rows for notification intake.",
    );
    expect(container.textContent).toContain('"kind": "notification"');

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        mode: "executed",
        kind: "public",
        message: "Inserted 2 persona_tasks rows for public intake.",
        injectionPreview: {
          rpcName: "inject_persona_tasks",
          summary: {
            candidateCount: 2,
            insertedCount: 2,
            skippedCount: 0,
            insertedTaskIds: ["task-new-public-comment-1", "task-new-public-post-1"],
            skippedReasonCounts: {},
          },
          results: [],
        },
        insertedTasks: [
          {
            ...buildMockAiAgentOverviewSnapshot().recentTasks[0],
            id: "task-new-public-comment-1",
            sourceId: "comment-1",
            sourceTable: "comments",
            taskType: "comment",
            dispatchKind: "public",
            status: "PENDING",
            createdAt: "2026-03-30T00:01:00.000Z",
            payload: {
              contentType: "comment",
              source: "public-comment",
            },
          },
          {
            ...buildMockAiAgentOverviewSnapshot().recentTasks[1],
            id: "task-new-public-post-1",
            sourceId: "post-1",
            sourceTable: "posts",
            taskType: "post",
            dispatchKind: "public",
            status: "PENDING",
            createdAt: "2026-03-30T00:02:00.000Z",
            payload: {
              contentType: "post",
              source: "public-post",
            },
          },
        ],
      }),
      headers: new Headers({ "Content-Type": "application/json" }),
    });

    const injectPublicButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Inject public tasks"),
    );
    expect(injectPublicButton).toBeDefined();

    await act(async () => {
      injectPublicButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/ai/agent/intake/public/inject",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({}),
      }),
    );
    expect(container.textContent).toContain("Inserted 2 persona_tasks rows for public intake.");
    expect(container.textContent).toContain('"kind": "public"');

    const runButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Run"),
    );

    const runButtonAgain = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Run"),
    );
    await act(async () => {
      runButtonAgain?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).toContain("Request Phase A");
    expect(container.textContent).toContain("Selected Task Execution");
    expect(container.textContent).toContain("Execution Preview");
    expect(container.textContent).toContain("Run API Result");
    expect(container.textContent).toContain("Run Prompt Input");
    expect(container.textContent).toContain('"actionType": "comment"');
    expect(container.textContent).toContain("Run Write Plan");
    expect(container.textContent).toContain('"table": "comments"');
    expect(container.textContent).toContain("Task Memory Lineage");
    expect(container.textContent).toContain('"selectedTaskId": "task-new-public-comment-1"');
    expect(container.textContent).toContain("Operator Flow Trace");
    expect(container.textContent).toContain('"intakeCompleted": true');
    expect(container.textContent).toContain('"executionCompleted": false');

    const viewPromptButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("View Prompt"),
    );
    expect(viewPromptButton).toBeDefined();

    await act(async () => {
      viewPromptButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).toContain("Run Prompt Detail");
    expect(container.textContent).toContain("Assembled Prompt");
    expect(container.textContent).toContain("Model Payload");

    const copyPromptButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Copy Prompt"),
    );
    expect(copyPromptButton).toBeDefined();

    await act(async () => {
      copyPromptButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(clipboardWriteTextMock).toHaveBeenCalledWith(
      expect.stringContaining("[ai_agent_execution_preview]"),
    );

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        mode: "preview",
        target: "text_once",
        targetLabel: "Run next text task",
        available: true,
        blocker: null,
        selectedTaskId: "task-1",
        summary: "Shared execution preview is available for the selected text task.",
        executionPreview: null,
      }),
      headers: new Headers({ "Content-Type": "application/json" }),
    });

    const runPreviewButtons = Array.from(container.querySelectorAll("button")).filter(
      (button) => button.textContent === "Preview",
    );
    const textRunPreviewButton = runPreviewButtons[1];
    expect(textRunPreviewButton).toBeDefined();

    await act(async () => {
      textRunPreviewButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/ai/agent/run/text_once",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ mode: "preview", taskId: "task-new-public-comment-1" }),
      }),
    );

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        mode: "executed",
        target: "text_once",
        targetLabel: "Run next text task",
        selectedTaskId: "task-new-public-comment-1",
        summary:
          "Persisted comment comment-new-1 and completed queue task task-new-public-comment-1.",
        executionPreview: null,
        compressionResult: null,
        textResult: {
          taskId: "task-new-public-comment-1",
          persistedTable: "comments",
          persistedId: "comment-new-1",
          resultType: "comment",
          updatedTask: {
            ...buildMockAiAgentOverviewSnapshot().recentTasks[0],
            id: "task-new-public-comment-1",
            status: "DONE",
            resultId: "comment-new-1",
            resultType: "comment",
            completedAt: "2026-03-30T00:00:00.000Z",
          },
        },
      }),
      headers: new Headers({ "Content-Type": "application/json" }),
    });

    const runExecuteButtons = Array.from(container.querySelectorAll("button")).filter(
      (button) => button.textContent === "Execute",
    );
    const textRunExecuteButton = runExecuteButtons[1];
    expect(textRunExecuteButton).toBeDefined();

    await act(async () => {
      textRunExecuteButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/ai/agent/run/text_once",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ mode: "execute", taskId: "task-new-public-comment-1" }),
      }),
    );
    expect(container.textContent).toContain('"mode": "executed"');
    expect(container.textContent).toContain(
      "Persisted comment comment-new-1 and completed queue task task-new-public-comment-1.",
    );
    expect(container.textContent).toContain(
      '"latestWriteSelectedTaskId": "task-new-public-comment-1"',
    );
    expect(container.textContent).toContain('"latestWriteMatchesSelectedTask": true');
    expect(container.textContent).toContain("Task Memory Outcome Trace");
    expect(container.textContent).toContain(
      '"latestWriteCandidateTaskId": "task-new-public-comment-1"',
    );
    expect(container.textContent).toContain('"latestWritePersisted": false');
    expect(container.textContent).toContain('"target": "text_once"');
    expect(container.textContent).toContain('"executionCompleted": true');

    const memoryButtonLater = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Memory"),
    );

    await act(async () => {
      memoryButtonLater?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).toContain("Persona Memory");
    expect(container.textContent).toContain("Canonical Long Memory");
    expect(container.textContent).toContain("Compression Batch Preview");
    expect(container.textContent).toContain("Persist compression");

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        latestWritePreview: {
          path: "llm_post",
          summary: "Latest successful post would follow the staged LLM memory-write path.",
        },
      }),
      headers: new Headers({ "Content-Type": "application/json" }),
    });

    const latestWritePreviewButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.includes("Preview latest write"),
    );
    await act(async () => {
      latestWritePreviewButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/ai/agent/memory/personas/persona-1/latest-write-preview",
      expect.objectContaining({
        headers: expect.objectContaining({ "Content-Type": "application/json" }),
      }),
    );
    expect(container.textContent).toContain("Memory API Result");

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        result: {
          mode: "persisted",
          personaId: "persona-1",
          summary: "Persisted latest memory write for persona-1.",
          persistedMemoryId: "memory-write-42",
          latestWritePreview: buildMockMemoryPreviewSet().previews[0].latestWritePreview,
          verificationTrace: {
            persistedMemoryId: "memory-write-42",
            selectedTaskId: "task-1",
            persistedMemory: {
              id: "memory-write-42",
              content: "Thread memory for Orchid: comment result from comments:comment-1",
            },
          },
          preview: buildMockMemoryPreviewSet().previews[0],
        },
      }),
      headers: new Headers({ "Content-Type": "application/json" }),
    });

    const persistLatestWriteButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.includes("Persist latest write"),
    );
    expect(persistLatestWriteButton).toBeDefined();

    await act(async () => {
      persistLatestWriteButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).toContain("Memory Verification Trace");
    expect(container.textContent).toContain("memory-write-42");
    expect(container.textContent).toContain("task-1");
    expect(container.textContent).toContain("Task Memory Lineage");
    expect(container.textContent).toContain("Task Memory Outcome Trace");
    expect(container.textContent).toContain('"latestWriteMatchesSelectedTask": false');
    expect(container.textContent).toContain('"latestWritePersistedMemoryId": "memory-write-42"');
    expect(container.textContent).toContain('"latestWritePersisted": true');

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        result: {
          mode: "persisted",
          personaId: "persona-1",
          summary: "Persisted canonical long memory and removed 1 compressible short-memory rows.",
          persistedLongMemoryId: "long-memory-42",
          deletedShortMemoryIds: ["memory-board-1"],
          protectedShortMemoryIds: ["memory-thread-1"],
          verificationTrace: {
            persistedLongMemoryId: "long-memory-42",
            persistedLongMemory: {
              id: "long-memory-42",
              content: "# Canonical Memory for Orchid",
            },
            cleanup: {
              deletedShortMemoryIds: ["memory-board-1"],
              protectedShortMemoryIds: ["memory-thread-1"],
            },
          },
          preview: {
            ...buildMockMemoryPreviewSet().previews[0],
            persona: {
              ...buildMockMemoryPreviewSet().previews[0].persona,
              shortMemoryCount: 1,
            },
          },
        },
      }),
      headers: new Headers({ "Content-Type": "application/json" }),
    });

    const persistCompressionButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.includes("Persist compression"),
    );
    await act(async () => {
      persistCompressionButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/ai/agent/memory/personas/persona-1/compress",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({}),
      }),
    );
    expect(container.textContent).toContain("persisted");
    expect(container.textContent).toContain("Memory Verification Trace");
    expect(container.textContent).toContain("long-memory-42");
    expect(container.textContent).toContain("memory-thread-1");
    expect(container.textContent).toContain('"compressionPersistedLongMemoryId": "long-memory-42"');
    expect(container.textContent).toContain('"compressionPersisted": true');
    expect(container.textContent).toContain('"allStagesSharePersona": true');
    expect(container.textContent).toContain('"compressionPersisted": true');

    const personaSelect = container.querySelector("select") as HTMLSelectElement | null;
    expect(personaSelect).not.toBeNull();
    await act(async () => {
      personaSelect!.value = "persona-2";
      personaSelect!.dispatchEvent(new Event("change", { bubbles: true }));
    });

    expect(container.textContent).toContain("@ai_marlowe");
    expect(container.textContent).not.toContain(
      '"latestWritePersistedMemoryId": "memory-write-42"',
    );
    expect(container.textContent).not.toContain(
      '"compressionPersistedLongMemoryId": "long-memory-42"',
    );

    const logsButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Logs"),
    );

    await act(async () => {
      logsButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).toContain("Log Detail");
    expect(container.textContent).toContain("Media Jobs");
    expect(container.textContent).toContain("Apply filters");
    expect(container.textContent).toContain("cooldown_active");
    expect(container.textContent).toContain("Structured Diagnostics");
    expect(container.textContent).toContain("Selector Summary");
    expect(container.textContent).toContain("4 candidates / 4 accepted");
    expect(container.textContent).toContain("Worker Summary");
    expect(container.textContent).toContain("3 comments / 1 posts");
    expect(container.textContent).toContain("Parser Status");
    expect(container.textContent).toContain("repaired");
    expect(container.textContent).toContain("Repair Applied");
    expect(container.textContent).toContain("Yes (1)");
    expect(container.textContent).toContain("Parser Issues");
    expect(container.textContent).toContain("missing_image_alt");
    expect(container.textContent).toContain("Metadata JSON");

    const statusFilter = container.querySelector("select");
    expect(statusFilter).not.toBeNull();
    await act(async () => {
      statusFilter!.value = "FAILED";
      statusFilter!.dispatchEvent(new Event("change", { bubbles: true }));
    });

    const searchInput = container.querySelector(
      'input[placeholder="Search persona, owner, prompt"]',
    ) as HTMLInputElement | null;
    expect(searchInput).not.toBeNull();
    await act(async () => {
      searchInput!.value = "orchid";
      searchInput!.dispatchEvent(new Event("input", { bubbles: true }));
      searchInput!.dispatchEvent(new Event("change", { bubbles: true }));
    });

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        jobs: [
          {
            ...buildMockAiAgentOverviewSnapshot().recentMediaJobs[0],
            id: "media-fresh-1",
            status: "FAILED",
          },
        ],
        summary: { pending: 0, running: 0, done: 0, failed: 1, total: 1 },
        fetchedAt: "2026-03-30T01:00:00.000Z",
      }),
      headers: new Headers({ "Content-Type": "application/json" }),
    });

    const refreshMediaJobsButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Apply filters"),
    );

    await act(async () => {
      refreshMediaJobsButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/ai/agent/media/jobs?limit=12&status=FAILED&query=orchid",
      expect.objectContaining({
        headers: expect.objectContaining({ "Content-Type": "application/json" }),
      }),
    );
    expect(container.textContent).toContain("failed 1");
    expect(container.textContent).toContain("media-fresh-1");
    expect(container.textContent).toContain("limit 12");

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        jobs: [
          {
            ...buildMockAiAgentOverviewSnapshot().recentMediaJobs[0],
            id: "media-fresh-1",
            status: "FAILED",
          },
          {
            ...buildMockAiAgentOverviewSnapshot().recentMediaJobs[0],
            id: "media-fresh-2",
            status: "FAILED",
          },
        ],
        summary: { pending: 0, running: 0, done: 0, failed: 2, total: 2 },
        fetchedAt: "2026-03-30T01:02:00.000Z",
      }),
      headers: new Headers({ "Content-Type": "application/json" }),
    });

    const loadMoreButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Load more"),
    );
    await act(async () => {
      loadMoreButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/ai/agent/media/jobs?limit=24&status=FAILED&query=orchid",
      expect.objectContaining({
        headers: expect.objectContaining({ "Content-Type": "application/json" }),
      }),
    );
    expect(container.textContent).toContain("limit 24");
    expect(container.textContent).toContain("failed 2");

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        job: {
          ...buildMockAiAgentOverviewSnapshot().recentMediaJobs[0],
          id: "media-fresh-1",
          status: "FAILED",
        },
        owner: {
          ownerType: "post",
          ownerId: "post-1",
          postId: "post-1",
          boardSlug: "board",
          title: "Generated image post",
          bodyPreview: "A generated body preview.",
          status: "PUBLISHED",
          path: "/r/board/posts/post-1",
        },
        fetchedAt: "2026-03-30T01:05:00.000Z",
      }),
      headers: new Headers({ "Content-Type": "application/json" }),
    });

    const loadOwnerDetailButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Load owner detail"),
    );

    await act(async () => {
      loadOwnerDetailButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/ai/agent/media/jobs/media-fresh-1",
      expect.objectContaining({
        headers: expect.objectContaining({ "Content-Type": "application/json" }),
      }),
    );
    expect(container.textContent).toContain("Owner Detail");
    expect(container.textContent).toContain("Generated image post");
    expect(container.textContent).toContain("/r/board/posts/post-1");

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        mode: "preview",
        mediaId: "media-fresh-1",
        action: "retry_generation",
        actionPreview: {
          action: "retry_generation",
          enabled: true,
          reason:
            "Retry will regenerate the asset and overwrite the current media metadata on the selected row.",
          reasonCode: "RETRY_READY",
          statusTransition: { from: "FAILED", to: "DONE" },
          payload: {
            media_id: "media-fresh-1",
            owner_id: "post-1",
            owner_type: "post",
            image_prompt: "prompt",
          },
        },
        message:
          "Retry will regenerate the asset and overwrite the current media metadata on the selected row.",
      }),
      headers: new Headers({ "Content-Type": "application/json" }),
    });

    const previewRetryButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Preview retry"),
    );
    await act(async () => {
      previewRetryButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/ai/agent/media/jobs/media-fresh-1/actions",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ action: "retry_generation", mode: "preview" }),
      }),
    );
    expect(container.textContent).toContain("Media Action Result");
    expect(container.textContent).toContain("Reason code:");
    expect(container.textContent).toContain("RETRY_READY");

    const executeRetryButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Execute retry"),
    );

    fetchMock.mockResolvedValueOnce({
      ok: false,
      json: async () => ({
        error: "Retry is not allowed for completed media rows.",
        mode: "blocked_execute",
        mediaId: "media-fresh-1",
        action: "retry_generation",
        actionPreview: {
          action: "retry_generation",
          enabled: false,
          reason: "Retry is not allowed for completed media rows.",
          reasonCode: "DONE_ROW",
          statusTransition: { from: "DONE", to: "DONE" },
          payload: {
            media_id: "media-fresh-1",
            owner_id: "post-1",
            owner_type: "post",
            image_prompt: "prompt",
          },
        },
        message: "Retry is not allowed for completed media rows.",
      }),
      headers: new Headers({ "Content-Type": "application/json" }),
    });
    await act(async () => {
      executeRetryButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/ai/agent/media/jobs/media-fresh-1/actions",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ action: "retry_generation", mode: "execute" }),
      }),
    );
    expect(container.textContent).toContain("Retry is not allowed for completed media rows.");
    expect(container.textContent).toContain("DONE_ROW");

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        mode: "executed",
        mediaId: "media-fresh-1",
        action: "retry_generation",
        actionPreview: {
          action: "retry_generation",
          enabled: true,
          reason:
            "Retry will regenerate the asset and overwrite the current media metadata on the selected row.",
          reasonCode: "RETRY_READY",
          statusTransition: { from: "FAILED", to: "DONE" },
          payload: {
            media_id: "media-fresh-1",
            owner_id: "post-1",
            owner_type: "post",
            image_prompt: "prompt",
          },
        },
        updatedDetail: {
          job: {
            ...buildMockAiAgentOverviewSnapshot().recentMediaJobs[0],
            id: "media-fresh-1",
            status: "DONE",
            url: "https://cdn.test/fresh-done.png",
          },
          owner: {
            ownerType: "post",
            ownerId: "post-1",
            postId: "post-1",
            boardSlug: "board",
            title: "Generated image post",
            bodyPreview: "A generated body preview.",
            status: "PUBLISHED",
            path: "/r/board/posts/post-1",
          },
          fetchedAt: "2026-03-30T01:06:00.000Z",
        },
        message: "retry_generation executed against media.",
      }),
      headers: new Headers({ "Content-Type": "application/json" }),
    });
    await act(async () => {
      executeRetryButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(container.textContent).toContain("retry_generation executed against media.");
    expect(container.textContent).toContain("https://cdn.test/fresh-done.png");
    expect(container.textContent).toContain('"mode": "executed"');
  });

  it("updates overview runtime state details after a successful runtime control execute", async () => {
    const snapshot = buildMockAiAgentOverviewSnapshot();
    snapshot.runtimeState = {
      available: true,
      statusLabel: "Running",
      detail: "Runtime lease is healthy.",
      paused: false,
      leaseOwner: "orchestrator-1",
      leaseUntil: "2026-03-29T01:15:00.000Z",
      cooldownUntil: null,
      lastStartedAt: "2026-03-29T01:10:00.000Z",
      lastFinishedAt: "2026-03-29T01:11:00.000Z",
    };

    await act(async () => {
      root.render(
        React.createElement(AiAgentPanel, {
          initialSnapshot: snapshot,
          runtimePreviews: buildMockIntakeRuntimePreviews(),
          runtimeMemoryPreviews: buildMockMemoryPreviewSet(),
        }),
      );
    });

    expect(container.textContent).toContain("Runtime lease is healthy.");
    expect(container.textContent).toContain("Lease Owner");
    expect(container.textContent).toContain("orchestrator-1");

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        mode: "executed",
        action: "pause",
        actionLabel: "Pause runtime",
        summary: "Pause runtime executed against orchestrator runtime state.",
        runtimeState: {
          available: true,
          statusLabel: "Paused",
          detail: "Runtime paused by operator.",
          paused: true,
          leaseOwner: "operator-pause",
          leaseUntil: "2026-03-29T01:20:00.000Z",
          cooldownUntil: "2026-03-29T01:25:00.000Z",
          lastStartedAt: "2026-03-29T01:10:00.000Z",
          lastFinishedAt: "2026-03-29T01:11:00.000Z",
        },
      }),
      headers: new Headers({ "Content-Type": "application/json" }),
    });

    const pauseRuntimeButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Pause runtime"),
    );
    expect(pauseRuntimeButton).toBeDefined();

    await act(async () => {
      pauseRuntimeButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).toContain("Runtime paused by operator.");
    expect(container.textContent).toContain("operator-pause");
    expect(container.textContent).toContain("Cooldown Until");
    expect(container.textContent).toContain("Paused");
    expect(container.textContent).toContain("Yes");
    expect(container.textContent).toContain("Continuous Runtime Checkpoint");
  });

  it("disables runtime actions when paused or cooldown guards already block them", async () => {
    const snapshot = buildMockAiAgentOverviewSnapshot();
    snapshot.runtimeState = {
      available: true,
      statusLabel: "Paused",
      detail: "Runtime paused by operator.",
      paused: true,
      leaseOwner: "operator-pause",
      leaseUntil: "2026-03-29T01:20:00.000Z",
      cooldownUntil: "2026-03-29T01:25:00.000Z",
      lastStartedAt: "2026-03-29T01:10:00.000Z",
      lastFinishedAt: "2026-03-29T01:11:00.000Z",
    };

    await act(async () => {
      root.render(
        React.createElement(AiAgentPanel, {
          initialSnapshot: snapshot,
          runtimePreviews: buildMockIntakeRuntimePreviews(),
          runtimeMemoryPreviews: buildMockMemoryPreviewSet(),
        }),
      );
    });

    const pauseRuntimeButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Pause runtime"),
    );
    const resumeRuntimeButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Resume runtime"),
    );
    const forceRunCycleButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Run Phase A"),
    );

    expect(pauseRuntimeButton?.hasAttribute("disabled")).toBe(true);
    expect(resumeRuntimeButton?.hasAttribute("disabled")).toBe(false);
    expect(forceRunCycleButton?.hasAttribute("disabled")).toBe(true);
    expect(container.textContent).toContain("Runtime is already paused.");
    expect(container.textContent).toContain("Runtime is paused; resume before running Phase A.");
  });

  it("shows memory lineage in the run tab and syncs runner compression results", async () => {
    await act(async () => {
      root.render(
        React.createElement(AiAgentPanel, {
          initialSnapshot: buildMockAiAgentOverviewSnapshot(),
          runtimePreviews: buildMockIntakeRuntimePreviews(),
          runtimeMemoryPreviews: buildMockMemoryPreviewSet(),
        }),
      );
    });

    const runButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Run"),
    );
    expect(runButton).toBeDefined();

    await act(async () => {
      runButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).toContain("Task Memory Lineage");
    expect(container.textContent).toContain('"selectedTaskId": "task-1"');
    expect(container.textContent).toContain('"compressionPersistedLongMemoryId": null');
    expect(container.textContent).toContain("Run Memory Verification");

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        mode: "executed",
        target: "compress_once",
        targetLabel: "Run next compression batch",
        selectedTaskId: null,
        summary: "Persisted compression for persona-1 and removed 1 short-memory rows.",
        executionPreview: null,
        compressionResult: {
          mode: "persisted",
          personaId: "persona-1",
          summary: "Persisted canonical long memory and removed 1 compressible short-memory rows.",
          compressionPreview: buildMockMemoryPreviewSet().previews[0].compressionPreview,
          persistedLongMemoryId: "long-memory-run-1",
          deletedShortMemoryIds: ["memory-board-1"],
          protectedShortMemoryIds: ["memory-thread-1"],
          verificationTrace: {
            persistedLongMemoryId: "long-memory-run-1",
            persistedLongMemory: {
              id: "long-memory-run-1",
              content: "# Canonical Memory for Orchid",
            },
            cleanup: {
              deletedShortMemoryIds: ["memory-board-1"],
              protectedShortMemoryIds: ["memory-thread-1"],
            },
          },
          preview: {
            ...buildMockMemoryPreviewSet().previews[0],
            persona: {
              ...buildMockMemoryPreviewSet().previews[0].persona,
              shortMemoryCount: 1,
            },
          },
        },
        textResult: null,
        mediaResult: null,
        orchestratorResult: null,
      }),
      headers: new Headers({ "Content-Type": "application/json" }),
    });

    const runExecuteButtons = Array.from(container.querySelectorAll("button")).filter(
      (button) => button.textContent === "Execute",
    );
    const compressExecuteButton = runExecuteButtons[3];
    expect(compressExecuteButton).toBeDefined();

    await act(async () => {
      compressExecuteButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/ai/agent/run/compress_once",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ mode: "execute", taskId: null }),
      }),
    );
    expect(container.textContent).toContain(
      "Persisted compression for persona-1 and removed 1 short-memory rows.",
    );
    expect(container.textContent).toContain(
      '"compressionPersistedLongMemoryId": "long-memory-run-1"',
    );
    expect(container.textContent).toContain("Memory Verification Trace");
    expect(container.textContent).toContain('"persistedLongMemoryId": "long-memory-run-1"');
    expect(container.textContent).toContain("Run Compression Result");
  });

  it("syncs orchestrator-injected tasks back into the task table after runner execute", async () => {
    await act(async () => {
      root.render(
        React.createElement(AiAgentPanel, {
          initialSnapshot: buildMockAiAgentOverviewSnapshot(),
          runtimePreviews: buildMockIntakeRuntimePreviews(),
          runtimeMemoryPreviews: buildMockMemoryPreviewSet(),
        }),
      );
    });

    const runButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Run"),
    );

    await act(async () => {
      runButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        mode: "executed",
        target: "orchestrator_once",
        targetLabel: "Request Phase A",
        selectedTaskId: null,
        summary: "Manual Phase A request accepted. Runtime app will execute it next.",
        executionPreview: null,
        compressionResult: null,
        textResult: null,
        mediaResult: null,
        orchestratorResult: {
          runtimeState: {
            available: true,
            statusLabel: "Manual Phase A Pending",
            detail: "Manual Phase A request is pending from admin-user.",
            paused: false,
            publicCandidateGroupIndex: 0,
            publicCandidateEpoch: 0,
            leaseOwner: null,
            leaseUntil: null,
            cooldownUntil: "2026-03-30T02:05:00.000Z",
            runtimeAppSeenAt: "2026-03-30T02:00:00.000Z",
            runtimeAppOnline: true,
            manualPhaseARequestPending: true,
            manualPhaseARequestedAt: "2026-03-30T02:00:00.000Z",
            manualPhaseARequestedBy: "admin-user",
            manualPhaseARequestId: "manual-request-1",
            manualPhaseAStartedAt: null,
            manualPhaseAFinishedAt: null,
            manualPhaseAError: null,
            lastStartedAt: "2026-03-30T01:55:00.000Z",
            lastFinishedAt: "2026-03-30T02:00:00.000Z",
          },
        },
      }),
      headers: new Headers({ "Content-Type": "application/json" }),
    });

    const runExecuteButtons = Array.from(container.querySelectorAll("button")).filter(
      (button) => button.textContent === "Execute",
    );
    const orchestratorExecuteButton = runExecuteButtons[0];
    expect(orchestratorExecuteButton).toBeDefined();

    await act(async () => {
      orchestratorExecuteButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/ai/agent/run/orchestrator_once",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ mode: "execute", taskId: null }),
      }),
    );
    expect(container.textContent).toContain(
      "Manual Phase A request accepted. Runtime app will execute it next.",
    );
    expect(container.textContent).toContain('"manualPhaseARequestPending": true');
  });

  it("surfaces structured log diagnostics for executed and skipped runs", async () => {
    await act(async () => {
      root.render(
        React.createElement(AiAgentPanel, {
          initialSnapshot: buildMockAiAgentOverviewSnapshot(),
          runtimePreviews: buildMockIntakeRuntimePreviews(),
          runtimeMemoryPreviews: buildMockMemoryPreviewSet(),
        }),
      );
    });

    const logsButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Logs"),
    );
    expect(logsButton).toBeDefined();

    await act(async () => {
      logsButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).toContain("Structured Diagnostics");
    expect(container.textContent).toContain("4 candidates / 4 accepted");
    expect(container.textContent).toContain("3 comments / 1 posts");
    expect(container.textContent).toContain("missing_image_alt");

    const runRows = Array.from(container.querySelectorAll("tbody tr"));
    const skippedRunRow = runRows.find((row) => row.textContent?.includes("cooldown_active"));
    expect(skippedRunRow).toBeDefined();

    await act(async () => {
      skippedRunRow?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).toContain("Skip Reason");
    expect(container.textContent).toContain("cooldown_active");
    expect(container.textContent).toContain("Selector Summary");
    expect(container.textContent).toContain("n/a");
    expect(container.textContent).toContain("Parser Status");
    expect(container.textContent).toContain("Metadata JSON");
    expect(container.textContent).toContain("cooldownMinutesRemaining");
  });

  it("shows a ready continuous-runtime checkpoint when runtime, walkthrough, memory, and logs are all green", async () => {
    const snapshot = buildMockAiAgentOverviewSnapshot();
    snapshot.runtimeState = {
      available: true,
      statusLabel: "Running",
      detail: "Runtime lease is healthy.",
      paused: false,
      leaseOwner: "orchestrator-1",
      leaseUntil: "2026-03-29T01:15:00.000Z",
      cooldownUntil: null,
      lastStartedAt: "2026-03-29T01:10:00.000Z",
      lastFinishedAt: "2026-03-29T01:11:00.000Z",
    };
    snapshot.queue.running = 0;
    snapshot.queue.failed = 0;
    snapshot.queue.inReview = 0;

    await act(async () => {
      root.render(
        React.createElement(AiAgentPanel, {
          initialSnapshot: snapshot,
          runtimePreviews: buildMockIntakeRuntimePreviews(),
          runtimeMemoryPreviews: buildMockMemoryPreviewSet(),
        }),
      );
    });

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        mode: "executed",
        kind: "public",
        message: "Inserted 1 persona_tasks rows for public intake.",
        injectionPreview: {
          rpcName: "inject_persona_tasks",
          summary: {
            candidateCount: 1,
            insertedCount: 1,
            skippedCount: 0,
            insertedTaskIds: ["task-green-1"],
            skippedReasonCounts: {},
          },
          results: [],
        },
        insertedTasks: [
          {
            ...buildMockAiAgentOverviewSnapshot().recentTasks[0],
            id: "task-green-1",
            status: "PENDING",
            sourceId: "comment-1",
            sourceTable: "comments",
          },
        ],
      }),
      headers: new Headers({ "Content-Type": "application/json" }),
    });

    const intakeButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Intake"),
    );
    await act(async () => {
      intakeButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const injectPublicButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Inject public tasks"),
    );
    await act(async () => {
      injectPublicButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const runButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Run"),
    );
    await act(async () => {
      runButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const memoryButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Memory"),
    );
    await act(async () => {
      memoryButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        result: {
          mode: "persisted",
          personaId: "persona-1",
          summary: "Persisted latest memory write for persona-1.",
          persistedMemoryId: "memory-write-green-1",
          latestWritePreview: buildMockMemoryPreviewSet().previews[0].latestWritePreview,
          verificationTrace: {
            persistedMemoryId: "memory-write-green-1",
            selectedTaskId: "task-green-1",
            persistedMemory: {
              id: "memory-write-green-1",
              content: "Thread memory for Orchid: comment result from comments:comment-1",
            },
          },
          preview: buildMockMemoryPreviewSet().previews[0],
        },
      }),
      headers: new Headers({ "Content-Type": "application/json" }),
    });

    const persistLatestWriteButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.includes("Persist latest write"),
    );
    await act(async () => {
      persistLatestWriteButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await act(async () => {
      runButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const runExecuteButtons = Array.from(container.querySelectorAll("button")).filter(
      (button) => button.textContent === "Execute",
    );
    const compressExecuteButton = runExecuteButtons[3];

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        mode: "executed",
        target: "compress_once",
        targetLabel: "Run next compression batch",
        selectedTaskId: "task-green-1",
        summary: "Persisted compression for persona-1 and removed 1 short-memory rows.",
        executionPreview: null,
        compressionResult: {
          mode: "persisted",
          personaId: "persona-1",
          summary: "Persisted canonical long memory and removed 1 compressible short-memory rows.",
          compressionPreview: buildMockMemoryPreviewSet().previews[0].compressionPreview,
          persistedLongMemoryId: "long-memory-green-1",
          deletedShortMemoryIds: ["memory-board-1"],
          protectedShortMemoryIds: ["memory-thread-1"],
          verificationTrace: {
            persistedLongMemoryId: "long-memory-green-1",
            persistedLongMemory: {
              id: "long-memory-green-1",
              content: "# Canonical Memory for Orchid",
            },
            cleanup: {
              deletedShortMemoryIds: ["memory-board-1"],
              protectedShortMemoryIds: ["memory-thread-1"],
            },
          },
          preview: buildMockMemoryPreviewSet().previews[0],
        },
        textResult: {
          taskId: "task-green-1",
          persistedTable: "comments",
          persistedId: "comment-green-1",
          resultType: "comment",
          updatedTask: {
            ...buildMockAiAgentOverviewSnapshot().recentTasks[0],
            id: "task-green-1",
            status: "DONE",
            resultId: "comment-green-1",
            resultType: "comment",
            completedAt: "2026-03-30T02:10:00.000Z",
          },
        },
        mediaResult: null,
        orchestratorResult: null,
      }),
      headers: new Headers({ "Content-Type": "application/json" }),
    });

    await act(async () => {
      compressExecuteButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const overviewButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Overview"),
    );
    await act(async () => {
      overviewButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).toContain("Continuous Runtime Checkpoint");
    expect(container.textContent).toContain("Ready For Continuous Runtime");
    expect(container.textContent).toContain("runtime readiness");
    expect(container.textContent).toContain("operator walkthrough");
    expect(container.textContent).toContain("memory persistence");
    expect(container.textContent).toContain("logs diagnostics");
    expect(container.textContent).toContain("PM Walkthrough Checklist");
    expect(container.textContent).toContain("Walkthrough Ready For PM Sign-Off");
    expect(container.textContent).toContain("PM Acceptance Summary");
    expect(container.textContent).toContain("Ready For PM Acceptance Pass");
    expect(container.textContent).toContain(
      "No remaining operator-evidence blockers are currently visible.",
    );
    expect(container.textContent).toContain("Overview");
    expect(container.textContent).toContain("Intake");
    expect(container.textContent).toContain("Tasks");
    expect(container.textContent).toContain("Run");
    expect(container.textContent).toContain("Memory");
    expect(container.textContent).toContain("Logs");
  });
});
