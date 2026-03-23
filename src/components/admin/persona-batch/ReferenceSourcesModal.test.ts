/** @vitest-environment jsdom */

import { act } from "react";
import React from "react";
import ReactDOMClient from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ReferenceSourcesModal } from "./ReferenceSourcesModal";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("ReferenceSourcesModal", () => {
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

  it("renders textarea plus footer with left row count and right-aligned elapsed/add/close controls", async () => {
    await act(async () => {
      root.render(
        React.createElement(ReferenceSourcesModal, {
          isOpen: true,
          value: "Anthony Bourdain\nHayao Miyazaki",
          disabled: false,
          rowCount: 2,
          addLoading: true,
          addElapsedSeconds: 7,
          onChange: vi.fn(),
          onAdd: vi.fn(),
          onClose: vi.fn(),
        }),
      );
    });

    expect(container.textContent).toContain("Reference Sources");
    expect(container.textContent).toContain(
      "comma or newline separated, ex: Anthony Bourdain, Hayao Miyazaki, Ursula K. Le Guin",
    );
    expect(container.querySelector("textarea")).not.toBeNull();
    expect(
      container.querySelector('[data-testid="reference-sources-row-count"]')?.textContent,
    ).toBe("2 rows");
    expect(
      container.querySelector('[data-testid="reference-sources-add-elapsed"]')?.textContent,
    ).toBe("00:07");
    const footerActions = container.querySelector(
      '[data-testid="reference-sources-footer-actions"]',
    );
    expect(footerActions?.className).toContain("ml-auto");
    expect(footerActions?.textContent).toContain("Add");
    expect(footerActions?.textContent).toContain("Close");
    const addButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.trim() === "Add",
    );
    expect(addButton?.className).toContain("btn-sm");
  });

  it("shows completed add summary after the input has been cleared", async () => {
    await act(async () => {
      root.render(
        React.createElement(ReferenceSourcesModal, {
          isOpen: true,
          value: "",
          disabled: false,
          rowCount: 0,
          addLoading: false,
          addElapsedSeconds: 0,
          addLastCompletedElapsedSeconds: 1,
          addLastCompletedAddedCount: 2,
          addLastCompletedDuplicateCount: 1,
          onChange: vi.fn(),
          onAdd: vi.fn(),
          onClose: vi.fn(),
        }),
      );
    });

    await act(async () => {
      root.render(
        React.createElement(ReferenceSourcesModal, {
          isOpen: true,
          value: "",
          disabled: false,
          rowCount: 0,
          addLoading: true,
          addElapsedSeconds: 0,
          addLastCompletedElapsedSeconds: null,
          addLastCompletedAddedCount: null,
          addLastCompletedDuplicateCount: null,
          onChange: vi.fn(),
          onAdd: vi.fn(),
          onClose: vi.fn(),
        }),
      );
    });

    await act(async () => {
      root.render(
        React.createElement(ReferenceSourcesModal, {
          isOpen: true,
          value: "",
          disabled: false,
          rowCount: 0,
          addLoading: false,
          addElapsedSeconds: 0,
          addLastCompletedElapsedSeconds: 1,
          addLastCompletedAddedCount: 2,
          addLastCompletedDuplicateCount: 1,
          onChange: vi.fn(),
          onAdd: vi.fn(),
          onClose: vi.fn(),
        }),
      );
    });

    expect(
      container.querySelector('[data-testid="reference-sources-row-count"]')?.textContent,
    ).toBe("Added 2 rows, 1 duplicate");
    expect(
      container.querySelector('[data-testid="reference-sources-add-elapsed"]')?.textContent,
    ).toBe("00:01");
  });

  it("resets completed summary after closing and reopening the modal", async () => {
    await act(async () => {
      root.render(
        React.createElement(ReferenceSourcesModal, {
          isOpen: true,
          value: "",
          disabled: false,
          rowCount: 0,
          addLoading: true,
          addElapsedSeconds: 0,
          addLastCompletedElapsedSeconds: null,
          addLastCompletedAddedCount: null,
          addLastCompletedDuplicateCount: null,
          onChange: vi.fn(),
          onAdd: vi.fn(),
          onClose: vi.fn(),
        }),
      );
    });

    await act(async () => {
      root.render(
        React.createElement(ReferenceSourcesModal, {
          isOpen: true,
          value: "",
          disabled: false,
          rowCount: 0,
          addLoading: false,
          addElapsedSeconds: 0,
          addLastCompletedElapsedSeconds: 1,
          addLastCompletedAddedCount: 2,
          addLastCompletedDuplicateCount: 1,
          onChange: vi.fn(),
          onAdd: vi.fn(),
          onClose: vi.fn(),
        }),
      );
    });

    expect(
      container.querySelector('[data-testid="reference-sources-row-count"]')?.textContent,
    ).toBe("Added 2 rows, 1 duplicate");

    await act(async () => {
      root.render(
        React.createElement(ReferenceSourcesModal, {
          isOpen: false,
          value: "",
          disabled: false,
          rowCount: 0,
          addLoading: false,
          addElapsedSeconds: 0,
          addLastCompletedElapsedSeconds: 1,
          addLastCompletedAddedCount: 2,
          addLastCompletedDuplicateCount: 1,
          onChange: vi.fn(),
          onAdd: vi.fn(),
          onClose: vi.fn(),
        }),
      );
    });

    await act(async () => {
      root.render(
        React.createElement(ReferenceSourcesModal, {
          isOpen: true,
          value: "Anthony Bourdain\nHayao Miyazaki",
          disabled: false,
          rowCount: 2,
          addLoading: false,
          addElapsedSeconds: 0,
          addLastCompletedElapsedSeconds: 1,
          addLastCompletedAddedCount: 2,
          addLastCompletedDuplicateCount: 1,
          onChange: vi.fn(),
          onAdd: vi.fn(),
          onClose: vi.fn(),
        }),
      );
    });

    expect(
      container.querySelector('[data-testid="reference-sources-row-count"]')?.textContent,
    ).toBe("2 rows");
    expect(container.querySelector('[data-testid="reference-sources-add-elapsed"]')).toBeNull();
  });
});
