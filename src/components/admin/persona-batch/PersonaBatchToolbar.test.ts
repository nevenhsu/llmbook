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

  it("renders a single-row reference header with title on the left and add on the right", async () => {
    await act(async () => {
      root.render(
        React.createElement(PersonaBatchToolbar, {
          modelId: "model-1",
          models,
          disableInputs: false,
          onModelChange: vi.fn(),
          onOpenReferenceModal: vi.fn(),
        }),
      );
    });

    const addButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.trim() === "Add",
    );
    expect(addButton).toBeDefined();
    expect(addButton?.className).toContain("shrink-0");
    expect(addButton?.className).toContain("btn-sm");

    const referenceHeader = container.querySelector('[data-testid="reference-sources-header"]');
    expect(referenceHeader?.textContent).toContain("Reference Sources");
    expect(referenceHeader?.className).toContain("justify-between");
    expect(container.querySelector("textarea")).toBeNull();
  });

  it("renders the short reference label without inline textarea helper UI", async () => {
    await act(async () => {
      root.render(
        React.createElement(PersonaBatchToolbar, {
          modelId: "model-1",
          models,
          disableInputs: false,
          onModelChange: vi.fn(),
          onOpenReferenceModal: vi.fn(),
        }),
      );
    });

    expect(container.textContent).toContain("Reference Sources");
    expect(container.textContent).not.toContain("comma or newline separated");
    expect(container.querySelector("textarea")).toBeNull();
  });
});
