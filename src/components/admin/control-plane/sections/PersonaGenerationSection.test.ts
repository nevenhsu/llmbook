/** @vitest-environment jsdom */

import { act } from "react";
import React from "react";
import ReactDOMClient from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PersonaGenerationSection } from "./PersonaGenerationSection";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("PersonaGenerationSection", () => {
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

  it("disables Update Persona while the selected persona profile is still loading", async () => {
    await act(async () => {
      root.render(
        React.createElement(PersonaGenerationSection, {
          personaGeneration: {
            modelId: "model-1",
            extraPrompt: "Generate a witty but respectful creator persona.",
          },
          setPersonaGeneration: vi.fn(),
          personaUpdate: {
            personaId: "persona-1",
            modelId: "model-1",
            extraPrompt: "",
          },
          setPersonaUpdate: vi.fn(),
          personas: [
            {
              id: "persona-1",
              username: "ai_persona_1",
              display_name: "Persona One",
              bio: "Bio one",
              status: "active",
            },
          ],
          selectedUpdatePersona: {
            id: "persona-1",
            username: "ai_persona_1",
            display_name: "Persona One",
            bio: "Bio one",
            status: "active",
          },
          selectedUpdatePersonaProfile: null,
          selectedUpdatePersonaProfileLoading: true,
          personaGenerationModels: [
            {
              id: "model-1",
              providerId: "provider-1",
              modelKey: "grok-4.1-fast-reasoning",
              displayName: "Grok",
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
              updatedAt: "2026-03-22T00:00:00.000Z",
            },
          ],
          providers: [
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
          ],
          personaGenerationLoading: false,
          personaUpdateLoading: false,
          personaPromptAssistLoading: false,
          personaPromptAssistError: null,
          personaPromptAssistCompleted: false,
          personaPromptAssistElapsedSeconds: 0,
          personaUpdatePromptAssistLoading: false,
          personaUpdatePromptAssistError: null,
          personaUpdatePromptAssistCompleted: false,
          personaUpdatePromptAssistElapsedSeconds: 0,
          personaPreviewRunCount: 0,
          personaLastSavedAt: null,
          personaSaveForm: {
            displayName: "",
            username: "",
          },
          setPersonaSaveForm: vi.fn(),
          personaSaveLoading: false,
          personaGenerationPreview: null,
          promptAssemblyGlobalPolicyContent: "",
          personaGenerationMode: "update",
          personaGenerationModalOpen: false,
          personaGenerationModalPhase: "idle",
          personaGenerationModalError: null,
          personaGenerationModalErrorDetails: null,
          personaGenerationModalRawOutput: null,
          personaGenerationElapsedSeconds: 0,
          personaStepStatus: {
            generated: false,
            saved: false,
          },
          assistPersonaPrompt: vi.fn(),
          assistPersonaUpdatePrompt: vi.fn(),
          runPersonaGenerationPreview: vi.fn(),
          runPersonaUpdatePreview: vi.fn(),
          closePersonaGenerationModal: vi.fn(),
          savePersonaFromGeneration: vi.fn(),
        }),
      );
    });

    const updateButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Update Persona"),
    ) as HTMLButtonElement | undefined;
    const updatePromptAssistButton = container.querySelector(
      'button[aria-label="Prompt AI for update"]',
    ) as HTMLButtonElement | null;

    expect(updateButton).toBeDefined();
    expect(updateButton?.disabled).toBe(true);
    expect(updatePromptAssistButton).not.toBeNull();
    expect(updatePromptAssistButton?.disabled).toBe(true);
  });
});
