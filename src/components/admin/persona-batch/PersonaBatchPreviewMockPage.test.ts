/** @vitest-environment jsdom */

import { act } from "react";
import React from "react";
import ReactDOMClient from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PersonaBatchPreviewMockPage } from "./PersonaBatchPreviewMockPage";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function setTextareaValue(textarea: HTMLTextAreaElement, value: string) {
  const descriptor = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value");
  descriptor?.set?.call(textarea, value);
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
}

describe("PersonaBatchPreviewMockPage", () => {
  let container: HTMLDivElement;
  let root: ReactDOMClient.Root;

  beforeEach(() => {
    vi.useFakeTimers();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = ReactDOMClient.createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.useRealTimers();
  });

  it("renders the preview-only batch persona workspace with mock rows", async () => {
    await act(async () => {
      root.render(React.createElement(PersonaBatchPreviewMockPage));
    });

    expect(container.textContent).toContain("Persona Batch Preview");
    expect(container.textContent).toContain("No network request or database write happens here.");
    expect(container.textContent).toContain("Anthony Bourdain");
    expect(container.textContent).toContain("Hayao Miyazaki");
    expect(container.textContent).toContain("Duplicate");
    expect(container.textContent).toContain("View");
    expect(container.textContent).not.toContain("Row Error");
  });

  it("resets preview state from the refresh action and auto-stops bulk loading after one second", async () => {
    await act(async () => {
      root.render(React.createElement(PersonaBatchPreviewMockPage));
    });

    const secondRow = container.querySelectorAll("tbody tr")[1];
    const clearRowButton = Array.from(secondRow?.querySelectorAll("button") ?? []).find(
      (button) => button.textContent?.trim() === "Clear",
    );
    expect(clearRowButton).toBeDefined();

    await act(async () => {
      clearRowButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.querySelector("tbody")?.textContent).not.toContain("Hayao Miyazaki");

    const refreshButton = container.querySelector('button[aria-label="Refresh preview"]');
    expect(refreshButton).toBeDefined();
    expect(refreshButton?.className).toContain("btn-ghost");
    expect(refreshButton?.className).not.toContain("btn-outline");

    await act(async () => {
      refreshButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.querySelector("tbody")?.textContent).toContain("Hayao Miyazaki");

    const headerControls = container.querySelector('[data-testid="batch-rows-header-controls"]');
    const bulkGenerateButton = Array.from(headerControls?.querySelectorAll("button") ?? []).find(
      (button) => button.textContent?.includes("Generate"),
    );
    expect(bulkGenerateButton).toBeDefined();

    await act(async () => {
      bulkGenerateButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.querySelector('[data-testid="bulk-loading-generate"]')).not.toBeNull();

    await act(async () => {
      vi.advanceTimersByTime(1000);
    });

    expect(container.querySelector('[data-testid="bulk-loading-generate"]')).toBeNull();
    expect(container.textContent).toContain("Generated 00:01");
  });

  it("shows prompt loading and elapsed text inside the edit-context modal during preview prompt assist", async () => {
    await act(async () => {
      root.render(React.createElement(PersonaBatchPreviewMockPage));
    });

    const firstRow = container.querySelectorAll("tbody tr")[0];
    const editContextButton = Array.from(firstRow?.querySelectorAll("button") ?? []).find(
      (button) => button.textContent?.trim() === "Edit",
    );
    expect(editContextButton).toBeDefined();

    await act(async () => {
      editContextButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const contextModal = Array.from(container.querySelectorAll("dialog")).find((dialog) =>
      dialog.textContent?.includes("Edit Context Prompt"),
    );
    expect(contextModal).toBeDefined();

    const promptButton = contextModal?.querySelector('button[aria-label="Prompt"]');
    expect(promptButton).toBeDefined();

    await act(async () => {
      promptButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(contextModal?.textContent).toContain("Prompt 00:00");
    expect(contextModal?.querySelector(".loading.loading-spinner")).not.toBeNull();

    await act(async () => {
      vi.advanceTimersByTime(1000);
    });

    expect(contextModal?.textContent).toContain("Prompt 00:01");
    expect(contextModal?.textContent).not.toContain(
      "This keeps existing persona data until you regenerate.",
    );
    expect(contextModal?.querySelector(".loading.loading-spinner")).toBeNull();
  });

  it("shows add loading and elapsed text when preview adds new reference names", async () => {
    await act(async () => {
      root.render(React.createElement(PersonaBatchPreviewMockPage));
    });

    const addButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.trim() === "Add",
    );
    expect(addButton).toBeDefined();

    await act(async () => {
      addButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const addSummary = container.querySelector(
      '[data-testid="reference-input-add-status-summary"]',
    );
    const addElapsed = container.querySelector(
      '[data-testid="reference-input-add-status-elapsed"]',
    );
    expect(addSummary?.textContent).toBe("Adding");
    expect(addElapsed?.textContent).toBe("00:00");

    await act(async () => {
      vi.advanceTimersByTime(1000);
    });

    expect(
      container.querySelector('[data-testid="reference-input-add-status-summary"]')?.textContent,
    ).toBe("Added 1 row, 0 duplicates");
    expect(
      container.querySelector('[data-testid="reference-input-add-status-elapsed"]')?.textContent,
    ).toBe("00:01");
    expect(container.querySelector("tbody")?.textContent).toContain("Octavia Butler");
  });

  it("clears the input and shows zero added rows when preview add only contains duplicates", async () => {
    await act(async () => {
      root.render(React.createElement(PersonaBatchPreviewMockPage));
    });

    const textarea = container.querySelector("textarea") as HTMLTextAreaElement | null;
    expect(textarea).not.toBeNull();

    await act(async () => {
      if (textarea) {
        setTextareaValue(textarea, "Anthony Bourdain");
      }
    });

    expect((container.querySelector("textarea") as HTMLTextAreaElement | null)?.value).toBe(
      "Anthony Bourdain",
    );

    const addButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.trim() === "Add",
    );
    expect(addButton).toBeDefined();

    await act(async () => {
      addButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(
      container.querySelector('[data-testid="reference-input-add-status-summary"]')?.textContent,
    ).toBe("Added 0 rows, 1 duplicate");
    expect(
      container.querySelector('[data-testid="reference-input-add-status-elapsed"]')?.textContent,
    ).toBe("00:00");
    expect((container.querySelector("textarea") as HTMLTextAreaElement | null)?.value).toBe("");
  });

  it("does not reuse row ids after clearing a row and adding another reference", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await act(async () => {
      root.render(React.createElement(PersonaBatchPreviewMockPage));
    });

    const addButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.trim() === "Add",
    );
    expect(addButton).toBeDefined();

    await act(async () => {
      addButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      vi.advanceTimersByTime(1000);
    });

    const secondRow = container.querySelectorAll("tbody tr")[1];
    const clearRowButton = Array.from(secondRow?.querySelectorAll("button") ?? []).find(
      (button) => button.textContent?.trim() === "Clear",
    );
    expect(clearRowButton).toBeDefined();

    await act(async () => {
      clearRowButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const textarea = container.querySelector("textarea");
    expect(textarea).not.toBeNull();

    await act(async () => {
      setTextareaValue(textarea as HTMLTextAreaElement, "Leiji Matsumoto");
    });

    await act(async () => {
      addButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      vi.advanceTimersByTime(1000);
    });

    expect(
      consoleErrorSpy.mock.calls.some((call) =>
        call.some(
          (arg) =>
            typeof arg === "string" && arg.includes("Encountered two children with the same key"),
        ),
      ),
    ).toBe(false);

    consoleErrorSpy.mockRestore();
  });

  it("pauses after the current bulk preview chunk and resumes from the next chunk", async () => {
    await act(async () => {
      root.render(React.createElement(PersonaBatchPreviewMockPage));
    });

    const headerControls = container.querySelector('[data-testid="batch-rows-header-controls"]');
    const bulkGenerateButton = Array.from(headerControls?.querySelectorAll("button") ?? []).find(
      (button) => button.textContent?.includes("Generate"),
    );
    expect(bulkGenerateButton).toBeDefined();

    await act(async () => {
      bulkGenerateButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const pauseButton = container.querySelector('button[aria-label="Pause bulk task"]');
    expect(pauseButton).toBeDefined();

    await act(async () => {
      pauseButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await act(async () => {
      vi.advanceTimersByTime(1000);
    });

    expect(container.textContent).toContain("Generating 00:01 paused");

    const resumeButton = container.querySelector('button[aria-label="Resume bulk task"]');
    expect(resumeButton).toBeDefined();

    await act(async () => {
      resumeButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).toContain("Generating 00:01");

    await act(async () => {
      vi.advanceTimersByTime(1000);
    });

    expect(container.textContent).toContain("Generated 00:02");
    expect(container.querySelector('button[aria-label="Resume bulk task"]')).toBeNull();
  });
});
