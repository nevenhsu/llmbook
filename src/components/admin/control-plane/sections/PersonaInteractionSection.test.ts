/** @vitest-environment jsdom */

import { act } from "react";
import React from "react";
import ReactDOMClient from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defaultInteractionTaskContext } from "../control-plane-utils";
import { PersonaInteractionSection } from "./PersonaInteractionSection";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/components/ui/PersonaSelector", () => ({
  default: ({ value, onChange }: { value: string; onChange: (personaId: string) => void }) =>
    React.createElement("input", {
      value,
      onInput: (event: Event) => onChange((event.target as HTMLInputElement | null)?.value ?? ""),
      placeholder: "Search persona...",
    }),
}));

vi.mock("@/components/ui/Avatar", () => ({
  default: ({ src }: { src?: string }) =>
    React.createElement("img", { src: src ?? "", alt: "avatar" }),
}));

vi.mock("../SectionCard", () => ({
  SectionCard: ({ title, children }: { title: string; children: React.ReactNode }) =>
    React.createElement("section", null, React.createElement("h2", null, title), children),
}));

vi.mock("../InteractionPreviewModal", () => ({
  InteractionPreviewModal: ({
    isOpen,
    selectedPersona,
  }: {
    isOpen: boolean;
    selectedPersona: { display_name: string } | null;
  }) =>
    isOpen
      ? React.createElement(
          "div",
          null,
          "Interaction Preview Modal",
          selectedPersona?.display_name ?? "",
        )
      : null,
}));

describe("PersonaInteractionSection", () => {
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

  it("shows selected persona references and task-context AI affordance", async () => {
    const runInteractionPreview = vi.fn().mockResolvedValue(undefined);
    const closeInteractionPreviewModal = vi.fn();
    const assistInteractionTaskContext = vi.fn().mockResolvedValue(undefined);
    const setInteractionInput = vi.fn();

    await act(async () => {
      root.render(
        React.createElement(PersonaInteractionSection, {
          interactionInput: {
            personaId: "persona-1",
            modelId: "model-1",
            taskType: "comment",
            taskContext: "",
          },
          setInteractionInput,
          personas: [
            {
              id: "persona-1",
              username: "ai_jax_harlan",
              display_name: "Jax Harlan",
              avatar_url: "https://example.com/jax.png",
            },
          ],
          textModels: [
            {
              id: "model-1",
              providerId: "provider-1",
              modelKey: "test-model",
              displayName: "Test Model",
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
              contextWindow: null,
              maxOutputTokens: null,
              metadata: {},
              updatedAt: "2026-03-16T00:00:00.000Z",
            },
          ],
          providers: [
            {
              id: "provider-1",
              providerKey: "minimax",
              displayName: "MiniMax",
              sdkPackage: "@ai-sdk/minimax",
              status: "active",
              testStatus: "success",
              keyLast4: "1234",
              hasKey: true,
              lastApiErrorCode: null,
              lastApiErrorMessage: null,
              lastApiErrorAt: null,
              createdAt: "2026-03-16T00:00:00.000Z",
              updatedAt: "2026-03-16T00:00:00.000Z",
            },
          ],
          interactionPreview: null,
          interactionPreviewModalOpen: false,
          interactionPreviewModalPhase: "idle",
          interactionPreviewModalError: null,
          interactionPreviewElapsedSeconds: 0,
          selectedPersona: {
            id: "persona-1",
            username: "ai_jax_harlan",
            display_name: "Jax Harlan",
            avatar_url: "https://example.com/jax.png",
          },
          selectedPersonaProfile: {
            persona: {
              id: "persona-1",
              username: "ai_jax_harlan",
              display_name: "Jax Harlan",
              bio: "Sharp critic",
              status: "active",
            },
            personaCore: {
              reference_sources: [
                { name: "John Grisham", type: "author" },
                { name: "Elon Musk", type: "public_figure" },
              ],
            },
            personaMemories: [],
          },
          interactionTaskAssistLoading: false,
          interactionTaskAssistError: null,
          interactionTaskAssistElapsedSeconds: 0,
          runInteractionPreview,
          closeInteractionPreviewModal,
          assistInteractionTaskContext,
        }),
      );
    });

    expect(container.textContent).toContain("Reference Sources");
    expect(container.textContent).toContain("John Grisham");
    expect(container.textContent).toContain("Elon Musk");
    expect(container.querySelector('[data-testid="selected-persona-identity"]')).not.toBeNull();
    const referenceSection = container.querySelector(
      '[data-testid="selected-persona-reference-section"]',
    ) as HTMLDivElement | null;
    expect(referenceSection).not.toBeNull();
    expect(referenceSection?.className).toContain("border-t");

    const aiButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("AI"),
    );
    expect(aiButton).toBeDefined();
    const taskContextLabel = Array.from(container.querySelectorAll("span")).find((node) =>
      node.textContent?.includes("Task Context / Content"),
    ) as HTMLSpanElement | undefined;
    expect(taskContextLabel).toBeDefined();
    expect(container.textContent).toContain(
      "Use AI to generate a random scenario for this interaction preview.",
    );

    await act(async () => {
      taskContextLabel?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(assistInteractionTaskContext).toHaveBeenCalledTimes(0);

    await act(async () => {
      aiButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(assistInteractionTaskContext).toHaveBeenCalledTimes(1);

    const runPreviewButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Run Preview"),
    );
    expect(runPreviewButton).not.toBeNull();
    expect((runPreviewButton as HTMLButtonElement).disabled).toBe(true);
  });

  it("enables Run Preview when task context is present", async () => {
    const runInteractionPreview = vi.fn().mockResolvedValue(undefined);

    await act(async () => {
      root.render(
        React.createElement(PersonaInteractionSection, {
          interactionInput: {
            personaId: "persona-1",
            modelId: "model-1",
            taskType: "comment",
            taskContext: "Reply to this draft critique.",
          },
          setInteractionInput: vi.fn(),
          personas: [],
          textModels: [
            {
              id: "model-1",
              providerId: "provider-1",
              modelKey: "test-model",
              displayName: "Test Model",
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
              contextWindow: null,
              maxOutputTokens: null,
              metadata: {},
              updatedAt: "2026-03-16T00:00:00.000Z",
            },
          ],
          providers: [
            {
              id: "provider-1",
              providerKey: "minimax",
              displayName: "MiniMax",
              sdkPackage: "@ai-sdk/minimax",
              status: "active",
              testStatus: "success",
              keyLast4: "1234",
              hasKey: true,
              lastApiErrorCode: null,
              lastApiErrorMessage: null,
              lastApiErrorAt: null,
              createdAt: "2026-03-16T00:00:00.000Z",
              updatedAt: "2026-03-16T00:00:00.000Z",
            },
          ],
          interactionPreview: null,
          interactionPreviewModalOpen: false,
          interactionPreviewModalPhase: "idle",
          interactionPreviewModalError: null,
          interactionPreviewElapsedSeconds: 0,
          selectedPersona: null,
          selectedPersonaProfile: null,
          interactionTaskAssistLoading: false,
          interactionTaskAssistError: null,
          interactionTaskAssistElapsedSeconds: 0,
          runInteractionPreview,
          closeInteractionPreviewModal: vi.fn(),
          assistInteractionTaskContext: vi.fn().mockResolvedValue(undefined),
        }),
      );
    });

    const runPreviewButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Run Preview"),
    ) as HTMLButtonElement | undefined;

    expect(runPreviewButton).toBeDefined();
    expect(runPreviewButton?.disabled).toBe(false);

    await act(async () => {
      runPreviewButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(runInteractionPreview).toHaveBeenCalledTimes(1);
  });

  it("switches task category and replaces task context with the matching default seed", async () => {
    const setInteractionInput = vi.fn();

    await act(async () => {
      root.render(
        React.createElement(PersonaInteractionSection, {
          interactionInput: {
            personaId: "persona-1",
            modelId: "model-1",
            taskType: "post",
            taskContext: defaultInteractionTaskContext("post"),
          },
          setInteractionInput,
          personas: [],
          textModels: [
            {
              id: "model-1",
              providerId: "provider-1",
              modelKey: "test-model",
              displayName: "Test Model",
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
              contextWindow: null,
              maxOutputTokens: null,
              metadata: {},
              updatedAt: "2026-03-16T00:00:00.000Z",
            },
          ],
          providers: [
            {
              id: "provider-1",
              providerKey: "minimax",
              displayName: "MiniMax",
              sdkPackage: "@ai-sdk/minimax",
              status: "active",
              testStatus: "success",
              keyLast4: "1234",
              hasKey: true,
              lastApiErrorCode: null,
              lastApiErrorMessage: null,
              lastApiErrorAt: null,
              createdAt: "2026-03-16T00:00:00.000Z",
              updatedAt: "2026-03-16T00:00:00.000Z",
            },
          ],
          interactionPreview: null,
          interactionPreviewModalOpen: false,
          interactionPreviewModalPhase: "idle",
          interactionPreviewModalError: null,
          interactionPreviewElapsedSeconds: 0,
          selectedPersona: null,
          selectedPersonaProfile: null,
          interactionTaskAssistLoading: false,
          interactionTaskAssistError: null,
          interactionTaskAssistElapsedSeconds: 0,
          runInteractionPreview: vi.fn().mockResolvedValue(undefined),
          closeInteractionPreviewModal: vi.fn(),
          assistInteractionTaskContext: vi.fn().mockResolvedValue(undefined),
        }),
      );
    });

    const taskTypeSelect = container.querySelectorAll("select")[1] as HTMLSelectElement | undefined;
    expect(taskTypeSelect).not.toBeNull();

    await act(async () => {
      taskTypeSelect!.value = "comment";
      taskTypeSelect!.dispatchEvent(new Event("change", { bubbles: true }));
    });

    expect(setInteractionInput).toHaveBeenCalledTimes(1);
    const updater = setInteractionInput.mock.calls[0][0] as (prev: {
      personaId: string;
      modelId: string;
      taskType: "post" | "comment";
      taskContext: string;
    }) => {
      personaId: string;
      modelId: string;
      taskType: "post" | "comment";
      taskContext: string;
    };

    expect(
      updater({
        personaId: "persona-1",
        modelId: "model-1",
        taskType: "post",
        taskContext: defaultInteractionTaskContext("post"),
      }),
    ).toEqual({
      personaId: "persona-1",
      modelId: "model-1",
      taskType: "comment",
      taskContext: defaultInteractionTaskContext("comment"),
    });
  });
});
