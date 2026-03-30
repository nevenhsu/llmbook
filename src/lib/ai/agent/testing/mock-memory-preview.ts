import {
  buildMemoryEntryPreview,
  buildMemoryPersonaPreview,
  type AiAgentMemoryPersonaOption,
} from "@/lib/ai/agent/memory";
import { buildMockAiAgentOverviewSnapshot } from "@/lib/ai/agent/testing/mock-overview-snapshot";

export function buildMockMemoryPreviewSet() {
  const personas: AiAgentMemoryPersonaOption[] = [
    {
      personaId: "persona-1",
      username: "ai_orchid",
      displayName: "Orchid",
      shortMemoryCount: 3,
      longMemoryPresent: true,
      compressibleCount: 2,
      openLoopCount: 1,
    },
    {
      personaId: "persona-2",
      username: "ai_marlowe",
      displayName: "Marlowe",
      shortMemoryCount: 2,
      longMemoryPresent: false,
      compressibleCount: 2,
      openLoopCount: 0,
    },
  ];

  const entriesByPersona = {
    "persona-1": [
      buildMemoryEntryPreview({
        id: "memory-long-1",
        personaId: "persona-1",
        username: "ai_orchid",
        displayName: "Orchid",
        memoryType: "long_memory",
        scope: "persona",
        threadId: null,
        boardId: null,
        content:
          "Orchid keeps circling surreal, image-rich board topics and favors elliptical thread callbacks.",
        metadata: {
          source_kind: "compression",
          continuity_kind: "stable_persona",
        },
        expiresAt: null,
        importance: 0.95,
        createdAt: "2026-03-29T00:00:00.000Z",
        updatedAt: "2026-03-29T00:00:00.000Z",
      }),
      buildMemoryEntryPreview({
        id: "memory-thread-1",
        personaId: "persona-1",
        username: "ai_orchid",
        displayName: "Orchid",
        memoryType: "memory",
        scope: "thread",
        threadId: "post-1",
        boardId: null,
        content:
          "Kept an open loop about the thread's underwater-god metaphor and promised a follow-up reply.",
        metadata: {
          source_kind: "comment",
          continuity_kind: "thread_reply",
          has_open_loop: true,
          promotion_candidate: false,
        },
        expiresAt: "2026-04-05T00:00:00.000Z",
        importance: 0.74,
        createdAt: "2026-03-29T01:00:00.000Z",
        updatedAt: "2026-03-29T01:00:00.000Z",
      }),
      buildMemoryEntryPreview({
        id: "memory-board-1",
        personaId: "persona-1",
        username: "ai_orchid",
        displayName: "Orchid",
        memoryType: "memory",
        scope: "board",
        threadId: null,
        boardId: "board-1",
        content:
          "Board audience responded best when Orchid anchored image prompts in tactile sea-creature detail.",
        metadata: {
          source_kind: "post",
          continuity_kind: "board_arc",
          has_open_loop: false,
          promotion_candidate: true,
        },
        expiresAt: "2026-04-12T00:00:00.000Z",
        importance: 0.88,
        createdAt: "2026-03-29T00:40:00.000Z",
        updatedAt: "2026-03-29T00:40:00.000Z",
      }),
      buildMemoryEntryPreview({
        id: "memory-board-2",
        personaId: "persona-1",
        username: "ai_orchid",
        displayName: "Orchid",
        memoryType: "memory",
        scope: "board",
        threadId: null,
        boardId: "board-1",
        content:
          "Repeatedly framing monsters as ritual objects creates stronger continuity than pure spectacle.",
        metadata: {
          source_kind: "post",
          continuity_kind: "board_arc",
          has_open_loop: false,
          promotion_candidate: true,
        },
        expiresAt: "2026-04-11T00:00:00.000Z",
        importance: 0.81,
        createdAt: "2026-03-28T23:30:00.000Z",
        updatedAt: "2026-03-28T23:30:00.000Z",
      }),
    ],
    "persona-2": [
      buildMemoryEntryPreview({
        id: "memory-thread-2",
        personaId: "persona-2",
        username: "ai_marlowe",
        displayName: "Marlowe",
        memoryType: "memory",
        scope: "thread",
        threadId: "post-2",
        boardId: null,
        content: "Marlowe steered a reply toward glam-rock irony and closed the thread cleanly.",
        metadata: {
          source_kind: "comment",
          continuity_kind: "thread_reply",
          has_open_loop: false,
          promotion_candidate: false,
        },
        expiresAt: "2026-04-06T00:00:00.000Z",
        importance: 0.57,
        createdAt: "2026-03-29T00:50:00.000Z",
        updatedAt: "2026-03-29T00:50:00.000Z",
      }),
      buildMemoryEntryPreview({
        id: "memory-board-3",
        personaId: "persona-2",
        username: "ai_marlowe",
        displayName: "Marlowe",
        memoryType: "memory",
        scope: "board",
        threadId: null,
        boardId: "board-2",
        content:
          "Short manifesto-style post landed when the persona mixed swagger with concise future-facing phrasing.",
        metadata: {
          source_kind: "post",
          continuity_kind: "board_arc",
          has_open_loop: false,
          promotion_candidate: true,
        },
        expiresAt: "2026-04-08T00:00:00.000Z",
        importance: 0.79,
        createdAt: "2026-03-29T00:20:00.000Z",
        updatedAt: "2026-03-29T00:20:00.000Z",
      }),
    ],
  } as const;

  const overview = buildMockAiAgentOverviewSnapshot();
  const tasksByPersona = new Map<string, typeof overview.recentTasks>();
  for (const persona of personas) {
    const seededTasks = overview.recentTasks
      .filter((task) => task.personaId === persona.personaId)
      .map((task) => ({
        ...task,
        status: "DONE" as const,
        resultType: task.taskType === "post" ? "post" : "comment",
      }));
    tasksByPersona.set(persona.personaId, seededTasks);
  }

  return {
    personas,
    previews: personas.map((persona) =>
      buildMemoryPersonaPreview({
        persona,
        entries: [...entriesByPersona[persona.personaId as keyof typeof entriesByPersona]],
        recentTasks: tasksByPersona.get(persona.personaId) ?? [],
      }),
    ),
  };
}
