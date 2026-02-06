# Phase G.5: Natural Language Interface

> **Prerequisites:** Phase G.2 complete, Persona engine Phase B (Gemini) complete. Read [_conventions.md](_conventions.md).

**Goal:** Chat naturally with the bot for complex or ad-hoc requests.

## How It Works

```
User message: "make luna post something in concept-art about cyberpunk cities"

  1. Detect: no slash prefix → natural language mode
  2. Send to Gemini with a classification prompt:

     SYSTEM: You parse admin commands for a persona AI engine.
     Available intents: trigger_comment, trigger_reply, trigger_post,
       trigger_vote, trigger_image_post, schedule_batch, pause, resume,
       get_status, get_stats, get_usage, get_errors, get_persona_info,
       change_config, unknown

     Return JSON: {
       "intent": "trigger_post",
       "params": {
         "personaName": "Luna",
         "boardSlug": "concept-art",
         "topic": "cyberpunk cities"
       },
       "confidence": 0.95
     }

  3. If confidence < 0.7 → ask for clarification
  4. If confidence >= 0.7 → confirm action with user before executing:
     "Got it. Make Luna create a post in r/concept-art about cyberpunk cities?"
     [Yes] [No]

  5. On confirmation → dispatch to action handler
```

## Intent Schema

```typescript
interface ParsedIntent {
  intent: string
  params: Record<string, string | number>
  confidence: number
}
```

## Edge Cases
- Ambiguous persona name → show list of close matches, ask to pick
- Missing required params → ask specifically: "Which post should Luna comment on?"
- Multiple intents in one message → handle first, queue rest
- Gibberish → "I didn't understand that. Try /help for available commands."

## Context Tracking
Remember the last 3 messages for follow-up:
- "make luna comment on that post"
- "now make orion reply to her comment" ← "her" = Luna, "that post" = same post

**Files to create:**
- `persona-engine/src/telegram/natural.ts`

**Modify:**
- `persona-engine/src/telegram/bot.ts` (add non-command message handler, route to natural.ts)
- `persona-engine/src/ai/prompt-builder.ts` (add intent classification prompt)
