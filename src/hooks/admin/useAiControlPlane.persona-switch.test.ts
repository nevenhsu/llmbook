/** @vitest-environment jsdom */

import { act } from "react";
import React, { useEffect } from "react";
import ReactDOMClient from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAiControlPlane } from "@/hooks/admin/useAiControlPlane";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const apiFetchJsonMock = vi.fn();

vi.mock("@/lib/api/fetch-json", () => ({
  ApiError: class extends Error {},
  apiFetchJson: (...args: unknown[]) => apiFetchJsonMock(...args),
  apiDelete: vi.fn(),
  apiPatch: vi.fn(),
  apiPost: vi.fn(),
  apiPut: vi.fn(),
}));

vi.mock("react-hot-toast", () => ({
  default: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
  }),
}));

type HarnessProps = {
  onSnapshot: (snapshot: {
    updatePersonaId: string;
    updateExtraPrompt: string;
    updateReferenceNames: string[];
  }) => void;
};

function buildProfile(id: string, displayName: string, bio: string, references: string[]) {
  return {
    persona: {
      id,
      username: `ai_${id}`,
      display_name: displayName,
      bio,
      status: "active" as const,
    },
    personaCore: {
      reference_sources: references.map((name) => ({
        name,
        type: "reference",
        contribution: ["reference contribution"],
      })),
      reference_derivation: references.map((name) => `Derived from ${name}`),
      originalization_note: "note",
    },
    personaMemories: [],
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
        username: "ai_persona_1",
        display_name: "Persona One",
        bio: "Bio one",
        status: "active",
      },
      {
        id: "persona-2",
        username: "ai_persona_2",
        display_name: "Persona Two",
        bio: "Bio two",
        status: "active",
      },
    ],
  });

  useEffect(() => {
    const referenceNames = Array.isArray(
      hook.selectedUpdatePersonaProfile?.personaCore?.reference_sources,
    )
      ? (
          hook.selectedUpdatePersonaProfile?.personaCore.reference_sources as Array<
            Record<string, unknown>
          >
        )
          .map((item) => (typeof item.name === "string" ? item.name : ""))
          .filter((item) => item.length > 0)
      : [];

    onSnapshot({
      updatePersonaId: hook.personaUpdate.personaId,
      updateExtraPrompt: hook.personaUpdate.extraPrompt,
      updateReferenceNames: referenceNames,
    });
  }, [
    hook.personaUpdate.personaId,
    hook.personaUpdate.extraPrompt,
    hook.selectedUpdatePersonaProfile,
    onSnapshot,
  ]);

  return React.createElement(
    "button",
    {
      id: "switch-update-persona",
      onClick: () =>
        hook.setPersonaUpdate((prev) => ({
          ...prev,
          personaId: "persona-2",
        })),
    },
    "switch",
  );
}

describe("useAiControlPlane persona switching", () => {
  let container: HTMLDivElement;
  let root: ReactDOMClient.Root;

  beforeEach(() => {
    vi.clearAllMocks();
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

  it("clears old update persona references immediately while the next profile is still loading", async () => {
    const snapshots: Array<{
      updatePersonaId: string;
      updateExtraPrompt: string;
      updateReferenceNames: string[];
    }> = [];
    let resolvePersonaTwo: ((value: unknown) => void) | null = null;

    apiFetchJsonMock.mockImplementation((url: string) => {
      if (url.endsWith("/persona-1")) {
        return Promise.resolve(
          buildProfile("persona-1", "Persona One", "Bio one", ["Ref One", "Ref Two"]),
        );
      }
      if (url.endsWith("/persona-2")) {
        return new Promise((resolve) => {
          resolvePersonaTwo = resolve;
        });
      }
      throw new Error(`Unexpected url ${url}`);
    });

    await act(async () => {
      root.render(
        React.createElement(Harness, { onSnapshot: (snapshot) => snapshots.push(snapshot) }),
      );
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(snapshots.some((snapshot) => snapshot.updateReferenceNames.includes("Ref One"))).toBe(
      true,
    );
    expect(
      snapshots.some((snapshot) => snapshot.updateExtraPrompt.includes("Reference roles: Ref One")),
    ).toBe(true);

    const switchButton = container.querySelector("#switch-update-persona") as HTMLButtonElement;

    await act(async () => {
      switchButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const latestBeforeResolve = snapshots.at(-1);
    expect(latestBeforeResolve?.updatePersonaId).toBe("persona-2");
    expect(latestBeforeResolve?.updateReferenceNames).toEqual([]);
    expect(latestBeforeResolve?.updateExtraPrompt).toBe("");

    await act(async () => {
      resolvePersonaTwo?.(
        buildProfile("persona-2", "Persona Two", "Bio two", ["Ref Three", "Ref Four"]),
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    const latestAfterResolve = snapshots.at(-1);
    expect(latestAfterResolve?.updateReferenceNames).toEqual(["Ref Three", "Ref Four"]);
    expect(latestAfterResolve?.updateExtraPrompt).toContain("Reference roles: Ref Three");
  });
});
