/** @vitest-environment jsdom */

import { act } from "react";
import React from "react";
import ReactDOMClient from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockPersonaGenerationPreview } from "@/lib/ai/admin/persona-generation-preview-mock";
import type { AiModelConfig, AiProviderConfig } from "@/lib/ai/admin/control-plane-contract";
import type { PersonaBatchGenerationController } from "@/hooks/admin/usePersonaBatchGeneration";
import { PersonaBatchPage } from "./PersonaBatchPage";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const initialProviders: AiProviderConfig[] = [
  {
    id: "provider-1",
    providerKey: "xai",
    displayName: "xAI",
    sdkPackage: "@ai-sdk/xai",
    status: "active",
    testStatus: "success",
    keyLast4: "1234",
    hasKey: true,
    lastApiErrorCode: null,
    lastApiErrorMessage: null,
    lastApiErrorAt: null,
    createdAt: "2026-03-22T00:00:00.000Z",
    updatedAt: "2026-03-22T00:00:00.000Z",
  },
];

const initialModels: AiModelConfig[] = [
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

function buildController(overrides: Partial<PersonaBatchGenerationController> = {}) {
  const setModelId = vi.fn();
  const setReferenceInput = vi.fn();
  const addReferenceRowsFromInput = vi.fn();
  const setChunkSize = vi.fn();
  const runRowPromptAssist = vi.fn();
  const runRowGenerate = vi.fn();
  const runRowSave = vi.fn();
  const updateContextPrompt = vi.fn();
  const updatePersonaIdentity = vi.fn();
  const requestBulkPause = vi.fn();
  const resumeBulkTask = vi.fn();
  const setAutoAdvanceBulkActions = vi.fn();
  const rows: PersonaBatchGenerationController["rows"] = [
    {
      rowId: "row-1",
      referenceName: "Anthony Bourdain",
      dbReferenceExists: false,
      contextPrompt: "A globe-trotting storyteller with knife-edge taste.",
      displayName: mockPersonaGenerationPreview.structured.persona.display_name,
      username: "ai_riptideroo",
      personaData: mockPersonaGenerationPreview.structured,
      saved: false,
      savedPersonaId: null,
      promptChangedSinceGenerate: false,
      referenceCheckStatus: "new",
      activeTask: null,
      activeElapsedSeconds: 0,
      lastCompletedTask: "generate",
      lastCompletedElapsedSeconds: 12,
      latestError: {
        type: "generate",
        message: "persona generation output must be valid JSON",
        apiUrl: "/api/admin/ai/persona-generation/preview",
        payload: { extraPrompt: "Anthony Bourdain" },
        rawResponse: { error: "persona generation output must be valid JSON" },
        createdAt: "2026-03-22T00:00:00.000Z",
      },
    },
  ];

  return {
    controller: {
      modelId: "model-1",
      setModelId,
      referenceInput: "Anthony Bourdain, Hayao Miyazaki",
      setReferenceInput,
      rows,
      chunkSize: 5,
      setChunkSize,
      bulkTask: null,
      bulkElapsedSeconds: 0,
      addLastCompletedElapsedSeconds: null,
      addLastCompletedAddedCount: null,
      addLastCompletedDuplicateCount: null,
      bulkPausedTask: null,
      bulkPausedElapsedSeconds: 0,
      bulkPauseRequested: false,
      bulkLastCompletedTask: "generate",
      bulkLastElapsedSeconds: 24,
      canBulkPrompt: true,
      canBulkGenerate: false,
      canBulkSave: false,
      autoAdvanceBulkActions: true,
      setAutoAdvanceBulkActions,
      anyApiActive: false,
      addLoading: false,
      addElapsedSeconds: 0,
      bulkActionsDisabled: false,
      canReset: true,
      canClearBatchRows: false,
      personaGenerationModels: initialModels,
      addReferenceRowsFromInput,
      clearBatchRows: vi.fn(),
      clearRow: vi.fn(),
      updateContextPrompt,
      updatePersonaIdentity,
      runRowPromptAssist,
      runRowGenerate,
      runRowSave,
      runBulkPromptAssist: vi.fn(),
      runBulkGenerate: vi.fn(),
      runBulkSave: vi.fn(),
      requestBulkPause,
      resumeBulkTask,
      reset: vi.fn(),
      ...overrides,
    } satisfies PersonaBatchGenerationController,
    spies: {
      setModelId,
      setReferenceInput,
      addReferenceRowsFromInput,
      setChunkSize,
      runRowPromptAssist,
      runRowGenerate,
      runRowSave,
      updateContextPrompt,
      updatePersonaIdentity,
      requestBulkPause,
      resumeBulkTask,
      setAutoAdvanceBulkActions,
    },
  };
}

describe("PersonaBatchPage", () => {
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

  it("renders model selection first and wires chunk/persona/error/context modals through the shared surface", async () => {
    const { controller, spies } = buildController();

    await act(async () => {
      root.render(
        React.createElement(PersonaBatchPage, {
          controller,
          initialModels,
          initialProviders,
        }),
      );
    });

    expect(container.textContent).toContain("Model Selection");
    expect(container.textContent).toContain("Reference Sources");
    expect(container.textContent).toContain("Chunk Size: 5");
    expect(container.querySelector("textarea")).toBeNull();

    const openReferenceModalButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.trim() === "Add",
    );
    expect(openReferenceModalButton).toBeDefined();

    await act(async () => {
      openReferenceModalButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).toContain(
      "comma or newline separated, ex: Anthony Bourdain, Hayao Miyazaki, Ursula K. Le Guin",
    );

    const chunkButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Chunk Size: 5"),
    );
    expect(chunkButton).toBeDefined();

    await act(async () => {
      chunkButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).toContain("Rows per batch");

    const editContextButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.trim() === "Edit",
    );
    expect(editContextButton).toBeDefined();

    await act(async () => {
      editContextButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).toContain("Edit Context Prompt");

    const contextModal = Array.from(container.querySelectorAll("dialog")).find((dialog) =>
      dialog.textContent?.includes("Edit Context Prompt"),
    );
    const contextPromptButton = contextModal?.querySelector('button[aria-label="Prompt"]');
    expect(contextPromptButton).toBeDefined();

    await act(async () => {
      contextPromptButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(spies.runRowPromptAssist).toHaveBeenCalledWith("row-1");

    const autoNextCheckbox = container.querySelector(
      'input[type="checkbox"][aria-label="Auto next step"]',
    ) as HTMLInputElement | null;
    expect(autoNextCheckbox).not.toBeNull();

    await act(async () => {
      autoNextCheckbox?.click();
    });

    expect(spies.setAutoAdvanceBulkActions).toHaveBeenCalledWith(false);

    const contextSaveButton = Array.from(contextModal?.querySelectorAll("button") ?? []).find(
      (button) => button.textContent?.trim() === "Save",
    );
    expect(contextSaveButton).toBeDefined();

    await act(async () => {
      contextSaveButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(spies.updateContextPrompt).toHaveBeenCalled();

    const editButtons = Array.from(container.querySelectorAll("button")).filter(
      (button) => button.textContent?.trim() === "Edit",
    );
    const editIdentityButton = editButtons[1];
    expect(editIdentityButton).toBeDefined();

    await act(async () => {
      editIdentityButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).toContain("Edit Persona Identity");

    const identityModal = Array.from(container.querySelectorAll("dialog")).find((dialog) =>
      dialog.textContent?.includes("Edit Persona Identity"),
    );
    const identitySaveButton = Array.from(identityModal?.querySelectorAll("button") ?? []).find(
      (button) => button.textContent?.trim() === "Save",
    );
    expect(identitySaveButton).toBeDefined();

    await act(async () => {
      identitySaveButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(spies.updatePersonaIdentity).toHaveBeenCalled();

    const viewPersonaButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.trim() === "View",
    );
    expect(viewPersonaButton).toBeDefined();

    await act(async () => {
      viewPersonaButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).toContain("Anthony Bourdain Persona");
    expect(container.textContent).toContain("ai_riptideroo");
    expect(container.textContent).toContain("Anthony Bourdain");
    expect(container.textContent).toContain("Voice Fingerprint");

    const personaRegenerateButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.includes("Regenerate"),
    );
    expect(personaRegenerateButton).toBeDefined();

    await act(async () => {
      personaRegenerateButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(spies.runRowGenerate).toHaveBeenCalledWith("row-1");

    const viewErrorButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.trim() === "View generate error",
    );
    expect(viewErrorButton).toBeDefined();

    await act(async () => {
      viewErrorButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).toContain("Anthony Bourdain generate error");
    expect(container.textContent).toContain("/api/admin/ai/persona-generation/preview");
    expect(container.textContent).toContain("Copy JSON");
  });
});
