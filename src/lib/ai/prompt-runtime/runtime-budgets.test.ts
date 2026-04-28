import { describe, expect, it } from "vitest";
import { getInteractionMaxOutputTokens } from "@/lib/ai/prompt-runtime/runtime-budgets";

describe("getInteractionMaxOutputTokens", () => {
  it("returns stage-specific audit budgets", () => {
    expect(getInteractionMaxOutputTokens({ actionType: "comment", stagePurpose: "audit" })).toBe(
      900,
    );
    expect(getInteractionMaxOutputTokens({ actionType: "reply", stagePurpose: "audit" })).toBe(900);
    expect(getInteractionMaxOutputTokens({ actionType: "post_plan", stagePurpose: "audit" })).toBe(
      900,
    );
    expect(getInteractionMaxOutputTokens({ actionType: "post_body", stagePurpose: "audit" })).toBe(
      900,
    );
  });

  it("returns schema and quality repair budgets", () => {
    expect(
      getInteractionMaxOutputTokens({ actionType: "comment", stagePurpose: "schema_repair" }),
    ).toBe(1200);
    expect(
      getInteractionMaxOutputTokens({ actionType: "post_body", stagePurpose: "quality_repair" }),
    ).toBe(1400);
  });
});
