/** @vitest-environment jsdom */

import { act } from "react";
import React from "react";
import ReactDOMClient from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AiAgentOperatorConsole from "@/components/admin/agent-panel/AiAgentOperatorConsole";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("AiAgentOperatorConsole", () => {
  let container: HTMLDivElement;
  let root: ReactDOMClient.Root;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = ReactDOMClient.createRoot(container);
    fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();

      if (url === "/api/admin/ai/agent/panel/runtime") {
        return {
          ok: true,
          json: async () => ({
            mainRuntime: {
              available: true,
              statusLabel: "Ready",
              detail: "Runtime is ready.",
              paused: true,
              publicCandidateGroupIndex: null,
              publicCandidateEpoch: null,
              leaseOwner: null,
              leaseUntil: null,
              cooldownUntil: null,
              runtimeAppSeenAt: "2026-04-08T12:00:00.000Z",
              runtimeAppOnline: true,
              manualPhaseARequestPending: false,
              manualPhaseARequestedAt: null,
              manualPhaseARequestedBy: null,
              manualPhaseARequestId: null,
              manualPhaseAStartedAt: null,
              manualPhaseAFinishedAt: null,
              manualPhaseAError: null,
              lastStartedAt: null,
              lastFinishedAt: null,
            },
            jobsRuntime: {
              runtimeKey: "global",
              paused: false,
              leaseOwner: null,
              leaseUntil: null,
              runtimeAppSeenAt: "2026-04-08T12:00:00.000Z",
              lastStartedAt: null,
              lastFinishedAt: null,
              updatedAt: "2026-04-08T12:00:00.000Z",
              statusLabel: "Idle",
              detail: "Jobs runtime is idle.",
            },
            summary: {
              queueTasksAll: 12,
              publicTasks: 7,
              notificationTasks: 5,
              imageQueue: 3,
              jobsQueue: 2,
            },
            fetchedAt: "2026-04-08T12:00:00.000Z",
          }),
          headers: new Headers({ "Content-Type": "application/json" }),
        };
      }

      if (url.startsWith("/api/admin/ai/agent/panel/jobs?")) {
        return {
          ok: true,
          json: async () => ({
            runtimeState: {
              runtimeKey: "global",
              paused: false,
              leaseOwner: null,
              leaseUntil: null,
              runtimeAppSeenAt: "2026-04-08T12:00:00.000Z",
              lastStartedAt: null,
              lastFinishedAt: null,
              updatedAt: "2026-04-08T12:00:00.000Z",
              statusLabel: "Idle",
              detail: "Jobs runtime is idle.",
            },
            summary: { active: 1, terminal: 1, total: 2 },
            page: 1,
            pageSize: 10,
            totalItems: 2,
            totalPages: 1,
            fetchedAt: "2026-04-08T12:00:00.000Z",
            rows: [
              {
                id: "job-1",
                jobType: "public_task",
                subjectId: "task-1",
                status: "RUNNING",
                target: {
                  kind: "task",
                  label: "/r/board/posts/post-1",
                  href: "/r/board/posts/post-1",
                },
                finishedAt: null,
                createdAt: "2026-04-08T12:00:00.000Z",
                errorMessage: null,
                canClone: false,
                canRetry: false,
              },
              {
                id: "job-2",
                jobType: "notification_task",
                subjectId: "task-2",
                status: "FAILED",
                target: {
                  kind: "task",
                  label: "/r/board/posts/post-2",
                  href: "/r/board/posts/post-2",
                },
                finishedAt: "2026-04-08T11:50:00.000Z",
                createdAt: "2026-04-08T11:45:00.000Z",
                errorMessage: "provider timeout",
                canClone: true,
                canRetry: true,
              },
            ],
          }),
          headers: new Headers({ "Content-Type": "application/json" }),
        };
      }

      if (url.startsWith("/api/admin/ai/agent/panel/tasks/public?")) {
        return {
          ok: true,
          json: async () => ({
            kind: "public",
            summary: { active: 0, terminal: 1, total: 1 },
            page: 1,
            pageSize: 10,
            totalItems: 1,
            totalPages: 1,
            fetchedAt: "2026-04-08T12:00:00.000Z",
            rows: [
              {
                id: "task-1",
                persona: { id: "persona-1", username: "ai_orchid", displayName: "Orchid" },
                taskType: "comment",
                dispatchKind: "public",
                status: "DONE",
                target: {
                  href: "/r/board/posts/post-1#comment-comment-1",
                  label: "/r/board/posts/post-1#comment-comment-1",
                },
                scheduledAt: "2026-04-08T11:00:00.000Z",
                completedAt: "2026-04-08T11:05:00.000Z",
                createdAt: "2026-04-08T10:55:00.000Z",
                canRedo: true,
              },
            ],
          }),
          headers: new Headers({ "Content-Type": "application/json" }),
        };
      }

      if (url.startsWith("/api/admin/ai/agent/panel/memory?")) {
        return {
          ok: true,
          json: async () => ({
            summary: { total: 1 },
            page: 1,
            pageSize: 10,
            totalItems: 1,
            totalPages: 1,
            fetchedAt: "2026-04-08T12:00:00.000Z",
            rows: [
              {
                persona: { id: "persona-1", username: "ai_orchid", displayName: "Orchid" },
                longMemoryPresent: true,
                shortMemoryCount: 4,
                latestMemoryUpdatedAt: "2026-04-08T11:30:00.000Z",
                lastCompressedAt: null,
                priorityScore: 7,
              },
            ],
          }),
          headers: new Headers({ "Content-Type": "application/json" }),
        };
      }

      if (url === "/api/admin/ai/agent/panel/jobs" && init?.method === "POST") {
        const body = init?.body ? JSON.parse(String(init.body)) : null;
        return {
          ok: true,
          json: async () => ({
            mode: body?.action === "retry" ? "retried" : "enqueued",
            task: {
              id:
                body?.action === "retry" ? body?.jobId : body?.jobId ? "job-cloned" : "job-created",
              status: "PENDING",
            },
          }),
          headers: new Headers({ "Content-Type": "application/json" }),
        };
      }

      if (url === "/api/admin/ai/agent/panel/jobs/runtime/pause") {
        return {
          ok: true,
          json: async () => ({
            mode: "executed",
            summary: "Pause will stop new job claims after the current job finishes.",
            runtimeState: {
              runtimeKey: "global",
              paused: true,
              leaseOwner: null,
              leaseUntil: null,
              runtimeAppSeenAt: "2026-04-08T12:00:00.000Z",
              lastStartedAt: null,
              lastFinishedAt: null,
              updatedAt: "2026-04-08T12:01:00.000Z",
              statusLabel: "Paused",
              detail: "Jobs runtime is paused.",
            },
          }),
          headers: new Headers({ "Content-Type": "application/json" }),
        };
      }

      throw new Error(`Unhandled fetch: ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.unstubAllGlobals();
  });

  it("loads client tab data and enqueues shared jobs from Public and Memory", async () => {
    await act(async () => {
      root.render(React.createElement(AiAgentOperatorConsole));
    });

    expect(container.textContent).toContain("AI Agent Operator Console");
    expect(container.textContent).toContain("Queue Tasks");
    expect(container.textContent).toContain("12");
    expect(container.textContent).toContain("Start");
    const imageTab = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.trim() === "Image",
    );
    expect(imageTab).toBeUndefined();

    const jobsTab = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Jobs"),
    );
    await act(async () => {
      jobsTab?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).toContain("/r/board/posts/post-1");
    expect(container.textContent).toContain("RUNNING");
    expect(container.textContent).toContain("provider timeout");
    expect(container.textContent).toContain("-");
    expect(container.textContent).not.toContain("Finished");

    const failedStatusMeta = container.querySelector('[data-testid="job-status-meta-job-2"]');
    expect(failedStatusMeta?.className).toContain("text-error");

    const failedErrorCell = container.querySelector('[data-testid="job-error-job-2"]');
    expect(failedErrorCell?.className).toContain("text-error");

    const jobsPauseButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.trim() === "Pause",
    );
    await act(async () => {
      jobsPauseButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/ai/agent/panel/jobs/runtime/pause",
      expect.objectContaining({ method: "POST" }),
    );

    const cloneButtons = Array.from(container.querySelectorAll("button")).filter(
      (button) => button.textContent?.trim() === "Clone",
    );
    expect(cloneButtons).toHaveLength(2);
    expect(cloneButtons[0]?.hasAttribute("disabled")).toBe(true);
    expect(cloneButtons[1]?.hasAttribute("disabled")).toBe(false);

    await act(async () => {
      cloneButtons[1]?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/ai/agent/panel/jobs",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ jobId: "job-2", action: "clone" }),
      }),
    );

    const retryButtons = Array.from(container.querySelectorAll("button")).filter(
      (button) => button.textContent?.trim() === "Retry",
    );
    expect(retryButtons).toHaveLength(2);
    expect(retryButtons[0]?.hasAttribute("disabled")).toBe(true);
    expect(retryButtons[1]?.hasAttribute("disabled")).toBe(false);

    await act(async () => {
      retryButtons[1]?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/ai/agent/panel/jobs",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ jobId: "job-2", action: "retry" }),
      }),
    );

    const publicTab = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Public"),
    );
    await act(async () => {
      publicTab?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).toContain("Orchid");

    const redoButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.trim() === "Redo",
    );
    await act(async () => {
      redoButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/ai/agent/panel/jobs",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ jobType: "public_task", subjectId: "task-1" }),
      }),
    );

    const memoryTab = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Memory"),
    );
    await act(async () => {
      memoryTab?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const runButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.trim() === "Run",
    );
    await act(async () => {
      runButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/ai/agent/panel/jobs",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ jobType: "memory_compress", subjectId: "persona-1" }),
      }),
    );
  });
});
