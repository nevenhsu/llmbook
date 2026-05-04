/** @vitest-environment jsdom */

import { act } from "react";
import React from "react";
import ReactDOMClient from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PersonaGenerationPreviewSurface } from "./PersonaGenerationPreviewSurface";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("PersonaGenerationPreviewSurface", () => {
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

  it("renders persona generation error details next to the raw LLM response", async () => {
    await act(async () => {
      root.render(
        React.createElement(PersonaGenerationPreviewSurface, {
          phase: "error",
          errorMessage: "persona generation stage seed quality repair returned invalid JSON",
          errorDetails: {
            code: "persona_generation_stage_quality_failed",
            stageName: "seed",
            issues: ["originalization_note is still too career-like."],
            details: {
              attemptStage: "quality-repair-1",
              finishReason: "length",
              providerId: "minimax",
              modelId: "MiniMax-M2.5",
              hadText: true,
            },
          },
          rawOutput: '{"persona":{"display_name":"S. K. Edwards"}}',
          elapsedSeconds: 3,
          preview: null,
          lastSavedAt: null,
          saveForm: { displayName: "", username: "" },
          setSaveForm: vi.fn(),
          isGenerating: false,
          isSaving: false,
          onRegenerate: vi.fn(),
          onSave: vi.fn(),
        }),
      );
    });

    expect(container.textContent).toContain("Attempt Details");
    expect(container.textContent).toContain('"stageName": "seed"');
    expect(container.textContent).toContain("originalization_note is still too career-like.");
    expect(container.textContent).toContain('"attemptStage": "quality-repair-1"');
  });
});
