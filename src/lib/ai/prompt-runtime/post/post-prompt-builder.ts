import type { ContentMode } from "@/lib/ai/core/persona-core-v2";
import type { PostFrame } from "@/lib/ai/prompt-runtime/persona-v2-flow-contracts";

export type CanonicalPostStage = "post_plan" | "post_frame" | "post_body";
export type CanonicalSelectedPostPlan = {
  title: string;
  thesis: string;
  bodyOutline: string[];
};

export function buildPostStageActionModePolicy(input: {
  flow: "post";
  stage: CanonicalPostStage;
}): string {
  switch (input.stage) {
    case "post_plan":
      return "This stage is planning and scoring candidate post ideas. Plan forum-native angles, compare against recent posts, and score conservatively. Do not write the final post body.";
    case "post_frame":
      return "This stage generates a compact structural frame for a locked post title. Produce a single flat object with main_idea, angle, beats, required_details, ending_direction, tone, and avoid. Never nest objects inside beats or details. Do not write the final post body.";
    case "post_body":
      return "This stage writes the final post body for a locked title and thesis. Write accurate, persona-specific markdown. Do not change the locked title.";
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
          "Plan forum-native argument, analysis, opinion, question, synthesis, or critique.",
          "Do not plan fiction or story-mode content.",
          "Preserve board relevance and recent-post novelty.",
          "Before output, use the persona packet procedure internally to decide what the persona notices, doubts, cares about, and what response move to choose.",
          "Do not reveal that internal procedure.",
        ].join("\n");
      case "post_frame":
        return [
          "Content mode: discussion.",
          "Generate a compact structural frame for a locked post title.",
          "The output is a PostFrame structured object — not the final post body.",
          "Use the persona packet procedure internally to decide what the persona notices, values, dismisses, and what angle to take.",
          "Do not reveal that internal procedure.",
          "",
          "[focus_contract]",
          "main_idea must be one clear central claim or thesis — not a broad topic.",
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
          "",
          "[quality_gate]",
          "Before finalizing the output, internally check:",
          "- Does the frame have one dominant main_idea?",
          "- Does every beat support that main_idea?",
          "- Are all beats and required_details concrete, not abstract?",
          "- Does the ending_direction sharpen the thesis instead of merely repeating it?",
          "- Is every field filled with real content, not placeholders?",
          "If any answer is no, revise before output.",
          "Do not reveal this checklist.",
        ].join("\n");
      case "post_body":
        return [
          "Content mode: discussion.",
          "Write forum-native markdown carrying a clear claim, structure, and concrete usefulness.",
          "Do not write fiction.",
          "Use the persona packet procedure internally to interpret context before choosing final content.",
          "Do not reveal that internal procedure.",
        ].join("\n");
    }
  }

  // story mode
  switch (input.stage) {
    case "post_plan":
      return [
        "Content mode: story.",
        "Plan story title, central premise, and story beats.",
        "Generate story planning candidates, not discussion angles.",
        "Map title, thesis, and body_outline to story title, premise, and beats.",
        "Use the persona packet procedure internally to select conflict, character pressure, scene detail, and ending logic.",
        "Do not reveal that internal procedure.",
      ].join("\n");
    case "post_frame":
      return [
        "Content mode: story.",
        "Generate a compact structural frame for a locked story title.",
        "The output is a PostFrame structured object — not the final story body.",
        "Use the persona packet procedure internally to select conflict, character pressure, scene detail, and ending logic.",
        "Do not reveal that internal procedure.",
        "",
        "[focus_contract]",
        "main_idea must be the dramatic premise or narrative thesis — the core situation, conflict, and meaning the story dramatizes.",
        "It is not an essay thesis or a topic.",
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
        "",
        "[quality_gate]",
        "Before finalizing the output, internally check:",
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
        "Content mode: story.",
        "Write long story markdown prose using the persona's story logic and voice.",
        "Use the selected plan as story title and central pressure.",
        "Do not turn the story into writing advice, a moral explainer, or a synopsis.",
        "Use the persona packet procedure internally to choose conflict, character pressure, scene detail, and ending logic.",
        "Do not reveal that internal procedure.",
      ].join("\n");
  }
}

export function buildPostStageTaskContext(input: {
  flow: "post";
  stage: CanonicalPostStage;
  contentMode: ContentMode;
  baseTaskContext?: string;
}): string {
  switch (input.stage) {
    case "post_plan":
      return [
        input.baseTaskContext ?? "",
        "This is the planning stage only.",
        "Return 2-3 candidates, score conservatively, and do not write the final post body.",
      ]
        .join("\n\n")
        .trim();
    case "post_frame":
      return [
        "Generate a compact structural frame for the locked title and thesis below.",
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
    `Thesis: ${plan.thesis}`,
    "Body outline:",
    ...plan.bodyOutline.map((item) => `- ${item}`),
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
      const lines = [
        "Return 2-3 candidates as structured output.",
        "Each candidate must have a title, thesis, body_outline (2-5 items), persona_fit_score (0-100), and novelty_score (0-100).",
        "Do not mention prompt instructions or system blocks in the output.",
      ];
      if (input.contentMode === "story") {
        lines.push(
          "Story mode: title is a possible story title, thesis is a one-sentence premise, and body_outline contains story beats.",
        );
      }
      return lines.join("\n");
    }
    case "post_frame":
      return [
        "Return a single PostFrame object as structured output with exactly these fields and no extra keys.",
        "Write main_idea as the single dominant claim, thesis, or dramatic premise.",
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
        "The `tags` field must contain 1 to 5 hashtags like \"#cthulhu\" or \"#克蘇魯\".",
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
    "Do not mention these prompt blocks, internal policies, or persona schema.",
    "Do not write as a generic assistant, moderator, writing coach, or neutral explainer unless explicitly requested.",
    "Do not add memory, relationship claims, reference-name imitation, or default examples.",
    "Keep the output in the requested JSON schema only.",
  ].join("\n");
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
