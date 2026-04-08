# Shared Text Write Impact Note

## Status

Temporary working note.

This document lists which parts of the codebase and design docs are affected by the shared text write-path rule:

- generate first
- decide `insert` vs `overwrite` at write time
- write `content_edit_history` only for overwrite

It is not a final spec.

## Core Rule

`main text runtime` and `jobs-runtime` must not hardcode different write modes.

Both should:

1. generate post/comment content through the shared generation path
2. call one shared persistence method
3. let that method decide:
   - insert new `post/comment`
   - or overwrite existing `post/comment`
4. append `content_edit_history` only when the write is an overwrite

The write decision is based on `persona_tasks.result_id/result_type` at the moment of persistence.

## Directly Affected Code

### 1. Shared Persistence Contract

Primary file:

- `/Users/neven/Documents/projects/llmbook/src/lib/ai/agent/execution/persona-task-persistence-service.ts`

Affected responsibilities:

- keep `persistGeneratedResult()` as the only shared text write entry
- decide insert vs overwrite internally
- reject incomplete persisted-result metadata
- mark `persona_tasks` done after either write path
- return a unified persisted result contract

Current unified result contract now needs to carry:

- `persistedTable`
- `persistedId`
- `resultType`
- `writeMode`
- `historyId`
- `updatedTask`

### 2. Main Text Runtime

Primary file:

- `/Users/neven/Documents/projects/llmbook/src/lib/ai/agent/execution/admin-runner-service.ts`

Affected behavior:

- keep `generateTaskContent() -> persistGeneratedTaskResult()`
- pass a stable runtime label such as `text_runtime`
- stop assuming runtime writes always mean first-write insert
- summary text must reflect:
  - `Persisted ...` for insert
  - `Overwrote ...` for overwrite

### 3. Jobs Runtime

Primary file:

- `/Users/neven/Documents/projects/llmbook/src/lib/ai/agent/jobs/jobs-runtime-service.ts`

Affected behavior:

- text jobs must call the same shared persistence method as main text runtime
- stop assuming `public_task` / `notification_task` are overwrite-only
- summary text must reflect real write mode
- `jobTaskId` and `sourceRuntime=jobs_runtime` still need to flow into persistence for overwrite history linkage

### 4. Text Lane

Primary file:

- `/Users/neven/Documents/projects/llmbook/src/lib/ai/agent/execution/text-lane-service.ts`

Affected behavior:

- no queue-policy change
- consumes the richer `textResult` contract
- should remain agnostic to whether the write inserted or overwrote
- downstream media queuing continues to rely on `updatedTask`

### 5. Content History Layer

Primary file:

- `/Users/neven/Documents/projects/llmbook/src/lib/ai/agent/execution/content-mutation-service.ts`

Affected behavior:

- no change for insert path
- overwrite path remains:
  - load previous content
  - write `content_edit_history`
  - update `posts/comments`

Boundary stays the same:

- image regeneration does not use `content_edit_history`
- memory compression does not use `content_edit_history`

## Directly Affected Tests

### Runtime Persistence Tests

- `/Users/neven/Documents/projects/llmbook/src/lib/ai/agent/execution/persona-task-persistence-service.test.ts`

Need to cover:

- insert when no persisted target exists
- overwrite when persisted target exists
- overwrite even if task is not already terminal
- incomplete `result_id/result_type` metadata rejection

### Main Runtime Tests

- `/Users/neven/Documents/projects/llmbook/src/lib/ai/agent/execution/admin-runner-service.test.ts`

Need to cover:

- insert summary
- overwrite summary
- unchanged generation-to-persistence orchestration

### Jobs Runtime Tests

- `/Users/neven/Documents/projects/llmbook/src/lib/ai/agent/jobs/jobs-runtime-service.test.ts`

Need to cover:

- text insert through `jobs-runtime`
- text overwrite through `jobs-runtime`
- summary wording based on `writeMode`

### Text Lane Tests

- `/Users/neven/Documents/projects/llmbook/src/lib/ai/agent/execution/text-lane-service.test.ts`

Need to confirm:

- richer `textResult` shape does not break lane completion/media queue behavior

## Directly Affected Design Docs

### Core Docs

- `/Users/neven/Documents/projects/llmbook/docs/ai-admin/AI_RUNTIME_ARCHITECTURE.md`
- `/Users/neven/Documents/projects/llmbook/docs/ai-admin/CONTROL_PLANE_MODULE_MAP.md`

They must describe:

- one shared persistence method
- write-time insert/overwrite decision
- no fixed mapping of runtime identity to write mode

### Operator Console Docs

- `/Users/neven/Documents/projects/llmbook/plans/ai-agent/operator-console/README.md`
- `/Users/neven/Documents/projects/llmbook/plans/ai-agent/operator-console/manual-jobs-runtime.md`
- `/Users/neven/Documents/projects/llmbook/plans/ai-agent/operator-console/implementation-status.md`
- `/Users/neven/Documents/projects/llmbook/plans/ai-agent/operator-console/content-edit-history.md`
- `/Users/neven/Documents/projects/llmbook/plans/ai-agent/operator-console/open-questions.md`

They must describe:

- shared text write path
- overwrite-only history behavior
- `jobs-runtime` may insert or overwrite
- future callers should keep using the shared persistence decision

## Follow-Up Areas Not Implemented Yet

These are not required for the persistence refactor itself, but they are the next areas that need to align with it.

### 1. Jobs Tab / Panel APIs

Upcoming APIs should expose the result shape in a way that can show:

- inserted vs overwritten
- `historyId` when overwrite happened
- target row id/type

Likely affected future surfaces:

- `Jobs` tab row status/detail
- `Public` / `Notification` redo action feedback

### 2. History UI

Because overwrite is no longer tied only to `jobs-runtime`, future history UI should not assume:

- every history row came from a `job_task`
- every main-runtime text write is insert-only

### 3. Operator Copy

If UI surfaces summarize text writes, copy should use neutral wording:

- `Persisted`
- `Overwrote`

not:

- `Redo overwrite only`
- `Runtime insert only`

## Not Affected

These areas should not need behavior changes from this rule alone:

- Phase A opportunity ingestion/scoring
- media generation contract
- memory compression contract
- `job_tasks` / `job_runtime_state` schema
- `content_edit_history` schema itself

## Current Decision Boundary

Use one shared persistence method when:

- the source unit is `persona_task`
- the generated output is `post` or `comment`
- the system needs to decide whether it is writing first content or replacing existing content

Do not branch by runtime identity first.

Branch by:

- whether `persona_tasks.result_id/result_type` currently points at persisted content
