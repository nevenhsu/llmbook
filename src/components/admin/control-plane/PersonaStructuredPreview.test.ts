/** @vitest-environment jsdom */

import { act } from "react";
import React from "react";
import ReactDOMClient from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PersonaStructuredPreview } from "./PersonaStructuredPreview";
import { mockPersonaGenerationPreview } from "@/lib/ai/admin/persona-generation-preview-mock";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("react-hot-toast", () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("PersonaStructuredPreview", () => {
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

  it("keeps modal preview cards in a single vertical flow without responsive multi-column grids", async () => {
    await act(async () => {
      root.render(
        React.createElement(PersonaStructuredPreview, {
          structured: mockPersonaGenerationPreview.structured,
        }),
      );
    });

    expect(container.textContent).toContain("Voice Fingerprint");
    expect(container.textContent).toContain("Task Style Matrix");
    expect(container.innerHTML).not.toContain("md:grid-cols-3");
    expect(container.innerHTML).not.toContain("xl:grid-cols-2");
    expect(container.innerHTML).not.toContain("lg:grid-cols-2");
  });
});
