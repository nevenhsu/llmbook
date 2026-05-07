import { describe, expect, it } from "vitest";
import {
  buildReplyAuditPrompt,
  buildReplyRepairPrompt,
  parseReplyAuditResult,
} from "@/lib/ai/prompt-runtime/reply-flow-audit";

const PERSONA_PACKET_TEXT =
  "Persona: forensic workflow critic. Procedure: internally trace the pressure point first before writing.";

describe("reply-flow-audit", () => {
  it("builds a compact reply audit packet", () => {
    const prompt = buildReplyAuditPrompt({
      personaPacketText: PERSONA_PACKET_TEXT,
      sourceCommentText:
        "[source_comment]\n[artist_3]: This still sounds too vague. What exactly changes in the workflow if you add a repair step?",
      ancestorCommentsText:
        "[ancestor_comments]\n[artist_1]: Prompt review is useful, but most examples stop before runtime execution.",
      generatedReply:
        "Repair is important in many production systems. Workflows need to be thoughtfully designed.",
    });

    expect(prompt).toContain("[reply_audit]");
    expect(prompt).toContain("non_top_level_essay_shape");
    expect(prompt).toContain("source_comment_responsiveness");
    expect(prompt).toContain("compact app-owned review packet");
  });

  it("parses reply audit JSON strictly", () => {
    expect(
      parseReplyAuditResult(
        JSON.stringify({
          passes: false,
          issues: [
            "The reply does not answer the source comment's request for a concrete workflow change.",
          ],
          repairGuidance: ["Answer the source comment directly with one concrete workflow change."],
          checks: {
            source_comment_responsiveness: "fail",
            thread_continuity: "fail",
            forward_motion: "fail",
            non_top_level_essay_shape: "fail",
            value_fit: "fail",
            reasoning_fit: "pass",
            discourse_fit: "fail",
            expression_fit: "fail",
            procedure_fit: "pass",
          },
        }),
      ),
    ).toEqual({
      passes: false,
      issues: [
        "The reply does not answer the source comment's request for a concrete workflow change.",
      ],
      repairGuidance: ["Answer the source comment directly with one concrete workflow change."],
      checks: {
        source_comment_responsiveness: "fail",
        thread_continuity: "fail",
        forward_motion: "fail",
        non_top_level_essay_shape: "fail",
        value_fit: "fail",
        reasoning_fit: "pass",
        discourse_fit: "fail",
        expression_fit: "fail",
        procedure_fit: "pass",
      },
    });
  });

  it("builds a fuller reply repair packet", () => {
    const prompt = buildReplyRepairPrompt({
      personaPacketText: PERSONA_PACKET_TEXT,
      sourceCommentText:
        "[source_comment]\n[artist_3]: This still sounds too vague. What exactly changes in the workflow if you add a repair step?",
      ancestorCommentsText:
        "[ancestor_comments]\n[artist_1]: Prompt review is useful, but most examples stop before runtime execution.",
      issues: ["The reply restarts the topic as a broad essay instead of continuing the thread."],
      repairGuidance: [
        "Keep the reply thread-native instead of widening into a general explainer.",
      ],
      previousOutput: JSON.stringify({
        markdown: "Repair is important in many production systems.",
        need_image: false,
        image_prompt: null,
        image_alt: null,
      }),
    });

    expect(prompt).toContain("[reply_repair]");
    expect(prompt).toContain("Do not write a top-level essay.");
    expect(prompt).toContain("[previous_output]");
  });
});
