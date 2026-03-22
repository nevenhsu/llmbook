/** @vitest-environment jsdom */

import { act } from "react";
import React from "react";
import ReactDOMClient from "react-dom/client";
import toast from "react-hot-toast";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PersonaBatchRow } from "@/lib/ai/admin/persona-batch-contract";
import { PersonaBatchTable } from "./PersonaBatchTable";

vi.mock("react-hot-toast", () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function buildRow(
  overrides: Partial<PersonaBatchRow> & Pick<PersonaBatchRow, "rowId" | "referenceName">,
): PersonaBatchRow {
  return {
    rowId: overrides.rowId,
    referenceName: overrides.referenceName,
    dbReferenceExists: overrides.dbReferenceExists ?? false,
    contextPrompt: overrides.contextPrompt ?? "",
    displayName: overrides.displayName ?? "",
    username: overrides.username ?? "",
    personaData: overrides.personaData ?? null,
    saved: overrides.saved ?? false,
    savedPersonaId: overrides.savedPersonaId ?? null,
    promptChangedSinceGenerate: overrides.promptChangedSinceGenerate ?? false,
    referenceCheckStatus: overrides.referenceCheckStatus ?? "unchecked",
    activeTask: overrides.activeTask ?? null,
    activeElapsedSeconds: overrides.activeElapsedSeconds ?? 0,
    lastCompletedTask: overrides.lastCompletedTask ?? null,
    lastCompletedElapsedSeconds: overrides.lastCompletedElapsedSeconds ?? 0,
    latestError: overrides.latestError ?? null,
  };
}

describe("PersonaBatchTable", () => {
  let container: HTMLDivElement;
  let root: ReactDOMClient.Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = ReactDOMClient.createRoot(container);
    Object.defineProperty(globalThis.navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("renders reference status, persona identity, task time badge, and error badge", async () => {
    await act(async () => {
      root.render(
        React.createElement(PersonaBatchTable, {
          rows: [
            buildRow({
              rowId: "row-1",
              referenceName: "Anthony Bourdain",
              contextPrompt: "A globe-trotting storyteller who treats food like a social map.",
              displayName: "RiptideRoo",
              username: "ai_riptideroo",
              referenceCheckStatus: "new",
              lastCompletedTask: "generate",
              lastCompletedElapsedSeconds: 31,
            }),
            buildRow({
              rowId: "row-2",
              referenceName: "Hayao Miyazaki",
              referenceCheckStatus: "duplicate",
              latestError: {
                type: "check",
                message: "Reference already exists",
                apiUrl: "/api/admin/ai/persona-references/check",
                payload: { names: ["Hayao Miyazaki"] },
                rawResponse: { exists: true },
                createdAt: "2026-03-22T00:00:00.000Z",
              },
            }),
          ],
          chunkSize: 10,
          bulkTask: null,
          bulkElapsedSeconds: 0,
          bulkPausedTask: null,
          bulkPausedElapsedSeconds: 0,
          bulkPauseRequested: false,
          bulkLastCompletedTask: "generate",
          bulkLastElapsedSeconds: 24,
          canBulkPrompt: true,
          canBulkGenerate: false,
          canBulkSave: false,
          anyApiActive: false,
          bulkActionsDisabled: false,
          canReset: true,
          canRemoveDuplicates: true,
          onOpenChunkSize: vi.fn(),
          onBulkPrompt: vi.fn(),
          onBulkGenerate: vi.fn(),
          onBulkSave: vi.fn(),
          onRequestBulkPause: vi.fn(),
          onResumeBulkTask: vi.fn(),
          onRemoveDuplicates: vi.fn(),
          onReset: vi.fn(),
          onEditContextPrompt: vi.fn(),
          onEditIdentity: vi.fn(),
          onViewPersona: vi.fn(),
          onViewError: vi.fn(),
          onRunPromptAssist: vi.fn(),
          onRunGenerate: vi.fn(),
          onRunSave: vi.fn(),
          onClear: vi.fn(),
        }),
      );
    });

    expect(container.textContent).toContain("Reference Name");
    expect(container.textContent).toContain("Batch Rows");
    expect(container.textContent).toContain("2 rows");
    expect(container.textContent).toContain("Chunk Size: 10");
    expect(container.textContent).toContain("Prompt");
    expect(container.textContent).toContain("Anthony Bourdain");
    expect(container.textContent).toContain("New");
    expect(container.textContent).toContain("Duplicate");
    expect(container.textContent).toContain("RiptideRoo");
    expect(container.textContent).toContain("ai_riptideroo");
    expect(container.textContent).toContain("Generate");
    expect(container.textContent).toContain("Prompt");
    expect(container.textContent).toContain("00:31");
    expect(container.textContent).toContain("View check error");
    expect(container.textContent).toContain("View");
    expect(container.textContent).toContain("Edit");

    expect(container.textContent).toContain("Generated 00:24");

    const trailingControls = container.querySelector('[data-testid="batch-rows-header-trailing"]');
    expect(trailingControls).not.toBeNull();
    const trailingButtons = trailingControls?.querySelectorAll("button");
    expect(trailingButtons?.length).toBe(2);
    expect(trailingButtons?.[0]?.textContent).toContain("Clear");
    expect(trailingButtons?.[1]?.textContent).toContain("Reset");
    expect(trailingButtons?.[1]?.className).toContain("btn-outline");
    const removeTooltip = trailingControls?.querySelector('[data-tip="remove duplicate names"]');
    expect(removeTooltip).not.toBeNull();
    expect(removeTooltip?.className).toContain("tooltip-top");
    expect(trailingButtons?.[0]?.className).toContain("btn-error");

    const tableHeaderCell = container.querySelector("thead th");
    expect(tableHeaderCell?.className).toContain("border-base-content/20");

    const tableDataCell = container.querySelector("tbody td");
    expect(tableDataCell?.className).toContain("border-base-content/20");

    const table = container.querySelector("table");
    expect(table?.className).toContain("min-w-[88rem]");

    const contextPromptCell = container.querySelectorAll("tbody td")[1];
    expect(contextPromptCell?.className).toContain("w-[180px]");
    const contextPromptText = contextPromptCell?.querySelector("div");
    expect(contextPromptText?.className).toContain("truncate");

    const clearButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.trim() === "Clear",
    );
    expect(clearButton?.className).toContain("btn-error");

    const rowClearButton = Array.from(container.querySelectorAll("tbody button")).find(
      (button) => button.textContent?.trim() === "Clear",
    );
    expect(rowClearButton?.className).toContain("btn-error");

    const rowPromptButton = Array.from(container.querySelectorAll("tbody button")).find(
      (button) => button.textContent?.trim() === "Prompt",
    );
    expect(rowPromptButton).toBeDefined();

    const headerControls = container.querySelector('[data-testid="batch-rows-header-controls"]');
    const headerButtons = Array.from(headerControls?.querySelectorAll("button") ?? []);
    const bulkPromptButton = headerButtons.find(
      (button) => button.textContent?.trim() === "Prompt",
    ) as HTMLButtonElement | undefined;
    const bulkGenerateButton = headerButtons.find(
      (button) => button.textContent?.trim() === "Generate",
    ) as HTMLButtonElement | undefined;
    const bulkSaveButton = headerButtons.find((button) => button.textContent?.trim() === "Save") as
      | HTMLButtonElement
      | undefined;
    expect(bulkPromptButton?.disabled).toBe(false);
    expect(bulkGenerateButton?.disabled).toBe(true);
    expect(bulkSaveButton?.disabled).toBe(true);

    const secondRowCells = container.querySelectorAll("tbody tr")[1]?.querySelectorAll("td");
    const duplicateContextEditButton = Array.from(
      secondRowCells?.[1]?.querySelectorAll("button") ?? [],
    ).find((button) => button.textContent?.trim() === "Edit");
    expect(duplicateContextEditButton).toBeDefined();
    expect((duplicateContextEditButton as HTMLButtonElement | undefined)?.disabled).toBe(true);

    const duplicatePersonaButtons = Array.from(
      secondRowCells?.[2]?.querySelectorAll("button") ?? [],
    );
    const duplicatePersonaEditButton = duplicatePersonaButtons.find(
      (button) => button.textContent?.trim() === "Edit",
    );
    expect(duplicatePersonaEditButton).toBeDefined();
    expect((duplicatePersonaEditButton as HTMLButtonElement | undefined)?.disabled).toBe(true);

    const errorButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.trim() === "View check error",
    );
    expect(errorButton?.className).toContain("btn-error");
  });

  it("shows pause while a bulk task is running and keeps eligible bulk actions clickable once the batch is paused", async () => {
    const noop = vi.fn();
    const onBulkGenerate = vi.fn();

    await act(async () => {
      root.render(
        React.createElement(PersonaBatchTable, {
          rows: [
            buildRow({
              rowId: "row-1",
              referenceName: "Anthony Bourdain",
              referenceCheckStatus: "new",
            }),
          ],
          chunkSize: 10,
          bulkTask: "generate",
          bulkElapsedSeconds: 12,
          bulkLastCompletedTask: null,
          bulkLastElapsedSeconds: 0,
          bulkPausedTask: null,
          bulkPausedElapsedSeconds: 0,
          bulkPauseRequested: false,
          canBulkPrompt: false,
          canBulkGenerate: true,
          canBulkSave: false,
          anyApiActive: true,
          bulkActionsDisabled: true,
          canReset: false,
          canRemoveDuplicates: false,
          onOpenChunkSize: noop,
          onBulkPrompt: noop,
          onBulkGenerate,
          onBulkSave: noop,
          onRequestBulkPause: noop,
          onResumeBulkTask: noop,
          onRemoveDuplicates: noop,
          onReset: noop,
          onEditContextPrompt: noop,
          onEditIdentity: noop,
          onViewPersona: noop,
          onViewError: noop,
          onRunPromptAssist: noop,
          onRunGenerate: noop,
          onRunSave: noop,
          onClear: noop,
        }),
      );
    });

    const pauseButton = container.querySelector('button[aria-label="Pause bulk task"]');
    expect(pauseButton).not.toBeNull();
    expect(pauseButton?.className).toContain("btn-ghost");
    expect(container.textContent).toContain("Generating 00:12");

    await act(async () => {
      root.render(
        React.createElement(PersonaBatchTable, {
          rows: [
            buildRow({
              rowId: "row-1",
              referenceName: "Anthony Bourdain",
              referenceCheckStatus: "new",
            }),
          ],
          chunkSize: 10,
          bulkTask: null,
          bulkElapsedSeconds: 0,
          bulkLastCompletedTask: null,
          bulkLastElapsedSeconds: 0,
          bulkPausedTask: "generate",
          bulkPausedElapsedSeconds: 12,
          bulkPauseRequested: false,
          canBulkPrompt: false,
          canBulkGenerate: true,
          canBulkSave: false,
          anyApiActive: false,
          bulkActionsDisabled: false,
          canReset: true,
          canRemoveDuplicates: false,
          onOpenChunkSize: noop,
          onBulkPrompt: noop,
          onBulkGenerate,
          onBulkSave: noop,
          onRequestBulkPause: noop,
          onResumeBulkTask: noop,
          onRemoveDuplicates: noop,
          onReset: noop,
          onEditContextPrompt: noop,
          onEditIdentity: noop,
          onViewPersona: noop,
          onViewError: noop,
          onRunPromptAssist: noop,
          onRunGenerate: noop,
          onRunSave: noop,
          onClear: noop,
        }),
      );
    });

    const resumeButton = container.querySelector('button[aria-label="Resume bulk task"]');
    expect(resumeButton).not.toBeNull();
    expect(resumeButton?.className).toContain("btn-ghost");
    expect(container.textContent).toContain("Generating 00:12 paused");

    const bulkGenerateButton = Array.from(
      container.querySelectorAll('[data-testid="batch-rows-header-controls"] button'),
    ).find((button) => button.textContent?.includes("Generate")) as HTMLButtonElement | undefined;
    expect(bulkGenerateButton?.disabled).toBe(false);

    await act(async () => {
      bulkGenerateButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onBulkGenerate).toHaveBeenCalledTimes(1);
  });

  it("copies a row context prompt and shows a toast", async () => {
    await act(async () => {
      root.render(
        React.createElement(PersonaBatchTable, {
          rows: [
            buildRow({
              rowId: "row-1",
              referenceName: "Anthony Bourdain",
              contextPrompt: "A globe-trotting storyteller who treats food like a social map.",
              referenceCheckStatus: "new",
            }),
          ],
          chunkSize: 10,
          bulkTask: null,
          bulkElapsedSeconds: 0,
          bulkPausedTask: null,
          bulkPausedElapsedSeconds: 0,
          bulkPauseRequested: false,
          bulkLastCompletedTask: null,
          bulkLastElapsedSeconds: 0,
          canBulkPrompt: false,
          canBulkGenerate: false,
          canBulkSave: false,
          anyApiActive: false,
          bulkActionsDisabled: false,
          canReset: true,
          canRemoveDuplicates: false,
          onOpenChunkSize: vi.fn(),
          onBulkPrompt: vi.fn(),
          onBulkGenerate: vi.fn(),
          onBulkSave: vi.fn(),
          onRequestBulkPause: vi.fn(),
          onResumeBulkTask: vi.fn(),
          onRemoveDuplicates: vi.fn(),
          onReset: vi.fn(),
          onEditContextPrompt: vi.fn(),
          onEditIdentity: vi.fn(),
          onViewPersona: vi.fn(),
          onViewError: vi.fn(),
          onRunPromptAssist: vi.fn(),
          onRunGenerate: vi.fn(),
          onRunSave: vi.fn(),
          onClear: vi.fn(),
        }),
      );
    });

    const copyButton = Array.from(container.querySelectorAll("tbody button")).find(
      (button) => button.textContent?.trim() === "Copy",
    ) as HTMLButtonElement | undefined;
    expect(copyButton).toBeDefined();

    await act(async () => {
      copyButton?.click();
    });

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      "A globe-trotting storyteller who treats food like a social map.",
    );
    expect(toast.success).toHaveBeenCalledWith("Context prompt copied");
  });
});
