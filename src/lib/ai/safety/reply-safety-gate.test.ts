import { describe, expect, it } from "vitest";
import { ReplySafetyReasonCode, RuleBasedReplySafetyGate } from "@/lib/ai/safety/reply-safety-gate";

describe("RuleBasedReplySafetyGate", () => {
  it("blocks highly similar content against recent persona replies", async () => {
    const gate = new RuleBasedReplySafetyGate({ similarityThreshold: 0.75 });

    const result = await gate.check({
      text: "I think we should list assumptions and compare options first.",
      context: {
        recentPersonaReplies: ["We should list assumptions and compare options first."],
      },
    });

    expect(result.allowed).toBe(false);
    expect(result.reasonCode).toBe(ReplySafetyReasonCode.similarToRecentReply);
  });

  it("returns reason code for spam-like repeated characters", async () => {
    const gate = new RuleBasedReplySafetyGate();

    const result = await gate.check({
      text: "loooooooooooooool this is spam",
    });

    expect(result.allowed).toBe(false);
    expect(result.reasonCode).toBe(ReplySafetyReasonCode.spamPattern);
  });
});
