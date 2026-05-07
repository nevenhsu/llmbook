import { describe, expect, it } from "vitest";
import {
  buildCommentAuditPrompt,
  buildCommentRepairPrompt,
  parseCommentAuditResult,
} from "@/lib/ai/prompt-runtime/comment-flow-audit";
import type { PromptPersonaEvidence } from "@/lib/ai/prompt-runtime/persona-audit-shared";

const PERSONA_EVIDENCE: PromptPersonaEvidence = {
  displayName: "Marlowe",
  identity: "Forensic workflow critic",
  referenceSourceNames: ["Ursula K. Le Guin", "David Foster Wallace"],
  doctrine: {
    valueFit: ["clarity", "evidence-first"],
    reasoningFit: ["trace the boundary first", "attack vague certainty"],
    discourseFit: ["standalone top-level intervention", "name the distinction early"],
    expressionFit: ["skeptical", "concrete", "thread-native"],
  },
};

describe("comment-flow-audit", () => {
  it("builds a compact comment audit packet", () => {
    const prompt = buildCommentAuditPrompt({
      personaEvidence: PERSONA_EVIDENCE,
      rootPostText: "[root_post]\nTitle: Best prompting workflows this week",
      recentTopLevelCommentsText:
        "[recent_top_level_comments]\n[artist_1]: I want examples that show where prompt repair actually changed the final result.",
      generatedComment:
        "I agree that the surrounding task contract matters a lot. The workflow is bigger than the prompt.",
    });

    expect(prompt).toContain("[comment_audit]");
    expect(prompt).toContain("compact app-owned review packet");
    expect(prompt).toContain("standalone_top_level_shape");
    expect(prompt).toContain("[persona_evidence]");
    expect(prompt).toContain("Do not complain that unrelated generation background is absent");
  });

  it("parses comment audit JSON strictly", () => {
    expect(
      parseCommentAuditResult(
        JSON.stringify({
          passes: false,
          issues: ["The comment mostly repeats a recent top-level comment."],
          repairGuidance: [
            "Add one concrete distinction the recent comments did not already make.",
          ],
          checks: {
            post_relevance: "pass",
            net_new_value: "fail",
            non_repetition_against_recent_comments: "fail",
            standalone_top_level_shape: "fail",
            value_fit: "fail",
            reasoning_fit: "pass",
            discourse_fit: "fail",
            expression_fit: "fail",
          },
        }),
      ),
    ).toEqual({
      passes: false,
      issues: ["The comment mostly repeats a recent top-level comment."],
      repairGuidance: ["Add one concrete distinction the recent comments did not already make."],
      checks: {
        post_relevance: "pass",
        net_new_value: "fail",
        non_repetition_against_recent_comments: "fail",
        standalone_top_level_shape: "fail",
        value_fit: "fail",
        reasoning_fit: "pass",
        discourse_fit: "fail",
        expression_fit: "fail",
      },
    });
  });

  it("builds a fuller comment repair packet", () => {
    const prompt = buildCommentRepairPrompt({
      personaEvidence: PERSONA_EVIDENCE,
      rootPostText: "[root_post]\nTitle: Best prompting workflows this week",
      recentTopLevelCommentsText:
        "[recent_top_level_comments]\n[artist_1]: I want examples that show where prompt repair actually changed the final result.",
      issues: ["The comment is too generic to feel standalone."],
      repairGuidance: ["Make the comment stand on its own as a top-level intervention."],
      previousOutput: JSON.stringify({
        markdown: "I agree with the thread.",
        need_image: false,
        image_prompt: null,
        image_alt: null,
      }),
    });

    expect(prompt).toContain("[comment_repair]");
    expect(prompt).toContain("fuller rewrite packet");
    expect(prompt).toContain("[previous_output]");
    expect(prompt).toContain("standalone top-level contribution");
  });
});
