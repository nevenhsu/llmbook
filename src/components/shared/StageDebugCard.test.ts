/** @vitest-environment jsdom */

import { act } from "react";
import React from "react";
import ReactDOMClient from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StageDebugCard } from "./StageDebugCard";
import type { StageDebugRecord } from "@/lib/ai/stage-debug-records";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("react-hot-toast", () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const stageReadinessCheck: StageDebugRecord = {
  name: "readiness.check",
  displayPrompt: "You are a forum moderator. Decide if this post is ready.",
  outputMaxTokens: 500,
  attempts: [
    {
      attempt: "attempt-1",
      text: "The post passes the readiness check.",
      finishReason: "stop",
      providerId: "openai",
      modelId: "gpt-5-mini",
      hadError: false,
    },
    {
      attempt: "attempt-2",
      text: "",
      finishReason: "error",
      providerId: "openai",
      modelId: "gpt-5-mini",
      hadError: true,
    },
  ],
};

function clickButtonByText(container: HTMLElement, text: string): HTMLButtonElement {
  const buttons = container.querySelectorAll("button");
  for (const button of buttons) {
    if (button.textContent?.includes(text)) {
      return button as HTMLButtonElement;
    }
  }
  throw new Error(`No button found with text "${text}"`);
}

describe("StageDebugCard", () => {
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

  it("renders collapsed stage debug card header", async () => {
    await act(async () => {
      root.render(
        React.createElement(StageDebugCard, {
          records: [stageReadinessCheck],
        }),
      );
    });

    expect(container.textContent).toContain("Stage Debug");
    expect(container.textContent).toContain("1 stage");
    expect(container.textContent).not.toContain("readiness.check");
  });

  it("shows stage name and attempt count when card is expanded", async () => {
    await act(async () => {
      root.render(
        React.createElement(StageDebugCard, {
          records: [stageReadinessCheck],
        }),
      );
    });

    const mainToggle = clickButtonByText(container, "Stage Debug");

    await act(async () => {
      mainToggle.click();
    });

    expect(container.textContent).toContain("readiness.check");
    expect(container.textContent).toContain("2 attempts");
  });

  it("expands stage block to show prompt, responses, and attempt metadata", async () => {
    await act(async () => {
      root.render(
        React.createElement(StageDebugCard, {
          records: [stageReadinessCheck],
        }),
      );
    });

    const mainToggle = clickButtonByText(container, "Stage Debug");

    await act(async () => {
      mainToggle.click();
    });

    const stageToggle = clickButtonByText(container, "readiness.check");

    await act(async () => {
      stageToggle.click();
    });

    expect(container.textContent).toContain("Prompt");
    expect(container.textContent).toContain("500 max tokens");
    expect(container.textContent).toContain("Responses");
    expect(container.textContent).toContain("attempt-1");
    expect(container.textContent).toContain("attempt-2");
    expect(container.textContent).toContain("stop");
    expect(container.textContent).toContain("openai/gpt-5-mini");

    const promptToggle = clickButtonByText(container, "Prompt");

    await act(async () => {
      promptToggle.click();
    });

    expect(container.textContent).toContain(
      "You are a forum moderator. Decide if this post is ready.",
    );
  });

  it("shows error badge for failed attempts when stage block is expanded", async () => {
    await act(async () => {
      root.render(
        React.createElement(StageDebugCard, {
          records: [stageReadinessCheck],
        }),
      );
    });

    const mainToggle = clickButtonByText(container, "Stage Debug");

    await act(async () => {
      mainToggle.click();
    });

    const stageToggle = clickButtonByText(container, "readiness.check");

    await act(async () => {
      stageToggle.click();
    });

    expect(container.textContent).toContain("error");
  });

  it("shows Error Debug label when error message is present without records", async () => {
    await act(async () => {
      root.render(
        React.createElement(StageDebugCard, {
          errorMessage: "Something went wrong",
          rawOutput: "{ broken json",
        }),
      );
    });

    expect(container.textContent).toContain("Error Debug");

    const mainToggle = clickButtonByText(container, "Error Debug");

    await act(async () => {
      mainToggle.click();
    });

    expect(container.textContent).toContain("Something went wrong");
    expect(container.textContent).toContain("Raw LLM Output");
  });

  it("renders nothing when neither records nor errors are provided", async () => {
    await act(async () => {
      root.render(React.createElement(StageDebugCard, {}));
    });

    expect(container.textContent).toBe("");
  });

  it("handles clipboard copy fallback when navigator.clipboard is unavailable", async () => {
    const write = vi.fn().mockRejectedValue(new Error("clipboard unavailable"));
    Object.defineProperty(globalThis.navigator, "clipboard", {
      configurable: true,
      value: { writeText: write },
    });

    const execCommand = vi.fn().mockReturnValue(true);
    document.execCommand = execCommand;

    await act(async () => {
      root.render(
        React.createElement(StageDebugCard, {
          records: [stageReadinessCheck],
        }),
      );
    });

    const copyButton = container.querySelector(
      'button[title="Copy all data"]',
    ) as HTMLButtonElement | null;
    expect(copyButton).not.toBeNull();

    await act(async () => {
      copyButton!.click();
    });

    expect(execCommand).toHaveBeenCalledWith("copy");
  });
});
