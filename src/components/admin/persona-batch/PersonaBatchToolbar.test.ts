/** @vitest-environment jsdom */

import { act } from "react";
import React from "react";
import ReactDOMClient from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AiModelConfig } from "@/lib/ai/admin/control-plane-contract";
import { PersonaBatchToolbar } from "./PersonaBatchToolbar";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const models: AiModelConfig[] = [
  {
    id: "model-1",
    providerId: "provider-1",
    modelKey: "grok-4-1-fast-reasoning",
    displayName: "Grok 4.1 Fast Reasoning",
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
    updatedAt: "2026-03-22T00:00:00.000Z",
  },
];

describe("PersonaBatchToolbar", () => {
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

  it("keeps the add result on the far left and groups elapsed time with the add button on the right", async () => {
    await act(async () => {
      root.render(
        React.createElement(PersonaBatchToolbar, {
          modelId: "model-1",
          models,
          referenceInput: "Anthony Bourdain",
          disableInputs: false,
          addLoading: false,
          addLastCompletedAddedCount: null,
          addLastCompletedDuplicateCount: null,
          onModelChange: vi.fn(),
          onReferenceInputChange: vi.fn(),
          onAdd: vi.fn(),
        }),
      );
    });

    const addButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.trim() === "Add",
    );
    expect(addButton).toBeDefined();
    expect(addButton?.className).toContain("shrink-0");

    const actionContainer = addButton?.parentElement;
    expect(actionContainer?.className).toContain("ml-auto");
    expect(actionContainer?.className).toContain("items-center");

    const wrapper = actionContainer?.parentElement?.parentElement;
    expect(wrapper?.className).toContain("xl:col-span-3");
  });

  it("renders a short reference label with helper text below the input", async () => {
    await act(async () => {
      root.render(
        React.createElement(PersonaBatchToolbar, {
          modelId: "model-1",
          models,
          referenceInput: "",
          disableInputs: false,
          addLoading: false,
          addLastCompletedAddedCount: null,
          addLastCompletedDuplicateCount: null,
          onModelChange: vi.fn(),
          onReferenceInputChange: vi.fn(),
          onAdd: vi.fn(),
        }),
      );
    });

    expect(container.textContent).toContain("Reference Sources");
    expect(container.textContent).toContain(
      "comma or newline separated, ex: Anthony Bourdain, Hayao Miyazaki, Ursula K. Le Guin",
    );
    expect(container.textContent).not.toContain("Reference Sources (comma or newline separated)");

    const textarea = container.querySelector("textarea");
    expect(textarea?.getAttribute("placeholder")).toBe("");
  });

  it("shows add elapsed time inline with the add button while running and after completion", async () => {
    await act(async () => {
      root.render(
        React.createElement(PersonaBatchToolbar, {
          modelId: "model-1",
          models,
          referenceInput: "Anthony Bourdain",
          disableInputs: false,
          addLoading: true,
          addElapsedSeconds: 7,
          addLastCompletedElapsedSeconds: null,
          addLastCompletedAddedCount: null,
          addLastCompletedDuplicateCount: null,
          onModelChange: vi.fn(),
          onReferenceInputChange: vi.fn(),
          onAdd: vi.fn(),
        }),
      );
    });

    const status = container.querySelector('[data-testid="reference-input-add-status"]');
    const statusSummary = container.querySelector(
      '[data-testid="reference-input-add-status-summary"]',
    );
    const statusElapsed = container.querySelector(
      '[data-testid="reference-input-add-status-elapsed"]',
    );
    expect(status).not.toBeNull();
    expect(statusSummary?.textContent).toBe("Adding");
    expect(statusElapsed?.textContent).toBe("00:07");

    const outerRow = status?.parentElement;
    expect(outerRow?.className).toContain("justify-between");

    const actionContainer = addButtonFrom(container)?.parentElement;
    expect(actionContainer?.className).toContain("ml-auto");
    expect(actionContainer?.textContent).toContain("00:07");
    expect(actionContainer?.textContent).toContain("Add");

    await act(async () => {
      root.render(
        React.createElement(PersonaBatchToolbar, {
          modelId: "model-1",
          models,
          referenceInput: "",
          disableInputs: false,
          addLoading: false,
          addElapsedSeconds: 0,
          addLastCompletedElapsedSeconds: 7,
          addLastCompletedAddedCount: 2,
          addLastCompletedDuplicateCount: 1,
          onModelChange: vi.fn(),
          onReferenceInputChange: vi.fn(),
          onAdd: vi.fn(),
        }),
      );
    });

    const completedSummary = container.querySelector(
      '[data-testid="reference-input-add-status-summary"]',
    );
    const completedElapsed = container.querySelector(
      '[data-testid="reference-input-add-status-elapsed"]',
    );
    expect(completedSummary?.textContent).toBe("Added 2 rows, 1 duplicate");
    expect(completedElapsed?.textContent).toBe("00:07");
  });
});

function addButtonFrom(container: HTMLDivElement): HTMLButtonElement | undefined {
  return Array.from(container.querySelectorAll("button")).find(
    (button) => button.textContent?.trim() === "Add",
  ) as HTMLButtonElement | undefined;
}
