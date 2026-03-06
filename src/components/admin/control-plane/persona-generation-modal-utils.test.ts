import { describe, expect, it } from "vitest";
import {
  canSavePersonaGeneration,
  formatPersonaGenerationElapsed,
  isPersonaGenerationAbortError,
} from "@/components/admin/control-plane/persona-generation-modal-utils";

describe("persona-generation-modal-utils", () => {
  it("only enables save when generation succeeded with preview data", () => {
    expect(canSavePersonaGeneration("success", { structured: {} } as never)).toBe(true);
    expect(canSavePersonaGeneration("loading", { structured: {} } as never)).toBe(false);
    expect(canSavePersonaGeneration("error", { structured: {} } as never)).toBe(false);
    expect(canSavePersonaGeneration("success", null)).toBe(false);
  });

  it("formats elapsed time as mm:ss", () => {
    expect(formatPersonaGenerationElapsed(0)).toBe("00:00");
    expect(formatPersonaGenerationElapsed(9)).toBe("00:09");
    expect(formatPersonaGenerationElapsed(65)).toBe("01:05");
  });

  it("detects abort-like request errors", () => {
    expect(isPersonaGenerationAbortError(new DOMException("Aborted", "AbortError"))).toBe(true);
    expect(isPersonaGenerationAbortError({ name: "AbortError" })).toBe(true);
    expect(isPersonaGenerationAbortError(new Error("boom"))).toBe(false);
  });
});
