import { describe, expect, it } from "vitest";
import {
  buildPostPlanAuditPrompt,
  parsePostPlanAuditResult,
} from "@/lib/ai/prompt-runtime/post-plan-audit";
import type { PostPlanCandidate } from "@/lib/ai/prompt-runtime/post-plan-contract";

function validCandidate(): PostPlanCandidate {
  return {
    title: "The workflow bug people keep mislabeling",
    angleSummary: "Workflow vs prompt distinction",
    thesis: "Most prompt issues are really workflow issues",
    bodyOutline: ["#point1", "#point2", "#point3"],
    differenceFromRecent: ["#diff1"],
    boardFitScore: 80,
    titlePersonaFitScore: 85,
    titleNoveltyScore: 90,
    angleNoveltyScore: 88,
    bodyUsefulnessScore: 75,
  };
}

const PERSONA_PACKET_TEXT =
  "Identity: pattern-spotter. Voice: dry wit. Procedure: internally scan for unstated assumptions and flag missing costs before writing.";

describe("postPlanAudit", () => {
  it("builds a semantic post_plan audit prompt", () => {
    const prompt = buildPostPlanAuditPrompt({
      candidate: validCandidate(),
      personaPacketText: PERSONA_PACKET_TEXT,
    });

    expect(prompt).toContain("auditing a post_plan stage output");
    expect(prompt).toContain("[post_plan_candidate]");
    expect(prompt).toContain("[persona_packet]");
    expect(prompt).toContain("[output_constraints]");
    expect(prompt).toContain('"passes": true');
    expect(prompt).toContain('"issues": ["string"]');
    expect(prompt).toContain('"candidate_count": "pass | fail"');
    expect(prompt).toContain('"persona_fit": "pass | fail"');
    expect(prompt).toContain('"novelty_evidence": "pass | fail"');
    expect(prompt).toContain('"procedure_fit": "pass | fail"');
    expect(prompt).toContain("pattern-spotter");
  });

  it("builds prompt with narrative_fit for story mode", () => {
    const prompt = buildPostPlanAuditPrompt({
      candidate: validCandidate(),
      contentMode: "story",
      personaPacketText: PERSONA_PACKET_TEXT,
    });

    expect(prompt).toContain('"narrative_fit": "pass | fail"');
  });

  it("builds prompt for discussion mode without narrative_fit", () => {
    const prompt = buildPostPlanAuditPrompt({
      candidate: validCandidate(),
      contentMode: "discussion",
    });

    expect(prompt).not.toContain("narrative_fit");
  });

  it("parses valid semantic post_plan audit JSON (discussion mode)", () => {
    const result = parsePostPlanAuditResult(
      JSON.stringify({
        passes: true,
        issues: [],
        repairGuidance: [],
        checks: {
          candidate_count: "pass",
          persona_fit: "pass",
          novelty_evidence: "pass",
          procedure_fit: "pass",
        },
      }),
    );

    expect(result.passes).toBe(true);
    expect(result.issues).toEqual([]);
    expect(result.checks).toEqual({
      candidate_count: "pass",
      persona_fit: "pass",
      novelty_evidence: "pass",
      procedure_fit: "pass",
    });
  });

  it("parses valid audit JSON with narrative_fit for story mode", () => {
    const result = parsePostPlanAuditResult(
      JSON.stringify({
        passes: false,
        issues: ["Candidate does not fit the narrative engine."],
        repairGuidance: ["Use the persona's favored conflict."],
        checks: {
          candidate_count: "pass",
          persona_fit: "fail",
          novelty_evidence: "fail",
          procedure_fit: "fail",
          narrative_fit: "fail",
        },
      }),
      "story",
    );

    expect(result.passes).toBe(false);
    expect(result.checks.narrative_fit).toBe("fail");
    expect(result.checks.procedure_fit).toBe("fail");
  });

  it("rejects invalid audit JSON", () => {
    expect(() => parsePostPlanAuditResult("")).toThrow(/empty/);
    expect(() => parsePostPlanAuditResult("not json")).toThrow(/raw JSON object/);
    expect(() => parsePostPlanAuditResult("{ bad }")).toThrow(/valid JSON/);

    expect(() =>
      parsePostPlanAuditResult(
        JSON.stringify({
          passes: true,
          issues: [],
          repairGuidance: [],
          checks: { candidate_count: "pass" },
        }),
      ),
    ).toThrow(/checks/);
  });

  it("normalizes valid audit JSON with issues", () => {
    expect(
      parsePostPlanAuditResult(
        JSON.stringify({
          passes: false,
          issues: ["Candidate 1 is too close to recent posts."],
          repairGuidance: ["Make the angle more distinct."],
          checks: {
            candidate_count: "pass",
            persona_fit: "fail",
            novelty_evidence: "fail",
            procedure_fit: "pass",
          },
        }),
      ),
    ).toEqual({
      passes: false,
      issues: ["Candidate 1 is too close to recent posts."],
      repairGuidance: ["Make the angle more distinct."],
      checks: {
        candidate_count: "pass",
        persona_fit: "fail",
        novelty_evidence: "fail",
        procedure_fit: "pass",
      },
    });
  });
});
