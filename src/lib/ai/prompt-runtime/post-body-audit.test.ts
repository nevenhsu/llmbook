import { describe, expect, it } from "vitest";
import {
  buildPostBodyAuditPrompt,
  buildPostBodyRepairPrompt,
  parsePostBodyAuditResult,
} from "@/lib/ai/prompt-runtime/post-body-audit";
import {
  formatPersonaEvidenceForAudit,
  type PromptPersonaEvidence,
} from "@/lib/ai/prompt-runtime/persona-audit-shared";

const PERSONA_EVIDENCE: PromptPersonaEvidence = {
  displayName: "Marlowe",
  identity: "Forensic workflow critic",
  referenceSourceNames: ["Ursula K. Le Guin", "David Foster Wallace"],
  doctrine: {
    valueFit: ["clarity", "evidence-first"],
    reasoningFit: ["trace the boundary first", "attack vague certainty"],
    discourseFit: ["state the hidden boundary early", "close with a sting"],
    expressionFit: ["skeptical", "concrete", "operator-level"],
  },
};

describe("post-body audit prompts", () => {
  it("builds a compact audit packet without asking for missing generation background", () => {
    const prompt = buildPostBodyAuditPrompt({
      boardContextText: "[board]\nName: Creative Lab",
      selectedPostPlanText:
        "[selected_post_plan]\nLocked title: The workflow bug people keep mislabeling as a prompt bug",
      renderedFinalPost:
        "# The workflow bug people keep mislabeling as a prompt bug\n\n#ai #workflow\n\nBody text",
      personaEvidence: PERSONA_EVIDENCE,
    });

    expect(prompt).toContain("[post_body_audit]");
    expect(prompt).toContain("compact app-owned review packet");
    expect(prompt).toContain("[persona_evidence]");
    expect(prompt).toContain("reference_sources:");
    expect(prompt).toContain("Do not complain that unrelated generation background is absent");
    expect(prompt).toContain('"contentChecks"');
    expect(prompt).toContain('"personaChecks"');
  });

  it("parses merged body audit output strictly", () => {
    expect(
      parsePostBodyAuditResult(
        JSON.stringify({
          passes: false,
          issues: ["Body stays generic."],
          repairGuidance: ["Open with the hidden execution boundary."],
          contentChecks: {
            angle_fidelity: "fail",
            board_fit: "pass",
            body_usefulness: "fail",
            markdown_structure: "fail",
            title_body_alignment: "pass",
          },
          personaChecks: {
            body_persona_fit: "fail",
            anti_style_compliance: "pass",
            value_fit: "fail",
            reasoning_fit: "fail",
            discourse_fit: "fail",
            expression_fit: "fail",
          },
        }),
      ),
    ).toEqual({
      passes: false,
      issues: ["Body stays generic."],
      repairGuidance: ["Open with the hidden execution boundary."],
      contentChecks: {
        angle_fidelity: "fail",
        board_fit: "pass",
        body_usefulness: "fail",
        markdown_structure: "fail",
        title_body_alignment: "pass",
      },
      personaChecks: {
        body_persona_fit: "fail",
        anti_style_compliance: "pass",
        value_fit: "fail",
        reasoning_fit: "fail",
        discourse_fit: "fail",
        expression_fit: "fail",
      },
    });
  });

  it("builds a fuller repair packet with previous body-stage JSON", () => {
    const prompt = buildPostBodyRepairPrompt({
      selectedPostPlanText:
        "[selected_post_plan]\nLocked title: The workflow bug people keep mislabeling as a prompt bug",
      personaEvidence: PERSONA_EVIDENCE,
      issues: ["Body stays generic."],
      repairGuidance: ["Open with the hidden execution boundary."],
      previousOutput: JSON.stringify({
        body: "Generic body.",
        tags: ["#ai"],
        need_image: false,
        image_prompt: null,
        image_alt: null,
      }),
    });

    expect(prompt).toContain("[post_body_repair]");
    expect(prompt).toContain("fuller rewrite packet");
    expect(prompt).toContain("[previous_output]");
    expect(prompt).toContain("Do not change the title.");
    expect(prompt).toContain("Do not output title.");
  });

  it("formats persona evidence into the audit packet contract", () => {
    const text = formatPersonaEvidenceForAudit(PERSONA_EVIDENCE);

    expect(text).toContain("display_name: Marlowe");
    expect(text).toContain("identity_summary:");
    expect(text).toContain("reference_sources:");
    expect(text).toContain("value_fit:");
    expect(text).toContain("expression_fit:");
  });
});
