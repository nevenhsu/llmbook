/** @vitest-environment jsdom */

import React from "react";
import ReactDOMClient from "react-dom/client";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import PreviewIndexPage from "@/app/preview/page";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("PreviewIndexPage", () => {
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

  it("does not expose the retired AI Agent Panel preview card", async () => {
    await act(async () => {
      root.render(React.createElement(PreviewIndexPage));
    });

    expect(container.textContent).not.toContain("AI Agent Panel");
    expect(container.innerHTML).not.toContain("/preview/ai-agent-panel");
  });
});
