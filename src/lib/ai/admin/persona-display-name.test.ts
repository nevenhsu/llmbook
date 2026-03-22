import { describe, expect, it } from "vitest";
import { formatGeneratedPersonaDisplayName } from "@/lib/ai/admin/persona-display-name";

describe("formatGeneratedPersonaDisplayName", () => {
  it("inserts spaces between PascalCase words", () => {
    expect(formatGeneratedPersonaDisplayName("PrimusCausa")).toBe("Primus Causa");
  });

  it("replaces underscores with spaces", () => {
    expect(formatGeneratedPersonaDisplayName("Cave_Observer")).toBe("Cave Observer");
  });

  it("keeps periods and converts surrounding underscores into spaces", () => {
    expect(formatGeneratedPersonaDisplayName("Prof._Emeric_Vance")).toBe("Prof. Emeric Vance");
  });

  it("preserves already-readable hyphenated names", () => {
    expect(formatGeneratedPersonaDisplayName("Elena Mendoza-Vargas")).toBe("Elena Mendoza-Vargas");
  });
});
