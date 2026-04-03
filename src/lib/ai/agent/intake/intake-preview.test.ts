import { describe, expect, it } from "vitest";
import {
  buildCandidateStagePrompt,
  buildOpportunityStagePrompt,
  buildReferenceWindow,
  buildSelectorInputPreview,
  resolvePersonasForReferences,
} from "@/lib/ai/agent/intake/intake-preview";

describe("intake preview prompt/input builders", () => {
  it("builds selector input previews with stable prompt-local opportunity keys", () => {
    const selectorInput = buildSelectorInputPreview({
      fixtureMode: "mixed-public-opportunity",
      groupIndexOverride: 2,
      selectorReferenceBatchSize: 10,
      items: [
        {
          source: "public-post",
          contentType: "post",
          summary: "Board: Creative Lab | Recent post title: Best prompting workflows this week",
          sourceId: "post-1",
          metadata: {
            boardId: "board-1",
            boardSlug: "creative-lab",
            postId: "post-1",
          },
        },
        {
          source: "public-comment",
          contentType: "comment",
          summary: "Board: Creative Lab | Recent comment: Good follow-up thread",
          sourceId: "comment-2",
          metadata: {
            boardId: "board-1",
            boardSlug: "creative-lab",
            postId: "post-1",
            commentId: "comment-2",
          },
        },
      ],
    });

    expect(selectorInput.referenceWindow).toEqual({
      batchSize: 10,
      groupIndex: 2,
    });
    expect(selectorInput.opportunities).toEqual([
      {
        opportunityKey: "O01",
        source: "public-post",
        contentType: "post",
        summary: "Board: Creative Lab | Recent post title: Best prompting workflows this week",
      },
      {
        opportunityKey: "O02",
        source: "public-comment",
        contentType: "comment",
        summary: "Board: Creative Lab | Recent comment: Good follow-up thread",
      },
    ]);
    expect(selectorInput.opportunityLookup[1]).toMatchObject({
      opportunityKey: "O02",
      sourceTable: "comments",
      sourceId: "comment-2",
      metadata: {
        commentId: "comment-2",
      },
    });
  });

  it("renders the opportunities prompt with the probability contract only", () => {
    const selectorInput = buildSelectorInputPreview({
      fixtureMode: "notification-intake",
      groupIndexOverride: 0,
      selectorReferenceBatchSize: 4,
      items: [
        {
          source: "notification",
          contentType: "mention",
          summary: "Unread mention with clear reply target",
        },
      ],
    });

    const prompt = buildOpportunityStagePrompt(selectorInput);

    expect(prompt).toContain("[stage]");
    expect(prompt).toContain("opportunities_selector");
    expect(prompt).toContain("[decision_criteria]");
    expect(prompt).toContain("[available_opportunities]");
    expect(prompt).toContain("- opportunity_key: N01");
    expect(prompt).toContain("content_type: mention");
    expect(prompt).toContain("summary: Unread mention with clear reply target");
    expect(prompt).toContain("Use 0.8 to 1.0 when the opportunity is clearly worth acting on now");
    expect(prompt).toContain('"scores"');
    expect(prompt).toContain('"opportunity_key"');
    expect(prompt).toContain('"probability"');
    expect(prompt).toContain("probability > 0.5");
    expect(prompt).not.toContain("[snapshot_scope]");
    expect(prompt).not.toContain("markdown: string");
    expect(prompt).not.toContain("need_image: boolean");
    expect(prompt).not.toContain("[agent_voice_contract]");
  });

  it("renders the candidates prompt with explicit selected opportunities and speaker probabilities", () => {
    const prompt = buildCandidateStagePrompt({
      selectedOpportunities: [
        {
          opportunityKey: "O01",
          contentType: "post",
          summary: "Board: Creative Lab | Recent post title: Best prompting workflows this week",
        },
        {
          opportunityKey: "O02",
          contentType: "comment",
          summary: "Board: Creative Lab | Recent comment: Good follow-up thread",
        },
      ],
      referenceBatch: ["David Bowie", "Laurie Anderson", "Grace Jones"],
    });

    expect(prompt).toContain("[selected_opportunities]");
    expect(prompt).toContain("- opportunity_key: O01");
    expect(prompt).toContain("content_type: post");
    expect(prompt).toContain(
      "summary: Board: Creative Lab | Recent post title: Best prompting workflows this week",
    );
    expect(prompt).toContain("[speaker_batch]");
    expect(prompt).toContain("Pick speakers only from the provided speaker batch.");
    expect(prompt).toContain("at least 1 speaker and at most 3 speakers");
    expect(prompt).toContain('"speaker_candidates"');
    expect(prompt).toContain('"selected_speakers"');
    expect(prompt).toContain('{ "name": "David Bowie", "probability": 0.82 }');
    expect(prompt).not.toContain("[candidate_scope]");
    expect(prompt).not.toContain("Opportunity Key | Content Type | Summary");
  });

  it("keeps preview utilities aligned with the current reference/persona fixture rules", () => {
    const firstWindow = buildReferenceWindow({
      batchSize: 2,
      groupIndex: 0,
    });
    const clampedWindow = buildReferenceWindow({
      batchSize: 2,
      groupIndex: 99,
    });
    const personas = resolvePersonasForReferences({
      selectedReferences: [{ referenceName: "Grace Jones" }, { referenceName: "Laurie Anderson" }],
    });

    expect(firstWindow.window).toEqual(["Yayoi Kusama", "David Bowie"]);
    expect(clampedWindow.window).toHaveLength(2);
    expect(personas).toEqual([
      expect.objectContaining({
        personaId: "persona-sable",
        active: false,
        referenceSource: "Grace Jones",
      }),
      expect.objectContaining({
        personaId: "persona-marlowe",
        active: true,
        referenceSource: "Laurie Anderson",
      }),
    ]);
  });
});
