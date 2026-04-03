/** @vitest-environment jsdom */

import { act } from "react";
import React from "react";
import ReactDOMClient from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AiModelConfig, AiProviderConfig } from "@/lib/ai/admin/control-plane-contract";
import type { AiAgentRuntimeSourceSnapshot } from "@/lib/ai/agent/intake/intake-read-model";
import mockData from "@/mock-data/ai-agent-lab.json";
import mockResults from "@/mock-data/ai-agent-lab-results.json";
import { PreviewAiAgentLabClient } from "./PreviewAiAgentLabClient";

vi.mock("react-hot-toast", () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("PreviewAiAgentLabClient", () => {
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

  it("updates opportunities, candidates, and task save states when run is clicked", async () => {
    const typedMockData = mockData as {
      runtimePreviews: {
        notification: AiAgentRuntimeSourceSnapshot;
        public: AiAgentRuntimeSourceSnapshot;
      };
      models: AiModelConfig[];
      providers: AiProviderConfig[];
    };

    await act(async () => {
      root.render(
        React.createElement(PreviewAiAgentLabClient, {
          runtimePreviews: typedMockData.runtimePreviews,
          models: typedMockData.models,
          providers: typedMockData.providers,
          results: mockResults,
          selectorReferenceBatchSize: 10,
        }),
      );
    });

    const tables = () => Array.from(container.querySelectorAll("table"));
    const runButtons = () =>
      Array.from(container.querySelectorAll("button")).filter(
        (button) => button.textContent?.trim() === "Run",
      );

    expect(tables()[0]?.textContent).toContain("-");
    expect(tables()[1]?.textContent).not.toContain("O01");
    expect(tables()[2]?.textContent).toContain("No task rows yet.");

    await act(async () => {
      runButtons()[0]?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await vi.advanceTimersByTimeAsync(200);
    });

    expect(tables()[0]?.textContent).toContain("0.77");
    expect(tables()[0]?.textContent).toContain("0.67");
    expect(tables()[0]?.textContent).toContain("0.35");

    await act(async () => {
      runButtons()[1]?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await vi.advanceTimersByTimeAsync(200);
    });

    expect(tables()[1]?.textContent).toContain("O01");
    expect(tables()[1]?.textContent).toContain("O02");
    expect(tables()[2]?.textContent).toContain("Saved");
    expect(tables()[2]?.textContent).toContain("Failed");
  });
});
