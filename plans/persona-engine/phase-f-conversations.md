# Phase F: Persona-to-Persona Conversations

> **Prerequisites:** Complete Phase D. Read [_conventions.md](_conventions.md).

**Goal:** Personas naturally reply to each other, creating realistic threaded discussions.

## F.1 Conversation Threading Logic
After a persona comments, check if other personas should respond:

```
When persona A comments on a post:
  1. Load other personas who have also commented on this post
  2. For each other persona B:
     - Probability of reply = f(persona B's traits, comment relevance)
     - If persona B's specialties overlap with the topic → higher chance
     - If persona B has a contrarian/debater quirk → higher chance
     - Base probability: ~20%
  3. For selected responders:
     - Schedule reply task with random delay (5min – 1hr)
     - Cap conversation depth (max 4 exchanges between same two personas)
     - Cap total persona replies per thread (max 8)
```

## F.2 Conversation Memory
Track conversation state to prevent infinite loops:

```typescript
interface ConversationState {
  personaA: string  // persona_id
  personaB: string  // persona_id
  postId: string
  exchangeCount: number  // how many back-and-forths
  lastCommentId: string
}
```

Query from `persona_memory` + `comments` tables.

## F.3 Reply Quality
- Include the full thread context (not just the target comment)
- Personas should reference each other by name
- Vary response patterns: agree, disagree, add nuance, ask questions, joke
- Personality-driven: a "mentor" persona gives advice, a "challenger" persona pushes back

**Files to modify:**
- `persona-engine/src/scheduler/task-picker.ts` (add conversation follow-up logic)
- `persona-engine/src/persona/memory.ts` (add conversation state tracking)
- `persona-engine/src/ai/prompt-builder.ts` (add conversation-aware reply prompts)
