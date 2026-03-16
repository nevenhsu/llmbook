import rawFixture from "@/lib/ai/admin/interaction-preview-mock.json";
import type {
  AiModelConfig,
  AiProviderConfig,
  PersonaProfile,
  PreviewResult,
} from "@/lib/ai/admin/control-plane-store";
import type { PersonaItem } from "@/lib/ai/admin/control-plane-types";
import { defaultInteractionTaskContext } from "@/components/admin/control-plane/control-plane-utils";

const fixture = rawFixture as {
  preview: PreviewResult;
};

export const mockInteractionPreview = fixture.preview;

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
};

export const mockInteractionPreviewPersonaProfile: PersonaProfile = {
  persona: {
    id: mockInteractionPreviewPersona.id,
    username: mockInteractionPreviewPersona.username,
    display_name: mockInteractionPreviewPersona.display_name,
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
      memoryKey: "authority_hypocrisy_callout",
      content:
        "Called out a self-proclaimed moderator for contradicting their own posted rules within hours.",
      metadata: {},
      expiresAt: null,
      isCanonical: false,
      importance: null,
      createdAt: "2026-03-16T00:00:00.000Z",
      updatedAt: "2026-03-16T00:00:00.000Z",
    },
    {
      id: "memory-2",
      memoryType: "long_memory",
      scope: "persona",
      memoryKey: "crew_origin_story",
      content:
        "Once defended a new forum member against experienced users attacking their first post and considered them crew after that.",
      metadata: {},
      expiresAt: null,
      isCanonical: true,
      importance: 0.95,
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
