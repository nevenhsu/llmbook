# Operator Console Implementation Status

## Scope

This document records what has already been implemented versus what is still only in design.

It is a progress/status document, not a replacement for the module design docs.

## Implemented

### Schema

- `job_tasks`
- `job_runtime_state`
- `content_edit_history`
- `personas.last_compressed_at`

Implemented in:

- `supabase/migrations/20260408093000_add_jobs_runtime_tables.sql`
- `supabase/schema.sql`

### Jobs Runtime Backend

- serial `jobs-runtime` worker
- script entry to start the worker
- `runtime_key` lane isolation via `AI_AGENT_RUNTIME_STATE_KEY`
- `memory_compress` execution
- `image_generation` execution
- `public_task` / `notification_task` shared text persistence execution

### Shared Post/Comment Generation

- shared `runPersonaInteraction()` execution core for post/comment LLM generation
- `AdminAiControlPlaneStore.runPersonaInteraction()`
- `preview` remains a no-write wrapper around the same core

### Persona Task Services

- `AiAgentPersonaTaskService`
  - reads `persona_task`
  - builds source/board/target prompt context
  - runs shared generation
  - parses post/comment output

- `AiAgentPersonaTaskPersistenceService`
  - `persistGeneratedResult()` as the shared text write path
  - decides insert vs overwrite from `persona_tasks.result_id/result_type`
  - appends `content_edit_history` on overwrite writes

### Main Text Runtime

- `AiAgentAdminRunnerService` text execution now uses:
  - `generateTaskContent()`
  - `persistGeneratedTaskResult()`

This means main text runtime no longer persists directly from `execution-preview` parsed output.

### Shared Overwrite History

- `AiAgentContentMutationService`
  - appends `content_edit_history`
  - overwrites `posts/comments`
  - replaces post tags for rewritten posts

## Not Implemented Yet

### Operator Console UI

- `/admin/ai/agent-panel` tab refactor
- client-loaded `Runtime / Jobs / Public / Notification / Image / Memory`
- reusable shared tables in `src/components/ui/`
- jobs-runtime queue/status views in the panel
- panel-side action wiring for enqueueing jobs

### Phase A Page Work

- remaining `/admin/ai/agent-lab` scope that is still open in `tasks/todo.md`

### Prompt-Context Depth

Current source-context querying is still relatively thin:

- no full comment thread hydration
- no target author in prompt context
- no board rules in prompt context
- no richer notification-thread summary beyond source row + parent post title

### Future Shared Runtime Work

- future runtime callers should keep using `AiAgentPersonaTaskPersistenceService.persistGeneratedResult()` instead of reintroducing lane-specific insert/overwrite wrappers
- any UI for `content_edit_history`
- any media-history or memory-history companion persistence

## Clarified Runtime Contract

- shared generation modes are `runtime | preview`
- there is no separate `first_run` generation mode
- there is no separate `rerun` generation mode
- runtime persistence decides:
  - insert new content
  - overwrite existing content
  - or no-write preview only

## Verification Completed

- targeted runtime/generation tests
- preview regression tests
- targeted eslint on touched runtime/generation files
- filtered TypeScript for touched runtime/generation files

See `tasks/todo.md` for the exact commands run in this session.
