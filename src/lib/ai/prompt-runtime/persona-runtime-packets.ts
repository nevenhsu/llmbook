import { parsePersonaCoreV2, FALLBACK_PERSONA_CORE_V2 } from "@/lib/ai/core/persona-core-v2";
import type {
  PersonaCoreV2,
  ContentMode,
  PersonaFlowStage,
  PersonaInteractionFlow,
  PersonaInteractionStage,
  PersonaPacketBudget,
  PersonaRuntimePacket,
  PersonaRuntimePacketSections,
  PersonaAuditEvidencePacket,
  PersonaAuditTarget,
} from "@/lib/ai/core/persona-core-v2";

type BudgetProfile = {
  minWords: number;
  maxWords: number;
  hardMaxWords: number;
};

const STAGE_BUDGETS: Record<PersonaInteractionStage, BudgetProfile> = {
  post_plan: { minWords: 80, maxWords: 400, hardMaxWords: 500 },
  post_frame: { minWords: 70, maxWords: 400, hardMaxWords: 500 },
  post_body: { minWords: 70, maxWords: 400, hardMaxWords: 500 },
  comment_body: { minWords: 50, maxWords: 400, hardMaxWords: 500 },
  reply_body: { minWords: 50, maxWords: 400, hardMaxWords: 500 },
};

type SectionKey = keyof PersonaRuntimePacketSections;
type RenderableSectionKey = Exclude<SectionKey, "thinkingProcedure">;
type RenderablePacketSections = Omit<PersonaRuntimePacketSections, "thinkingProcedure">;

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function truncateWords(text: string, maxWords: number): string {
  const words = text.trim().split(/\s+/);
  if (words.length <= maxWords) {
    return text;
  }
  return `${words.slice(0, maxWords).join(" ")} [truncated]`;
}

function buildProcedureLine(core: PersonaCoreV2, contentMode: ContentMode): string {
  const tp = core.mind.thinking_procedure;

  const parts: string[] = [
    ["context_reading:", tp.context_reading.join(", ")].join(" "),
    ["salience_rules:", tp.salience_rules.join(", ")].join(" "),
    ["response_moves:", tp.response_moves.join(", ")].join(" "),
    ["interpretation_moves:", tp.interpretation_moves.join(", ")].join(" "),
    ["omission_rules:", tp.omission_rules.join(", ")].join(" "),
  ];

  if (contentMode === "story") {
    parts.push(`story_mode: use ${core.narrative.story_engine};`);
  }

  const joined = parts.join(";\n");

  return `Internal procedure:\n${joined}`;
}

function buildSectionText(key: RenderableSectionKey, text: string): string {
  const labels: Record<RenderableSectionKey, string> = {
    identity: "Identity",
    mind: "Mind",
    taste: "Taste",
    voice: "Voice",
    forum: "Forum",
    narrative: "Narrative",
    referenceStyle: "Reference style",
    antiGeneric: "Avoid",
  };

  return `${labels[key]}:\n${text}`;
}

function buildReferenceStyleText(core: PersonaCoreV2): string {
  const parts: string[] = [];

  if (core.reference_style.reference_names.length > 0) {
    parts.push(`Reference names: ${core.reference_style.reference_names.join(", ")}`);
    parts.push(`- For persona-construction reference material, not roleplay targets.`);
  }

  if (core.reference_style.abstract_traits.length > 0) {
    parts.push(`Abstract traits: ${core.reference_style.abstract_traits.join(", ")}`);
    parts.push(
      `- For reasoning habits, taste, atmosphere, metaphor domains, and interaction patterns.`,
    );
  }

  return parts.join(";\n");
}

function selectSections(
  _flow: PersonaInteractionFlow,
  stage: PersonaInteractionStage,
  contentMode: ContentMode,
  core: PersonaCoreV2,
): RenderablePacketSections {
  const sections: RenderablePacketSections = {};

  if (contentMode === "discussion") {
    switch (stage) {
      case "post_plan":
        sections.identity = [
          buildSectionText("identity", core.identity.archetype),
          `Core drive: ${core.identity.core_drive}`,
          `Tension: ${core.identity.central_tension}`,
        ];
        sections.mind = [
          buildSectionText(
            "mind",
            `${core.mind.reasoning_style}; ${core.mind.attention_biases.join(", ")}`,
          ),
        ];
        sections.taste = [
          buildSectionText(
            "taste",
            `Values: ${core.taste.values.join(", ")}; Dismisses: ${core.taste.dismisses.join(", ")}`,
          ),
        ];
        sections.forum = [
          buildSectionText(
            "forum",
            `${core.forum.participation_mode}; Post intents: ${core.forum.preferred_post_intents.join(", ")}`,
          ),
        ];
        sections.antiGeneric = [
          buildSectionText("antiGeneric", core.anti_generic.avoid_patterns.join(", ")),
        ];
        sections.voice = [
          buildSectionText(
            "voice",
            `${core.voice.register}, ${core.voice.rhythm}; opens: ${core.voice.opening_habits[0]}; closes: ${core.voice.closing_habits[0]}`,
          ),
        ];
        sections.referenceStyle = [
          buildSectionText("referenceStyle", buildReferenceStyleText(core)),
        ];
        break;

      case "post_frame":
        sections.identity = [
          buildSectionText("identity", `${core.identity.archetype}; ${core.identity.core_drive}`),
          `Tension: ${core.identity.central_tension}`,
        ];
        sections.mind = [
          buildSectionText(
            "mind",
            `${core.mind.reasoning_style}; ${core.mind.attention_biases.join(", ")}`,
          ),
        ];
        sections.taste = [
          buildSectionText(
            "taste",
            `Values: ${core.taste.values.join(", ")}; Dismisses: ${core.taste.dismisses.join(", ")}`,
          ),
        ];
        sections.voice = [
          buildSectionText(
            "voice",
            `${core.voice.register}, ${core.voice.rhythm}; opens: ${core.voice.opening_habits[0]}; closes: ${core.voice.closing_habits[0]}`,
          ),
        ];
        sections.forum = [
          buildSectionText(
            "forum",
            `${core.forum.participation_mode}; Post intents: ${core.forum.preferred_post_intents.join(", ")}`,
          ),
        ];
        sections.antiGeneric = [
          buildSectionText("antiGeneric", core.anti_generic.avoid_patterns.join(", ")),
        ];
        sections.referenceStyle = [
          buildSectionText("referenceStyle", buildReferenceStyleText(core)),
        ];
        break;

      case "post_body":
        sections.identity = [
          buildSectionText("identity", `${core.identity.archetype}; ${core.identity.core_drive}`),
        ];
        sections.voice = [
          buildSectionText("voice", `${core.voice.register}, ${core.voice.rhythm}`),
          `Opens: ${core.voice.opening_habits.join(", ")}`,
          `Closes: ${core.voice.closing_habits.join(", ")}`,
          `Metaphors: ${core.voice.metaphor_domains.join(", ")}`,
        ];
        sections.forum = [
          buildSectionText("forum", `Post length: ${core.forum.typical_lengths.post}`),
        ];
        sections.taste = [buildSectionText("taste", `Values: ${core.taste.values.join(", ")}`)];
        sections.antiGeneric = [
          buildSectionText("antiGeneric", core.anti_generic.avoid_patterns.join(", ")),
        ];
        sections.referenceStyle = [
          buildSectionText("referenceStyle", buildReferenceStyleText(core)),
        ];
        break;

      case "comment_body":
        sections.identity = [
          buildSectionText("identity", `${core.identity.archetype}; ${core.identity.core_drive}`),
        ];
        sections.mind = [
          buildSectionText(
            "mind",
            `${core.mind.reasoning_style}; notices ${core.mind.attention_biases.join(", ")}`,
          ),
        ];
        sections.forum = [
          buildSectionText(
            "forum",
            `Comment intents: ${core.forum.preferred_comment_intents.join(", ")}`,
          ),
        ];
        sections.voice = [
          buildSectionText(
            "voice",
            `${core.voice.register}, ${core.voice.rhythm}; opens: ${core.voice.opening_habits[0]}`,
          ),
        ];
        sections.antiGeneric = [
          buildSectionText("antiGeneric", core.anti_generic.avoid_patterns.join(", ")),
        ];
        sections.taste = [
          buildSectionText(
            "taste",
            `Values: ${core.taste.values.join(", ")}; Dismisses: ${core.taste.dismisses.join(", ")}`,
          ),
        ];
        break;

      case "reply_body":
        sections.identity = [buildSectionText("identity", core.identity.archetype)];
        sections.mind = [buildSectionText("mind", `Disagreement: ${core.mind.disagreement_style}`)];
        sections.forum = [
          buildSectionText(
            "forum",
            `Reply intents: ${core.forum.preferred_reply_intents.join(", ")}`,
          ),
        ];
        sections.voice = [
          buildSectionText(
            "voice",
            `${core.voice.register}, ${core.voice.rhythm}; opens: ${core.voice.opening_habits[0]}; closes: ${core.voice.closing_habits[0]}`,
          ),
        ];
        sections.antiGeneric = [
          buildSectionText("antiGeneric", core.anti_generic.avoid_patterns.join(", ")),
        ];
        sections.referenceStyle = [
          buildSectionText("referenceStyle", buildReferenceStyleText(core)),
        ];
        break;
    }
  } else {
    // story mode
    switch (stage) {
      case "post_plan":
        sections.identity = [
          buildSectionText(
            "identity",
            `${core.identity.archetype}; tension: ${core.identity.central_tension}`,
          ),
        ];
        sections.narrative = [
          buildSectionText("narrative", `Engine: ${core.narrative.story_engine}`),
          `Conflicts: ${core.narrative.favored_conflicts.join(", ")}`,
          `Plot: ${core.narrative.plot_instincts.join(", ")}`,
          `Endings: ${core.narrative.ending_preferences.join(", ")}`,
        ];
        sections.antiGeneric = [
          buildSectionText(
            "antiGeneric",
            `Avoid story: ${core.narrative.avoid_story_shapes.join(", ")}`,
          ),
        ];
        sections.voice = [
          buildSectionText("voice", `${core.voice.register}, ${core.voice.rhythm}`),
        ];
        sections.referenceStyle = [
          buildSectionText("referenceStyle", buildReferenceStyleText(core)),
        ];
        break;

      case "post_frame":
        sections.identity = [
          buildSectionText(
            "identity",
            `${core.identity.archetype}; tension: ${core.identity.central_tension}`,
          ),
        ];
        sections.mind = [
          buildSectionText(
            "mind",
            `${core.mind.reasoning_style}; ${core.mind.attention_biases.join(", ")}`,
          ),
        ];
        sections.voice = [
          buildSectionText("voice", `${core.voice.register}, ${core.voice.rhythm}`),
          `Opens: ${core.voice.opening_habits[0]}`,
        ];
        sections.narrative = [
          buildSectionText("narrative", `Engine: ${core.narrative.story_engine}`),
          `Conflicts: ${core.narrative.favored_conflicts.join(", ")}`,
          `Plot: ${core.narrative.plot_instincts.join(", ")}`,
          `Endings: ${core.narrative.ending_preferences.join(", ")}`,
          `Scene details: ${core.narrative.scene_detail_biases.join(", ")}`,
        ];
        sections.antiGeneric = [
          buildSectionText(
            "antiGeneric",
            `Avoid story: ${core.narrative.avoid_story_shapes.join(", ")}`,
          ),
        ];
        sections.referenceStyle = [
          buildSectionText("referenceStyle", buildReferenceStyleText(core)),
        ];
        break;

      case "post_body":
        sections.voice = [
          buildSectionText("voice", `${core.voice.register}, ${core.voice.rhythm}`),
          `Opens: ${core.voice.opening_habits.join(", ")}`,
          `Metaphors: ${core.voice.metaphor_domains.join(", ")}`,
        ];
        sections.narrative = [
          buildSectionText("narrative", `Engine: ${core.narrative.story_engine}`),
          `Characters: ${core.narrative.character_focus.join(", ")}`,
          `Emotions: ${core.narrative.emotional_palette.join(", ")}`,
          `Scene details: ${core.narrative.scene_detail_biases.join(", ")}`,
          `Plot: ${core.narrative.plot_instincts.join(", ")}`,
          `Endings: ${core.narrative.ending_preferences.join(", ")}`,
        ];
        sections.antiGeneric = [
          buildSectionText(
            "antiGeneric",
            `Avoid story: ${core.narrative.avoid_story_shapes.join(", ")}`,
          ),
        ];
        sections.forum = [
          buildSectionText("forum", `Post length: ${core.forum.typical_lengths.post}`),
        ];
        sections.referenceStyle = [
          buildSectionText("referenceStyle", buildReferenceStyleText(core)),
        ];
        break;

      case "comment_body":
        sections.voice = [
          buildSectionText("voice", `${core.voice.register}, ${core.voice.rhythm}`),
        ];
        sections.narrative = [
          buildSectionText("narrative", `Engine: ${core.narrative.story_engine}`),
          `Conflict: ${core.narrative.favored_conflicts[0] ?? "none"}`,
          `Character: ${core.narrative.character_focus[0] ?? "none"}`,
          `Scene: ${core.narrative.scene_detail_biases.slice(0, 2).join(", ")}`,
        ];
        sections.antiGeneric = [
          buildSectionText(
            "antiGeneric",
            `Avoid story: ${core.narrative.avoid_story_shapes.join(", ")}`,
          ),
        ];
        sections.referenceStyle = [
          buildSectionText("referenceStyle", buildReferenceStyleText(core)),
        ];
        break;

      case "reply_body":
        sections.voice = [
          buildSectionText("voice", `${core.voice.register}, ${core.voice.rhythm}`),
        ];
        sections.narrative = [
          buildSectionText("narrative", `Plot: ${core.narrative.plot_instincts.join(", ")}`),
          `Emotions: ${core.narrative.emotional_palette.join(", ")}`,
          `Scene: ${core.narrative.scene_detail_biases.slice(0, 2).join(", ")}`,
          `Endings: ${core.narrative.ending_preferences.join(", ")}`,
        ];
        sections.antiGeneric = [
          buildSectionText(
            "antiGeneric",
            `Avoid story: ${core.narrative.avoid_story_shapes.join(", ")}`,
          ),
        ];
        sections.forum = [
          buildSectionText(
            "forum",
            `Reply intent: ${core.forum.preferred_reply_intents.join(", ")}`,
          ),
        ];
        sections.referenceStyle = [
          buildSectionText("referenceStyle", buildReferenceStyleText(core)),
        ];
        break;
    }
  }

  return sections;
}

function renderPacketSections(sections: RenderablePacketSections): string {
  const lines: string[] = [];

  for (const key of Object.keys(sections) as RenderableSectionKey[]) {
    const sectionLines = sections[key];
    if (sectionLines && sectionLines.length > 0) {
      lines.push(...sectionLines);
    }
  }

  return lines.join("\n");
}

export function normalizePersonaCoreV2(input: unknown): {
  core: PersonaCoreV2;
  source: "v2" | "fallback";
  warnings: string[];
} {
  const result = parsePersonaCoreV2(input);

  if (result.warnings.some((w) => w.includes("fallback"))) {
    return {
      core: result.core,
      source: "fallback",
      warnings: result.warnings,
    };
  }

  return {
    core: result.core,
    source: "v2",
    warnings: result.warnings,
  };
}

function enforceBudget(
  sections: RenderablePacketSections,
  procedureLine: string,
  budget: BudgetProfile,
): {
  sections: RenderablePacketSections;
  procedureLine: string;
  omittedSections: string[];
  warnings: string[];
} {
  const omittedSections: string[] = [];
  const warnings: string[] = [];
  let finalProcedureLine = procedureLine;

  let rendered = renderPacketSections(sections);
  let fullText = [rendered, procedureLine].filter(Boolean).join("\n\n");
  let wordCount = countWords(fullText);

  if (wordCount <= budget.maxWords) {
    return { sections, procedureLine: finalProcedureLine, omittedSections, warnings };
  }

  // Budget still below hard max? Add procedure line inline at the end
  fullText = [rendered, procedureLine].join("\n\n");
  wordCount = countWords(fullText);

  if (wordCount > budget.hardMaxWords) {
    // Need to truncate: remove optional sections by priority
    const removalOrder: RenderableSectionKey[] = [
      "referenceStyle",
      "taste",
      "forum",
      "mind",
      "voice",
      "narrative",
      "antiGeneric",
      "identity",
    ];

    for (const key of removalOrder) {
      if (!sections[key] || sections[key]!.length === 0) {
        continue;
      }

      // Try removing one line at a time
      const lines = sections[key]!;
      while (lines.length > 0) {
        lines.pop();
        rendered = renderPacketSections(sections);
        fullText = [rendered, procedureLine].join("\n\n");
        wordCount = countWords(fullText);

        if (wordCount <= budget.hardMaxWords) {
          break;
        }
      }

      if (wordCount <= budget.hardMaxWords) {
        break;
      }
    }
  }

  // If still over hard max, truncate the procedure line
  if (wordCount > budget.hardMaxWords) {
    const nonProcWords = countWords(rendered);
    const procBudget = Math.max(10, budget.hardMaxWords - nonProcWords);
    finalProcedureLine = truncateWords(procedureLine, procBudget);
    fullText = [rendered, finalProcedureLine].join("\n\n");
    wordCount = countWords(fullText);

    if (wordCount > budget.hardMaxWords) {
      fullText = truncateWords(fullText, budget.hardMaxWords);
      warnings.push(`packet truncated to hard max ${budget.hardMaxWords} words`);
    }
  }

  return { sections, procedureLine: finalProcedureLine, omittedSections, warnings };
}

export function buildPersonaRuntimePacket(input: {
  flow: PersonaInteractionFlow;
  stage: PersonaInteractionStage;
  contentMode: ContentMode;
  personaId: string;
  displayName?: string | null;
  core: PersonaCoreV2;
  options?: {
    includeExamples?: false;
    strictBudget?: boolean;
  };
}): PersonaRuntimePacket {
  const budget = STAGE_BUDGETS[input.stage];
  const warnings: string[] = [];

  if (input.options?.includeExamples) {
    warnings.push("examples disabled by default");
  }

  const sections = selectSections(input.flow, input.stage, input.contentMode, input.core);
  const procedureLine = buildProcedureLine(input.core, input.contentMode);

  const {
    sections: finalSections,
    procedureLine: finalProcedureLine,
    omittedSections,
    warnings: budgetWarnings,
  } = enforceBudget(sections, procedureLine, budget);

  const sectionText = renderPacketSections(finalSections);
  const renderedText = [sectionText, finalProcedureLine].filter(Boolean).join("\n\n");

  return {
    flow: input.flow,
    stage: input.stage,
    contentMode: input.contentMode,
    personaId: input.personaId,
    displayName: input.displayName ?? null,
    schemaVersion: "v2",
    budget: { ...budget },
    sections: {
      ...finalSections,
      thinkingProcedure: finalProcedureLine.length > 0 ? [finalProcedureLine] : undefined,
    },
    renderedText,
    wordCount: countWords(renderedText),
    omittedSections,
    warnings: [...warnings, ...budgetWarnings],
  };
}

export function buildPostPlanPersonaPacket(input: {
  contentMode: ContentMode;
  personaId: string;
  displayName?: string | null;
  core: PersonaCoreV2;
}): PersonaRuntimePacket {
  return buildPersonaRuntimePacket({
    flow: "post",
    stage: "post_plan",
    contentMode: input.contentMode,
    personaId: input.personaId,
    displayName: input.displayName,
    core: input.core,
  });
}

export function buildPostBodyPersonaPacket(input: {
  contentMode: ContentMode;
  personaId: string;
  displayName?: string | null;
  core: PersonaCoreV2;
}): PersonaRuntimePacket {
  return buildPersonaRuntimePacket({
    flow: "post",
    stage: "post_body",
    contentMode: input.contentMode,
    personaId: input.personaId,
    displayName: input.displayName,
    core: input.core,
  });
}

export function buildCommentPersonaPacket(input: {
  contentMode: ContentMode;
  personaId: string;
  displayName?: string | null;
  core: PersonaCoreV2;
}): PersonaRuntimePacket {
  return buildPersonaRuntimePacket({
    flow: "comment",
    stage: "comment_body",
    contentMode: input.contentMode,
    personaId: input.personaId,
    displayName: input.displayName,
    core: input.core,
  });
}

export function buildReplyPersonaPacket(input: {
  contentMode: ContentMode;
  personaId: string;
  displayName?: string | null;
  core: PersonaCoreV2;
}): PersonaRuntimePacket {
  return buildPersonaRuntimePacket({
    flow: "reply",
    stage: "reply_body",
    contentMode: input.contentMode,
    personaId: input.personaId,
    displayName: input.displayName,
    core: input.core,
  });
}

const DUMMY_SECTIONS: PersonaRuntimePacketSections = {
  identity: [],
  mind: [],
  thinkingProcedure: [],
  taste: [],
  voice: [],
  forum: [],
  narrative: [],
  referenceStyle: [],
  antiGeneric: [],
};

export function buildPersonaPacketForPrompt(input: {
  flow: PersonaInteractionFlow;
  stage: PersonaInteractionStage;
  stagePurpose: string;
  contentMode: ContentMode;
  personaId: string;
  displayName?: string | null;
  core: PersonaCoreV2;
}): PersonaRuntimePacket | null {
  if (
    (input.flow === "post" &&
      (input.stage === "post_plan" ||
        input.stage === "post_frame" ||
        input.stage === "post_body")) ||
    (input.flow === "comment" && input.stage === "comment_body") ||
    (input.flow === "reply" && input.stage === "reply_body")
  ) {
    return buildPersonaRuntimePacket({
      flow: input.flow,
      stage: input.stage,
      contentMode: input.contentMode,
      personaId: input.personaId,
      displayName: input.displayName,
      core: input.core,
    });
  }

  return null;
}
