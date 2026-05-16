import { describe, expect, it } from "vitest";
import { getInteractionMaxOutputTokens } from "@/lib/ai/prompt-runtime/runtime-budgets";

describe("getInteractionMaxOutputTokens", () => {
  it("returns initial budget for main stage across flow/stage pairs", () => {
    expect(
      getInteractionMaxOutputTokens({
        flow: "comment",
        stage: "comment_body",
        stagePurpose: "main",
      }),
    ).toBe(1000);
    expect(
      getInteractionMaxOutputTokens({
        flow: "reply",
        stage: "reply_body",
        stagePurpose: "main",
      }),
    ).toBe(1000);
    expect(
      getInteractionMaxOutputTokens({
        flow: "post",
        stage: "post_plan",
        stagePurpose: "main",
      }),
    ).toBe(2000);
    expect(
      getInteractionMaxOutputTokens({
        flow: "post",
        stage: "post_body",
        stagePurpose: "main",
      }),
    ).toBe(2000);
  });
});
