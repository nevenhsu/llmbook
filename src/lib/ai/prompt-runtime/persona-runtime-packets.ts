import { parsePersonaCoreV2, FALLBACK_PERSONA_CORE_V2 } from "@/lib/ai/core/persona-core-v2";
import type {
  PersonaCoreV2,
  ContentMode,
  PersonaFlowKind,
  PersonaPacketBudget,
  PersonaRuntimePacket,
  PersonaRuntimePacketSections,
  PersonaAuditEvidencePacket,
  PersonaAuditTarget,
} from "@/lib/ai/core/persona-core-v2";
import type { PromptActionType } from "@/lib/ai/prompt-runtime/prompt-builder";

type BudgetProfile = {
  minWords: number;
  maxWords: number;
  hardMaxWords: number;
};

const BUDGETS: Record<PersonaFlowKind, BudgetProfile> = {
  post_plan: { minWords: 80, maxWords: 160, hardMaxWords: 240 },
  post_body: { minWords: 70, maxWords: 140, hardMaxWords: 200 },
  comment: { minWords: 50, maxWords: 120, hardMaxWords: 180 },
  reply: { minWords: 50, maxWords: 120, hardMaxWords: 180 },
  audit: { minWords: 50, maxWords: 140, hardMaxWords: 220 },
};

type SectionKey = keyof PersonaRuntimePacketSections;

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

function joinLines(lines: string[]): string {
  return lines.filter((l) => l.length > 0).join("\n");
}

function buildProcedureLine(
  core: PersonaCoreV2,
  flow: PersonaFlowKind,
  contentMode: ContentMode,
): string {
  const tp = core.mind.thinking_procedure;

  let parts: string[] = [];

  switch (flow) {
    case "post_plan":
      parts = [
        ...tp.context_reading.slice(0, 1),
        ...tp.salience_rules.slice(0, 1),
        ...tp.response_moves.slice(0, 1),
      ];
      break;
    case "post_body":
      parts = [
        ...tp.interpretation_moves.slice(0, 1),
        ...tp.response_moves.slice(0, 1),
        ...tp.omission_rules.slice(0, 1),
      ];
      break;
    case "comment":
      parts = [
        ...tp.context_reading.slice(0, 1),
        ...tp.salience_rules.slice(0, 1),
        ...tp.response_moves.slice(0, 1),
      ];
      break;
    case "reply":
      parts = [
        ...tp.context_reading.slice(0, 1),
        ...tp.response_moves.slice(0, 1),
        ...tp.omission_rules.slice(0, 1),
      ];
      break;
    case "audit":
      parts = [
        ...tp.context_reading.slice(0, 1),
        ...tp.salience_rules.slice(0, 1),
        "verify internal procedure matches output",
      ];
      break;
  }

  if (contentMode === "story") {
    parts = [...parts, `story mode: use ${core.narrative.story_engine.slice(0, 40)}`];
  }

  const joined = parts.join("; ");

  if (countWords(joined) > 55) {
    const truncated = truncateWords(joined, 55);
    return `Procedure: internally ${truncated}`;
  }

  return `Procedure: internally ${joined}`;
}

function buildSectionText(key: SectionKey, text: string): string {
  const labels: Record<SectionKey, string> = {
    identity: "Identity",
    mind: "Mind",
    thinkingProcedure: "Procedure",
    taste: "Taste",
    voice: "Voice",
    forum: "Forum",
    narrative: "Narrative",
    referenceStyle: "Reference style",
    antiGeneric: "Avoid",
  };

  return `${labels[key]}: ${text}`;
}

function selectSections(
  flow: PersonaFlowKind,
  contentMode: ContentMode,
  core: PersonaCoreV2,
): PersonaRuntimePacketSections {
  const sections: PersonaRuntimePacketSections = {};

  if (contentMode === "discussion") {
    switch (flow) {
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
        sections.referenceStyle = [
          buildSectionText(
            "referenceStyle",
            `${core.reference_style.abstract_traits.join(", ")}; do not imitate names or canon.`,
          ),
        ];
        sections.voice = [
          buildSectionText(
            "voice",
            `${core.voice.register}, ${core.voice.rhythm}; opens: ${core.voice.opening_habits[0]}; closes: ${core.voice.closing_habits[0]}`,
          ),
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
          buildSectionText(
            "referenceStyle",
            `${core.reference_style.abstract_traits.join(", ")}; do not imitate.`,
          ),
        ];
        break;

      case "comment":
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

      case "reply":
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
          buildSectionText(
            "referenceStyle",
            `${core.reference_style.abstract_traits.join(", ")}; do not imitate.`,
          ),
        ];
        break;

      case "audit":
        sections.identity = [
          buildSectionText("identity", `${core.identity.archetype}; ${core.identity.core_drive}`),
        ];
        sections.mind = [
          buildSectionText(
            "mind",
            `${core.mind.reasoning_style}; values: ${core.taste.values.join(", ")}`,
          ),
        ];
        sections.antiGeneric = [
          buildSectionText(
            "antiGeneric",
            `${core.anti_generic.avoid_patterns.join(", ")}; failure mode: ${core.anti_generic.failure_mode}`,
          ),
        ];
        sections.referenceStyle = [
          buildSectionText(
            "referenceStyle",
            `traits: ${core.reference_style.abstract_traits.join(", ")}; non-imitation enforced.`,
          ),
        ];
        break;
    }
  } else {
    // story mode
    switch (flow) {
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
        break;

      case "comment":
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
        break;

      case "reply":
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
        break;

      case "audit":
        sections.identity = [buildSectionText("identity", core.identity.archetype)];
        sections.narrative = [
          buildSectionText(
            "narrative",
            `Engine: ${core.narrative.story_engine}; Conflicts: ${core.narrative.favored_conflicts.join(", ")}`,
          ),
        ];
        sections.antiGeneric = [
          buildSectionText("antiGeneric", core.anti_generic.avoid_patterns.join(", ")),
        ];
        sections.referenceStyle = [
          buildSectionText(
            "referenceStyle",
            `traits: ${core.reference_style.abstract_traits.join(", ")}; non-imitation.`,
          ),
        ];
        break;
    }
  }

  return sections;
}

function renderPacketSections(sections: PersonaRuntimePacketSections): string {
  const lines: string[] = [];

  for (const key of Object.keys(sections) as SectionKey[]) {
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
  sections: PersonaRuntimePacketSections,
  procedureLine: string,
  budget: BudgetProfile,
): { sections: PersonaRuntimePacketSections; omittedSections: string[]; warnings: string[] } {
  const omittedSections: string[] = [];
  const warnings: string[] = [];

  let rendered = renderPacketSections(sections);
  let fullText = [rendered, procedureLine].filter(Boolean).join("\n\n");
  let wordCount = countWords(fullText);

  if (wordCount <= budget.maxWords) {
    sections.thinkingProcedure = [procedureLine];
    return { sections, omittedSections, warnings };
  }

  // Budget still below hard max? Add procedure line inline at the end
  fullText = [rendered, procedureLine].join("\n\n");
  wordCount = countWords(fullText);

  if (wordCount > budget.hardMaxWords) {
    // Need to truncate: remove optional sections by priority
    const removalOrder: SectionKey[] = [
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
    const truncatedProc = truncateWords(procedureLine, procBudget);
    fullText = [rendered, truncatedProc].join("\n\n");
    wordCount = countWords(fullText);

    if (wordCount > budget.hardMaxWords) {
      fullText = truncateWords(fullText, budget.hardMaxWords);
      warnings.push(`packet truncated to hard max ${budget.hardMaxWords} words`);
    }
  }

  sections.thinkingProcedure = [procedureLine];

  return { sections, omittedSections, warnings };
}

export function renderPersonaRuntimePacket(input: {
  packet: Omit<PersonaRuntimePacket, "renderedText" | "wordCount">;
  strictBudget?: boolean;
}): PersonaRuntimePacket {
  const { sections, omittedSections, warnings } = enforceBudget(
    input.packet.sections,
    "", // procedure line already in sections from the builder
    input.packet.budget,
  );

  const procedureLines = sections.thinkingProcedure ?? [];
  delete sections.thinkingProcedure;

  const sectionText = renderPacketSections(sections);
  const procedureText = procedureLines.join("\n");
  const renderedText = [sectionText, procedureText].filter(Boolean).join("\n\n");

  return {
    ...input.packet,
    sections: {
      ...sections,
      thinkingProcedure: procedureLines.length > 0 ? procedureLines : undefined,
    },
    renderedText,
    wordCount: countWords(renderedText),
    omittedSections,
    warnings: [...input.packet.warnings, ...warnings],
  };
}

export function buildPersonaRuntimePacket(input: {
  flow: PersonaFlowKind;
  contentMode: ContentMode;
  personaId: string;
  displayName?: string | null;
  core: PersonaCoreV2;
  options?: {
    includeExamples?: false;
    strictBudget?: boolean;
  };
}): PersonaRuntimePacket {
  const budget = BUDGETS[input.flow];
  const warnings: string[] = [];

  if (input.options?.includeExamples) {
    warnings.push("examples disabled by default");
  }

  const sections = selectSections(input.flow, input.contentMode, input.core);
  const procedureLine = buildProcedureLine(input.core, input.flow, input.contentMode);

  sections.thinkingProcedure = [procedureLine];

  const {
    sections: finalSections,
    omittedSections,
    warnings: budgetWarnings,
  } = enforceBudget(sections, procedureLine, budget);

  const sectionText = renderPacketSections(finalSections);

  // Extract procedure lines from sections to ensure they appear last
  const procLines = finalSections.thinkingProcedure ?? [];
  delete finalSections.thinkingProcedure;

  const renderedText = [sectionText, procLines.join("\n")].filter(Boolean).join("\n\n");

  return {
    flow: input.flow,
    contentMode: input.contentMode,
    personaId: input.personaId,
    displayName: input.displayName ?? null,
    schemaVersion: "v2",
    budget: { ...budget },
    sections: { ...finalSections, thinkingProcedure: procLines.length > 0 ? procLines : undefined },
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
    flow: "post_plan",
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
    flow: "post_body",
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
    contentMode: input.contentMode,
    personaId: input.personaId,
    displayName: input.displayName,
    core: input.core,
  });
}

export function buildAuditPersonaPacket(input: {
  contentMode: ContentMode;
  personaId: string;
  displayName?: string | null;
  core: PersonaCoreV2;
  auditTargets?: PersonaAuditTarget[];
}): PersonaAuditEvidencePacket {
  const packet = buildPersonaRuntimePacket({
    flow: "audit",
    contentMode: input.contentMode,
    personaId: input.personaId,
    displayName: input.displayName,
    core: input.core,
  });

  return {
    ...packet,
    flow: "audit",
    auditTargets: input.auditTargets ?? [
      "value_fit",
      "reasoning_fit",
      "discourse_fit",
      "expression_fit",
      "procedure_fit",
      "anti_generic",
      "reference_non_imitation",
      ...(input.contentMode === "story" ? (["narrative_fit"] as PersonaAuditTarget[]) : []),
    ],
  };
}

const FLOW_MAP: Record<string, PersonaFlowKind> = {
  post: "post_body",
  post_plan: "post_plan",
  post_body: "post_body",
  comment: "comment",
  reply: "reply",
};

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
  taskType: PromptActionType;
  stagePurpose: string;
  contentMode: ContentMode;
  personaId: string;
  displayName?: string | null;
  core: PersonaCoreV2;
}): PersonaRuntimePacket | null {
  const flow = FLOW_MAP[input.taskType];
  if (!flow) {
    return null;
  }

  if (input.stagePurpose === "audit" || input.stagePurpose === "quality_repair") {
    return buildAuditPersonaPacket({
      contentMode: input.contentMode,
      personaId: input.personaId,
      displayName: input.displayName,
      core: input.core,
    });
  }

  return buildPersonaRuntimePacket({
    flow,
    contentMode: input.contentMode,
    personaId: input.personaId,
    displayName: input.displayName,
    core: input.core,
  });
}
