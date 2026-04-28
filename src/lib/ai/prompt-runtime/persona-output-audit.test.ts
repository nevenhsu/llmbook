import { describe, expect, it } from "vitest";
import {
  PersonaOutputValidationError,
  buildPersonaOutputAuditPrompt,
  parsePersonaAuditResult,
} from "@/lib/ai/prompt-runtime/persona-output-audit";
import { derivePromptPersonaDirectives } from "@/lib/ai/prompt-runtime/persona-prompt-directives";
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

function sampleDirectives() {
  return derivePromptPersonaDirectives({
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
}

describe("buildPersonaOutputAuditPrompt", () => {
  it("builds an English audit prompt that reviews target-language output with compact persona context", () => {
    const prompt = buildPersonaOutputAuditPrompt({
      actionType: "post",
      taskContext: "Write a post about cosmic horror creature design.",
      renderedOutput:
        "# Cthulhu Creature Design\n\n#cthulhu\n\n這裡想聊一下克蘇魯怪物設計。建議先建立一個清楚的框架。",
      directives: sampleDirectives(),
      observedIssues: ["generic_explainer_tone", "too_clean_editorial_tone"],
    });

    expect(prompt).toContain("[persona_output_audit]");
    expect(prompt).toContain("Evaluate the generated output in whatever language it uses.");
    expect(prompt).toContain("Return exactly one JSON object.");
    expect(prompt).toContain("passes: boolean");
    expect(prompt).toContain("repairGuidance: string[]");
    expect(prompt).toContain('severity: "low" | "medium" | "high"');
    expect(prompt).toContain("confidence: number");
    expect(prompt).toContain("missingSignals: string[]");
    expect(prompt).toContain("[observed_drift_signals]");
    expect(prompt).toContain("generic_explainer_tone");
    expect(prompt).toContain("Monkey D. Luffy");
    expect(prompt).toContain("Straw Hat Pirates");
    expect(prompt).toContain("[audit_mode]");
    expect(prompt).toContain("default");
  });

  it("supports a compact audit mode for retrying empty audit output", () => {
    const prompt = buildPersonaOutputAuditPrompt({
      actionType: "post",
      taskContext: "Write a post about cosmic horror creature design.".repeat(100),
      renderedOutput: "A".repeat(3000),
      directives: sampleDirectives(),
      observedIssues: ["generic_explainer_tone"],
      mode: "compact",
    });

    expect(prompt).toContain("[audit_mode]");
    expect(prompt).toContain("compact");
    expect(prompt).toContain("[truncated]");
  });
});

describe("parsePersonaAuditResult", () => {
  it("parses a valid structured audit result", () => {
    expect(
      parsePersonaAuditResult(
        JSON.stringify({
          passes: false,
          issues: ["missing immediate reaction"],
          repairGuidance: ["Open with a gut reaction."],
          severity: "high",
          confidence: 0.92,
          missingSignals: ["immediate reaction", "reference-role framing"],
        }),
      ),
    ).toEqual({
      passes: false,
      issues: ["missing immediate reaction"],
      repairGuidance: ["Open with a gut reaction."],
      severity: "high",
      confidence: 0.92,
      missingSignals: ["immediate reaction", "reference-role framing"],
    });
  });

  it("throws a typed validation error when the audit result is malformed", () => {
    expect(() =>
      parsePersonaAuditResult(
        JSON.stringify({
          passes: "nope",
          issues: "missing immediate reaction",
          repairGuidance: [],
          severity: "high",
          confidence: 0.5,
          missingSignals: [],
        }),
      ),
    ).toThrow(PersonaOutputValidationError);
  });
});
