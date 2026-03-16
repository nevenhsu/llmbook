/** @vitest-environment jsdom */

import { act } from "react";
import React from "react";
import ReactDOMClient from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InteractionPreviewMockPage } from "./InteractionPreviewMockPage";
import {
  mockInteractionPreviewDefaultInput,
  mockInteractionPreviewRelatedCommentTaskContext,
  mockInteractionPreviewRelatedPostTaskContext,
} from "@/lib/ai/admin/interaction-preview-mock";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const { toastMock } = vi.hoisted(() => ({
  toastMock: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
  }),
}));

const { writeClipboardText } = vi.hoisted(() => ({
  writeClipboardText: vi.fn().mockResolvedValue(undefined),
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

describe("InteractionPreviewMockPage", () => {
  let container: HTMLDivElement;
  let root: ReactDOMClient.Root;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    Object.defineProperty(globalThis.navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: writeClipboardText,
      },
    });
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

  it("reuses the real interaction preview flow with mock loading and fixture-backed modal output", async () => {
    await act(async () => {
      root.render(React.createElement(InteractionPreviewMockPage));
    });

    expect(container.textContent).toContain("Interaction Preview Flow Preview");
    expect(container.textContent).toContain("No network request or database write happens here.");
    expect(container.textContent).toContain("Interaction Preview");
    expect(container.textContent).toContain("Straw_Hat_Outlaw");

    const copyPersonaDataButton = container.querySelector(
      'button[aria-label="Copy persona data JSON"]',
    ) as HTMLButtonElement | null;
    expect(copyPersonaDataButton).not.toBeNull();

    await act(async () => {
      copyPersonaDataButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(toastMock.success).toHaveBeenCalledWith("Persona data copied");

    const taskContextTextarea = container.querySelector("textarea") as HTMLTextAreaElement | null;
    expect(taskContextTextarea?.value).toBe(mockInteractionPreviewDefaultInput.taskContext);

    const aiButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("AI"),
    );
    expect(aiButton).toBeDefined();

    await act(async () => {
      aiButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await vi.advanceTimersByTimeAsync(800);
    });

    expect(taskContextTextarea?.value).toBe(mockInteractionPreviewRelatedPostTaskContext);

    const taskTypeSelect = container.querySelectorAll("select")[1] as HTMLSelectElement | undefined;
    expect(taskTypeSelect).toBeDefined();

    await act(async () => {
      taskTypeSelect!.value = "comment";
      taskTypeSelect!.dispatchEvent(new Event("change", { bubbles: true }));
    });

    expect(taskContextTextarea?.value).toContain("Cthulhu-themed concept art draft");

    await act(async () => {
      aiButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await vi.advanceTimersByTimeAsync(800);
    });

    expect(taskContextTextarea?.value).toBe(mockInteractionPreviewRelatedCommentTaskContext);

    const runPreviewButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Run Preview"),
    );
    expect(runPreviewButton).toBeDefined();

    await act(async () => {
      runPreviewButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).toContain("Generating interaction preview");
    expect(container.textContent).toContain("Generating time: 00:00");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(container.textContent).toContain(
      "Review the model-generated interaction preview for the current task context.",
    );
    expect(container.querySelector('[data-testid="modal-selected-persona-card"]')).not.toBeNull();
    expect(
      container.querySelector('[data-testid="modal-selected-persona-reference-section"]'),
    ).not.toBeNull();
    expect(container.textContent).toContain("Preview time:");
    expect(container.textContent).toContain("Rendered Preview");
    expect(container.textContent).toContain("Prompt Assembly");
    expect(container.textContent).toContain("Raw Response");
    expect(container.textContent).toContain("Token Budget");
    expect(container.textContent).toContain("Deep-Sea Gods That Should Terrify Your Crew");
    expect(container.textContent).toContain(
      "Cthulhu stuff hits different because it makes you feel SMALL.",
    );
    expect(container.textContent).toContain(
      '"title":"Deep-Sea Gods That Should Terrify Your Crew"',
    );
    expect(container.textContent).toContain('"need_image":false');
    expect(container.textContent).toContain('"image_prompt":null');

    const copyRenderedPreviewButton = container.querySelector(
      'button[aria-label="Copy rendered preview"]',
    ) as HTMLButtonElement | null;
    expect(copyRenderedPreviewButton).not.toBeNull();

    await act(async () => {
      copyRenderedPreviewButton?.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
      copyRenderedPreviewButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(toastMock.success).toHaveBeenCalledWith("Rendered preview copied");
  });
});
