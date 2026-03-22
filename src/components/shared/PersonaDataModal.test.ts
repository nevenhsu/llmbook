/** @vitest-environment jsdom */

import { act } from "react";
import React from "react";
import ReactDOMClient from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockPersonaGenerationPreview } from "@/lib/ai/admin/persona-generation-preview-mock";
import { PersonaDataModal } from "./PersonaDataModal";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("PersonaDataModal", () => {
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

  it("renders structured persona data when available", async () => {
    await act(async () => {
      root.render(
        React.createElement(PersonaDataModal, {
          isOpen: true,
          title: "Persona Data",
          structured: mockPersonaGenerationPreview.structured,
          displayName: "RiptideRoo",
          username: "ai_riptideroo",
          onClose: vi.fn(),
          secondaryActionLabel: "Regenerate",
          primaryActionLabel: "Save",
          onSecondaryAction: vi.fn(),
          onPrimaryAction: vi.fn(),
        }),
      );
    });

    expect(container.textContent).toContain("Persona Data");
    expect(container.querySelector('[data-testid="selected-persona-card"]')).not.toBeNull();
    expect(container.textContent).toContain(
      mockPersonaGenerationPreview.structured.persona.display_name,
    );
    expect(container.textContent).toContain("ai_riptideroo");
    expect(container.textContent).toContain("Monkey D. Luffy");
    expect(container.textContent).toContain("Straw Hat Pirates");
    expect(container.textContent).toContain("Voice Fingerprint");
    expect(container.textContent).toContain("Regenerate");
    expect(container.textContent).toContain("Save");
    const buttons = Array.from(container.querySelectorAll("button"));
    expect(buttons.find((button) => button.textContent?.includes("Regenerate"))?.disabled).toBe(
      false,
    );
    expect(buttons.find((button) => button.textContent?.includes("Save"))?.disabled).toBe(false);
  });

  it("uses personaData reference sources for the summary card instead of merged row references", async () => {
    await act(async () => {
      root.render(
        React.createElement(PersonaDataModal, {
          isOpen: true,
          title: "Roland Barthes Persona",
          structured: mockPersonaGenerationPreview.structured,
          displayName: "RiptideRoo",
          username: "ai_riptideroo",
          onClose: vi.fn(),
        }),
      );
    });

    const personaCard = container.querySelector('[data-testid="selected-persona-card"]');
    expect(personaCard).not.toBeNull();
    expect(personaCard?.textContent).toContain("Monkey D. Luffy");
    expect(personaCard?.textContent).not.toContain("Roland Barthes");
    expect(container.textContent).toContain(
      `Reference Sources (${mockPersonaGenerationPreview.structured.reference_sources.length})`,
    );
  });

  it("keeps footer actions disabled when no persona data exists", async () => {
    await act(async () => {
      root.render(
        React.createElement(PersonaDataModal, {
          isOpen: true,
          title: "Persona Data",
          structured: null,
          onClose: vi.fn(),
          secondaryActionLabel: "Regenerate",
          primaryActionLabel: "Save",
          onSecondaryAction: vi.fn(),
          onPrimaryAction: vi.fn(),
        }),
      );
    });

    expect(container.textContent).toContain("No persona data available.");
    const buttons = Array.from(container.querySelectorAll("button"));
    expect(buttons.find((button) => button.textContent?.includes("Regenerate"))?.disabled).toBe(
      true,
    );
    expect(buttons.find((button) => button.textContent?.includes("Save"))?.disabled).toBe(true);
  });
});
