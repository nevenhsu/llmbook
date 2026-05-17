/** @vitest-environment jsdom */

import { act } from "react";
import React, { useEffect } from "react";
import ReactDOMClient from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAiControlPlane } from "@/hooks/admin/useAiControlPlane";
import type {
  PersonaGenerationStructured,
  PersonaProfile,
  PreviewResult,
} from "@/lib/ai/admin/control-plane-store";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const apiFetchJsonMock = vi.fn();
const apiPostMock = vi.fn();

vi.mock("@/lib/api/fetch-json", () => ({
  ApiError: class extends Error {
    public status: number;
    public details?: unknown;

    public constructor(message: string, status: number, details?: unknown) {
      super(message);
      this.name = "ApiError";
      this.status = status;
      this.details = details;
    }
  },
  apiFetchJson: (...args: unknown[]) => apiFetchJsonMock(...args),
  apiDelete: vi.fn(),
  apiPatch: vi.fn(),
  apiPost: (...args: unknown[]) => apiPostMock(...args),
  apiPut: vi.fn(),
}));

vi.mock("react-hot-toast", () => ({
  default: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
  }),
}));

type Snapshot = {
  saveForm: {
    displayName: string;
    username: string;
  };
  modalOpen: boolean;
  mode: "create" | "update";
  modalError: string | null;
  modalResult: string | null;
};

type HarnessProps = {
  onSnapshot: (snapshot: Snapshot) => void;
};

function buildProfile(): PersonaProfile {
  return {
    persona: {
      id: "persona-1",
      username: "ai_target_persona",
      display_name: "Target Persona",
      avatar_url: null,
      bio: "Existing bio",
      status: "active",
    },
    personaCore: {
      reference_sources: [
        {
          name: "Monkey D. Luffy",
          type: "character_inspiration",
          contribution: ["Impulsive crew-first energy"],
        },
      ],
      other_reference_sources: [
        {
          name: "pirate crew loyalty",
          type: "group_dynamic",
          contribution: ["Crew-as-family logic."],
        },
      ],
      reference_derivation: ["Crew loyalty over credentials"],
      originalization_note: "note",
    },
    personaMemories: [],
  };
}

function buildPreview(): PreviewResult & { structured: PersonaGenerationStructured } {
  return {
    markdown: "markdown",
    rawResponse: "{}",
    renderOk: true,
    renderError: null,
    tokenBudget: {
      estimatedInputTokens: 100,
      maxInputTokens: 1000,
      maxOutputTokens: 1000,
      blockStats: [],
      compressedStages: [],
      exceeded: false,
      message: null,
    },
    structured: {
      persona: {
        display_name: "Preview Mutation",
        bio: "Preview bio",
        status: "active",
      },
      persona_core: {},
      reference_sources: [],
      other_reference_sources: [],
      reference_derivation: [],
      originalization_note: "note",
    },
  };
}

function Harness({ onSnapshot }: HarnessProps) {
  const hook = useAiControlPlane({
    initialProviders: [
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
        createdAt: "2026-03-17T00:00:00.000Z",
        updatedAt: "2026-03-17T00:00:00.000Z",
      },
    ],
    initialModels: [
      {
        id: "model-1",
        providerId: "provider-1",
        modelKey: "grok",
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
        updatedAt: "2026-03-17T00:00:00.000Z",
      },
    ],
    initialReleases: [
      {
        version: 1,
        isActive: true,
        createdBy: "admin",
        changeNote: null,
        createdAt: "2026-03-17T00:00:00.000Z",
        globalPolicyDraft: {
          systemBaseline: "baseline",
          globalPolicy: "policy",
          styleGuide: "style",
          forbiddenRules: "forbidden",
        },
      },
    ],
    initialPersonas: [
      {
        id: "persona-1",
        username: "ai_target_persona",
        display_name: "Target Persona",
        bio: "Existing bio",
        status: "active",
      },
    ],
  });

  useEffect(() => {
    onSnapshot({
      saveForm: hook.personaSaveForm,
      modalOpen: hook.personaGenerationModalOpen,
      mode: hook.personaGenerationMode,
      modalError: hook.personaGenerationModalError,
      modalResult: hook.personaGenerationModalRawOutput,
    });
  }, [
    hook.personaSaveForm,
    hook.personaGenerationModalOpen,
    hook.personaGenerationMode,
    hook.personaGenerationModalError,
    hook.personaGenerationModalRawOutput,
    onSnapshot,
  ]);

  return React.createElement(
    React.Fragment,
    null,
    React.createElement(
      "button",
      {
        id: "run-update-preview",
        onClick: () => void hook.runPersonaUpdatePreview(),
      },
      "run update preview",
    ),
    React.createElement(
      "button",
      {
        id: "edit-save-form",
        onClick: () =>
          hook.setPersonaSaveForm({
            displayName: "Deckhand Riot",
            username: "ai_deckhand_riot",
          }),
      },
      "edit save form",
    ),
  );
}

describe("useAiControlPlane update persona preview", () => {
  let container: HTMLDivElement;
  let root: ReactDOMClient.Root;

  beforeEach(() => {
    vi.clearAllMocks();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = ReactDOMClient.createRoot(container);
    apiFetchJsonMock.mockResolvedValue(buildProfile());
    apiPostMock.mockResolvedValue({ preview: buildPreview() });
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("seeds update identity from the targeted persona once and preserves later manual edits across regenerate", async () => {
    const snapshots: Snapshot[] = [];

    await act(async () => {
      root.render(
        React.createElement(Harness, { onSnapshot: (snapshot) => snapshots.push(snapshot) }),
      );
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const runButton = container.querySelector("#run-update-preview") as HTMLButtonElement | null;
    const editButton = container.querySelector("#edit-save-form") as HTMLButtonElement | null;
    expect(runButton).not.toBeNull();
    expect(editButton).not.toBeNull();

    await act(async () => {
      runButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    const seededSnapshot = snapshots.at(-1);
    expect(seededSnapshot?.modalOpen).toBe(true);
    expect(seededSnapshot?.mode).toBe("update");
    expect(seededSnapshot?.saveForm).toEqual({
      displayName: "Target Persona",
      username: "ai_target_persona",
    });

    await act(async () => {
      editButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(snapshots.at(-1)?.saveForm).toEqual({
      displayName: "Deckhand Riot",
      username: "ai_deckhand_riot",
    });

    await act(async () => {
      runButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    const preservedSnapshot = snapshots.at(-1);
    expect(preservedSnapshot?.saveForm).toEqual({
      displayName: "Deckhand Riot",
      username: "ai_deckhand_riot",
    });
    expect(apiPostMock).toHaveBeenCalledTimes(2);
    expect(preservedSnapshot?.saveForm.displayName).not.toBe("Preview Mutation");
    expect(preservedSnapshot?.saveForm.username).not.toBe("ai_preview_mutation");
  });

  it("captures the canonical preview error result from the API payload", async () => {
    const { ApiError } = await import("@/lib/api/fetch-json");
    const snapshots: Snapshot[] = [];
    apiPostMock.mockRejectedValueOnce(
      new ApiError("persona generation output missing persona", 422, {
        error: "persona generation output missing persona",
        result: '{"result":{"persona":{"display_name":"Deep Focus"}}}',
      }),
    );

    await act(async () => {
      root.render(
        React.createElement(Harness, { onSnapshot: (snapshot) => snapshots.push(snapshot) }),
      );
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const runButton = container.querySelector("#run-update-preview") as HTMLButtonElement | null;
    expect(runButton).not.toBeNull();

    await act(async () => {
      runButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    const erroredSnapshot = snapshots.at(-1);
    expect(erroredSnapshot?.modalOpen).toBe(true);
    expect(erroredSnapshot?.modalError).toBe("persona generation output missing persona");
    expect(erroredSnapshot?.modalResult).toBe(
      '{"result":{"persona":{"display_name":"Deep Focus"}}}',
    );
  });
});
