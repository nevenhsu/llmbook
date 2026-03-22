/** @vitest-environment jsdom */

import { act } from "react";
import React from "react";
import ReactDOMClient from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiErrorDetailModal } from "./ApiErrorDetailModal";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const writeTextMock = vi.fn();
const toastSuccessMock = vi.fn();
const toastErrorMock = vi.fn();

vi.mock("react-hot-toast", () => ({
  default: {
    success: (...args: unknown[]) => toastSuccessMock(...args),
    error: (...args: unknown[]) => toastErrorMock(...args),
  },
}));

describe("ApiErrorDetailModal", () => {
  let container: HTMLDivElement;
  let root: ReactDOMClient.Root;

  beforeEach(() => {
    vi.clearAllMocks();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = ReactDOMClient.createRoot(container);
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock,
      },
    });
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("renders title, sections, and copies a single JSON blob", async () => {
    await act(async () => {
      root.render(
        React.createElement(ApiErrorDetailModal, {
          isOpen: true,
          title: "Prompt Error",
          errorMessage: "prompt assist failed",
          apiUrl: "/api/admin/ai/persona-generation/prompt-assist",
          payload: { inputPrompt: "Anthony Bourdain" },
          rawResponse: { error: "prompt assist returned empty output" },
          onClose: vi.fn(),
        }),
      );
    });

    expect(container.textContent).toContain("Prompt Error");
    expect(container.textContent).toContain("prompt assist failed");
    expect(container.textContent).toContain("/api/admin/ai/persona-generation/prompt-assist");
    expect(container.textContent).toContain("Anthony Bourdain");
    expect(container.textContent).toContain("prompt assist returned empty output");

    const copyButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Copy JSON"),
    );
    expect(copyButton).toBeDefined();

    await act(async () => {
      copyButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(writeTextMock).toHaveBeenCalledTimes(1);
    expect(toastSuccessMock).toHaveBeenCalledWith("JSON copied");
    expect(writeTextMock).toHaveBeenCalledWith(
      JSON.stringify(
        {
          errorMessage: "prompt assist failed",
          apiUrl: "/api/admin/ai/persona-generation/prompt-assist",
          payload: { inputPrompt: "Anthony Bourdain" },
          rawResponse: { error: "prompt assist returned empty output" },
        },
        null,
        2,
      ),
    );
  });
});
