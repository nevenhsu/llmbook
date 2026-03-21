/** @vitest-environment jsdom */

import { act } from "react";
import React from "react";
import ReactDOMClient from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PreviewResult } from "@/lib/ai/admin/control-plane-store";
import { PreviewPanel } from "./PreviewPanel";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("react-hot-toast", () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("PreviewPanel", () => {
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

  it("renders labeled title, tags, and body sections for post-style raw responses", async () => {
    const preview: PreviewResult = {
      assembledPrompt: "prompt",
      markdown: "# Deep-Sea Gods That Should Terrify Your Crew\n\n#cthulhu #lovecraftian_horror",
      rawResponse: JSON.stringify({
        title: "Deep-Sea Gods That Should Terrify Your Crew",
        body: "Cthulhu stuff hits different because it makes you feel SMALL.",
        tags: ["#cthulhu", "#lovecraftian_horror"],
        need_image: true,
        image_prompt: "Eldritch sea creature rising from impossible dark water.",
        image_alt: "A towering cosmic horror with tentacles and impossible geometry.",
      }),
      renderOk: true,
      renderError: null,
      tokenBudget: {
        estimatedInputTokens: 100,
        maxInputTokens: 1000,
        maxOutputTokens: 300,
        blockStats: [],
        compressedStages: [],
        exceeded: false,
        message: null,
      },
      auditDiagnostics: {
        status: "passed_after_repair",
        issues: ["too editorial"],
        repairGuidance: ["Lead with a stronger thesis."],
        severity: "high",
        confidence: 0.91,
        missingSignals: ["immediate reaction"],
        repairApplied: true,
        auditMode: "compact",
        compactRetryUsed: true,
      },
    };

    await act(async () => {
      root.render(
        React.createElement(PreviewPanel, {
          preview,
          emptyLabel: "Empty",
        }),
      );
    });

    expect(container.textContent).toContain("Rendered Preview");
    expect(container.textContent).toContain("Title");
    expect(container.textContent).toContain("Tags");
    expect(container.textContent).toContain("Body");
    expect(container.textContent).toContain("Image Request");
    expect(container.textContent).toContain("Need Image");
    expect(container.textContent).toContain("true");
    expect(container.textContent).toContain(
      "Eldritch sea creature rising from impossible dark water.",
    );
    expect(container.textContent).toContain(
      "A towering cosmic horror with tentacles and impossible geometry.",
    );
    expect(container.textContent).toContain("Deep-Sea Gods That Should Terrify Your Crew");
    expect(container.textContent).toContain("#cthulhu");
    expect(container.textContent).toContain("#lovecraftian_horror");
    expect(container.textContent).toContain(
      "Cthulhu stuff hits different because it makes you feel SMALL.",
    );
    expect(container.textContent).toContain("Audit Diagnostics");
    expect(container.textContent).toContain("Audit Result");
    expect(container.textContent).toContain("Passed After Repair");
    expect(container.textContent).toContain("Repair Applied");
    expect(container.textContent).toContain("yes");
    expect(container.textContent).toContain("Audit Mode");
    expect(container.textContent).toContain("compact");
    expect(container.textContent).toContain("Missing Signals");
    expect(container.textContent).toContain("immediate reaction");
    expect(container.innerHTML).not.toContain("xl:grid-cols-2");
    expect(container.innerHTML).not.toContain("md:grid-cols-2");
  });

  it("keeps comment previews body-only without title or tags labels", async () => {
    const preview: PreviewResult = {
      assembledPrompt: "prompt",
      markdown: "This is a direct forum reply about Cthulhu creature design.",
      rawResponse: JSON.stringify({
        markdown: "This is a direct forum reply about Cthulhu creature design.",
        need_image: false,
        image_prompt: null,
        image_alt: null,
      }),
      renderOk: true,
      renderError: null,
      tokenBudget: {
        estimatedInputTokens: 100,
        maxInputTokens: 1000,
        maxOutputTokens: 300,
        blockStats: [],
        compressedStages: [],
        exceeded: false,
        message: null,
      },
    };

    await act(async () => {
      root.render(
        React.createElement(PreviewPanel, {
          preview,
          emptyLabel: "Empty",
        }),
      );
    });

    expect(container.textContent).toContain("Rendered Preview");
    expect(container.textContent).toContain("Image Request");
    expect(container.textContent).toContain("Need Image");
    expect(container.textContent).toContain("false");
    expect(container.textContent).toContain("No image requested for this preview.");
    expect(container.textContent).toContain(
      "This is a direct forum reply about Cthulhu creature design.",
    );
    expect(container.textContent).not.toContain("Title");
    expect(container.textContent).not.toContain("Tags");
    expect(container.textContent).not.toContain("Body");
    expect(container.textContent).not.toContain("Audit Diagnostics");
  });
});
