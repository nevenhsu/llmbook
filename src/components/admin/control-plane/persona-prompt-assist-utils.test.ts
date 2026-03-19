import { describe, expect, it } from "vitest";
import {
  formatPromptAssistStatus,
  readPromptAssistButtonMode,
} from "@/components/admin/control-plane/persona-prompt-assist-utils";

describe("persona-prompt-assist-utils", () => {
  it("shows timer while processing", () => {
    expect(formatPromptAssistStatus(true, false, 9, null)).toBe("AI assist processing 00:09");
  });

  it("shows error when present and idle", () => {
    expect(formatPromptAssistStatus(false, false, 0, "Provider timeout")).toBe("Provider timeout");
  });

  it("keeps the final elapsed time after assist completes", () => {
    expect(formatPromptAssistStatus(false, true, 1, null)).toBe("AI assist completed 00:01");
  });

  it("returns idle mode when not loading", () => {
    expect(readPromptAssistButtonMode(false)).toBe("idle");
    expect(readPromptAssistButtonMode(true)).toBe("cancel");
  });
});
