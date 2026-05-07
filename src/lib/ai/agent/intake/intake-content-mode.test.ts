import { describe, expect, it } from "vitest";
import {
  buildOpportunityStagePrompt,
  buildCandidateStagePrompt,
  buildSelectorInputPreview,
  buildPersonaCandidateCards,
  type PersonaCandidateCard,
} from "./intake-preview";

const FIXTURE_ITEMS = [
  {
    source: "public-post",
    contentType: "post",
    summary: "Board: Creative Lab | A person finds a locked box in a public place",
    sourceId: "post-1",
    createdAt: "2026-04-03T10:00:00.000Z",
  },
  {
    source: "public-post",
    contentType: "post",
    summary: "Board: Creative Lab | Another post about AI writing tools",
    sourceId: "post-2",
    createdAt: "2026-04-03T11:00:00.000Z",
  },
];

describe("contentMode in intake prompt", () => {
  describe("scoring prompt output contract", () => {
    it("includes contentMode in the example output schema", () => {
      const selectorInput = buildSelectorInputPreview({
        fixtureMode: "mixed-public-opportunity",
        groupIndexOverride: 0,
        selectorReferenceBatchSize: 10,
        items: FIXTURE_ITEMS,
      });

      const prompt = buildOpportunityStagePrompt(selectorInput);

      expect(prompt).toContain('"contentMode"');
      expect(prompt).toContain('"contentMode": "discussion"');
      expect(prompt).toContain('"contentMode": "story"');
    });

    it("requires contentMode in the output requirements", () => {
      const selectorInput = buildSelectorInputPreview({
        fixtureMode: "mixed-public-opportunity",
        groupIndexOverride: 0,
        selectorReferenceBatchSize: 10,
        items: FIXTURE_ITEMS,
      });

      const prompt = buildOpportunityStagePrompt(selectorInput);

      expect(prompt).toContain("`contentMode`");
      expect(prompt).toContain("discussion");
      expect(prompt).toContain("story");
      expect(prompt).toContain("forum-native analysis");
      expect(prompt).toContain("story writing");
      expect(prompt).toContain("narrative fragments");
    });

    it("still requires opportunity_key and probability", () => {
      const selectorInput = buildSelectorInputPreview({
        fixtureMode: "mixed-public-opportunity",
        groupIndexOverride: 0,
        selectorReferenceBatchSize: 10,
        items: FIXTURE_ITEMS,
      });

      const prompt = buildOpportunityStagePrompt(selectorInput);

      expect(prompt).toContain("`opportunity_key`");
      expect(prompt).toContain("`probability`");
      expect(prompt).toContain("probability > 0.5");
    });
  });
});

describe("contentMode in candidate prompt", () => {
  it("candidate prompt supports personaCards for richer speaker batches", () => {
    const cards: PersonaCandidateCard[] = [
      {
        referenceName: "David Bowie",
        abstractTraits: ["theatrical pressure", "outsider poise"],
        participationMode: "counterpoint",
        topForumIntents: ["critique", "clarification"],
      },
      {
        referenceName: "Laurie Anderson",
        abstractTraits: ["system-level observation", "cool distance"],
        participationMode: "field note",
        topForumIntents: ["synthesis", "clarification"],
      },
    ];

    const prompt = buildCandidateStagePrompt({
      selectedOpportunities: [
        {
          opportunityKey: "O01",
          contentType: "post",
          summary: "Board: Creative Lab | A person finds a locked box",
        },
      ],
      referenceBatch: ["David Bowie", "Laurie Anderson"],
      personaCards: cards,
    });

    // Speaker batch now includes traits, mode, and intents
    expect(prompt).toContain("David Bowie");
    expect(prompt).toContain("traits: theatrical pressure, outsider poise");
    expect(prompt).toContain("mode: counterpoint");
    expect(prompt).toContain("intents: critique, clarification");

    expect(prompt).toContain("Laurie Anderson");
    expect(prompt).toContain("traits: system-level observation, cool distance");
    expect(prompt).toContain("mode: field note");

    // Should tell LLM to use the enriched data
    expect(prompt).toContain("abstract traits, participation mode, and forum intents");
  });

  it("candidate prompt falls back to plain names when no personaCards", () => {
    const prompt = buildCandidateStagePrompt({
      selectedOpportunities: [{ opportunityKey: "O01", contentType: "post", summary: "Test" }],
      referenceBatch: ["David Bowie", "Laurie Anderson"],
    });

    expect(prompt).toContain("David Bowie");
    expect(prompt).toContain("Laurie Anderson");
    expect(prompt).not.toContain("traits:");
    expect(prompt).not.toContain("mode:");
    expect(prompt).not.toContain("intents:");
  });
});

describe("buildPersonaCandidateCards", () => {
  it("builds cards from v2 persona cores", () => {
    const cards = buildPersonaCandidateCards({
      referenceNames: ["David Bowie", "Laurie Anderson"],
      coresByName: {
        "David Bowie": {
          schema_version: "v2",
          reference_style: {
            abstract_traits: ["theatrical pressure", "outsider poise", "cool distance"],
          },
          forum: {
            participation_mode: "counterpoint",
            preferred_post_intents: ["critique", "clarification"],
            preferred_comment_intents: ["counterpoint", "pressure test"],
            preferred_reply_intents: ["rebuttal"],
          },
        },
        "Laurie Anderson": {
          schema_version: "v2",
          reference_style: {
            abstract_traits: ["system observation", "minimalist precision"],
          },
          forum: {
            participation_mode: "field note",
            preferred_post_intents: ["synthesis"],
            preferred_comment_intents: ["clarification"],
            preferred_reply_intents: ["focused ask"],
          },
        },
      },
    });

    expect(cards).toHaveLength(2);

    const bowie = cards.find((c) => c.referenceName === "David Bowie");
    expect(bowie).toBeDefined();
    expect(bowie!.abstractTraits).toEqual([
      "theatrical pressure",
      "outsider poise",
      "cool distance",
    ]);
    expect(bowie!.participationMode).toBe("counterpoint");
    expect(bowie!.topForumIntents).toContain("critique");
    expect(bowie!.topForumIntents).toContain("counterpoint");

    const laurie = cards.find((c) => c.referenceName === "Laurie Anderson");
    expect(laurie).toBeDefined();
    expect(laurie!.abstractTraits).toContain("system observation");
    expect(laurie!.participationMode).toBe("field note");
    expect(laurie!.topForumIntents).toContain("synthesis");
  });

  it("skips reference names with no matching core", () => {
    const cards = buildPersonaCandidateCards({
      referenceNames: ["Unknown Person"],
      coresByName: {},
    });

    expect(cards).toHaveLength(0);
  });

  it("handles missing abstract_traits and forum fields", () => {
    const cards = buildPersonaCandidateCards({
      referenceNames: ["Minimal Persona"],
      coresByName: {
        "Minimal Persona": {
          schema_version: "v2",
          reference_style: {},
          forum: {
            participation_mode: "observer",
          },
        },
      },
    });

    expect(cards).toHaveLength(1);
    expect(cards[0].abstractTraits).toEqual([]);
    expect(cards[0].participationMode).toBe("observer");
    expect(cards[0].topForumIntents).toEqual([]);
  });
});
