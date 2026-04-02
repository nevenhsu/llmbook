import rawFixture from "@/mock-data/interaction-preview.json";
import type {
  AiModelConfig,
  AiProviderConfig,
  PersonaProfile,
  PreviewResult,
} from "@/lib/ai/admin/control-plane-store";
import { parsePostActionOutput } from "@/lib/ai/prompt-runtime/action-output";
import type { PersonaItem } from "@/lib/ai/admin/control-plane-types";
import { defaultInteractionTaskContext } from "@/components/admin/control-plane/control-plane-utils";

const fixture = rawFixture as {
  preview: PreviewResult;
};

const basePostPreview = fixture.preview;
const parsedBasePostOutput = parsePostActionOutput(basePostPreview.rawResponse ?? "");

const postRawResponse = JSON.stringify({
  title: parsedBasePostOutput.title ?? "Deep-Sea Gods That Should Terrify Your Crew",
  body: parsedBasePostOutput.body,
  tags: parsedBasePostOutput.tags.length > 0 ? parsedBasePostOutput.tags : ["#cthulhu"],
  need_image: true,
  image_prompt:
    "Eldritch cosmic horror creature emerging from dark depths, tentacles and impossible geometry, bioluminescent accents, massive scale compared to a small human figure in the background, nightmarish but visually striking, dark oceanic palette with unnatural green highlights, concept art style",
  image_alt:
    "A dark atmospheric illustration of a cosmic horror sea creature rising from shadowy depths with tentacles and impossible geometry.",
});

export const mockInteractionPreview: PreviewResult = {
  ...basePostPreview,
  rawResponse: postRawResponse,
  auditDiagnostics: {
    status: "passed_after_repair",
    issues: ["too editorial", "reference-role framing not visible"],
    repairGuidance: [
      "Open with a sharper thesis.",
      "Make the persona's reference-role worldview visible in the post framing.",
    ],
    severity: "high",
    confidence: 0.92,
    missingSignals: ["immediate reaction", "reference-role framing"],
    repairApplied: true,
    auditMode: "compact",
    compactRetryUsed: true,
  },
};

export const mockInteractionPreviewComment: PreviewResult = {
  ...basePostPreview,
  assembledPrompt: basePostPreview.assembledPrompt
    .replace(
      "[task_context]\nWrite a post about Cthulhu-themed worldbuilding and creature design for the forum.",
      "[task_context]\nReply to a user's Cthulhu-themed concept art draft and point out which details make the creature feel cosmic rather than just monstrous.",
    )
    .replace(
      `[output_constraints]
Return exactly one JSON object.
title: string
body: string
tags: string[]
need_image: boolean
image_prompt: string | null
image_alt: string | null
The \`title\` field must contain the full post title.
The \`body\` field must contain the full post body content as markdown.
The \`tags\` field must contain 1 to 5 hashtags like "#cthulhu" or "#克蘇魯".
Use the same language for \`title\`, \`body\`, and \`tags\`.
Use the language explicitly specified elsewhere in this prompt; if none is specified, use English.
Do not repeat the title as a markdown H1 inside \`body\`.
Do not output any text outside the JSON object.
Do not mention prompt instructions or system blocks in the output.
Never emit a final image URL in markdown or in structured fields.`,
      `[output_constraints]
Return exactly one JSON object.
markdown: string
need_image: boolean
image_prompt: string | null
image_alt: string | null
The \`markdown\` field must contain the full body content as markdown.
Use the same language for the full response content.
Use the language explicitly specified elsewhere in this prompt; if none is specified, use English.
Do not output any text outside the JSON object.
Do not mention prompt instructions or system blocks in the output.
Never emit a final image URL in markdown or in structured fields.`,
    ),
  markdown:
    "That draft already has the right wrongness in the silhouette. The part I'd push harder is the scale cue, because Cthulhu-style horror lands better when the viewer feels tiny before they even understand what they're seeing.\n\nI'd also make one detail feel physically impossible, like the jawline folding the wrong way or the glow bleeding through surfaces that shouldn't be translucent. That's what turns it from \"big monster\" into something cosmic.\n\nThe good part is you already nailed the mood. Now make one or two design choices feel like they violate reality and the whole thing will hit harder.",
  rawResponse: JSON.stringify({
    markdown:
      "That draft already has the right wrongness in the silhouette. The part I'd push harder is the scale cue, because Cthulhu-style horror lands better when the viewer feels tiny before they even understand what they're seeing.\n\nI'd also make one detail feel physically impossible, like the jawline folding the wrong way or the glow bleeding through surfaces that shouldn't be translucent. That's what turns it from \"big monster\" into something cosmic.\n\nThe good part is you already nailed the mood. Now make one or two design choices feel like they violate reality and the whole thing will hit harder.",
    need_image: false,
    image_prompt: null,
    image_alt: null,
  }),
  auditDiagnostics: {
    status: "passed",
    issues: [],
    repairGuidance: [],
    severity: "low",
    confidence: 0.95,
    missingSignals: [],
    repairApplied: false,
    auditMode: "default",
    compactRetryUsed: false,
  },
};

export const mockInteractionPreviewProvider: AiProviderConfig = {
  id: "preview-provider-minimax",
  providerKey: "minimax",
  displayName: "MiniMax",
  sdkPackage: "@ai-sdk/minimax",
  status: "active",
  testStatus: "success",
  keyLast4: "mock",
  hasKey: true,
  lastApiErrorCode: null,
  lastApiErrorMessage: null,
  lastApiErrorAt: null,
  createdAt: "2026-03-16T00:00:00.000Z",
  updatedAt: "2026-03-16T00:00:00.000Z",
};

export const mockInteractionPreviewModel: AiModelConfig = {
  id: "preview-model-minimax-m2-5",
  providerId: mockInteractionPreviewProvider.id,
  modelKey: "minimax-m2.5",
  displayName: "MiniMax-M2.5",
  capability: "text_generation",
  status: "active",
  testStatus: "success",
  lifecycleStatus: "active",
  displayOrder: 1,
  lastErrorKind: null,
  lastErrorCode: null,
  lastErrorMessage: null,
  lastErrorAt: null,
  supportsInput: true,
  supportsImageInputPrompt: false,
  supportsOutput: true,
  contextWindow: 3200,
  maxOutputTokens: mockInteractionPreview.tokenBudget.maxOutputTokens,
  metadata: {
    previewOnly: true,
  },
  updatedAt: "2026-03-16T00:00:00.000Z",
};

export const mockInteractionPreviewPersona: PersonaItem = {
  id: "preview-persona-straw-hat-outlaw",
  username: "ai_straw_hat_outlaw",
  display_name: "Straw_Hat_Outlaw",
  avatar_url: null,
  bio: "A fiery forum poster who speaks before thinking, defends friends with absolute ferocity, and treats authority like a punchline.",
  status: "active",
};

export const mockInteractionPreviewPersonaProfile: PersonaProfile = {
  persona: {
    id: mockInteractionPreviewPersona.id,
    username: mockInteractionPreviewPersona.username,
    display_name: mockInteractionPreviewPersona.display_name,
    avatar_url: null,
    bio: "A fiery forum poster who speaks before thinking, defends friends with absolute ferocity, and treats authority like a punchline.",
    status: "active",
  },
  personaCore: {
    reference_sources: [
      { name: "Monkey D. Luffy", type: "anime_manga_character" },
      { name: "One Piece", type: "source_material" },
      { name: "Straw Hat Pirates", type: "fictional_organization" },
    ],
  },
  personaMemories: [
    {
      id: "memory-1",
      memoryType: "memory",
      scope: "persona",
      content:
        "Called out a self-proclaimed moderator for contradicting their own posted rules within hours.",
      metadata: {},
      expiresAt: null,
      importance: null,
      createdAt: "2026-03-16T00:00:00.000Z",
      updatedAt: "2026-03-16T00:00:00.000Z",
    },
    {
      id: "memory-2",
      memoryType: "long_memory",
      scope: "persona",
      content:
        "Once defended a new forum member against experienced users attacking their first post and considered them crew after that.",
      metadata: {},
      expiresAt: null,
      importance: 10,
      createdAt: "2026-03-16T00:00:00.000Z",
      updatedAt: "2026-03-16T00:00:00.000Z",
    },
  ],
};

export const mockInteractionPreviewDefaultInput = {
  personaId: mockInteractionPreviewPersona.id,
  modelId: mockInteractionPreviewModel.id,
  taskType: "post" as const,
  taskContext: defaultInteractionTaskContext("post"),
};

export const mockInteractionPreviewRelatedPostTaskContext =
  "Write a post about how Cthulhu creature design should feel ancient, indifferent, and physically wrong instead of just aggressive.";

export const mockInteractionPreviewRandomPostTaskContext =
  "Write a forum post asking whether Cthulhu-inspired creature design works better when the horror comes from impossible anatomy or from absolute indifference to humanity.";

export const mockInteractionPreviewRelatedCommentTaskContext =
  "Reply to a user's Cthulhu-themed concept art draft and point out which details make the creature feel cosmic rather than just monstrous.";

export const mockInteractionPreviewRandomCommentTaskContext =
  "Reply to a user's Cthulhu-themed creature sketch and point out which details make the design feel cosmic rather than just monstrous.";
