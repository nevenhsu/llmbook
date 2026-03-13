/** @vitest-environment jsdom */

import { act } from "react";
import React from "react";
import ReactDOMClient from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PersonaGenerationPreviewMockPage } from "./PersonaGenerationPreviewMockPage";
import {
  mockPersonaGenerationAdminExtraPrompt,
  mockPersonaGenerationSeedPrompt,
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
    await act(async () => {
      root.render(React.createElement(PersonaGenerationPreviewMockPage));
    });

    expect(container.textContent).toContain("Generate Persona Flow Preview");
    expect(container.textContent).toContain("No network request or database write happens here.");
    expect(container.textContent).toContain("Generate Persona");
    expect(container.textContent).not.toContain("Preview Mock Page");

    const extraPromptInput = container.querySelector(
      'input[placeholder*="favorite celebrity"]',
    ) as HTMLInputElement | null;
    expect(extraPromptInput).not.toBeNull();
    expect(extraPromptInput?.value).toBe(mockPersonaGenerationSeedPrompt);

    const promptAssistButton = container.querySelector('button[aria-label="Prompt AI"]');
    expect(promptAssistButton).not.toBeNull();

    await act(async () => {
      promptAssistButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

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
    expect(container.textContent).toContain("[validated_context]");
    expect(container.textContent).toContain("[admin_extra_prompt]");
    expect(container.textContent).toContain("(from Context / Extra Prompt input)");
    expect(container.textContent).not.toContain(mockPersonaGenerationAdminExtraPrompt);

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
    expect(container.textContent).toContain("Jax Harlan");
    expect(container.textContent).toContain("Archetype");
    expect(container.textContent).toContain("Core Motivation");
    expect(container.textContent).toContain("One-Sentence Identity");
    expect(container.textContent).toContain("Reference Sources (2)");
    expect(container.textContent).toContain("Persona Memories (3)");
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
    expect(displayNameInput?.value).toBe("Jax Harlan");
    const usernameInput = container.querySelector(
      'input[placeholder="e.g. satoshi"]',
    ) as HTMLInputElement | null;
    expect(usernameInput?.value).toBe("ai_jax_harlan");

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

    await act(async () => {
      saveButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).toContain("Saving...");
    expect(toastMock.success).toHaveBeenCalledTimes(0);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(toastMock.success).toHaveBeenCalledTimes(1);
    expect(toastMock.success).toHaveBeenCalledWith("Persona saved");
    expect(container.textContent).toContain("Saved");

    const savedButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Saved"),
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
      (button) => button.textContent?.includes("Save"),
    );
    expect(loadingSaveAfterRegenerate).toBeDefined();
    expect(loadingSaveAfterRegenerate?.disabled).toBe(true);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(container.textContent).toContain("Save");
  });
});
