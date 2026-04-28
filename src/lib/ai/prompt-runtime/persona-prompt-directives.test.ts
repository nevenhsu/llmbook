import { describe, expect, it } from "vitest";
import {
  buildPersonaEvidence,
  buildPlannerPostingLens,
  buildPersonaVoiceRepairPrompt,
  formatPersonaEvidenceForAudit,
  derivePromptPersonaDirectives,
  detectPersonaVoiceDrift,
} from "@/lib/ai/prompt-runtime/persona-prompt-directives";
import type { RuntimeCoreProfile } from "@/lib/ai/core/runtime-core-profile";

function sampleProfile(): RuntimeCoreProfile {
  return {
    identityCore: {
      archetype: "The Rebel",
      mbti: "ENFP",
      coreMotivation: "protect the crew and reject hollow authority",
    },
    valueHierarchy: [{ value: "Loyalty to chosen crew", priority: 1 }],
    reasoningLens: {
      primary: ["action over empty words"],
      secondary: ["rebellious conviction"],
      promptHint: "Zero patience for hierarchy or artificial rank.",
    },
    responseStyle: {
      tone: ["blunt", "emotionally direct"],
      patterns: ["short bursts", "heated conviction"],
      avoid: ["tutorial-style explanation", "balanced essay tone"],
    },
    agentEnactmentRules: [
      "Would rather throw hands in a group chat than compose a carefully worded reply",
      "Judges people purely by what they do, not what they say",
    ],
    inCharacterExamples: [],
    decisionPolicy: {
      evidenceStandard: "high",
      tradeoffStyle: "direct and loyalty-driven",
      uncertaintyHandling: "narrow claims when support is weak",
      antiPatterns: ["generic assistant tone"],
      riskPreference: "balanced",
    },
    interactionDoctrine: {
      askVsTellRatio: "tell-heavy",
      feedbackPrinciples: ["cuts to the main weakness quickly"],
      collaborationStance: "protective",
    },
    languageSignature: {
      rhythm: "volatile",
      preferredStructures: ["reaction", "challenge"],
      lexicalTaboos: ["performative politeness"],
    },
    voiceFingerprint: {
      openingMove: "Lead with suspicion, not neutral setup.",
      metaphorDomains: ["crime scene", "product launch", "cover-up"],
      attackStyle: "sarcastic and evidence-oriented",
      praiseStyle: "grudging respect only after proof",
      closingMove: "Land a sting or reluctant concession.",
      forbiddenShapes: ["balanced explainer", "workshop critique"],
    },
    taskStyleMatrix: {
      post: {
        entryShape: "Plant the angle early.",
        bodyShape: "Column-style argument, not tutorial.",
        closeShape: "End with a sting or reluctant concession.",
        forbiddenShapes: ["newsletter tone", "advice list"],
      },
      comment: {
        entryShape: "Sound like a live thread reply.",
        feedbackShape: "reaction -> suspicion -> concrete note -> grudging respect",
        closeShape: "Keep the close short and thread-native.",
        forbiddenShapes: ["sectioned critique", "support-macro tone"],
      },
    },
    guardrails: {
      hardNo: ["bootlicking authority"],
      deescalationRules: ["switch to camaraderie when loyalty is proven"],
    },
  };
}

describe("derivePromptPersonaDirectives", () => {
  it("builds non-generic voice contract, anti-style rules, and examples from the persona profile", () => {
    const directives = derivePromptPersonaDirectives({
      actionType: "comment",
      profile: sampleProfile(),
      personaCore: {
        identity_summary: {
          one_sentence_identity:
            "An impulsive, loyal-to-a-fault troublemaker who treats every forum like his ship.",
        },
        interaction_defaults: {
          non_generic_traits: [
            "Would rather throw hands in a group chat than compose a carefully worded reply",
          ],
          discussion_strengths: ["Fiercely defending crewmates with absolute ferocity"],
        },
        aesthetic_profile: {
          disliked_patterns: ["credentialism and status climbing"],
        },
        reference_sources: [{ name: "Monkey D. Luffy" }],
      },
    });

    expect(directives.voiceContract.join("\n")).toContain("recognizably this persona");
    expect(directives.voiceContract.join("\n")).toContain("Loyalty to chosen crew");
    expect(directives.voiceContract.join("\n")).toContain("reference roles");
    expect(directives.voiceContract.join("\n")).toContain("Monkey D. Luffy");
    expect(directives.voiceContract.join("\n")).not.toContain("unused legacy stance");
    expect(directives.antiStyleRules.join("\n")).toContain("generic assistant");
    expect(directives.antiStyleRules.join("\n")).toContain("tutorial");
    expect(directives.enactmentRules.join("\n")).toContain("Loyalty to chosen crew");
    expect(directives.enactmentRules.join("\n")).toContain("reference-role lens");
    expect(directives.inCharacterExamples).toHaveLength(2);
    expect(directives.inCharacterExamples[0]?.response).not.toContain("trade-offs");
    expect(directives.inCharacterExamples[0]?.response).toContain("I do not buy it yet");
    expect(directives.inCharacterExamples[0]?.response).toContain("what someone actually did");
    expect(directives.inCharacterExamples[1]?.response).toContain("do not polish the core away");
    expect(directives.inCharacterExamples[1]?.response).toContain("resolved in the gut");
    expect(directives.referenceRoleGuidance).toHaveLength(1);
    expect(directives.referenceRoleGuidance[0]).toContain("Monkey D. Luffy");
  });

  it("builds a planner posting lens from discussion semantics and reference sources without relying on relationship fields", () => {
    const postingLens = buildPlannerPostingLens({
      profile: sampleProfile(),
      personaCore: {
        identity_summary: {
          one_sentence_identity:
            "An impulsive, loyal-to-a-fault troublemaker who treats every forum like his ship.",
        },
        interaction_defaults: {
          default_stance: "supportive_but_blunt",
          discussion_strengths: ["Fiercely defending crewmates with absolute ferocity"],
          non_generic_traits: [
            "Would rather throw hands in a group chat than compose a carefully worded reply",
          ],
        },
        reference_sources: [{ name: "Monkey D. Luffy", type: "anime_manga_character" }],
      },
    });

    expect(postingLens.join("\n")).toContain("supportive_but_blunt");
    expect(postingLens.join("\n")).toContain("Monkey D. Luffy");
    expect(postingLens.join("\n")).not.toContain("unused legacy stance");
  });

  it("builds compact persona evidence with reference-source names for downstream audit and repair packets", () => {
    const evidence = buildPersonaEvidence({
      displayName: "AI Artist",
      profile: sampleProfile(),
      personaCore: {
        identity_summary: {
          one_sentence_identity:
            "An impulsive, loyal-to-a-fault troublemaker who treats every forum like his ship.",
        },
        interaction_defaults: {
          default_stance: "supportive_but_blunt",
          discussion_strengths: ["Fiercely defending crewmates with absolute ferocity"],
        },
        reference_sources: [
          { name: "Monkey D. Luffy", type: "anime_manga_character" },
          { name: "Straw Hat Pirates", type: "fictional_organization" },
        ],
      },
    });

    expect(evidence.displayName).toBe("AI Artist");
    expect(evidence.referenceSourceNames).toEqual(["Monkey D. Luffy", "Straw Hat Pirates"]);
    expect(evidence.doctrine.valueFit.length).toBeGreaterThan(0);
    expect(evidence.doctrine.reasoningFit.length).toBeGreaterThan(0);
    expect(evidence.doctrine.discourseFit.length).toBeGreaterThan(0);
    expect(evidence.doctrine.expressionFit.length).toBeGreaterThan(0);
  });

  it("derives different post-specific directives than comment-specific ones", () => {
    const postDirectives = derivePromptPersonaDirectives({
      actionType: "post",
      profile: sampleProfile(),
      personaCore: {
        identity_summary: {
          one_sentence_identity:
            "An impulsive, loyal-to-a-fault troublemaker who treats every forum like his ship.",
        },
        interaction_defaults: {
          non_generic_traits: [
            "Would rather throw hands in a group chat than compose a carefully worded reply",
          ],
          discussion_strengths: ["Fiercely defending crewmates with absolute ferocity"],
        },
        aesthetic_profile: {
          disliked_patterns: ["credentialism and status climbing"],
        },
        reference_sources: [{ name: "Monkey D. Luffy", type: "anime_manga_character" }],
      },
    });
    const commentDirectives = derivePromptPersonaDirectives({
      actionType: "comment",
      profile: sampleProfile(),
      personaCore: {
        identity_summary: {
          one_sentence_identity:
            "An impulsive, loyal-to-a-fault troublemaker who treats every forum like his ship.",
        },
        interaction_defaults: {
          non_generic_traits: [
            "Would rather throw hands in a group chat than compose a carefully worded reply",
          ],
          discussion_strengths: ["Fiercely defending crewmates with absolute ferocity"],
        },
        aesthetic_profile: {
          disliked_patterns: ["credentialism and status climbing"],
        },
        reference_sources: [{ name: "Monkey D. Luffy", type: "anime_manga_character" }],
      },
    });

    expect(postDirectives.voiceContract.join("\n")).toContain("thesis");
    expect(postDirectives.antiStyleRules.join("\n")).toContain("newsletter");
    expect(postDirectives.enactmentRules.join("\n")).toContain("thesis visible early");
    expect(postDirectives.inCharacterExamples[0]?.scenario).toContain("Writing a new forum post");
    expect(postDirectives.inCharacterExamples[0]?.response).toContain("Plant the angle early");

    expect(commentDirectives.voiceContract.join("\n")).toContain("immediate reaction");
    expect(commentDirectives.antiStyleRules.join("\n")).toContain("generic helpfulness");
    expect(commentDirectives.enactmentRules.join("\n")).toContain(
      "standalone top-level contribution",
    );
    expect(commentDirectives.inCharacterExamples[0]?.scenario).toContain("Someone leans on");
  });

  it("supports reply action type with thread-native anti-style guidance", () => {
    const replyDirectives = derivePromptPersonaDirectives({
      actionType: "reply",
      profile: sampleProfile(),
    });

    expect(replyDirectives.voiceContract.join("\n")).toContain("thread reply");
    expect(replyDirectives.antiStyleRules.join("\n")).toContain("top-level essay");
    expect(replyDirectives.enactmentRules.join("\n")).toContain(
      "specific point in the live thread",
    );
  });

  it("formats persona evidence for compact audit packets", () => {
    const evidence = buildPersonaEvidence({
      displayName: "AI Artist",
      profile: sampleProfile(),
    });

    const formatted = formatPersonaEvidenceForAudit(evidence);
    expect(formatted).toContain("display_name: AI Artist");
    expect(formatted).toContain("value_fit:");
    expect(formatted).toContain("reasoning_fit:");
  });
});

describe("detectPersonaVoiceDrift", () => {
  it("flags workshop-style headings and advice-list formatting as persona drift", () => {
    const issues = detectPersonaVoiceDrift(
      `What works:\n- strong silhouette\n- scale\n- wrongness`,
    );

    expect(issues).toContain("workshop_critique_headings");
    expect(issues).toContain("advice_list_structure");
  });

  it("flags overly clean editorial prose that lacks immediate reaction", () => {
    const issues = detectPersonaVoiceDrift(
      `Okay so I've been thinking about cosmic horror design lately.\n\nWhen designing creatures, think about scale, mystery, and mood. Instead of overcomplicating the concept, build a clean framework for the audience.`,
    );

    expect(issues).toContain("missing_immediate_reaction");
    expect(issues).toContain("too_clean_editorial_tone");
  });

  it("flags Chinese tutorial/editorial drift that lacks immediate reaction", () => {
    const issues = detectPersonaVoiceDrift(
      `這裡想聊一下克蘇魯風格的怪物設計。\n\n在設計這類生物時，可以先從比例、氣氛與神秘感開始思考。建議先建立一個清楚的框架，再逐步補上細節。總結來說，關鍵在於平衡造型與世界觀。`,
    );

    expect(issues).toContain("generic_explainer_tone");
    expect(issues).toContain("missing_immediate_reaction");
    expect(issues).toContain("too_clean_editorial_tone");
  });
});

describe("buildPersonaVoiceRepairPrompt", () => {
  it("includes reference-role guidance so repair rewrites use reference roles as behavioral source material", () => {
    const directives = derivePromptPersonaDirectives({
      actionType: "comment",
      profile: sampleProfile(),
      personaCore: {
        identity_summary: {
          one_sentence_identity:
            "An impulsive, loyal-to-a-fault troublemaker who treats every forum like his ship.",
        },
        interaction_defaults: {
          non_generic_traits: [
            "Would rather throw hands in a group chat than compose a carefully worded reply",
          ],
          discussion_strengths: ["Fiercely defending crewmates with absolute ferocity"],
        },
        aesthetic_profile: {
          disliked_patterns: ["credentialism and status climbing"],
        },
        reference_sources: [
          { name: "Monkey D. Luffy", type: "anime_manga_character" },
          { name: "Straw Hat Pirates", type: "fictional_organization" },
        ],
      },
    });

    const prompt = buildPersonaVoiceRepairPrompt({
      assembledPrompt: "[system_baseline]\nexample",
      rawOutput: '{"markdown":"What works:\\n- silhouette\\n- scale\\n- detail"}',
      actionType: "comment",
      directives,
      issues: ["workshop_critique_headings", "advice_list_structure"],
      repairGuidance: ["Lead with an immediate reaction instead of a workshop outline."],
      severity: "high",
      missingSignals: ["immediate reaction"],
    });

    expect(prompt).toContain("Reason through the persona's reference roles before rewriting");
    expect(prompt).toContain("[reference_role_guidance]");
    expect(prompt).toContain("Monkey D. Luffy");
    expect(prompt).toContain("Straw Hat Pirates");
    expect(prompt).toContain("[missing_signals]");
    expect(prompt).toContain("immediate reaction");
  });

  it("injects audit-provided repair guidance into the rewrite prompt", () => {
    const directives = derivePromptPersonaDirectives({
      actionType: "post",
      profile: sampleProfile(),
      personaCore: {
        identity_summary: {
          one_sentence_identity:
            "An impulsive, loyal-to-a-fault troublemaker who treats every forum like his ship.",
        },
        interaction_defaults: {
          non_generic_traits: [
            "Would rather throw hands in a group chat than compose a carefully worded reply",
          ],
        },
        reference_sources: [{ name: "Monkey D. Luffy", type: "anime_manga_character" }],
      },
    });

    const prompt = buildPersonaVoiceRepairPrompt({
      assembledPrompt: "[system_baseline]\nexample",
      rawOutput:
        '{"markdown":"Okay so I have been thinking about creature design. When designing creatures, think about mystery and scale."}',
      actionType: "post",
      directives,
      issues: ["persona priorities not visible", "too editorial"],
      repairGuidance: [
        "Let the opening hit with immediate gut reaction instead of a tidy setup.",
        "Make the persona's priorities visible in what the response attacks or defends.",
        "Do not write like a clean creator newsletter, calm forum explainer, or tasteful editorial post.",
      ],
      severity: "medium",
      missingSignals: ["persona priorities"],
    });

    expect(prompt).toContain("[repair_guidance]");
    expect(prompt).toContain("Let the opening hit with immediate gut reaction");
    expect(prompt).toContain("Make the persona's priorities visible");
    expect(prompt).toContain("Do not write like a clean creator newsletter");
  });
});
