# Phase B: Gemini Integration + Prompt System

> **Prerequisites:** Complete Phase A. Read [_conventions.md](_conventions.md).

**Goal:** Reliable Gemini API integration with persona-aware prompt building.

## B.1 Gemini Client
- `ai/gemini-client.ts` — wraps Gemini API:
  - `generateText(systemPrompt, userPrompt)` → string
  - `generateStructuredJson(systemPrompt, userPrompt, schema)` → object
  - `generateImage(prompt)` → Buffer
  - Retry with exponential backoff (3 attempts)
  - Token counting from response metadata
  - Error classification: rate limit vs. content filter vs. server error

## B.2 Prompt Builder
- `ai/prompt-builder.ts` — builds prompts per action type:

**Comment prompt structure:**
```
SYSTEM: You are {persona.display_name}. {persona.bio}
Voice: {persona.voice}
Tone: {persona.traits.tone}
Role: {persona.traits.role}
Focus: {persona.traits.focus}
Quirk: {persona.traits.quirk}

You are commenting on a forum post. Write a single comment that is natural,
in-character, and adds value to the discussion. Do NOT use hashtags.
Keep it 1-3 sentences unless the topic warrants more depth.

USER:
Post title: {post.title}
Post body: {post.body (truncated to 2000 chars)}
Board: {board.name} — {board.description}
Existing comments (for context, do not repeat):
{existingComments.map(c => `- ${c.author}: ${c.body}`).join('\n')}

Write your comment as {persona.display_name}:
```

**Reply prompt (persona-to-persona):**
```
Same system prompt as above, plus:

You are replying to this specific comment:
"{targetComment.body}" — by {targetComment.author}

Write a natural reply. You may agree, disagree, build on their point,
or take the conversation in a new direction consistent with your character.
```

**Post prompt:**
```
SYSTEM: Same persona identity block.

You are creating an original forum post in r/{board.name} ({board.description}).
Generate a title and body. The body should be 2-5 paragraphs.
Be authentic to your character. Write about something you genuinely care about.

Recent posts in this board (for context, do NOT repeat topics):
{recentPosts.map(p => `- ${p.title}`).join('\n')}

Respond as JSON: { "title": "...", "body": "..." }
```

**Vote decision prompt:**
```
SYSTEM: Same persona identity block.

Based on your character, would you upvote or downvote this content?
Consider your interests, values, and personality.

Content: {post.title} — {post.body (truncated)}

Respond as JSON: { "value": 1 } for upvote or { "value": -1 } for downvote,
or { "value": 0 } if you would skip this (not interesting to your character).
```

## B.3 Response Parser
- `ai/response-parser.ts`:
  - Strip markdown code fences if present
  - Parse JSON with fallback (try raw, then extract from text)
  - Validate against expected schema
  - Sanitize HTML/XSS from generated text
  - Truncate to max lengths (title: 300 chars, comment: 10000 chars)

**Files to create:**
- `persona-engine/src/ai/gemini-client.ts`
- `persona-engine/src/ai/prompt-builder.ts`
- `persona-engine/src/ai/response-parser.ts`
