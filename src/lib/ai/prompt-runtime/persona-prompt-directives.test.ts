import { describe, expect, it } from "vitest";
import {
  buildPersonaVoiceRepairPrompt,
  derivePromptPersonaDirectives,
  detectPersonaVoiceDrift,
} from "@/lib/ai/prompt-runtime/persona-prompt-directives";
import type { RuntimeSoulProfile } from "@/lib/ai/soul/runtime-soul-profile";

function sampleProfile(): RuntimeSoulProfile {
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
    relationshipTendencies: {
      defaultStance: "impulsive and loyalty-first",
      trustSignals: ["shows up for the crew"],
      frictionTriggers: ["formal debate styled as posturing"],
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
    guardrails: {
      hardNo: ["bootlicking authority"],
      deescalationRules: ["switch to camaraderie when loyalty is proven"],
    },
  };
}

describe("derivePromptPersonaDirectives", () => {
  it("builds non-generic voice contract, anti-style rules, and examples from the persona profile", () => {
    const directives = derivePromptPersonaDirectives({
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
    expect(directives.antiStyleRules.join("\n")).toContain("generic assistant");
    expect(directives.antiStyleRules.join("\n")).toContain("tutorial");
    expect(directives.enactmentRules.join("\n")).toContain("Loyalty to chosen crew");
    expect(directives.enactmentRules.join("\n")).toContain("reference-role lens");
    expect(directives.inCharacterExamples).toHaveLength(2);
    expect(directives.inCharacterExamples[0]?.response).not.toContain("trade-offs");
    expect(directives.inCharacterExamples[0]?.response).toContain("Nah");
    expect(directives.inCharacterExamples[0]?.response).toContain("admiral");
    expect(directives.inCharacterExamples[0]?.response).toContain("crew");
    expect(directives.inCharacterExamples[1]?.response).toContain("polish the life out of it");
    expect(directives.inCharacterExamples[1]?.response).toContain("wrong in your gut");
    expect(directives.referenceRoleGuidance).toHaveLength(1);
    expect(directives.referenceRoleGuidance[0]).toContain("Monkey D. Luffy");
    expect(directives.framingSignals).toContain("crew");
    expect(directives.framingSignals).toContain("authority");
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

  it("flags overly clean editorial prose that lacks reaction and loyalty/conflict framing", () => {
    const directives = derivePromptPersonaDirectives({
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
    const issues = detectPersonaVoiceDrift(
      `Okay so I've been thinking about cosmic horror design lately.\n\nWhen designing creatures, think about scale, mystery, and mood. Instead of overcomplicating the concept, build a clean framework for the audience.`,
      { framingSignals: directives.framingSignals },
    );

    expect(issues).toContain("missing_immediate_reaction");
    expect(issues).toContain("missing_persona_conflict_frame");
    expect(issues).toContain("too_clean_editorial_tone");
  });

  it("flags Chinese tutorial/editorial drift that lacks reaction and loyalty/conflict framing", () => {
    const directives = derivePromptPersonaDirectives({
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
    const issues = detectPersonaVoiceDrift(
      `這裡想聊一下克蘇魯風格的怪物設計。\n\n在設計這類生物時，可以先從比例、氣氛與神秘感開始思考。建議先建立一個清楚的框架，再逐步補上細節。總結來說，關鍵在於平衡造型與世界觀。`,
      { framingSignals: directives.framingSignals },
    );

    expect(issues).toContain("generic_explainer_tone");
    expect(issues).toContain("missing_immediate_reaction");
    expect(issues).toContain("missing_persona_conflict_frame");
    expect(issues).toContain("too_clean_editorial_tone");
  });
});

describe("buildPersonaVoiceRepairPrompt", () => {
  it("includes reference-role guidance so repair rewrites use reference roles as behavioral source material", () => {
    const directives = derivePromptPersonaDirectives({
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
    });

    expect(prompt).toContain("Reason through the persona's reference roles before rewriting");
    expect(prompt).toContain("[reference_role_guidance]");
    expect(prompt).toContain("Monkey D. Luffy");
    expect(prompt).toContain("Straw Hat Pirates");
  });

  it("adds persona-specific rewrite instructions when drift issues show missing reaction and conflict framing", () => {
    const directives = derivePromptPersonaDirectives({
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
      issues: [
        "missing_immediate_reaction",
        "missing_persona_conflict_frame",
        "too_clean_editorial_tone",
      ],
    });

    expect(prompt).toContain("Let the opening hit with immediate gut reaction");
    expect(prompt).toContain("Make loyalty, pressure, protection, betrayal, or authority visible");
    expect(prompt).toContain("Do not write like a clean creator newsletter");
  });
});
