/** @vitest-environment jsdom */

import { act } from "react";
import React from "react";
import ReactDOMClient from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ChunkSizeModal } from "./ChunkSizeModal";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("ChunkSizeModal", () => {
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

  it("clamps values above 20 back to 20 before save", async () => {
    const onSave = vi.fn();

    await act(async () => {
      root.render(
        React.createElement(ChunkSizeModal, {
          isOpen: true,
          value: 5,
          onClose: vi.fn(),
          onSave,
        }),
      );
    });

    const input = container.querySelector("input");
    expect(input).not.toBeNull();

    const reactInput = input as HTMLInputElement;
    const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    expect(valueSetter).toBeTypeOf("function");

    await act(async () => {
      valueSetter?.call(reactInput, "25");
      reactInput.dispatchEvent(new Event("input", { bubbles: true }));
      reactInput.dispatchEvent(new Event("change", { bubbles: true }));
    });

    expect(reactInput.value).toBe("20");

    const saveButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.trim() === "Save",
    );
    expect(saveButton).not.toBeNull();

    await act(async () => {
      saveButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onSave).toHaveBeenCalledWith(20);
  });
});
