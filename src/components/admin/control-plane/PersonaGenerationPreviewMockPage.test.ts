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

vi.mock("./PreviewPanel", () => ({
  PreviewPanel: ({
    preview,
  }: {
    preview: { structured: { personas: { display_name: string } } };
  }) =>
    React.createElement(
      "div",
      {
        "data-testid": "preview-panel",
      },
      preview.structured.personas.display_name,
    ),
}));

describe("PersonaGenerationPreviewMockPage", () => {
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

  it("reuses the full generate persona flow with mock prompt assist and mock preview output", async () => {
    await act(async () => {
      root.render(React.createElement(PersonaGenerationPreviewMockPage));
    });

    expect(container.textContent).toContain("Generate Persona Flow Preview");
    expect(container.textContent).toContain("No network request or database write happens here.");
    expect(container.textContent).toContain("Generate Persona");
    expect(container.textContent).not.toContain("Preview Mock Page");

    const extraPromptInput = container.querySelector(
      'input[placeholder*="Kotaro Isaka"]',
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

    await act(async () => {
      generateButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).toContain(
      "Review the generated persona data before saving it to the database.",
    );
    expect(container.textContent).toContain("Jax Harlan");
    expect(container.querySelector('[data-testid="preview-panel"]')?.textContent).toContain(
      "Jax Harlan",
    );
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
  });
});
