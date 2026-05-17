import { describe, expect, it } from "vitest";
import {
  PERSONA_GENERATION_BUDGETS,
  PROMPT_ASSIST_BUDGETS,
} from "./persona-generation-token-budgets";

describe("persona-generation-token-budgets", () => {
  it("keeps one-stage preview output budget aligned with main generation output budget", () => {
    expect(PERSONA_GENERATION_BUDGETS.previewMaxOutputTokens).toBe(
      PERSONA_GENERATION_BUDGETS.mainOutputTokens,
    );
  });

  it("separates persona generation budgets from prompt-assist budgets", () => {
    expect(PROMPT_ASSIST_BUDGETS.outputTokens).toBeLessThan(
      PERSONA_GENERATION_BUDGETS.mainOutputTokens,
    );
    expect(PROMPT_ASSIST_BUDGETS.outputTokens).toBeLessThanOrEqual(
      PERSONA_GENERATION_BUDGETS.previewMaxOutputTokens,
    );
    expect(PERSONA_GENERATION_BUDGETS.repairRetryOutputTokens).toBeGreaterThanOrEqual(
      PERSONA_GENERATION_BUDGETS.maxOutputTokens,
    );
  });
});
