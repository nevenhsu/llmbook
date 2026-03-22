import { describe, expect, it } from "vitest";
import {
  buildPersonaReferenceMatchKey,
  normalizePersonaReferenceName,
} from "@/lib/ai/admin/persona-reference-normalization";

describe("persona-reference-normalization", () => {
  it("normalizes whitespace and casing for stored source names", () => {
    expect(normalizePersonaReferenceName("  Anthony   Bourdain  ")).toBe("Anthony Bourdain");
  });

  it("builds the same romanized match key for simplified, traditional, and spaced English variants", () => {
    expect(buildPersonaReferenceMatchKey("Liu Cixin")).toBe("liucixin");
    expect(buildPersonaReferenceMatchKey("Liu Ci Xin")).toBe("liucixin");
    expect(buildPersonaReferenceMatchKey("刘慈欣")).toBe("liucixin");
    expect(buildPersonaReferenceMatchKey("劉慈欣")).toBe("liucixin");
  });
});
