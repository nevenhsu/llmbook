/** @vitest-environment jsdom */

import { act } from "react";
import React from "react";
import ReactDOMClient from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProvidersModelsSection } from "./ProvidersModelsSection";
import type { AiModelConfig, AiProviderConfig } from "@/lib/ai/admin/control-plane-store";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@dnd-kit/core", () => ({
  DndContext: ({ children }: { children: React.ReactNode }) =>
    React.createElement("div", null, children),
  PointerSensor: vi.fn(),
  closestCenter: vi.fn(),
  useSensor: vi.fn(() => ({})),
  useSensors: vi.fn(() => []),
}));

vi.mock("@dnd-kit/sortable", () => ({
  SortableContext: ({ children }: { children: React.ReactNode }) =>
    React.createElement("div", null, children),
  arrayMove: (items: string[], from: number, to: number) => {
    const next = [...items];
    const [item] = next.splice(from, 1);
    if (item !== undefined) {
      next.splice(to, 0, item);
    }
    return next;
  },
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: undefined,
    isDragging: false,
  }),
  verticalListSortingStrategy: {},
}));

vi.mock("@dnd-kit/utilities", () => ({
  CSS: {
    Transform: {
      toString: () => undefined,
    },
  },
}));

vi.mock("../SectionCard", () => ({
  SectionCard: ({ title, children }: { title: string; children: React.ReactNode }) =>
    React.createElement("section", null, React.createElement("h2", null, title), children),
}));

function buildProvider(overrides: Partial<AiProviderConfig> = {}): AiProviderConfig {
  return {
    id: "provider-1",
    providerKey: "deepseek",
    displayName: "DeepSeek",
    sdkPackage: "@ai-sdk/deepseek",
    status: "active",
    testStatus: "success",
    keyLast4: "1234",
    hasKey: true,
    lastApiErrorCode: null,
    lastApiErrorMessage: null,
    lastApiErrorAt: null,
    createdAt: "2026-04-30T00:00:00.000Z",
    updatedAt: "2026-04-30T00:00:00.000Z",
    ...overrides,
  };
}

function buildModel(overrides: Partial<AiModelConfig> = {}): AiModelConfig {
  return {
    id: "model-1",
    providerId: "provider-1",
    modelKey: "deepseek-v4-flash",
    displayName: "DeepSeek-V4-Flash",
    capability: "text_generation",
    status: "active",
    testStatus: "failed",
    lifecycleStatus: "active",
    displayOrder: 1,
    lastErrorKind: "provider_api",
    lastErrorCode: "bad_request",
    lastErrorMessage: "active model error",
    lastErrorAt: "2026-04-30T00:00:00.000Z",
    supportsInput: true,
    supportsImageInputPrompt: false,
    supportsOutput: true,
    contextWindow: null,
    maxOutputTokens: null,
    metadata: {},
    updatedAt: "2026-04-30T00:00:00.000Z",
    ...overrides,
  };
}

describe("ProvidersModelsSection", () => {
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

  it("shows model errors only for active models", async () => {
    await act(async () => {
      root.render(
        React.createElement(ProvidersModelsSection, {
          providers: [
            buildProvider(),
            buildProvider({
              id: "provider-2",
              providerKey: "minimax",
              displayName: "Minimax",
              sdkPackage: "vercel-minimax-ai-provider",
            }),
          ],
          models: [
            buildModel(),
            buildModel({
              id: "model-2",
              providerId: "provider-2",
              modelKey: "MiniMax-M2.5",
              displayName: "MiniMax M2.5",
              status: "disabled",
              lastErrorMessage: "inactive model error",
              displayOrder: 2,
            }),
          ],
          modelTestImageLinks: {},
          createSupportedProvider: vi.fn(),
          reorderModels: vi.fn(),
          runModelTest: vi.fn(),
          setModelActive: vi.fn(),
          setProviderActive: vi.fn(),
        }),
      );
    });

    expect(container.textContent).toContain("Model Errors");
    expect(container.textContent).toContain("active model error");
    expect(container.textContent).not.toContain("inactive model error");
  });
});
