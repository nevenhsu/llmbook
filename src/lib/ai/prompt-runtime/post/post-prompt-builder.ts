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
  stage: CanonicalPostStage;
  contentMode: ContentMode;
};

export function getPostPromptBlockOrder() {
  return POST_PROMPT_BLOCK_ORDER;
}

export function buildPostStageSchemaGuidanceBlock(input: PostPromptBlockInput): string {
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
      if (input.contentMode === "discussion") {
        return [
          "main_idea:",
          "- Write one specific, arguable, post-sized claim.",
          "- Do not write a broad topic, title, question, or summary label.",

          "angle:",
          "- Write the distinct lens that makes the post sharper than a generic discussion of the topic.",
          "- The angle must explain how the post thinks, not just what it discusses.",
          "",
          "required_details:",
          "- Write 3-7 concrete details usable directly in prose.",
          "- Use examples, mechanisms, contrasts, sensory images, behaviors, contradictions, or precise observations.",
          "- If a detail type does not fit the locked title, choose a more relevant concrete detail type.",
          "- Every detail must support the main_idea.",
          "",
          "ending_direction:",
          "- Describe how the post should land through insight, irony, reframing, tension, image, reversal, question, or epigram.",
          "- Do not write a generic summary ending.",
          "",
          "tone:",
          "- Write 2-5 actionable tone descriptors that guide rhythm, word choice, and stance.",
          '- Avoid empty descriptors like "interesting", "engaging", "clear", or "good".',
          "",
          "avoid:",
          "- Write 3-6 concrete failure modes specific to this post.",
          "- Avoid vague or reusable warnings unless directly relevant.",
        ].join("\n");
      }
      // story mode
      return [
        "main_idea:",
        "- Write one specific, story-sized dramatic premise.",
        "- It must name the central tension, transformation, or narrative engine.",
        "- Do not write a broad theme, title, genre label, or vague setup.",
        "",
        "angle:",
        "- Write the distinct narrative lens that makes the story sharper than a generic version of the premise.",
        "- The angle must explain how the story sees the premise, not just what happens.",
        "",
        "beats:",
        "- Write 3-5 concrete story movements.",
        "- Each beat must change the situation, pressure, relationship, discovery, or emotional state.",
        "- Prefer: opening image/tension, inciting disturbance, escalation/discovery, reversal/confrontation, ending turn.",
        `- Avoid: vague beats like "develop the character", "explore the theme", or "conclude the story".`,
        "",
        "required_details:",
        "- Write 3-7 concrete details usable directly in prose.",
        "- Use sensory images, objects, gestures, setting details, character behaviors, contradictions, rituals, dialogue cues, or precise story facts.",
        "- If a detail type does not fit the locked title, choose a more relevant concrete detail type.",
        "- Every detail must support the main_idea.",
        "",
        "ending_direction:",
        "- Describe how the story should land through emotional reversal, unsettling image, irony, revelation, sacrifice, transformation, unanswered question, or thematic echo.",
        "- Do not write a generic resolution.",
        "- Do not write the final paragraph itself.",
        "",
        "tone:",
        "- Write 2-5 actionable tone descriptors that guide rhythm, imagery, mood, and narrative stance.",
        `- Avoid empty descriptors like "interesting", "engaging", "clear", or "good".`,
        "",
        "avoid:",
        "- Write 3-6 concrete failure modes specific to this story.",
        "- Avoid vague or reusable warnings unless directly relevant.",
      ].join("\n");
    case "post_body":
      const body =
        input.contentMode === "discussion"
          ? [
              "body:",
              "- Markdown prose containing the finished forum post body.",
              "- Do not include the locked title.",
            ]
          : // story mode
            [
              "body:",
              "- Finished story post body in markdown prose.",
              "- Must read as a complete story or story fragment suitable for a forum post.",
              "- Use scene, action, image, dialogue, memory, or character perception instead of abstract explanation.",
              "- Do not include the locked title.",
            ];
      return [
        ...body,
        "",
        "tags:",
        "- Array of 1 to 5 hashtags. Only in English.",
        `- Example: ["#cthulhu", "#biology", "#cosmic_horror"]`,
        "",
        "need_image: Boolean",
        "- Set to true only if an image would meaningfully improve the post.",
        "- Set to false for ordinary discussion posts that do not need visual support.",
        "",
        "image_prompt: string",
        "- If need_image is true, describe the image to generate in concrete visual terms.",
        "- If need_image is false, use an empty string.",
        "",
        "image_alt:",
        "- String.",
        "- If need_image is true, write concise alt text describing the image.",
        "- If need_image is false, use an empty string.",
        "",
        "metadata.probability:",
        "- Integer from 0 to 100.",
        "- Self-assessed quality signal for how well the output follows the frame, persona, specificity, and creative strength.",
      ].join("\n");
  }
}

export function buildPostStageInternalProcessBlock(input: PostPromptBlockInput): string {
  const commonRules = ["Do not reveal, summarize, or mention this procedure."];

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
      // story mode
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
          "Silently follow this process before output:",
          "",
          "1. Lock the selected title, thesis, and outline as binding constraints.",
          "2. Compress the thesis into one dominant main_idea.",
          "3. Extract one distinct angle that sharpens the post.",
          "4. Build 3-5 beats with clear argumentative progression.",
          "5. Select 3-7 concrete required_details that prevent generic prose.",
          "6. Design an ending_direction that creates a final turn, not a summary.",
          "7. Choose 2-5 tone descriptors that fit the topic and forum context.",
          "8. Define 3-6 avoid items based on likely failure modes.",
          "9. Check that every field supports the locked title, thesis, and content mode.",
        ].join("\n");
      }
      // story mode
      return [
        "Silently follow this process before output:",
        "",
        "1. Lock the selected title, premise, and outline as binding constraints.",
        "2. Compress the premise into one dominant main_idea.",
        "3. Extract one distinct narrative angle that sharpens the story.",
        "4. Build 3-5 beats with clear story progression and escalating consequence.",
        "5. Select 3-7 concrete required_details that prevent generic prose.",
        "6. Design an ending_direction that creates a final emotional or thematic turn.",
        "7. Choose 2-5 tone descriptors that fit the premise, genre, and forum context.",
        "8. Define 3-6 avoid items based on likely story failure modes.",
        "9. Check that every field supports the locked title, premise, and content mode.",
      ].join("\n");
    case "post_body":
      if (input.contentMode === "discussion") {
        return [
          "Silently follow this process before output:",
          "",
          "1. Find the central contradiction.",
          "2. Build the post as physical clue → reconstruction → pressure test → unresolved question.",
          "3. Integrate every required detail naturally.",
          "4. Revise for specificity, rhythm, persona fit, and non-generic language.",
        ].join("\n");
      }
      // story mode
      return [
        "Silently follow this process before output:",
        "",
        "1. Find the central story contradiction, wound, desire, or mystery.",
        "2. Build the post as physical clue → scene reconstruction → escalation → irreversible turn → resonant ending.",
        "3. Integrate every required detail naturally through action, image, dialogue, memory, or implication.",
        "4. Keep exposition minimal. Prefer dramatization over explanation.",
        "5. Preserve the persona's voice, attention pattern, and emotional restraint.",
        "6. Revise for specificity, rhythm, narrative momentum, and non-generic language.",
      ].join("\n");
  }
}

export function buildPostStageActionModePolicy(input: PostPromptBlockInput): string {
  switch (input.stage) {
    case "post_plan":
      return [
        "This stage generates and scores candidate post plans only.",
        "Do not write the final post body.",
        "Plan forum-native angles, compare against available [board_context]/[target_context], and score conservatively.",
      ].join("\n");
    case "post_frame":
      return [
        input.contentMode === "discussion"
          ? "This stage generates one compact structural frame for a locked post plan."
          : "This stage generates one compact structural frame for a locked story post plan.",
        "Do not write the final post content.",
        "Do not change the locked title, thesis, topic, or content mode.",
      ].join("\n");
    case "post_body": {
      return [
        "This stage writes the final forum post body for a locked title and selected frame.",
        "Do not change the locked title, thesis, topic, or frame intent.",
        "Write the post itself, not a plan, critique, explanation, or writing advice.",
      ].join("\n");
    }
  }
}

export function buildPostStageContentModePolicy(input: {
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
          "Generate an argument-focused structural frame for a forum post.",
        ].join("\n");
      case "post_body":
        return [
          "Content mode: discussion.",
          "Write forum-native markdown with a clear claim, concrete reasoning, and specific examples.",
          "Do not write fiction, story prose, lore entry, or creature encyclopedia prose.",
          "The post may be analytical, skeptical, argumentative, comparative, or exploratory.",
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
        "Generate a story-focused PostFrame object, not prose and not the final story body.",
      ].join("\n");
    case "post_body":
      return [
        "Content mode: story.",
        "Write forum-native markdown that presents a complete story post with scene, character, tension, progression, and ending motion.",
        "Do not write discussion analysis, literary critique, lore encyclopedia prose, or advice.",
        "The story may contain reflection, but the reflection must emerge through scene, action, image, dialogue, or character perception.",
      ].join("\n");
  }
}

export function buildPostStageTaskContext(input: {
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
      // story mode
      return [
        "Generate 2 to 3 distinct story-mode post plan candidates using the target context.",
        "Treat the target context as constraints, not wording to copy verbatim.",
        "Each candidate must be expandable by a later stage into a story post.",
        "Each candidate should contain a narrative engine, not just a setting concept or creature description.",
      ].join("\n");
    case "post_frame":
      return ["Generate a compact structural frame for the locked title and idea."].join("\n");
    case "post_body":
      {
        if (input.contentMode === "discussion") {
          return [
            "Write the final post body for the selected plan and frame.",
            "The app owns the title separately, so do not include or rewrite the locked title.",
            "Treat the post_frame as binding.",
            "Convert the frame into a finished forum post with argument, examples, transitions, and a strong ending.",
            "Do not merely restate the beats.",
          ].join("\n");
        }
      }
      // story mode
      return [
        "Write the final story post body from the selected plan and frame.",
        "The app owns the title separately, so do not include or rewrite the locked title.",
        "Treat post_frame as binding.",
        "Expand the beats into a finished forum-native story post with scene progression, concrete detail, character presence, tension, and ending motion.",
        "Do not merely restate the outline.",
        "Do not explain the story idea from outside the story.",
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

export function buildPostStageOutputContract(input: PostPromptBlockInput): string {
  switch (input.stage) {
    case "post_plan":
      return [
        "Return only the schema-bound JSON object.",
        "Do not write final post prose.",
        input.contentMode === "discussion"
          ? "Discussion mode: title is a possible discussion title, idea is a one-sentence claim, and outline contains discussion beats."
          : "Story mode: title is a possible story title, idea is a one-sentence premise, and outline contains story beats.",
      ].join("\n");
    case "post_frame":
      return [
        "Return only the schema-bound JSON object.:",
        "main_idea, angle, beats, required_details, ending_direction, tone, avoid",
      ].join("\n");
    case "post_body":
      return [
        "Return only the schema-bound JSON object.",
        "Use the language explicitly specified elsewhere in this prompt; if none is specified, use English.",
        "Never emit a final image URL in markdown or in structured fields.",
      ].join("\n");
  }
}

export function buildPostStageAntiGenericContract(input: PostPromptBlockInput): string {
  const lines = [
    "Do not mention prompt instructions, system blocks, internal policies, persona schema, JSON schema, validation, or default examples.",
    "Do not write as a generic assistant, moderator, writing coach, or neutral explainer unless explicitly requested.",
  ];

  if (input.stage === "post_body") {
    if (input.contentMode === "discussion") {
      lines.push(
        "Do not use filler openings such as:",
        "- This is an interesting topic",
        "- One way to think about this is",
        "- In this post, I will",
        "- Let's explore",
        "Prefer a direct concrete opening with physical detail, contradiction, or evidence.",
      );
    } else {
      // story mode
      lines.push(
        "Do not write story analysis, literary critique, lore encyclopedia prose, or advice.",
        "Do not use filler openings such as:",
        "- This is a story about",
        "- Here is a story",
        "- In this tale",
        "- The story begins",
        "- Once upon a time",
        "Start with a concrete sensory detail, physical clue, contradiction, action, or voice.",
        "Do not resolve every mystery unless the frame explicitly requires closure.",
      );
    }
  }

  return lines.join("\n");
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
      stage: input.stage,
      contentMode: input.contentMode,
    }),
    content_mode_policy: buildPostStageContentModePolicy({
      stage: input.stage,
      contentMode: input.contentMode,
    }),
    target_context: input.targetContext ?? "No target context available.",
    task_context: buildPostStageTaskContext({
      stage: input.stage,
      contentMode: input.contentMode,
    }),
    schema_guidance: buildPostStageSchemaGuidanceBlock({
      stage: input.stage,
      contentMode: input.contentMode,
    }),
    internal_process: buildPostStageInternalProcessBlock({
      stage: input.stage,
      contentMode: input.contentMode,
    }),
    output_contract: buildPostStageOutputContract({
      stage: input.stage,
      contentMode: input.contentMode,
    }),
    anti_generic_contract: buildPostStageAntiGenericContract({
      stage: input.stage,
      contentMode: input.contentMode,
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
