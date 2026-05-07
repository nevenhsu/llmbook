import { describe, expect, it } from "vitest";
import {
  buildPostBodyAuditPrompt,
  buildPostBodyRepairPrompt,
  parsePostBodyAuditResult,
} from "@/lib/ai/prompt-runtime/post-body-audit";

const PERSONA_PACKET_TEXT =
  "Identity: pattern-spotter. Voice: dry wit. Procedure: internally scan for unstated assumptions before writing.";

describe("post-body audit prompts", () => {
  it("builds a compact audit packet", () => {
    const prompt = buildPostBodyAuditPrompt({
      selectedPostPlanText:
        "[selected_post_plan]\nLocked title: The workflow bug people keep mislabeling as a prompt bug",
      renderedFinalPost:
        "# The workflow bug people keep mislabeling as a prompt bug\n\n#ai #workflow\n\nBody text",
      personaPacketText: PERSONA_PACKET_TEXT,
    });

    expect(prompt).toContain("[post_body_audit]");
    expect(prompt).toContain("[persona_packet]");
    expect(prompt).toContain("pattern-spotter");
    expect(prompt).toContain('"contentChecks"');
    expect(prompt).toContain('"personaChecks"');
    expect(prompt).toContain('"procedure_fit"');
  });

  it("builds audit with narrative_fit for story mode", () => {
    const prompt = buildPostBodyAuditPrompt({
      selectedPostPlanText: "[selected_post_plan]\nLocked title: The Last Sailor",
      renderedFinalPost: "# The Last Sailor\n\nStory body...",
      contentMode: "story",
      personaPacketText: PERSONA_PACKET_TEXT,
    });

    expect(prompt).toContain("narrative_fit");
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
            body_usefulness: "fail",
            markdown_structure: "fail",
          },
          personaChecks: {
            body_persona_fit: "fail",
            anti_style_compliance: "pass",
            procedure_fit: "fail",
          },
        }),
      ),
    ).toEqual({
      passes: false,
      issues: ["Body stays generic."],
      repairGuidance: ["Open with the hidden execution boundary."],
      contentChecks: {
        angle_fidelity: "fail",
        body_usefulness: "fail",
        markdown_structure: "fail",
      },
      personaChecks: {
        body_persona_fit: "fail",
        anti_style_compliance: "pass",
        procedure_fit: "fail",
      },
    });
  });

  it("parses body audit with narrative_fit for story mode", () => {
    expect(
      parsePostBodyAuditResult(
        JSON.stringify({
          passes: false,
          issues: ["Story lacks narrative fit."],
          repairGuidance: ["Use the persona's favored conflict."],
          contentChecks: {
            angle_fidelity: "pass",
            body_usefulness: "fail",
            markdown_structure: "pass",
          },
          personaChecks: {
            body_persona_fit: "fail",
            anti_style_compliance: "pass",
            procedure_fit: "fail",
            narrative_fit: "fail",
          },
        }),
        "story",
      ),
    ).toEqual({
      passes: false,
      issues: ["Story lacks narrative fit."],
      repairGuidance: ["Use the persona's favored conflict."],
      contentChecks: {
        angle_fidelity: "pass",
        body_usefulness: "fail",
        markdown_structure: "pass",
      },
      personaChecks: {
        body_persona_fit: "fail",
        anti_style_compliance: "pass",
        procedure_fit: "fail",
        narrative_fit: "fail",
      },
    });
  });

  it("builds a fuller repair packet with previous body-stage JSON", () => {
    const prompt = buildPostBodyRepairPrompt({
      selectedPostPlanText:
        "[selected_post_plan]\nLocked title: The workflow bug people keep mislabeling as a prompt bug",
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
    expect(prompt).toContain("[previous_output]");
    expect(prompt).toContain("Do not change the title.");
    expect(prompt).toContain("Do not output title.");
  });
});
