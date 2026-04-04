/** @vitest-environment jsdom */

import { act } from "react";
import React from "react";
import ReactDOMClient from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  AiModelConfig,
  AiProviderConfig,
  PersonaSummary,
} from "@/lib/ai/admin/control-plane-contract";
import type { AiAgentRuntimeSourceSnapshot } from "@/lib/ai/agent/intake/intake-read-model";
import { AdminAiAgentLabClient } from "./AdminAiAgentLabClient";

const apiPostMock = vi.fn();

vi.mock("@/lib/api/fetch-json", () => ({
  apiPost: (...args: unknown[]) => apiPostMock(...args),
}));

vi.mock("react-hot-toast", () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("AdminAiAgentLabClient", () => {
  let container: HTMLDivElement;
  let root: ReactDOMClient.Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = ReactDOMClient.createRoot(container);
    apiPostMock.mockReset();
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("keeps notification candidates/tasks empty before run and appends only batch results after opportunities run", async () => {
    const notificationSnapshot = {
      kind: "notification",
      statusLabel: "ready",
      sourceNames: ["notifications"],
      items: [
        {
          source: "notification",
          contentType: "mention",
          summary: "Unread mention asking a persona to clarify the last thread.",
          sourceId: "notification-1",
          createdAt: "2026-04-04T10:00:00.000Z",
          metadata: {
            opportunityId: "opp-notification-1",
            recipientPersonaId: "persona-orchid",
            postId: "post-1",
            commentId: "comment-1",
            boardSlug: "creative-lab",
            context: "comment",
            notificationType: "mention",
          },
        },
      ],
      selectorInput: {
        fixtureMode: "notification-intake",
        groupIndexOverride: 0,
        selectorReferenceBatchSize: 10,
        referenceWindow: {
          batchSize: 10,
          groupIndex: 0,
        },
        opportunities: [
          {
            opportunityKey: "N01",
            source: "notification",
            contentType: "mention",
            summary: "Unread mention asking a persona to clarify the last thread.",
          },
        ],
        opportunityLookup: [
          {
            opportunityKey: "N01",
            source: "notification",
            contentType: "mention",
            summary: "Unread mention asking a persona to clarify the last thread.",
            sourceTable: "notifications",
            sourceId: "notification-1",
            metadata: {
              opportunityId: "opp-notification-1",
              recipientPersonaId: "persona-orchid",
              postId: "post-1",
              commentId: "comment-1",
              boardSlug: "creative-lab",
              context: "comment",
              notificationType: "mention",
            },
          },
        ],
      },
    } satisfies AiAgentRuntimeSourceSnapshot;

    const models = [
      { id: "model-1", providerId: "openai", label: "Model 1" },
    ] as unknown as AiModelConfig[];
    const providers = [{ id: "openai", label: "OpenAI" }] as unknown as AiProviderConfig[];
    const personas = [
      {
        id: "persona-orchid",
        username: "ai_orchid",
        display_name: "Orchid",
        avatar_url: null,
        status: "active",
      },
    ] as unknown as PersonaSummary[];

    apiPostMock.mockImplementation(async (url: string) => {
      if (url === "/api/admin/ai/agent/lab/source-mode/notification") {
        return { snapshot: notificationSnapshot };
      }
      if (url === "/api/admin/ai/agent/lab/opportunities/notification") {
        return {
          opportunityResults: [
            {
              opportunityId: "opp-notification-1",
              probability: 0.92,
              selected: true,
            },
          ],
          notificationAutoRoute: {
            taskResponse: {
              kind: "notification",
              insertedTasks: [],
              skippedTasks: [],
              taskOutcomes: [],
            },
            taskOutcomes: [
              {
                opportunityId: "opp-notification-1",
                personaId: "persona-orchid",
                inserted: true,
                taskId: "task-1",
                skipReason: null,
                status: "PENDING",
                errorMessage: null,
              },
            ],
          },
        };
      }
      throw new Error(`Unexpected url: ${url}`);
    });

    await act(async () => {
      root.render(
        React.createElement(AdminAiAgentLabClient, {
          runtimePreviews: {
            public: null,
            notification: notificationSnapshot,
          },
          models,
          providers,
          personas,
          selectorReferenceBatchSize: 10,
        }),
      );
    });

    const sourceModeSelect = container.querySelectorAll("select")[1];
    await act(async () => {
      if (sourceModeSelect instanceof HTMLSelectElement) {
        sourceModeSelect.value = "notification";
        sourceModeSelect.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });

    const tables = () => Array.from(container.querySelectorAll("table"));
    expect(tables()[1]?.textContent).toContain("No candidate rows yet.");
    expect(tables()[2]?.textContent).toContain("No task rows yet.");

    const runButtons = () =>
      Array.from(container.querySelectorAll("button")).filter(
        (button) => button.textContent?.trim() === "Run",
      );

    await act(async () => {
      runButtons()[0]?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
    });

    expect(tables()[1]?.textContent).toContain("Direct recipient");
    expect(tables()[1]?.textContent).toContain("Orchid");
    expect(tables()[2]?.textContent).toContain("Orchid");
    expect(tables()[2]?.textContent).toContain("Saved");
  });
});
