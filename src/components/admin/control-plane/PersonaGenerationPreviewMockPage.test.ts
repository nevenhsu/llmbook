/** @vitest-environment jsdom */

import { act } from "react";
import React from "react";
import ReactDOMClient from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PersonaGenerationPreviewMockPage } from "./PersonaGenerationPreviewMockPage";
import {
  mockPersonaGenerationAdminExtraPrompt,
  mockPersonaGenerationSeedPrompt,
  mockPersonaGenerationPreview,
} from "@/lib/ai/admin/persona-generation-preview-mock";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const { toastMock } = vi.hoisted(() => ({
  toastMock: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.mock("react-hot-toast", () => ({
  default: toastMock,
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    className,
  }: {
    children: React.ReactNode;
    href: string;
    className?: string;
  }) =>
    React.createElement(
      "a",
      {
        href,
        className,
      },
      children,
    ),
}));

describe("PersonaGenerationPreviewMockPage", () => {
  let container: HTMLDivElement;
  let root: ReactDOMClient.Root;

  const setInputValue = (input: HTMLInputElement, value: string) => {
    const nativeSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value",
    )?.set;
    nativeSetter?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = ReactDOMClient.createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    vi.useRealTimers();
    container.remove();
  });

  it("reuses the full generate persona flow with mock prompt assist and mock preview output", async () => {
    const personaCore = mockPersonaGenerationPreview.structured.persona_core as {
      voice_fingerprint: { opening_move: string };
      task_style_matrix: { post: { entry_shape: string } };
    };

    await act(async () => {
      root.render(React.createElement(PersonaGenerationPreviewMockPage));
    });

    expect(container.textContent).toContain("Generate Persona Flow Preview");
    expect(container.textContent).toContain("No network request or database write happens here.");
    expect(container.textContent).toContain("Generate Persona");
    expect(container.textContent).toContain("Update Persona");
    expect(container.textContent).not.toContain("Preview Mock Page");

    const extraPromptInput = container.querySelector(
      'textarea[placeholder*="favorite celebrity"]',
    ) as HTMLTextAreaElement | null;
    expect(extraPromptInput).not.toBeNull();
    expect(extraPromptInput?.value).toBe(mockPersonaGenerationSeedPrompt);
    const allPromptInputs = container.querySelectorAll(
      'textarea[placeholder*="favorite celebrity"], textarea[placeholder*="Current bio and reference roles"]',
    );
    const updateExtraPromptInput = allPromptInputs.item(1) as HTMLTextAreaElement | null;
    expect(updateExtraPromptInput?.value).toContain("Current bio:");
    expect(updateExtraPromptInput?.value).toContain("Reference roles:");
    expect(container.textContent).toContain(
      "Starts from current bio and references, then refines with AI.",
    );

    const updatePromptAssistButton = container.querySelector(
      'button[aria-label="Prompt AI for update"]',
    );
    expect(updatePromptAssistButton).not.toBeNull();

    await act(async () => {
      updatePromptAssistButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).toContain("AI assist processing 00:00");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(container.textContent).toContain("AI assist completed 00:01");
    expect(container.textContent).not.toContain(
      "Starts from current bio and references, then refines with AI.",
    );

    const promptAssistButton = container.querySelector('button[aria-label="Prompt AI"]');
    expect(promptAssistButton).not.toBeNull();

    await act(async () => {
      promptAssistButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).toContain("AI assist processing 00:00");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(container.textContent).toContain("AI assist completed 00:01");
    expect(container.textContent).not.toContain(
      "Empty: generate in English. Existing: refine in the same language.",
    );
    expect(extraPromptInput?.value).toBe(mockPersonaGenerationAdminExtraPrompt);

    const generateButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Generate Persona"),
    );
    expect(generateButton).toBeDefined();

    const preGenerateViewPromptButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.includes("View Prompt"),
    );
    expect(preGenerateViewPromptButton).toBeDefined();
    expect(preGenerateViewPromptButton?.disabled).toBe(false);

    await act(async () => {
      preGenerateViewPromptButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).toContain("Prompt Assembly");
    expect(container.textContent).toContain("Token Budget");
    expect(container.textContent).toContain("Stage 1: seed");
    expect(container.textContent).toContain("Stage 5: memories");
    expect(container.textContent).toContain(
      "voice_fingerprint{opening_move,metaphor_domains,attack_style,praise_style,closing_move,forbidden_shapes}",
    );
    expect(container.textContent).toContain(
      "task_style_matrix{post{entry_shape,body_shape,close_shape,forbidden_shapes},comment{entry_shape,feedback_shape,close_shape,forbidden_shapes}}.",
    );
    expect(container.textContent).toContain(
      "The final persona must be reference-inspired, not reference-cosplay.",
    );
    expect(container.textContent).toContain(
      "Write all persona-generation content in English, regardless of the language used in global policy text or admin extra prompt.",
    );
    expect(container.textContent).toContain(
      "Write values and aesthetic preferences as natural-language persona guidance, not snake_case labels or keyword bundles.",
    );
    expect(container.textContent).toContain(
      "Use natural-language behavioral descriptions, not enum labels or taxonomy tokens.",
    );
    expect(container.textContent).toContain("[validated_context]");
    expect(container.textContent).toContain("[admin_extra_prompt]");
    expect(container.textContent).toContain("(from Context / Extra Prompt input)");

    const valuesStageCollapse = Array.from(container.querySelectorAll(".collapse-title")).find(
      (node) => node.textContent?.includes("Stage 2: values_and_aesthetic"),
    ) as HTMLElement | undefined;
    expect(valuesStageCollapse).toBeDefined();

    await act(async () => {
      valuesStageCollapse?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).toContain(
      "[validated_context]\n(populated from previously validated stage output during runtime generation)",
    );

    const preGenerateCloseButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.trim() === "Close",
    );
    expect(preGenerateCloseButton).toBeDefined();

    await act(async () => {
      preGenerateCloseButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await act(async () => {
      generateButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).toContain("Generating...");
    expect(container.textContent).toContain("Generating time: 00:00");
    const loadingSaveButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Save"),
    );
    expect(loadingSaveButton).toBeDefined();
    expect(loadingSaveButton?.disabled).toBe(true);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(container.textContent).toContain(
      "Review the generated persona data before saving it to the database.",
    );
    expect(container.textContent).toContain("Generation time: 00:01");
    expect(container.textContent).toContain(
      mockPersonaGenerationPreview.structured.persona.display_name,
    );
    expect(container.textContent).toContain("Archetype");
    expect(container.textContent).toContain("Core Motivation");
    expect(container.textContent).toContain("One-Sentence Identity");
    expect(container.textContent).toContain("Voice Fingerprint");
    expect(container.textContent).toContain("Task Style Matrix");
    expect(container.textContent).toContain(personaCore.voice_fingerprint.opening_move);
    expect(container.textContent).toContain(personaCore.task_style_matrix.post.entry_shape);
    expect(container.querySelector('[data-testid="generated-persona-identity"]')).not.toBeNull();
    expect(
      container.querySelector('[data-testid="generated-persona-reference-section"]'),
    ).not.toBeNull();
    for (const reference of mockPersonaGenerationPreview.structured.reference_sources) {
      expect(container.textContent).toContain(reference.name);
    }
    expect(container.textContent).toContain(
      `Reference Sources (${mockPersonaGenerationPreview.structured.reference_sources.length})`,
    );
    expect(container.textContent).toContain(
      `Persona Memories (${mockPersonaGenerationPreview.structured.persona_memories.length})`,
    );
    expect(container.textContent).toContain("View Raw JSON");
    const rawJsonCopyButton = container.querySelector(
      'button[aria-label="Copy raw JSON"]',
    ) as HTMLButtonElement | null;
    expect(rawJsonCopyButton).not.toBeNull();
    const rawJsonCollapseInput = Array.from(container.querySelectorAll(".collapse > input")).at(
      -1,
    ) as HTMLInputElement | undefined;
    expect(rawJsonCollapseInput?.checked).toBe(false);

    await act(async () => {
      rawJsonCopyButton?.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
      rawJsonCopyButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(rawJsonCollapseInput?.checked).toBe(false);
    expect(container.textContent).not.toContain("Runs:");
    const modalBackdrop = container.querySelector("form.modal-backdrop");
    expect(modalBackdrop).not.toBeNull();
    expect(modalBackdrop?.className).toContain("!bg-black/50");

    const displayNameInput = container.querySelector(
      'input[placeholder="e.g. Satoshi Nakamoto"]',
    ) as HTMLInputElement | null;
    expect(displayNameInput?.value).toBe(
      mockPersonaGenerationPreview.structured.persona.display_name,
    );
    const usernameInput = container.querySelector(
      'input[placeholder="e.g. satoshi"]',
    ) as HTMLInputElement | null;
    expect(usernameInput?.value).toBe(
      `ai_${mockPersonaGenerationPreview.structured.persona.display_name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "")}`,
    );

    await act(async () => {
      setInputValue(usernameInput!, "The Deductionist");
    });

    expect(usernameInput?.value).toBe("ai_the_deductionist");

    const saveButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Save"),
    );
    expect(saveButton).toBeDefined();
    expect(saveButton?.disabled).toBe(false);

    const viewPromptButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("View Prompt"),
    );
    expect(viewPromptButton).toBeDefined();
    expect(viewPromptButton?.disabled).toBe(false);

    await act(async () => {
      viewPromptButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).toContain("Prompt Assembly");
    expect(container.textContent).toContain("Token Budget");
    expect(container.textContent).not.toContain("Markdown Output");
    expect(container.textContent).toContain("Stage 3: context_and_affinity");
    expect(
      Array.from(container.querySelectorAll("button")).some(
        (button) => button.textContent?.trim() === "Close",
      ),
    ).toBe(true);
    expect(
      Array.from(container.querySelectorAll("h3")).some(
        (heading) => heading.textContent?.trim() === "Prompt Assembly",
      ),
    ).toBe(true);

    const closePromptModalButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.trim() === "Close",
    );
    expect(closePromptModalButton).toBeDefined();

    await act(async () => {
      closePromptModalButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const updateButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Update Persona"),
    );
    expect(updateButton).toBeDefined();
    expect(
      Array.from(container.querySelectorAll("button")).filter((button) =>
        button.textContent?.includes("View Prompt"),
      ),
    ).toHaveLength(1);

    await act(async () => {
      updateButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).toContain("Generating...");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(container.textContent).toContain(
      "Review the regenerated persona data before updating the existing persona record.",
    );
    expect(container.textContent).toContain("Update");
    const updateDisplayNameInput = container.querySelector(
      'input[placeholder="e.g. Satoshi Nakamoto"]',
    ) as HTMLInputElement | null;
    const updateUsernameInput = container.querySelector(
      'input[placeholder="e.g. satoshi"]',
    ) as HTMLInputElement | null;
    expect(updateDisplayNameInput?.value).toBe("Jax Harlan");
    expect(updateUsernameInput?.value).toBe("ai_jax_harlan");
    const updateIdentityCard = container.querySelector(
      '[data-testid="generated-persona-identity"]',
    ) as HTMLElement | null;
    expect(updateIdentityCard?.textContent).toContain("Jax Harlan");
    expect(updateIdentityCard?.textContent).toContain("@ai_jax_harlan");

    await act(async () => {
      setInputValue(updateDisplayNameInput!, "Deckhand Riot");
      setInputValue(updateUsernameInput!, "RIPTIDE-ROO!?漢字.42");
    });

    expect(updateDisplayNameInput?.value).toBe("Deckhand Riot");
    expect(updateUsernameInput?.value).toBe("ai_riptideroo.42");
    expect(updateIdentityCard?.textContent).toContain("Deckhand Riot");
    expect(updateIdentityCard?.textContent).toContain("@ai_riptideroo.42");

    const updateActionButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.trim() === "Update",
    );
    expect(updateActionButton).toBeDefined();

    await act(async () => {
      updateActionButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).toContain("Saving...");
    expect(toastMock.success).toHaveBeenCalledTimes(0);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(toastMock.success).toHaveBeenCalledTimes(1);
    expect(toastMock.success).toHaveBeenCalledWith("Persona updated");
    expect(container.textContent).toContain("Updated");

    const savedButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Updated"),
    );
    expect(savedButton).toBeDefined();
    expect(savedButton?.disabled).toBe(false);

    await act(async () => {
      savedButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(toastMock.success).toHaveBeenCalledTimes(1);

    const regenerateButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Regenerate"),
    );
    expect(regenerateButton).toBeDefined();

    await act(async () => {
      regenerateButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).toContain("Generating...");
    const loadingSaveAfterRegenerate = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.includes("Update"),
    );
    expect(loadingSaveAfterRegenerate).toBeDefined();
    expect(loadingSaveAfterRegenerate?.disabled).toBe(true);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(container.textContent).toContain("Update");
    const regeneratedDisplayNameInput = container.querySelector(
      'input[placeholder="e.g. Satoshi Nakamoto"]',
    ) as HTMLInputElement | null;
    const regeneratedUsernameInput = container.querySelector(
      'input[placeholder="e.g. satoshi"]',
    ) as HTMLInputElement | null;
    const regeneratedIdentityCard = container.querySelector(
      '[data-testid="generated-persona-identity"]',
    ) as HTMLElement | null;
    expect(regeneratedDisplayNameInput?.value).toBe("Deckhand Riot");
    expect(regeneratedUsernameInput?.value).toBe("ai_riptideroo.42");
    expect(regeneratedIdentityCard?.textContent).toContain("Deckhand Riot");
    expect(regeneratedIdentityCard?.textContent).toContain("@ai_riptideroo.42");
  });
});
