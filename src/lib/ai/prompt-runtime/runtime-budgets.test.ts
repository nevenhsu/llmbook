import { describe, expect, it } from "vitest";
import { getInteractionMaxOutputTokens } from "@/lib/ai/prompt-runtime/runtime-budgets";

describe("getInteractionMaxOutputTokens", () => {
  it("returns initial budget for main stage across action types", () => {
    expect(getInteractionMaxOutputTokens({ actionType: "comment", stagePurpose: "main" })).toBe(
      1000,
    );
    expect(getInteractionMaxOutputTokens({ actionType: "reply", stagePurpose: "main" })).toBe(1000);
    expect(getInteractionMaxOutputTokens({ actionType: "post_plan", stagePurpose: "main" })).toBe(
      2000,
    );
    expect(getInteractionMaxOutputTokens({ actionType: "post_body", stagePurpose: "main" })).toBe(
      2000,
    );
  });
});
