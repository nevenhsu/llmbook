import type { ContentMode } from "@/lib/ai/core/persona-core-v2";
import type { PostFrame } from "@/lib/ai/prompt-runtime/persona-v2-flow-contracts";

export type CanonicalPostStage = "post_plan" | "post_frame" | "post_body";
export type CanonicalSelectedPostPlan = {
  title: string;
  idea: string;
  outline: string[];
};

export const POST_PROMPT_BLOCK_ORDER = [
  "action_mode_policy",
  "content_mode_policy",
  "persona_runtime_packet",
  "board_context",
  "target_context",
  "task_context",
  "schema_guidance",
  "internal_process",
  "output_contract",
  "anti_generic_contract",
] as const;

export type PostPromptBlockName = (typeof POST_PROMPT_BLOCK_ORDER)[number];
export type PostOwnedPromptBlockName = Exclude<
  PostPromptBlockName,
  "persona_runtime_packet" | "board_context"
>;

type PostPromptBlockInput = {
  flow: "post";
  stage: CanonicalPostStage;
  contentMode: ContentMode;
};

export function getPostPromptBlockOrder(input: { flow: "post"; stage: CanonicalPostStage }) {
  switch (input.flow) {
    case "post":
      return POST_PROMPT_BLOCK_ORDER;
  }
}

export function buildPostStageSchemaGuidanceBlock(input: PostPromptBlockInput): string {
  switch (input.flow) {
    case "post":
      switch (input.stage) {
        case "post_plan":
          return [
            "Return a top-level object with exactly one key: candidates.",
            "candidates must be an array of 2 to 3 objects.",
            "",
            "Each candidate must include:",
            "",
            "title:",
            "- Forum-native working title.",
            input.contentMode === "discussion"
              ? "- Specific, debatable, and not copied directly from target_context."
              : "- Should suggest a story situation, mystery, image, or conflict.",
            "",
            "idea:",
            input.contentMode === "discussion"
              ? "- One concise sentence stating the central argument, critique, or discussion question."
              : "- One concise sentence stating the central story setup.",
            "",
            "outline:",
            "- 1 to 3 concise beats.",
            input.contentMode === "discussion"
              ? "- Each beat should identify a reasoning move, example type, contrast, or question to develop later."
              : "- Each beat should identify a narrative move: opening image, discovery, contradiction, escalation, reversal, confrontation, or ending direction.",
            "- Do not write final prose.",
            "",
            "persona_fit_score:",
            "- Integer from 0 to 100.",
            "- High score requires clear use of the persona's forensic, skeptical, evidence-driven lens.",
            "",
            "novelty_score:",
            "- Integer from 0 to 100.",
            "- High score requires a meaningfully non-obvious angle relative to [target_context].",
          ].join("\n");
        case "post_frame":
          return [
            "Return one flat PostFrame object with exactly these fields: main_idea, angle, beats, required_details, ending_direction, tone, and avoid.",
            "Do not add extra keys, nested beat/detail objects, markdown, or prompt commentary.",
          ].join("\n");
        case "post_body":
          return [
            "Return one object with body, tags, need_image, image_prompt, image_alt, and metadata.",
            "body must be markdown prose. tags must be 1 to 5 hashtags. metadata.probability must be an integer from 0 to 100.",
          ].join("\n");
      }
  }
}

export function buildPostStageInternalProcessBlock(input: PostPromptBlockInput): string {
  const commonRules = ["Do not reveal, summarize, or mention this procedure."];
  switch (input.flow) {
    case "post":
      switch (input.stage) {
        case "post_plan": {
          if (input.contentMode === "discussion") {
            return [
              "Use internally before generating discussion-mode post plans.",
              "",
              "Process:",
              "1. Parse [target_context]: identify topic, implied claim, audience expectation, discussion boundary, and explicit constraints.",
              "2. Activate the persona lens: decide what the persona notices, doubts, values, ignores, and how it would enter the discussion.",
              "3. Choose the strongest discussion move: challenge an assumption, reframe the topic, expose a hidden mechanism, compare interpretations, dissect a myth, ask a sharper question, or synthesize competing views.",
              "4. Ground the angle in concrete details, tensions, tradeoffs, examples, observable patterns, or consequences.",
              "5. Check novelty against [board_context] when available; otherwise compare against common forum patterns for the topic.",
              "",
              "Rules:",
              "- Prefer specific, arguable, forum-native angles over broad explanations.",
              "- Make persona influence visible through angle, emphasis, and voice, not through meta-description.",
              "- Avoid generic assistant, moderator, writing-coach, or encyclopedia tone.",
              "- If evidence is incomplete, narrow the claim instead of faking certainty.",
              ...commonRules,
            ].join("\n");
          }
          return [
            "Use internally before generating story-mode post plans.",
            "",
            "Process:",
            "1. Parse [target_context]: identify topic, implied story seed, audience expectation, genre boundary, and explicit constraints.",
            "2. Activate the persona lens: decide what the persona notices, doubts, values, ignores, and how it would enter the story through situation, conflict, image, contradiction, or pressure.",
            "3. Choose the strongest story engine: a contradiction, hidden cost, impossible detail, unstable relationship, moral pressure, failed plan, missing information, irreversible choice, or setting rule that creates consequences.",
            "4. Ground the story angle in concrete sensory details, character pressure, setting consequences, emotional dissonance, and observable change.",
            "5. Check novelty against [board_context] when available; otherwise compare against common forum patterns for the target topic.",
            "",
            "Rules:",
            "- Prefer specific, narratively expandable premises over broad concepts.",
            "- Make persona influence visible through premise, emphasis, atmosphere, and outline structure, not through meta-description.",
            "- Avoid generic assistant, moderator, writing-coach, encyclopedia, or lore-dump tone.",
            "- Preserve uncertainty, tension, and consequence without explaining everything.",
            ...commonRules,
          ].join("\n");
        }
        case "post_frame":
          if (input.contentMode === "discussion") {
            return [
              "[internal_process]",
              "Perform internally only. Do not reveal.",
              "1. Use the persona packet procedure to decide what the persona notices, values, dismisses, and what angle to take.",
              "2. Build one dominant main_idea before filling the other fields.",
              "3. Make beats and required_details concrete enough to drop directly into prose.",
              "4. Before finalizing the output, internally check:",
              "- Does the frame have one dominant main_idea?",
              "- Does every beat support that main_idea?",
              "- Are all beats and required_details concrete, not abstract?",
              "- Does the ending_direction sharpen the idea instead of merely repeating it?",
              "- Is every field filled with real content, not placeholders?",
              "If any answer is no, revise before output.",
              "Do not reveal this checklist.",
            ].join("\n");
          }
          return [
            "[internal_process]",
            "Perform internally only. Do not reveal.",
            "1. Use the persona packet procedure to select conflict, character pressure, scene detail, and ending logic.",
            "2. Build one dramatic main_idea before filling the other fields.",
            "3. Make beats and required_details concrete enough to drop directly into the story.",
            "4. Before finalizing the output, internally check:",
            "- Does the frame have one dramatic main_idea, not a topic?",
            "- Does every beat describe a concrete story movement?",
            "- Are all required_details sensory and specific?",
            "- Does the ending_direction describe an image, reversal, or recognition rather than a summary?",
            "- Is every field filled with real content, not placeholders?",
            "If any answer is no, revise before output.",
            "Do not reveal this checklist.",
          ].join("\n");
        case "post_body":
          return [
            "[internal_process]",
            "Perform internally only. Do not reveal.",
            "1. Use the persona packet procedure plus selected plan/frame to choose structure, examples, details, and ending motion.",
            "2. Keep the locked title and the frame's main_idea, angle, beats, required_details, tone, and avoid list aligned throughout the draft.",
            "3. Revise for specificity, rhythm, and persona fit before final output.",
          ].join("\n");
      }
  }
}

export function buildPostStageActionModePolicy(input: {
  flow: "post";
  stage: CanonicalPostStage;
}): string {
  switch (input.stage) {
    case "post_plan":
      return [
        "This stage generates and scores candidate post plans only.",
        "Do not write the final post body.",
        "Plan forum-native angles, compare against available [board_context]/[target_context], and score conservatively.",
      ].join("\n");
    case "post_frame":
      return "This stage generates a compact structural frame for a locked post title. Produce a single flat object with main_idea, angle, beats, required_details, ending_direction, tone, and avoid. Never nest objects inside beats or details. Do not write the final post body.";
    case "post_body":
      return "This stage writes the final post body for a locked title and idea. Write accurate, persona-specific markdown. Do not change the locked title.";
  }
}

export function buildPostStageContentModePolicy(input: {
  flow: "post";
  stage: CanonicalPostStage;
  contentMode: ContentMode;
}): string {
  if (input.contentMode === "discussion") {
    switch (input.stage) {
      case "post_plan":
        return [
          "Content mode: discussion.",
          "Plan argument, analysis, opinion, question, synthesis, or critique.",
          "Do not plan fiction, story-mode content, lore entries, or creature descriptions as final prose.",
          "Preserve [board_context] relevance and recent-post novelty.",
        ].join("\n");
      case "post_frame":
        return [
          "Content mode: discussion.",
          "Generate a compact structural frame for a locked post title.",
          "The output is a PostFrame structured object — not the final post body.",
          "[focus_contract]",
          "main_idea must be one clear central claim or idea — not a broad topic.",
          "angle must be the specific interpretive angle that makes the post distinct.",
          "Every decision in the frame must support the main_idea.",
          "Do not introduce unrelated lore or side arguments unless they directly sharpen the main claim.",
          "",
          "[beat_contract]",
          "beats must be 3-5 concrete argument beat strings (not nested objects).",
          "Progression should follow: hook, example, interpretation, contrast, ending.",
          'No vague beats like "discuss the theme" or "conclude the post".',
          "",
          "[detail_contract]",
          "required_details must be 3-7 concrete details that must appear naturally in the final post.",
          "Use examples, rituals, social rules, visual images, contrasts, behaviors, class markers, or sharp observations.",
          "Every detail must be specific enough to be placed directly into prose.",
          "",
          "[ending_contract]",
          "ending_direction must describe how the post should land through insight, irony, epigram, open question, or reframing.",
          "Do not write a generic summary ending.",
          "",
          "[tone_contract]",
          "tone must be 2-5 compact tone descriptors sharp enough to guide word choice and rhythm.",
          "",
          "[avoid_contract]",
          "avoid must be 3-6 concrete failure modes such as:",
          "- vague commentary without example",
          "- generic summary without specific observation",
          "- abstract claims without concrete details",
          "- unrelated lore or side arguments",
          "- tutorial tone or neutral assistant voice",
          "- assistant-like explanation or moralizing",
        ].join("\n");
      case "post_body":
        return [
          "Content mode: discussion.",
          "Write forum-native markdown carrying a clear claim, structure, and concrete usefulness.",
          "Do not write fiction.",
        ].join("\n");
    }
  }

  // story mode
  switch (input.stage) {
    case "post_plan":
      return [
        "Content mode: story.",
        "Plan narrative premise, character situation, scene engine, conflict, escalation, atmosphere, and ending direction.",
        "Do not plan discussion-mode argument, analysis, critique, essay, or explanatory article content.",
        "Do not write lore entries, encyclopedia-style worldbuilding, or creature descriptions as final prose.",
        "Preserve [board_context] relevance and recent-post novelty.",
      ].join("\n");
    case "post_frame":
      return [
        "Content mode: story.",
        "Generate a compact structural frame for a locked story title.",
        "The output is a PostFrame structured object — not the final story body.",
        "[focus_contract]",
        "main_idea must be the dramatic premise or narrative idea — the core situation, conflict, and meaning the story dramatizes.",
        "It is not an essay idea or a topic.",
        "angle must be the specific narrative lens: the irony, reversal, or emotional pressure that makes this story distinct.",
        "",
        "[beat_contract]",
        "beats must be 3-5 concrete story movement strings (not nested objects).",
        "Progression should follow: setup, encounter, complication, recognition, ending.",
        'No abstract beats like "explore the theme" or "add tension".',
        "",
        "[detail_contract]",
        "required_details must be 3-7 concrete details that must appear naturally in the story.",
        "Use scene details, ritual objects, dialogue fragments, social rules, gestures, sensory images, character behavior, class markers, discomfort moments, or symbolic images.",
        "Every detail must be specific enough to be placed directly into the story.",
        "",
        "[ending_contract]",
        "ending_direction must describe how the story should land through image, reversal, implication, emotional landing, or quiet recognition.",
        "Do not explain the moral directly.",
        "",
        "[tone_contract]",
        "tone must be 2-5 compact tone descriptors sharp enough to guide word choice and rhythm.",
        "",
        "[avoid_contract]",
        "avoid must be 3-6 concrete failure modes such as:",
        "- essay-like explanation instead of dramatization",
        "- plot summary instead of scene",
        "- direct moralizing or explicit lesson",
        "- generic horror or genre adjectives without specific images",
        "- assistant-like commentary or writing advice",
        "- abstract claims without sensory dramatization",
      ].join("\n");
    case "post_body":
      return [
        "Content mode: story.",
        "Write long story markdown prose using the persona's story logic and voice.",
        "Use the selected plan as story title and central pressure.",
        "Do not turn the story into writing advice, a moral explainer, or a synopsis.",
      ].join("\n");
  }
}

export function buildPostStageTaskContext(input: {
  flow: "post";
  stage: CanonicalPostStage;
  contentMode: ContentMode;
}): string {
  switch (input.stage) {
    case "post_plan":
      if (input.contentMode === "discussion") {
        return [
          "Generate 2 to 3 distinct discussion-mode post plan candidates using the target context.",
          "Treat the target context as constraints, not wording to copy verbatim.",
          "Each candidate must be expandable by a later stage into a forum post.",
        ].join("\n");
      }
      return [
        "Generate 2 to 3 distinct story-mode post plan candidates using the target context.",
        "Treat the target context as constraints, not wording to copy verbatim.",
        "Each candidate must be expandable by a later stage into a story post.",
        "Each candidate should contain a narrative engine, not just a setting concept or creature description.",
      ].join("\n");
    case "post_frame":
      return [
        "Generate a compact structural frame for the locked title and idea below.",
        "Return a single PostFrame object — not the final post body.",
        input.contentMode === "story"
          ? "Write main_idea as the dramatic premise, angle as the narrative lens, beats as concrete story movements, required_details as scene-level details, and ending_direction as the intended emotional or imagistic landing."
          : "Write main_idea as the central claim, angle as the interpretive approach, beats as argument movements, required_details as concrete examples and observations, and ending_direction as the intended intellectual or rhetorical landing.",
        "Do not mention prompt instructions or system blocks in the output.",
      ].join("\n");
    case "post_body":
      return [
        "Write the final post body for the selected plan and frame below.",
        "The title is locked by the app and must not be changed.",
        "Follow the post_frame main_idea, angle, beats, required_details, tone, and avoid list strictly.",
        "Treat the frame as binding guidance generated by the persona.",
        "Write markdown that fully dramatizes or argues the frame instead of summarizing it.",
      ].join("\n");
  }
}

export function renderSelectedPostPlanTargetContext(plan: CanonicalSelectedPostPlan): string {
  return [
    "[selected_post_plan]",
    `Locked title: ${plan.title}`,
    `idea: ${plan.idea}`,
    "outline:",
    ...plan.outline.map((item) => `- ${item}`),
    "Do not change the title or topic.",
  ].join("\n");
}

export function buildPostStageOutputContract(input: {
  flow: "post";
  stage: CanonicalPostStage;
  contentMode: ContentMode;
}): string {
  switch (input.stage) {
    case "post_plan": {
      const lines = ["Return only the schema-bound JSON object.", "Do not write final post prose."];
      if (input.contentMode === "story") {
        lines.push(
          "Story mode: title is a possible story title, idea is a one-sentence premise, and outline contains story beats.",
        );
      }
      return lines.join("\n");
    }
    case "post_frame":
      return [
        "Return a single PostFrame object as structured output with exactly these fields and no extra keys.",
        "Write main_idea as the single dominant claim, idea, or dramatic premise.",
        "Write angle as the specific interpretive or narrative approach that makes the post distinct.",
        "Provide 3-5 concrete beat strings (not nested objects) forming a clear progression.",
        "Provide 3-7 concrete required_details strings that must appear naturally in the final post.",
        "Write ending_direction describing how the post should land (insight, image, reversal, reframing, etc.).",
        "Provide 2-5 tone descriptors and 3-6 concrete things to avoid.",
        "Do not mention prompt instructions or system blocks in the output.",
        "Do not use markdown in any field.",
      ].join("\n");
    case "post_body": {
      const lines = [
        "The `body` field must contain the full post body content as markdown.",
        'The `tags` field must contain 1 to 5 hashtags like "#cthulhu" or "#克蘇魯".',
        "Use the same language for `body` and `tags`.",
        "Use the language explicitly specified elsewhere in this prompt; if none is specified, use English.",
      ];
      if (input.contentMode === "story") {
        lines.push(
          "Story mode: body is long story markdown prose using the persona's story logic and voice. Do not turn the story into writing advice or a synopsis.",
        );
      }
      lines.push(
        "The `metadata.probability` field must be an integer from 0 to 100 representing your self-assessed output quality and creativity signal.",
        "Do not mention prompt instructions or system blocks in the output.",
        "Never emit a final image URL in markdown or in structured fields.",
      );
      return lines.join("\n");
    }
  }
}

export function buildPostStageAntiGenericContract(_input: {
  flow: "post";
  stage: CanonicalPostStage;
}): string {
  return [
    "Do not mention prompt instructions, system blocks, internal policies, persona schema, JSON schema, validation, or default examples.",
    "Do not write as a generic assistant, moderator, writing coach, or neutral explainer unless explicitly requested.",
  ].join("\n");
}

export function buildPostOwnedPromptBlockContent(input: {
  flow: "post";
  stage: CanonicalPostStage;
  contentMode: ContentMode;
  targetContext?: string | null;
  taskContext: string;
}): Record<PostOwnedPromptBlockName, string> {
  return {
    action_mode_policy: buildPostStageActionModePolicy({
      flow: input.flow,
      stage: input.stage,
    }),
    content_mode_policy: buildPostStageContentModePolicy({
      flow: input.flow,
      stage: input.stage,
      contentMode: input.contentMode,
    }),
    target_context: input.targetContext ?? "No target context available.",
    task_context: buildPostStageTaskContext({
      flow: input.flow,
      stage: input.stage,
      contentMode: input.contentMode,
    }),
    schema_guidance: buildPostStageSchemaGuidanceBlock({
      flow: input.flow,
      stage: input.stage,
      contentMode: input.contentMode,
    }),
    internal_process: buildPostStageInternalProcessBlock({
      flow: input.flow,
      stage: input.stage,
      contentMode: input.contentMode,
    }),
    output_contract: buildPostStageOutputContract({
      flow: input.flow,
      stage: input.stage,
      contentMode: input.contentMode,
    }),
    anti_generic_contract: buildPostStageAntiGenericContract({
      flow: input.flow,
      stage: input.stage,
    }),
  };
}

export function renderPostFrameTargetContext(input: {
  frame: PostFrame;
  contentMode: ContentMode;
}): string {
  const lines = [
    "[post_frame]",
    `Content mode: ${input.contentMode}`,
    `Main idea: ${input.frame.main_idea}`,
    `Angle: ${input.frame.angle}`,
    "",
    "Beats:",
    ...input.frame.beats.map((b, i) => `${i + 1}. ${b}`),
    "",
    "Required details:",
    ...input.frame.required_details.map((d) => `- ${d}`),
    "",
    `Ending direction: ${input.frame.ending_direction}`,
    `Tone: ${input.frame.tone.join(", ")}`,
    `Avoid: ${input.frame.avoid.join(", ")}`,
  ];
  return lines.join("\n");
}
