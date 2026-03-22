/** @vitest-environment jsdom */

import { act } from "react";
import React from "react";
import ReactDOMClient from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import toast from "react-hot-toast";
import { ApiError } from "@/lib/api/fetch-json";
import { mockPersonaGenerationPreview } from "@/lib/ai/admin/persona-generation-preview-mock";
import type { AiModelConfig, AiProviderConfig } from "@/lib/ai/admin/control-plane-contract";
import { usePersonaBatchGeneration } from "./usePersonaBatchGeneration";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const apiPostMock = vi.fn();
const apiPatchMock = vi.fn();

vi.mock("@/lib/api/fetch-json", () => ({
  ApiError: class extends Error {
    details?: unknown;

    constructor(message: string, status: number, details?: unknown) {
      super(message);
      this.name = "ApiError";
      this.details = details;
    }
  },
  apiFetchJson: vi.fn(),
  apiDelete: vi.fn(),
  apiPatch: (...args: unknown[]) => apiPatchMock(...args),
  apiPost: (...args: unknown[]) => apiPostMock(...args),
  apiPut: vi.fn(),
}));

vi.mock("react-hot-toast", () => ({
  default: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
  }),
}));

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
];

async function flushPromises(times = 4) {
  for (let index = 0; index < times; index += 1) {
    await Promise.resolve();
  }
}

function createDeferred() {
  let resolve: (() => void) | null = null;
  const promise = new Promise<void>((res) => {
    resolve = res;
  });
  return { promise, resolve: resolve! };
}

describe("usePersonaBatchGeneration", () => {
  let container: HTMLDivElement;
  let root: ReactDOMClient.Root;
  let latestHook: ReturnType<typeof usePersonaBatchGeneration> | null;

  function Harness() {
    latestHook = usePersonaBatchGeneration({
      initialModels,
      initialProviders,
    });
    return null;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = ReactDOMClient.createRoot(container);
    latestHook = null;
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("adds only unique names from the input and marks DB duplicates after the bulk reference check", async () => {
    apiPostMock.mockImplementation((url: string, payload: { names: string[] }) => {
      if (url === "/api/admin/ai/persona-references/check") {
        return Promise.resolve({
          items: payload.names.map((name) => ({
            input: name,
            matchKey: name
              .trim()
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, ""),
            romanizedName: name.trim(),
            exists: name.trim().toLowerCase() === "anthony bourdain",
          })),
        });
      }
      throw new Error(`Unexpected URL: ${url}`);
    });

    await act(async () => {
      root.render(React.createElement(Harness));
    });

    await act(async () => {
      latestHook?.setReferenceInput(
        "Anthony Bourdain\nKiki's Delivery Service\nKiki's Delivery Service",
      );
    });

    act(() => {
      void latestHook?.addReferenceRowsFromInput();
    });

    await act(async () => {
      await flushPromises();
    });

    expect(latestHook?.rows).toHaveLength(2);
    expect(latestHook?.rows.map((row) => row.referenceCheckStatus)).toEqual(["duplicate", "new"]);
  });

  it("uses the reference match key for cross-script duplicate detection", async () => {
    apiPostMock.mockImplementation((url: string, payload: { names: string[] }) => {
      if (url === "/api/admin/ai/persona-references/check") {
        return Promise.resolve({
          items: payload.names.map((name) => {
            if (name === "劉慈欣") {
              return {
                input: name,
                matchKey: "liucixin",
                romanizedName: "Liu Ci Xin",
                exists: true,
              };
            }
            return {
              input: name,
              matchKey: "newreference",
              romanizedName: "New Reference",
              exists: false,
            };
          }),
        });
      }
      throw new Error(`Unexpected URL: ${url}`);
    });

    await act(async () => {
      root.render(React.createElement(Harness));
    });

    await act(async () => {
      latestHook?.setReferenceInput("劉慈欣");
    });

    await act(async () => {
      await latestHook?.addReferenceRowsFromInput();
      await flushPromises();
    });

    expect(latestHook?.rows).toHaveLength(1);
    expect(latestHook?.rows[0]?.referenceCheckStatus).toBe("duplicate");
  });

  it("filters already-added names on add, re-checks all rows, and reports completion with toast", async () => {
    apiPostMock.mockImplementation((url: string, payload: { names: string[] }) => {
      if (url === "/api/admin/ai/persona-references/check") {
        return Promise.resolve({
          items: payload.names.map((name) => ({
            input: name,
            matchKey: name
              .trim()
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, ""),
            romanizedName: name.trim(),
            exists: false,
          })),
        });
      }
      throw new Error(`Unexpected URL: ${url}`);
    });

    await act(async () => {
      root.render(React.createElement(Harness));
    });

    await act(async () => {
      latestHook?.setReferenceInput("Anthony Bourdain");
    });

    act(() => {
      void latestHook?.addReferenceRowsFromInput();
    });

    await act(async () => {
      await flushPromises();
    });

    expect(latestHook?.rows.map((row) => row.referenceName)).toEqual(["Anthony Bourdain"]);

    await act(async () => {
      latestHook?.setReferenceInput("Anthony Bourdain\nHayao Miyazaki");
    });

    await act(async () => {
      await latestHook?.addReferenceRowsFromInput();
      await flushPromises();
    });

    expect(latestHook?.rows.map((row) => row.referenceName)).toEqual([
      "Anthony Bourdain",
      "Hayao Miyazaki",
    ]);
    expect(latestHook?.addLastCompletedElapsedSeconds).not.toBeNull();
    expect(latestHook?.addLastCompletedAddedCount).toBe(1);
    expect(latestHook?.addLastCompletedDuplicateCount).toBe(1);
    expect(latestHook?.referenceInput).toBe("");
    expect(apiPostMock).toHaveBeenLastCalledWith("/api/admin/ai/persona-references/check", {
      names: ["Anthony Bourdain", "Hayao Miyazaki"],
    });
    expect(toast.success).toHaveBeenCalledWith("Added 1 reference name.");
  });

  it("clears a row without triggering another reference-check request", async () => {
    apiPostMock.mockImplementation((url: string, payload: { names: string[] }) => {
      if (url === "/api/admin/ai/persona-references/check") {
        return Promise.resolve({
          items: payload.names.map((name) => ({
            input: name,
            matchKey: name
              .trim()
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, ""),
            romanizedName: name.trim(),
            exists: false,
          })),
        });
      }
      throw new Error(`Unexpected URL: ${url}`);
    });

    await act(async () => {
      root.render(React.createElement(Harness));
    });

    await act(async () => {
      latestHook?.setReferenceInput("Alpha\nBeta");
    });

    await act(async () => {
      await latestHook?.addReferenceRowsFromInput();
      await flushPromises();
    });

    expect(apiPostMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      await latestHook?.clearRow(latestHook!.rows[1]!.rowId);
      await flushPromises();
    });

    expect(apiPostMock).toHaveBeenCalledTimes(1);
    expect(latestHook?.rows).toHaveLength(1);
    expect(latestHook?.rows[0]?.referenceName).toBe("Alpha");
    expect(latestHook?.rows[0]?.referenceCheckStatus).toBe("new");
    expect(toast.success).toHaveBeenCalledWith("Row cleared");
  });

  it("does not cap added reference rows at 50", async () => {
    apiPostMock.mockImplementation((url: string, payload: { names: string[] }) => {
      if (url === "/api/admin/ai/persona-references/check") {
        return Promise.resolve({
          items: payload.names.map((name) => ({
            input: name,
            matchKey: name
              .trim()
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, ""),
            romanizedName: name.trim(),
            exists: false,
          })),
        });
      }
      throw new Error(`Unexpected URL: ${url}`);
    });

    await act(async () => {
      root.render(React.createElement(Harness));
    });

    const names = Array.from({ length: 55 }, (_, index) => `Reference ${index + 1}`);

    await act(async () => {
      latestHook?.setReferenceInput(names.join("\n"));
    });

    await act(async () => {
      await latestHook?.addReferenceRowsFromInput();
      await flushPromises();
    });

    expect(latestHook?.rows).toHaveLength(55);
    expect(latestHook?.rows[54]?.referenceName).toBe("Reference 55");
    expect(latestHook?.addLastCompletedAddedCount).toBe(55);
    expect(latestHook?.addLastCompletedDuplicateCount).toBe(0);
    expect(apiPostMock).toHaveBeenLastCalledWith("/api/admin/ai/persona-references/check", {
      names,
    });
  });

  it("clears the input and reports zero added rows when every submitted name is a duplicate", async () => {
    apiPostMock.mockImplementation((url: string, payload: { names: string[] }) => {
      if (url === "/api/admin/ai/persona-references/check") {
        return Promise.resolve({
          items: payload.names.map((name) => ({
            input: name,
            matchKey: name
              .trim()
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, ""),
            romanizedName: name.trim(),
            exists: false,
          })),
        });
      }
      throw new Error(`Unexpected URL: ${url}`);
    });

    await act(async () => {
      root.render(React.createElement(Harness));
    });

    await act(async () => {
      latestHook?.setReferenceInput("Anthony Bourdain");
    });

    await act(async () => {
      await latestHook?.addReferenceRowsFromInput();
      await flushPromises();
    });

    expect(latestHook?.rows).toHaveLength(1);

    await act(async () => {
      latestHook?.setReferenceInput("Anthony Bourdain");
    });

    await act(async () => {
      await latestHook?.addReferenceRowsFromInput();
      await flushPromises();
    });

    expect(latestHook?.rows).toHaveLength(1);
    expect(latestHook?.referenceInput).toBe("");
    expect(latestHook?.addLastCompletedAddedCount).toBe(0);
    expect(latestHook?.addLastCompletedDuplicateCount).toBe(1);
    expect(latestHook?.addLastCompletedElapsedSeconds).toBe(0);
  });

  it("only enables and runs bulk actions for rows that match each action's eligibility rules", async () => {
    apiPostMock.mockImplementation((url: string, payload: Record<string, unknown>) => {
      if (url === "/api/admin/ai/persona-references/check") {
        const names = (payload.names as string[]) ?? [];
        return Promise.resolve({
          items: names.map((name) => ({
            input: name,
            matchKey: name
              .trim()
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, ""),
            romanizedName: name.trim(),
            exists: false,
          })),
        });
      }
      if (url === "/api/admin/ai/persona-generation/prompt-assist") {
        return Promise.resolve({ text: `Prompt for ${payload.inputPrompt as string}` });
      }
      if (url === "/api/admin/ai/persona-generation/preview") {
        return Promise.resolve({
          preview: mockPersonaGenerationPreview,
        });
      }
      if (url === "/api/admin/ai/personas") {
        return Promise.resolve({ personaId: "persona-bulk" });
      }
      throw new Error(`Unexpected URL: ${url}`);
    });

    await act(async () => {
      root.render(React.createElement(Harness));
    });

    await act(async () => {
      latestHook?.setReferenceInput("Alpha\nBeta\nGamma\nDelta");
    });

    await act(async () => {
      await latestHook?.addReferenceRowsFromInput();
      await flushPromises();
    });

    await act(async () => {
      const alphaRowId = latestHook?.rows[0]?.rowId;
      const betaRowId = latestHook?.rows[1]?.rowId;
      const gammaRowId = latestHook?.rows[2]?.rowId;
      const deltaRowId = latestHook?.rows[3]?.rowId;
      if (!alphaRowId || !betaRowId || !gammaRowId || !deltaRowId) {
        throw new Error("Expected seeded rows");
      }

      latestHook?.updateContextPrompt(betaRowId, "Context for beta");
      latestHook?.updateContextPrompt(gammaRowId, "Context for gamma");

      await latestHook?.runRowGenerate(gammaRowId);
      await flushPromises();
      await latestHook?.runRowSave(gammaRowId);
      await flushPromises();
    });

    expect(latestHook?.canBulkPrompt).toBe(true);
    expect(latestHook?.canBulkGenerate).toBe(true);
    expect(latestHook?.canBulkSave).toBe(false);

    await act(async () => {
      await latestHook?.runBulkPromptAssist();
      await flushPromises();
    });

    expect(apiPostMock).toHaveBeenCalledWith("/api/admin/ai/persona-generation/prompt-assist", {
      modelId: "model-1",
      inputPrompt: "Alpha",
    });
    expect(apiPostMock).toHaveBeenCalledWith("/api/admin/ai/persona-generation/prompt-assist", {
      modelId: "model-1",
      inputPrompt: "Delta",
    });
    expect(apiPostMock).not.toHaveBeenCalledWith(
      "/api/admin/ai/persona-generation/prompt-assist",
      expect.objectContaining({ inputPrompt: "Context for beta" }),
    );
    expect(latestHook?.rows[0]?.contextPrompt).toBe("Prompt for Alpha");
    expect(latestHook?.rows[3]?.contextPrompt).toBe("Prompt for Delta");

    expect(latestHook?.canBulkGenerate).toBe(true);

    await act(async () => {
      await latestHook?.runBulkGenerate();
      await flushPromises();
    });

    const previewCalls = apiPostMock.mock.calls.filter(
      (call) => call[0] === "/api/admin/ai/persona-generation/preview",
    );
    expect(previewCalls).toHaveLength(4);
    expect(latestHook?.rows[0]?.personaData).not.toBeNull();
    expect(latestHook?.rows[1]?.personaData).not.toBeNull();
    expect(latestHook?.rows[2]?.personaData).not.toBeNull();
    expect(latestHook?.rows[3]?.personaData).not.toBeNull();

    expect(latestHook?.canBulkSave).toBe(true);

    await act(async () => {
      await latestHook?.runBulkSave();
      await flushPromises();
    });

    const saveCalls = apiPostMock.mock.calls.filter((call) => call[0] === "/api/admin/ai/personas");
    expect(saveCalls).toHaveLength(4);
    expect(latestHook?.rows[0]?.saved).toBe(true);
    expect(latestHook?.rows[1]?.saved).toBe(true);
    expect(latestHook?.rows[2]?.saved).toBe(true);
    expect(latestHook?.rows[3]?.saved).toBe(true);
    expect(latestHook?.canBulkSave).toBe(false);
  });

  it("blocks prompt assist until reference checking succeeds, then fills the context prompt", async () => {
    let resolveCheck: ((value: unknown) => void) | null = null;
    let addPromise: Promise<void> | undefined;
    apiPostMock.mockImplementation((url: string, payload: { names: string[] }) => {
      if (url === "/api/admin/ai/persona-references/check") {
        return new Promise((resolve) => {
          resolveCheck = resolve;
        });
      }
      if (url === "/api/admin/ai/persona-generation/prompt-assist") {
        return Promise.resolve({ text: "A sharp cultural critic inspired by Anthony Bourdain." });
      }
      throw new Error(`Unexpected URL: ${url}`);
    });

    await act(async () => {
      root.render(React.createElement(Harness));
    });

    await act(async () => {
      latestHook?.setReferenceInput("Anthony Bourdain");
    });

    act(() => {
      addPromise = latestHook?.addReferenceRowsFromInput();
    });

    await act(async () => {
      await flushPromises();
    });

    const rowId = latestHook?.rows[0]?.rowId;
    expect(rowId).toBeTruthy();

    await act(async () => {
      await latestHook?.runRowPromptAssist(rowId!);
    });

    expect(apiPostMock).toHaveBeenCalledTimes(1);
    expect(latestHook?.rows[0]?.contextPrompt).toBe("");

    await act(async () => {
      resolveCheck?.({
        items: [
          {
            input: "Anthony Bourdain",
            matchKey: "anthonybourdain",
            romanizedName: "Anthony Bourdain",
            exists: false,
          },
        ],
      });
      await addPromise;
      await flushPromises();
    });

    expect(latestHook?.rows[0]?.referenceCheckStatus).toBe("new");

    await act(async () => {
      await latestHook?.runRowPromptAssist(rowId!);
      await flushPromises();
    });

    expect(apiPostMock).toHaveBeenLastCalledWith("/api/admin/ai/persona-generation/prompt-assist", {
      modelId: "model-1",
      inputPrompt: "Anthony Bourdain",
    });
    expect(latestHook?.rows[0]?.contextPrompt).toContain("Anthony Bourdain");
  });

  it("stores prompt-assist error payloads with the failing llm result for debug modal inspection", async () => {
    apiPostMock.mockImplementation((url: string, payload: { names?: string[] }) => {
      if (url === "/api/admin/ai/persona-references/check") {
        return Promise.resolve({
          items: [
            {
              input: "Roland Barthes",
              matchKey: "rolandbarthes",
              romanizedName: "Roland Barthes",
              exists: false,
            },
          ],
        });
      }
      if (url === "/api/admin/ai/persona-generation/prompt-assist") {
        return Promise.reject(
          new ApiError(
            "prompt assist output must include at least 1 explicit real reference name",
            400,
            {
              error: "prompt assist output must include at least 1 explicit real reference name",
              code: "prompt_assist_missing_reference",
              result: "A globe-trotting storyteller who turns every meal into a social map.",
            },
          ),
        );
      }
      throw new Error(`Unexpected URL: ${url}`);
    });

    await act(async () => {
      root.render(React.createElement(Harness));
    });

    await act(async () => {
      latestHook?.setReferenceInput("Roland Barthes");
    });

    await act(async () => {
      await latestHook?.addReferenceRowsFromInput();
      await flushPromises();
    });

    const rowId = latestHook?.rows[0]?.rowId;
    expect(rowId).toBeTruthy();

    await act(async () => {
      await latestHook?.runRowPromptAssist(rowId!);
      await flushPromises();
    });

    expect(latestHook?.rows[0]?.latestError).toMatchObject({
      type: "prompt",
      message: "prompt assist output must include at least 1 explicit real reference name",
      rawResponse: {
        error: "prompt assist output must include at least 1 explicit real reference name",
        code: "prompt_assist_missing_reference",
        result: "A globe-trotting storyteller who turns every meal into a social map.",
      },
    });
  });

  it("generates persona data, saves it, and then re-saves via update after identity edits", async () => {
    apiPostMock.mockImplementation((url: string, payload: Record<string, unknown>) => {
      if (url === "/api/admin/ai/persona-references/check") {
        return Promise.resolve({
          items: [
            {
              input: "Anthony Bourdain",
              matchKey: "anthonybourdain",
              romanizedName: "Anthony Bourdain",
              exists: false,
            },
          ],
        });
      }
      if (url === "/api/admin/ai/persona-generation/preview") {
        return Promise.resolve({
          preview: mockPersonaGenerationPreview,
        });
      }
      if (url === "/api/admin/ai/personas") {
        return Promise.resolve({ personaId: "persona-1" });
      }
      throw new Error(`Unexpected URL: ${url}`);
    });
    apiPatchMock.mockResolvedValue({ success: true });

    await act(async () => {
      root.render(React.createElement(Harness));
    });

    await act(async () => {
      latestHook?.setReferenceInput("Anthony Bourdain");
    });

    await act(async () => {
      await latestHook?.addReferenceRowsFromInput();
      await flushPromises();
    });

    const rowId = latestHook?.rows[0]?.rowId!;

    await act(async () => {
      latestHook?.updateContextPrompt(
        rowId,
        "A globe-trotting critic in the voice of Anthony Bourdain.",
      );
    });

    await act(async () => {
      await latestHook?.runRowGenerate(rowId);
      await flushPromises();
    });

    expect(latestHook?.rows[0]?.personaData).toEqual(mockPersonaGenerationPreview.structured);
    expect(latestHook?.rows[0]?.displayName).toBe("Riptide Roo");
    expect(latestHook?.rows[0]?.username.startsWith("ai_")).toBe(true);

    await act(async () => {
      await latestHook?.runRowSave(rowId);
      await flushPromises();
    });

    expect(apiPostMock).toHaveBeenCalledWith(
      "/api/admin/ai/personas",
      expect.objectContaining({
        username: latestHook?.rows[0]?.username,
      }),
    );
    expect(latestHook?.rows[0]?.saved).toBe(true);
    expect(latestHook?.rows[0]?.savedPersonaId).toBe("persona-1");

    await act(async () => {
      latestHook?.updatePersonaIdentity(rowId, {
        displayName: "Edited Persona",
        username: "ai_edited_persona",
      });
    });

    expect(latestHook?.rows[0]?.saved).toBe(false);
    expect(latestHook?.rows[0]?.displayName).toBe("Edited Persona");
    expect(latestHook?.rows[0]?.username).toBe("ai_edited_persona");

    await act(async () => {
      await latestHook?.runRowSave(rowId);
      await flushPromises();
    });

    expect(apiPatchMock).toHaveBeenCalledWith(
      "/api/admin/ai/personas/persona-1",
      expect.objectContaining({
        displayName: "Edited Persona",
        username: "ai_edited_persona",
      }),
    );
    expect(latestHook?.rows[0]?.saved).toBe(true);
  });

  it("pauses bulk prompt processing after the current chunk settles and resumes the remaining rows when prompt is clicked again", async () => {
    const promptDeferredByName = new Map<string, ReturnType<typeof createDeferred>>();

    apiPostMock.mockImplementation(
      (url: string, payload: { names?: string[]; inputPrompt?: string }) => {
        if (url === "/api/admin/ai/persona-references/check") {
          return Promise.resolve({
            items: (payload.names ?? []).map((name) => ({
              input: name,
              matchKey: name
                .trim()
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, ""),
              romanizedName: name.trim(),
              exists: false,
            })),
          });
        }
        if (url === "/api/admin/ai/persona-generation/prompt-assist") {
          const deferred = createDeferred();
          promptDeferredByName.set(payload.inputPrompt ?? "", deferred);
          return deferred.promise.then(() => ({
            text: `Prompt for ${payload.inputPrompt}`,
          }));
        }
        throw new Error(`Unexpected URL: ${url}`);
      },
    );

    await act(async () => {
      root.render(React.createElement(Harness));
    });

    await act(async () => {
      latestHook?.setReferenceInput("Anthony Bourdain\nHayao Miyazaki\nOctavia Butler");
      latestHook?.setChunkSize(2);
    });

    await act(async () => {
      await latestHook?.addReferenceRowsFromInput();
      await flushPromises();
    });

    act(() => {
      void latestHook?.runBulkPromptAssist();
    });

    await act(async () => {
      await flushPromises();
    });

    expect(latestHook?.bulkTask).toBe("prompt");
    expect(apiPostMock).toHaveBeenCalledWith("/api/admin/ai/persona-generation/prompt-assist", {
      modelId: "model-1",
      inputPrompt: "Anthony Bourdain",
    });
    expect(apiPostMock).toHaveBeenCalledWith("/api/admin/ai/persona-generation/prompt-assist", {
      modelId: "model-1",
      inputPrompt: "Hayao Miyazaki",
    });

    act(() => {
      latestHook?.requestBulkPause();
    });

    await act(async () => {
      promptDeferredByName.get("Anthony Bourdain")?.resolve();
      promptDeferredByName.get("Hayao Miyazaki")?.resolve();
      await flushPromises();
    });

    expect(latestHook?.bulkTask).toBeNull();
    expect(latestHook?.bulkPausedTask).toBe("prompt");
    expect(latestHook?.rows[0]?.contextPrompt).toBe("Prompt for Anthony Bourdain");
    expect(latestHook?.rows[1]?.contextPrompt).toBe("Prompt for Hayao Miyazaki");
    expect(latestHook?.rows[2]?.contextPrompt).toBe("");

    act(() => {
      void latestHook?.runBulkPromptAssist();
    });

    await act(async () => {
      await flushPromises();
    });

    expect(latestHook?.bulkTask).toBe("prompt");
    expect(apiPostMock).toHaveBeenCalledWith("/api/admin/ai/persona-generation/prompt-assist", {
      modelId: "model-1",
      inputPrompt: "Octavia Butler",
    });

    await act(async () => {
      promptDeferredByName.get("Octavia Butler")?.resolve();
      await flushPromises();
    });

    expect(latestHook?.bulkTask).toBeNull();
    expect(latestHook?.bulkPausedTask).toBeNull();
    expect(latestHook?.bulkLastCompletedTask).toBe("prompt");
    expect(latestHook?.rows[2]?.contextPrompt).toBe("Prompt for Octavia Butler");
  });

  it("switches to a different bulk action while paused instead of forcing the old queue to resume", async () => {
    const promptDeferredByName = new Map<string, ReturnType<typeof createDeferred>>();

    apiPostMock.mockImplementation(
      (url: string, payload: { names?: string[]; inputPrompt?: string; extraPrompt?: string }) => {
        if (url === "/api/admin/ai/persona-references/check") {
          return Promise.resolve({
            items: (payload.names ?? []).map((name) => ({
              input: name,
              matchKey: name
                .trim()
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, ""),
              romanizedName: name.trim(),
              exists: false,
            })),
          });
        }
        if (url === "/api/admin/ai/persona-generation/prompt-assist") {
          const deferred = createDeferred();
          promptDeferredByName.set(payload.inputPrompt ?? "", deferred);
          return deferred.promise.then(() => ({
            text: `Prompt for ${payload.inputPrompt}`,
          }));
        }
        if (url === "/api/admin/ai/persona-generation/preview") {
          return Promise.resolve({
            preview: mockPersonaGenerationPreview,
          });
        }
        throw new Error(`Unexpected URL: ${url}`);
      },
    );

    await act(async () => {
      root.render(React.createElement(Harness));
    });

    await act(async () => {
      latestHook?.setReferenceInput("Anthony Bourdain\nHayao Miyazaki\nOctavia Butler");
      latestHook?.setChunkSize(2);
    });

    await act(async () => {
      await latestHook?.addReferenceRowsFromInput();
      await flushPromises();
    });

    act(() => {
      void latestHook?.runBulkPromptAssist();
    });

    await act(async () => {
      await flushPromises();
    });

    act(() => {
      latestHook?.requestBulkPause();
    });

    await act(async () => {
      promptDeferredByName.get("Anthony Bourdain")?.resolve();
      promptDeferredByName.get("Hayao Miyazaki")?.resolve();
      await flushPromises();
    });

    expect(latestHook?.bulkPausedTask).toBe("prompt");
    expect(latestHook?.rows[2]?.contextPrompt).toBe("");

    act(() => {
      void latestHook?.runBulkGenerate();
    });

    await act(async () => {
      await flushPromises();
    });

    expect(latestHook?.bulkTask).toBeNull();
    expect(latestHook?.bulkPausedTask).toBeNull();
    expect(latestHook?.bulkLastCompletedTask).toBe("generate");
    expect(apiPostMock).toHaveBeenCalledWith("/api/admin/ai/persona-generation/preview", {
      modelId: "model-1",
      extraPrompt: "Prompt for Anthony Bourdain",
    });
    expect(apiPostMock).toHaveBeenCalledWith("/api/admin/ai/persona-generation/preview", {
      modelId: "model-1",
      extraPrompt: "Prompt for Hayao Miyazaki",
    });
    expect(apiPostMock).not.toHaveBeenCalledWith("/api/admin/ai/persona-generation/prompt-assist", {
      modelId: "model-1",
      inputPrompt: "Octavia Butler",
    });
  });
});
