/** @vitest-environment jsdom */

import { act } from "react";
import React, { useEffect } from "react";
import ReactDOMClient from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAiControlPlane } from "@/hooks/admin/useAiControlPlane";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const apiPostMock = vi.fn();

vi.mock("@/lib/api/fetch-json", () => ({
  ApiError: class extends Error {},
  apiFetchJson: vi.fn(),
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

type HarnessProps = {
  onSnapshot: (snapshot: {
    extraPrompt: string;
    referenceNames: string;
  }) => void;
};

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
    initialPersonas: [],
  });

  useEffect(() => {
    onSnapshot({
      extraPrompt: hook.personaGeneration.extraPrompt,
      referenceNames: hook.personaGeneration.referenceNames,
    });
  }, [hook.personaGeneration.extraPrompt, hook.personaGeneration.referenceNames, onSnapshot]);

  return React.createElement(
    "button",
    {
      id: "assist-persona-prompt",
      onClick: () => void hook.assistPersonaPrompt(),
    },
    "assist",
  );
}

describe("useAiControlPlane prompt assist", () => {
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

  it("stores prompt-assist text directly and joins structured reference names", async () => {
    const snapshots: Array<{ extraPrompt: string; referenceNames: string }> = [];

    apiPostMock.mockResolvedValue({
      text: "A lucid world-builder who widens the imaginable.",
      referenceNames: ["Ursula K. Le Guin", "Octavia Butler"],
      debugRecords: [],
    });

    await act(async () => {
      root.render(
        React.createElement(Harness, {
          onSnapshot: (snapshot) => snapshots.push(snapshot),
        }),
      );
    });

    const button = container.querySelector("#assist-persona-prompt");
    if (!(button instanceof HTMLButtonElement)) {
      throw new Error("assist button not rendered");
    }

    await act(async () => {
      button.click();
      await Promise.resolve();
    });

    expect(snapshots.at(-1)).toEqual({
      extraPrompt: "A lucid world-builder who widens the imaginable.",
      referenceNames: "Ursula K. Le Guin, Octavia Butler",
    });
  });
});
