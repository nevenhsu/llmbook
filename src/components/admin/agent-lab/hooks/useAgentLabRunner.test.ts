/** @vitest-environment jsdom */

import React from "react";
import ReactDOMClient from "react-dom/client";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAgentLabRunner } from "./useAgentLabRunner";
import type { AgentLabPageProps } from "../types";

vi.mock("react-hot-toast", () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function buildProps(): AgentLabPageProps {
  return {
    dataSource: "runtime",
    sourceModeOptions: [{ value: "public", label: "Public" }],
    initialSourceMode: "public",
    models: [
      {
        id: "model-1",
        providerId: "openai",
        modelKey: "gpt-4.1",
        displayName: "Model 1",
        capability: "text_generation",
        status: "active",
        testStatus: "success",
        lifecycleStatus: "active",
        displayOrder: 1,
        lastErrorKind: null,
        lastErrorCode: null,
        lastErrorMessage: null,
        lastErrorAt: null,
        supportsInput: true,
        supportsImageInputPrompt: false,
        supportsOutput: true,
        contextWindow: 128000,
        maxOutputTokens: 4096,
        metadata: {},
        updatedAt: "2026-04-28T00:00:00.000Z",
      },
    ],
    providers: [
      {
        id: "openai",
        providerKey: "openai",
        displayName: "OpenAI",
        sdkPackage: "@ai-sdk/openai",
        status: "active",
        testStatus: "success",
        keyLast4: "test",
        hasKey: true,
        lastApiErrorCode: null,
        lastApiErrorMessage: null,
        lastApiErrorAt: null,
        createdAt: "2026-04-28T00:00:00.000Z",
        updatedAt: "2026-04-28T00:00:00.000Z",
      },
    ],
    initialModelId: "model-1",
    initialModes: {
      public: {
        personaGroup: {
          totalReferenceCount: 10,
          batchSize: 10,
          groupIndex: 0,
          maxGroupIndex: 0,
        },
        opportunities: [
          {
            recordId: "opp-1",
            opportunityKey: "O01",
            source: "public-post",
            link: null,
            content: "Board: Creative Lab | Recent post title: Example",
            createdAt: null,
            probability: 0.8,
            selected: true,
            errorMessage: null,
          },
        ],
        selectorStage: {
          status: "success",
          prompt: "selector prompt",
          inputData: null,
          outputData: null,
          rows: [
            {
              recordId: "opp-1",
              opportunityKey: "O01",
              source: "public-post",
              link: null,
              content: "Board: Creative Lab | Recent post title: Example",
              createdAt: null,
              probability: 0.8,
              selected: true,
              errorMessage: null,
            },
          ],
        },
        candidateStage: {
          status: "idle",
          prompt: "candidate prompt",
          inputData: null,
          outputData: null,
          rows: [],
        },
        taskStage: {
          rows: [],
          summary: {
            attempted: 0,
            succeeded: 0,
            failed: 0,
          },
          toastMessage: null,
        },
      },
      notification: {
        personaGroup: {
          totalReferenceCount: 0,
          batchSize: 10,
          groupIndex: 0,
          maxGroupIndex: 0,
        },
        opportunities: [],
        selectorStage: {
          status: "idle",
          prompt: null,
          inputData: null,
          outputData: null,
          rows: [],
        },
        candidateStage: {
          status: "auto-routed",
          prompt: null,
          inputData: null,
          outputData: null,
          rows: [],
        },
        taskStage: {
          rows: [],
          summary: {
            attempted: 0,
            succeeded: 0,
            failed: 0,
          },
          toastMessage: null,
        },
      },
    },
    onRunSelector: async () => {
      throw new Error("unused");
    },
    onRunCandidate: async ({ onProgress }) => {
      const partial = {
        candidateStage: {
          status: "success" as const,
          prompt: "candidate prompt",
          inputData: null,
          outputData: { speaker_candidates: [] },
          rows: [
            {
              opportunityKey: "O01",
              referenceName: "David Bowie",
              persona: {
                id: "persona-1",
                displayName: "Marlowe",
                username: "ai_marlowe",
                avatarUrl: null,
                href: "/u/ai_marlowe",
                status: "active" as const,
              },
              errorMessage: null,
            },
          ],
        },
        taskRows: [
          {
            taskId: "task-1",
            candidateIndex: 0,
            opportunityKey: "O01",
            persona: {
              id: "persona-1",
              displayName: "Marlowe",
              username: "ai_marlowe",
              avatarUrl: null,
              href: "/u/ai_marlowe",
              status: "active" as const,
            },
            taskType: "post" as const,
            status: "PENDING",
            saveState: "success" as const,
            errorMessage: null,
            saveResult: {
              candidateIndex: 0,
              inserted: true,
              skipReason: null,
              taskId: "task-1",
            },
            data: {},
            candidate: null,
            actions: {
              canSave: false,
            },
          },
        ],
      };

      onProgress?.(partial);
      await new Promise((resolve) => setTimeout(resolve, 20));
      return partial;
    },
    onSavePersonaGroup: async () => {
      throw new Error("unused");
    },
    onSaveTask: async () => ({
      inserted: true,
      skipReason: null,
      taskId: "task-1",
      errorMessage: null,
      status: "PENDING",
    }),
  };
}

function Harness({ props }: { props: AgentLabPageProps }) {
  const runner = useAgentLabRunner(props);

  return React.createElement(
    "div",
    null,
    React.createElement(
      "button",
      { type: "button", onClick: () => void runner.runSelector() },
      "Run Selector",
    ),
    React.createElement(
      "button",
      { type: "button", onClick: () => void runner.runCandidate() },
      "Run Candidate",
    ),
    React.createElement(
      "div",
      { "data-testid": "opportunity-probability" },
      runner.modeState.opportunities[0]?.probability ?? "none",
    ),
    React.createElement(
      "div",
      { "data-testid": "candidate-count" },
      runner.modeState.candidateStage.rows.length,
    ),
    React.createElement(
      "div",
      { "data-testid": "task-count" },
      runner.modeState.taskStage.rows.length,
    ),
    React.createElement(
      "div",
      { "data-testid": "task-save-state" },
      runner.modeState.taskStage.rows[0]?.saveState ?? "none",
    ),
  );
}

describe("useAgentLabRunner", () => {
  let container: HTMLDivElement;
  let root: ReactDOMClient.Root;

  beforeEach(() => {
    vi.useFakeTimers();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = ReactDOMClient.createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.useRealTimers();
  });

  it("applies candidate progress updates before the final run resolves", async () => {
    const props = buildProps();

    await act(async () => {
      root.render(React.createElement(Harness, { props }));
    });

    const runButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "Run Candidate",
    );
    const candidateCount = () =>
      container.querySelector('[data-testid="candidate-count"]')?.textContent;
    const taskCount = () => container.querySelector('[data-testid="task-count"]')?.textContent;
    const taskSaveState = () =>
      container.querySelector('[data-testid="task-save-state"]')?.textContent;

    expect(candidateCount()).toBe("0");
    expect(taskCount()).toBe("0");
    expect(taskSaveState()).toBe("none");

    await act(async () => {
      runButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(candidateCount()).toBe("1");
    expect(taskCount()).toBe("1");
    expect(taskSaveState()).toBe("success");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(25);
    });

    expect(candidateCount()).toBe("1");
    expect(taskCount()).toBe("1");
    expect(taskSaveState()).toBe("success");
  });

  it("applies selector progress updates before the final run resolves", async () => {
    const props = buildProps();
    props.initialModes.public.opportunities = [
      {
        recordId: "opp-1",
        opportunityKey: "O01",
        source: "public-post",
        link: null,
        content: "Board: Creative Lab | Recent post title: Example",
        createdAt: null,
        probability: null,
        selected: false,
        errorMessage: null,
      },
    ];
    props.initialModes.public.selectorStage = {
      status: "idle",
      prompt: "selector prompt",
      inputData: null,
      outputData: null,
      rows: props.initialModes.public.opportunities,
    };
    props.onRunSelector = async ({ onProgress }) => {
      const partial = {
        status: "success" as const,
        prompt: "selector prompt",
        inputData: null,
        outputData: { scores: [{ opportunity_key: "O01", probability: 0.72 }] },
        rows: [
          {
            recordId: "opp-1",
            opportunityKey: "O01",
            source: "public-post" as const,
            link: null,
            content: "Board: Creative Lab | Recent post title: Example",
            createdAt: null,
            probability: 0.72,
            selected: true,
            errorMessage: null,
          },
        ],
      };
      onProgress?.(partial);
      await new Promise((resolve) => setTimeout(resolve, 20));
      return partial;
    };

    await act(async () => {
      root.render(React.createElement(Harness, { props }));
    });

    const runButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "Run Selector",
    );
    const probability = () =>
      container.querySelector('[data-testid="opportunity-probability"]')?.textContent;

    expect(probability()).toBe("none");

    await act(async () => {
      runButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(probability()).toBe("0.72");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(25);
    });

    expect(probability()).toBe("0.72");
  });
});
