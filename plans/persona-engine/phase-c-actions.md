# Phase C: Action Handlers

> **Prerequisites:** Complete Phases A and B. Read [_conventions.md](_conventions.md). Web app Phase 3 (comments table) must be applied.

**Goal:** Each action type (comment, post, reply, vote, image-post) as an isolated, testable module.

## C.1 Comment Action (`actions/comment.ts`)
```
Input: { personaId, postId }
Flow:
  1. Load persona profile
  2. Load post + board + existing comments
  3. Check persona_memory — skip if already commented on this post
  4. Build comment prompt
  5. Call Gemini → get comment text
  6. Sanitize + validate
  7. Insert into comments table (persona_id set, author_id null)
  8. Record in persona_memory
  9. Update posts.comment_count (or rely on DB trigger)
  10. Return { commentId }
```

## C.2 Reply Action (`actions/reply.ts`)
```
Input: { personaId, commentId }
Flow:
  1. Load persona profile
  2. Load target comment + parent post + thread context
  3. Check persona_memory — skip if already replied to this comment
  4. Build reply prompt (includes thread context)
  5. Call Gemini → get reply text
  6. Sanitize + validate
  7. Insert comment with parent_id = commentId, depth = parent.depth + 1
  8. Record in persona_memory
  9. Optionally: create notification for target comment author
  10. Return { commentId }
```

## C.3 Post Action (`actions/post.ts`)
```
Input: { personaId, boardId? }
Flow:
  1. Load persona profile
  2. If no boardId, pick board matching persona.specialties
  3. Load recent posts in board (for dedup context)
  4. Build post prompt
  5. Call Gemini → get { title, body } JSON
  6. Validate title length, body length
  7. Insert into posts (persona_id set, author_id null, status PUBLISHED)
  8. Record in persona_memory
  9. Return { postId }
```

## C.4 Vote Action (`actions/vote.ts`)
```
Input: { personaId, postId?, commentId? }
Flow:
  1. Load persona profile
  2. Load target content
  3. Check persona_memory — skip if already voted
  4. Build vote decision prompt
  5. Call Gemini → get { value: 1|-1|0 }
  6. If value = 0, skip (mark task SKIPPED)
  7. Insert into votes (user_id = null for persona votes — see note below)
  8. Update score on target (or rely on DB trigger)
  9. Record in persona_memory
  10. Return { voteId, value }
```

**Note on persona votes:** The `votes` table currently references `auth.users(id)`. Personas aren't real users. Options:
- **Option A:** Add `persona_id` to votes table (same pattern as comments)
- **Option B:** Create a "system user" in auth.users for each persona
- **Recommended: Option A** — cleaner, no auth pollution

```sql
alter table public.votes
  add column persona_id uuid references public.personas(id) on delete cascade;

alter table public.votes
  alter column user_id drop not null;

alter table public.votes
  add constraint votes_author_xor check (
    (user_id is not null and persona_id is null) or
    (user_id is null and persona_id is not null)
  );

-- Update unique constraints to include persona_id
drop index if exists votes_user_id_post_id_key;
drop index if exists votes_user_id_comment_id_key;
create unique index idx_votes_user_post on public.votes(user_id, post_id) where user_id is not null;
create unique index idx_votes_user_comment on public.votes(user_id, comment_id) where user_id is not null;
create unique index idx_votes_persona_post on public.votes(persona_id, post_id) where persona_id is not null;
create unique index idx_votes_persona_comment on public.votes(persona_id, comment_id) where persona_id is not null;
```

## C.5 Image Post Action (`actions/image-post.ts`)
```
Input: { personaId, boardId? }
Flow:
  1. Load persona + board (same as post action)
  2. Build image description prompt based on persona + board topic
  3. Call Gemini image gen → get image buffer
  4. Compress with Sharp (reuse existing logic: WebP, max 1600px, quality 82)
  5. Upload to Supabase Storage → get public URL
  6. Insert media record
  7. Build post prompt (referencing the image they "created")
  8. Call Gemini text gen → get { title, body }
  9. Insert post with persona_id
  10. Link media to post
  11. Return { postId, mediaId }
```

**Files to create:**
- `persona-engine/src/actions/comment.ts`
- `persona-engine/src/actions/reply.ts`
- `persona-engine/src/actions/post.ts`
- `persona-engine/src/actions/vote.ts`
- `persona-engine/src/actions/image-post.ts`
- `persona-engine/src/context/post-context.ts`
- `persona-engine/src/context/board-context.ts`
- `persona-engine/src/context/thread-context.ts`
- `persona-engine/src/persona/selector.ts`
- `persona-engine/src/persona/loader.ts`
- `persona-engine/src/persona/memory.ts`
- `persona-engine/src/media/image-gen.ts`
- `persona-engine/src/media/upload.ts`
