/** @vitest-environment jsdom */

import { act } from "react";
import React from "react";
import ReactDOMClient from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AiControlPlanePanel from "./AiControlPlanePanel";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const { useAiControlPlaneMock, personaGenerationSectionMock } = vi.hoisted(() => ({
  useAiControlPlaneMock: vi.fn(),
  personaGenerationSectionMock: vi.fn(
    (props: {
      personaPromptAssistCompleted: boolean;
      personaUpdatePromptAssistCompleted: boolean;
    }) =>
      React.createElement(
        "div",
        {
          "data-testid": "persona-generation-section",
          "data-prompt-completed": String(props.personaPromptAssistCompleted),
          "data-update-prompt-completed": String(props.personaUpdatePromptAssistCompleted),
        },
        "Persona Generation Section",
      ),
  ),
}));

vi.mock("@/hooks/admin/useAiControlPlane", () => ({
  useAiControlPlane: useAiControlPlaneMock,
}));

vi.mock("./control-plane/sections/ProvidersModelsSection", () => ({
  ProvidersModelsSection: () => React.createElement("div", null, "Providers"),
}));

vi.mock("./control-plane/sections/PolicyStudioSection", () => ({
  PolicyStudioSection: () => React.createElement("div", null, "Policy"),
}));

vi.mock("./control-plane/sections/PersonaGenerationSection", () => ({
  PersonaGenerationSection: personaGenerationSectionMock,
}));

vi.mock("./control-plane/sections/PersonaInteractionSection", () => ({
  PersonaInteractionSection: () => React.createElement("div", null, "Interaction"),
}));

describe("AiControlPlanePanel", () => {
  let container: HTMLDivElement;
  let root: ReactDOMClient.Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = ReactDOMClient.createRoot(container);
    personaGenerationSectionMock.mockClear();
    useAiControlPlaneMock.mockReturnValue({
      activeSection: "persona",
      setActiveSection: vi.fn(),
      providers: [],
      models: [],
      releases: [],
      personas: [],
      draft: {},
      setDraft: vi.fn(),
      personaGeneration: { modelId: "", extraPrompt: "", referenceNames: "" },
      setPersonaGeneration: vi.fn(),
      personaUpdate: { personaId: "", modelId: "", extraPrompt: "" },
      setPersonaUpdate: vi.fn(),
      personaGenerationLoading: false,
      personaUpdateLoading: false,
      personaPromptAssistLoading: false,
      personaPromptAssistError: null,
      personaPromptAssistCompleted: true,
      personaPromptAssistElapsedSeconds: 1,
      personaUpdatePromptAssistLoading: false,
      personaUpdatePromptAssistError: null,
      personaUpdatePromptAssistCompleted: true,
      personaUpdatePromptAssistElapsedSeconds: 1,
      personaPreviewRunCount: 0,
      personaLastSavedAt: null,
      personaSaveLoading: false,
      personaSaveForm: { displayName: "", username: "" },
      setPersonaSaveForm: vi.fn(),
      personaGenerationPreview: null,
      personaGenerationMode: "create",
      personaGenerationModalOpen: false,
      personaGenerationModalPhase: "idle",
      personaGenerationModalError: null,
      personaGenerationModalErrorDetails: null,
      personaGenerationModalRawOutput: null,
      personaGenerationElapsedSeconds: 0,
      interactionInput: {
        personaId: "",
        modelId: "",
        taskType: "post",
        targetContextText: "",
      },
      setInteractionInput: vi.fn(),
      interactionPreview: null,
      interactionPreviewModalOpen: false,
      interactionPreviewModalPhase: "idle",
      interactionPreviewModalError: null,
      interactionPreviewElapsedSeconds: 0,
      selectedPersonaProfile: null,
      selectedUpdatePersona: null,
      selectedUpdatePersonaProfile: null,
      selectedUpdatePersonaProfileLoading: false,
      interactionTaskAssistLoading: false,
      interactionTaskAssistError: null,
      interactionTaskAssistElapsedSeconds: 0,
      modelTestImageLinks: {},
      activeRelease: null,
      textModels: [],
      personaGenerationModels: [],
      selectedPersona: null,
      refreshAll: vi.fn(),
      createSupportedProvider: vi.fn(),
      runModelTest: vi.fn(),
      setModelActive: vi.fn(),
      setProviderActive: vi.fn(),
      reorderModels: vi.fn(),
      createDraft: vi.fn(),
      publishNextVersion: vi.fn(),
      rollbackRelease: vi.fn(),
      deletePolicyRelease: vi.fn(),
      viewPolicyVersion: vi.fn(),
      runPersonaGenerationPreview: vi.fn(),
      runPersonaUpdatePreview: vi.fn(),
      assistPersonaPrompt: vi.fn(),
      assistPersonaUpdatePrompt: vi.fn(),
      closePersonaGenerationModal: vi.fn(),
      savePersonaFromGeneration: vi.fn(),
      runInteractionPreview: vi.fn(),
      closeInteractionPreviewModal: vi.fn(),
      assistInteractionTaskContext: vi.fn(),
      personaStepStatus: { generated: false, saved: false },
    });
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("passes prompt-assist completed flags into PersonaGenerationSection without crashing", async () => {
    await act(async () => {
      root.render(
        React.createElement(AiControlPlanePanel, {
          initialProviders: [],
          initialModels: [],
          initialReleases: [],
          initialPersonas: [],
        }),
      );
    });

    const personaSection = container.querySelector(
      '[data-testid="persona-generation-section"]',
    ) as HTMLDivElement | null;

    expect(personaSection).not.toBeNull();
    expect(personaSection?.dataset.promptCompleted).toBe("true");
    expect(personaSection?.dataset.updatePromptCompleted).toBe("true");

    const refreshButton = container.querySelector("button");
    expect(refreshButton?.className).toContain("btn-ghost");
    expect(refreshButton?.className).not.toContain("btn-outline");
  });
});
