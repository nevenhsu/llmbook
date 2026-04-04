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

    act(() => {
      runButtons()[0]?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });
    await act(async () => {
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

  it("keeps at least one failed task row after candidate run so resave UI can be previewed", async () => {
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

    const runButtons = () =>
      Array.from(container.querySelectorAll("button")).filter(
        (button) => button.textContent?.trim() === "Run",
      );

    await act(async () => {
      runButtons()[0]?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await vi.advanceTimersByTimeAsync(200);
    });

    await act(async () => {
      runButtons()[1]?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await vi.advanceTimersByTimeAsync(200);
    });

    const tables = () => Array.from(container.querySelectorAll("table"));
    expect(tables()[2]?.textContent).toContain("Failed");
  });

  it("shows loading UI across all three tables when mock state is loading", async () => {
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

    const loadingButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.trim() === "Loading",
    );

    await act(async () => {
      loadingButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const allText = container.textContent ?? "";
    expect(allText).toContain("Loading rows...");
    expect(container.querySelectorAll(".skeleton").length).toBeGreaterThan(0);
  });

  it("keeps notification candidates and tasks empty before opportunities are run", async () => {
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
  });

  it("preserves source mode when mock state changes", async () => {
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

    const sourceModeSelect = container.querySelectorAll("select")[1];
    await act(async () => {
      if (sourceModeSelect instanceof HTMLSelectElement) {
        sourceModeSelect.value = "notification";
        sourceModeSelect.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });

    const runningButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.trim() === "Running",
    );
    await act(async () => {
      runningButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const updatedSourceModeSelect = container.querySelectorAll("select")[1];
    expect(updatedSourceModeSelect).toBeInstanceOf(HTMLSelectElement);
    expect((updatedSourceModeSelect as HTMLSelectElement).value).toBe("notification");
  });

  it("shows run-time loading UI while a run is in progress", async () => {
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

    const runButtons = () =>
      Array.from(container.querySelectorAll("button")).filter(
        (button) => button.textContent?.trim() === "Run",
      );

    act(() => {
      runButtons()[0]?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.querySelectorAll(".skeleton").length).toBeGreaterThan(0);
    expect(container.textContent ?? "").toContain("Running...");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });

    expect(container.textContent ?? "").not.toContain("Running...");
  });

  it("fills notification candidates and tasks after opportunities run", async () => {
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

    const sourceModeSelect = container.querySelectorAll("select")[1];
    await act(async () => {
      if (sourceModeSelect instanceof HTMLSelectElement) {
        sourceModeSelect.value = "notification";
        sourceModeSelect.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });

    const runButtons = () =>
      Array.from(container.querySelectorAll("button")).filter(
        (button) => button.textContent?.trim() === "Run",
      );

    await act(async () => {
      runButtons()[0]?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await vi.advanceTimersByTimeAsync(200);
    });

    const text = container.textContent ?? "";
    expect(text).toContain("N01");
    expect(text).toContain("Direct recipient");
    expect(text).toContain("Orchid");
  });

  it("keeps public candidate reference/persona cells visible during first candidate run", async () => {
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

    const runButtons = () =>
      Array.from(container.querySelectorAll("button")).filter(
        (button) => button.textContent?.trim() === "Run",
      );

    await act(async () => {
      runButtons()[0]?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await vi.advanceTimersByTimeAsync(200);
    });

    act(() => {
      runButtons()[1]?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const text = container.textContent ?? "";
    expect(text).toContain("David Bowie");
    expect(text).toContain("Marlowe");
    expect(text).toContain("Bjork");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });
  });

  it("shows a distinct running mock state with visible row data plus partial skeletons", async () => {
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

    const runningButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.trim() === "Running",
    );

    await act(async () => {
      runningButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const text = container.textContent ?? "";
    expect(text).toContain("Best prompting workflows this week");
    expect(text).toContain("David Bowie");
    expect(text).toContain("Marlowe");
    expect(text).toContain("Bjork");
    expect(container.querySelectorAll(".skeleton").length).toBeGreaterThan(0);
  });

  it("keeps notification candidate data static and only shows task saving UI in running mock state", async () => {
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

    const sourceModeSelect = container.querySelectorAll("select")[1];
    await act(async () => {
      if (sourceModeSelect instanceof HTMLSelectElement) {
        sourceModeSelect.value = "notification";
        sourceModeSelect.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });

    const runningButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.trim() === "Running",
    );

    await act(async () => {
      runningButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const text = container.textContent ?? "";
    expect(text).toContain("Direct recipient");
    expect(text).toContain("Orchid");
    expect(text).toContain("Saving");
    expect(text).not.toContain("No candidate rows yet.");
    expect(text).not.toContain("No task rows yet.");
  });
});
