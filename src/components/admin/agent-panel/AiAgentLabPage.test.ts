/** @vitest-environment jsdom */

import { act } from "react";
import React from "react";
import ReactDOMClient from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AiModelConfig, AiProviderConfig } from "@/lib/ai/admin/control-plane-contract";
import AiAgentLabPage from "@/components/admin/agent-panel/AiAgentLabPage";

vi.mock("react-hot-toast", () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const providers: AiProviderConfig[] = [
  {
    id: "provider-openai",
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
    createdAt: "2026-03-31T00:00:00.000Z",
    updatedAt: "2026-03-31T00:00:00.000Z",
  },
];

const models: AiModelConfig[] = [
  {
    id: "model-gpt-5-4",
    providerId: "provider-openai",
    modelKey: "gpt-5.4",
    displayName: "GPT-5.4",
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
    maxOutputTokens: 8192,
    metadata: {},
    updatedAt: "2026-03-31T00:00:00.000Z",
  },
];

function buildProps(overrides?: {
  onSaveTask?: (input: { rowIndex: number }) => Promise<{
    inserted: boolean;
    skipReason: string | null;
    taskId: string | null;
    errorMessage: string | null;
    status: string;
  }>;
}) {
  return {
    dataSource: "mock" as const,
    sourceModeOptions: [
      { value: "public" as const, label: "Public Preview" },
      { value: "notification" as const, label: "Notification Preview" },
    ],
    initialSourceMode: "public" as const,
    models,
    providers,
    initialModelId: models[0].id,
    initialModes: {
      public: {
        personaGroup: {
          totalReferenceCount: 10,
          batchSize: 5,
          groupIndex: 0,
          maxGroupIndex: 1,
        },
        opportunities: [
          {
            opportunityKey: "public-1",
            source: "public-post",
            link: "/posts/public-1",
            content: "Public post",
            createdAt: "2026-03-31T10:00:00.000Z",
          },
        ],
        selectorStage: {
          status: "success" as const,
          prompt: "selector prompt",
          inputData: { items: [] },
          outputData: { selectedOpportunityKeys: ["public-1"] },
          rows: [
            {
              opportunityKey: "public-1",
              source: "public-post",
              link: "/posts/public-1",
              content: "Public post",
              reason: "Reason",
              errorMessage: null,
            },
          ],
        },
        candidateStage: {
          status: "success" as const,
          prompt: "candidate prompt",
          inputData: { items: [] },
          outputData: { candidates: [] },
          selectedReferences: [],
          rows: [
            {
              opportunityKey: "public-1",
              referenceName: "Orchid Reference",
              targetPersona: {
                id: "persona-orchid",
                displayName: "Orchid",
                href: "/personas/persona-orchid",
              },
              dispatchKind: "public" as const,
              reason: "Reason",
              dedupeKey: "dedupe-1",
              errorMessage: null,
            },
          ],
        },
        taskStage: {
          summary: {
            attempted: 0,
            succeeded: 0,
            failed: 0,
          },
          toastMessage: null,
          rows: [
            {
              taskId: "task-saved",
              candidateIndex: 0,
              opportunityKey: "public-1",
              persona: {
                id: "persona-orchid",
                displayName: "Orchid",
                href: "/personas/persona-orchid",
              },
              taskType: "comment" as const,
              status: "PENDING",
              saveState: "success" as const,
              errorMessage: null,
              saveResult: {
                candidateIndex: 0,
                inserted: true,
                skipReason: null,
                taskId: "task-saved",
              },
              actions: {
                canSave: false,
              },
              candidate: {
                candidateIndex: 0,
                opportunityKey: "public-1",
                personaId: "persona-orchid",
                username: "ai_orchid",
                dispatchKind: "public" as const,
                sourceTable: "posts" as const,
                sourceId: "post-1",
                dedupeKey: "dedupe-1",
                cooldownUntil: "2026-03-31T12:00:00.000Z",
                decisionReason: "Reason",
                payload: {
                  contentType: "comment",
                  source: "public-post",
                  summary: "Public post",
                  fixtureMode: "mixed-public-opportunity",
                },
              },
              data: {},
            },
            {
              taskId: null,
              candidateIndex: 1,
              opportunityKey: "public-1",
              persona: {
                id: "persona-marlowe",
                displayName: "Marlowe",
                href: "/personas/persona-marlowe",
              },
              taskType: "comment" as const,
              status: "PENDING",
              saveState: "idle" as const,
              errorMessage: null,
              saveResult: null,
              actions: {
                canSave: true,
              },
              candidate: {
                candidateIndex: 1,
                opportunityKey: "public-1",
                personaId: "persona-marlowe",
                username: "ai_marlowe",
                dispatchKind: "public" as const,
                sourceTable: "posts" as const,
                sourceId: "post-1",
                dedupeKey: "dedupe-2",
                cooldownUntil: "2026-03-31T12:00:00.000Z",
                decisionReason: "Reason",
                payload: {
                  contentType: "comment",
                  source: "public-post",
                  summary: "Public post",
                  fixtureMode: "mixed-public-opportunity",
                },
              },
              data: {},
            },
            {
              taskId: null,
              candidateIndex: 2,
              opportunityKey: "public-1",
              persona: {
                id: "persona-vesper",
                displayName: "Vesper",
                href: "/personas/persona-vesper",
              },
              taskType: "comment" as const,
              status: "PENDING",
              saveState: "failed" as const,
              errorMessage: "cooldown_active",
              saveResult: {
                candidateIndex: 2,
                inserted: false,
                skipReason: "cooldown_active",
                taskId: null,
              },
              actions: {
                canSave: true,
              },
              candidate: {
                candidateIndex: 2,
                opportunityKey: "public-1",
                personaId: "persona-vesper",
                username: "ai_vesper",
                dispatchKind: "public" as const,
                sourceTable: "posts" as const,
                sourceId: "post-1",
                dedupeKey: "dedupe-3",
                cooldownUntil: "2026-03-31T12:00:00.000Z",
                decisionReason: "Reason",
                payload: {
                  contentType: "comment",
                  source: "public-post",
                  summary: "Public post",
                  fixtureMode: "mixed-public-opportunity",
                },
              },
              data: {},
            },
          ],
        },
      },
      notification: {
        personaGroup: {
          totalReferenceCount: 10,
          batchSize: 5,
          groupIndex: 0,
          maxGroupIndex: 1,
        },
        opportunities: [],
        selectorStage: {
          status: "idle" as const,
          prompt: null,
          inputData: null,
          outputData: null,
          rows: [],
        },
        candidateStage: {
          status: "auto-routed" as const,
          prompt: null,
          inputData: null,
          outputData: null,
          selectedReferences: [],
          rows: [],
        },
        taskStage: {
          summary: {
            attempted: 0,
            succeeded: 0,
            failed: 0,
          },
          toastMessage: null,
          rows: [],
        },
      },
    },
    onRunSelector: vi.fn(),
    onRunCandidate: vi.fn(),
    onSaveTask:
      overrides?.onSaveTask ??
      vi.fn(async ({ rowIndex }: { rowIndex: number }) => ({
        inserted: rowIndex === 1,
        skipReason: rowIndex === 2 ? "cooldown_active" : null,
        taskId: rowIndex === 1 ? "task-new" : null,
        errorMessage: rowIndex === 2 ? "cooldown_active" : null,
        status: "PENDING",
      })),
  } satisfies React.ComponentProps<typeof AiAgentLabPage>;
}

describe("AiAgentLabPage", () => {
  let container: HTMLDivElement;
  let root: ReactDOMClient.Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = ReactDOMClient.createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("renders the model selector in preview and disables row save for saved rows", async () => {
    await act(async () => {
      root.render(React.createElement(AiAgentLabPage, buildProps()));
    });

    expect(container.textContent).toContain("AI Agent Lab");
    expect(container.textContent).toContain("GPT-5.4");
    expect(container.textContent).toContain("Save All");

    const buttons = Array.from(container.querySelectorAll("button"));
    const savedRowButton = buttons.find((button) => button.textContent?.trim() === "Saved");
    const idleRowButton = buttons.find((button) => button.textContent?.trim() === "Save");

    expect(savedRowButton).toBeDefined();
    expect(savedRowButton).toHaveProperty("disabled", true);
    expect(idleRowButton).toBeDefined();
    expect(idleRowButton).toHaveProperty("disabled", false);
  });

  it("save all skips saved rows and continues after row failures", async () => {
    const onSaveTask = vi.fn(async ({ rowIndex }: { rowIndex: number }) => {
      if (rowIndex === 1) {
        return {
          inserted: true,
          skipReason: null,
          taskId: "task-new",
          errorMessage: null,
          status: "PENDING",
        };
      }

      return {
        inserted: false,
        skipReason: "cooldown_active",
        taskId: null,
        errorMessage: "cooldown_active",
        status: "PENDING",
      };
    });

    await act(async () => {
      root.render(React.createElement(AiAgentLabPage, buildProps({ onSaveTask })));
    });

    const saveAllButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Save All"),
    );

    await act(async () => {
      saveAllButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onSaveTask.mock.calls.map((call) => call[0].rowIndex)).toEqual([1, 2]);
    expect(container.textContent).toContain("success");
    expect(container.textContent).toContain("failed");
    expect(container.textContent).toContain("cooldown_active");
  });
});
