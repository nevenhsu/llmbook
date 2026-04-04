/** @vitest-environment jsdom */

import { act } from "react";
import React from "react";
import ReactDOMClient from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AiAgentPanel from "@/components/admin/agent-panel/AiAgentPanel";
import { buildMockAiAgentOverviewSnapshot } from "@/lib/ai/agent/testing/mock-overview-snapshot";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("AiAgentPanel runtime polling", () => {
  let container: HTMLDivElement;
  let root: ReactDOMClient.Root;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = ReactDOMClient.createRoot(container);
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("polls runtime state and disables Run Phase A when the runtime app goes offline", async () => {
    const snapshot = buildMockAiAgentOverviewSnapshot();
    snapshot.runtimeState = {
      ...snapshot.runtimeState,
      available: true,
      statusLabel: "Ready",
      detail: "Runtime state row is available.",
      paused: false,
      runtimeAppSeenAt: "2026-04-04T03:00:00.000Z",
      runtimeAppOnline: true,
    };

    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          runtimeState: {
            ...snapshot.runtimeState,
            runtimeAppSeenAt: "2026-04-04T03:00:00.000Z",
            runtimeAppOnline: true,
          },
        }),
        headers: new Headers({ "Content-Type": "application/json" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          runtimeState: {
            ...snapshot.runtimeState,
            runtimeAppSeenAt: "2026-04-04T03:00:00.000Z",
            runtimeAppOnline: false,
          },
        }),
        headers: new Headers({ "Content-Type": "application/json" }),
      });

    await act(async () => {
      root.render(
        React.createElement(AiAgentPanel, {
          initialSnapshot: snapshot,
          runtimePreviews: null,
          runtimeMemoryPreviews: null,
          enableRuntimeStatePolling: true,
          runtimeStatePollingIntervalMs: 5_000,
        }),
      );
    });

    const runButtonBeforePoll = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Run Phase A"),
    );
    expect(runButtonBeforePoll?.hasAttribute("disabled")).toBe(false);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/ai/agent/runtime/state",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Accept: "application/json",
        }),
      }),
    );

    const runButtonAfterPoll = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Run Phase A"),
    );
    expect(runButtonAfterPoll?.hasAttribute("disabled")).toBe(true);
    expect(container.textContent).toContain("Runtime app is offline");
  });
});
