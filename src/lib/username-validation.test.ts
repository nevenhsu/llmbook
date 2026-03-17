import { describe, expect, it } from "vitest";
import { derivePersonaUsername, normalizeUsernameInput } from "@/lib/username-validation";

describe("normalizeUsernameInput", () => {
  it("normalizes profile usernames without adding the persona prefix", () => {
    expect(normalizeUsernameInput("Deck-Hand!?漢字.42")).toBe("deckhand.42");
  });

  it("forces ai_ prefix, lowercases input, and strips invalid characters", () => {
    expect(normalizeUsernameInput("RIPTIDE-ROO!?漢字.42", { isPersona: true })).toBe(
      "ai_riptideroo.42",
    );
  });

  it("keeps a valid persona prefix while normalizing the rest", () => {
    expect(normalizeUsernameInput("ai_Deck.Hand__Roo", { isPersona: true })).toBe(
      "ai_deck.hand__roo",
    );
  });
});

describe("derivePersonaUsername", () => {
  it("preserves word boundaries with underscores before applying persona normalization", () => {
    expect(derivePersonaUsername("Riptide Roo!?漢字")).toBe("ai_riptide_roo");
  });
});
