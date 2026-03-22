/** @vitest-environment jsdom */

import { act } from "react";
import React from "react";
import ReactDOMClient from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EditContextPromptModal } from "./EditContextPromptModal";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("EditContextPromptModal", () => {
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

  it("renders an icon-only prompt button beside the textarea and swaps the helper line for elapsed text while prompting", async () => {
    await act(async () => {
      root.render(
        React.createElement(EditContextPromptModal, {
          isOpen: true,
          referenceName: "Anthony Bourdain",
          value: "A globe-trotting storyteller",
          promptLoading: true,
          promptElapsedSeconds: 9,
          onClose: vi.fn(),
          onSave: vi.fn(),
          onPromptAssist: vi.fn(),
        }),
      );
    });

    const textarea = container.querySelector("textarea");
    expect(textarea).not.toBeNull();

    const promptButton = container.querySelector('button[aria-label="Prompt"]');
    expect(promptButton).not.toBeNull();
    expect(promptButton?.textContent?.trim()).toBe("");
    expect(promptButton?.parentElement?.className).toContain("flex");

    expect(container.textContent).toContain("Prompt 00:09");
    expect(container.textContent).not.toContain(
      "This keeps existing persona data until you regenerate.",
    );
  });

  it("keeps showing the last completed prompt elapsed text after prompting finishes", async () => {
    await act(async () => {
      root.render(
        React.createElement(EditContextPromptModal, {
          isOpen: true,
          referenceName: "Anthony Bourdain",
          value: "A globe-trotting storyteller",
          promptLoading: false,
          promptElapsedSeconds: 0,
          promptLastCompletedElapsedSeconds: 9,
          onClose: vi.fn(),
          onSave: vi.fn(),
          onPromptAssist: vi.fn(),
        }),
      );
    });

    expect(container.textContent).toContain("Prompt 00:09");
    expect(container.textContent).not.toContain(
      "This keeps existing persona data until you regenerate.",
    );
    expect(container.querySelector(".loading.loading-spinner")).toBeNull();
  });
});
