# Jobs Runtime Design

## Scope

This document defines the queue/runtime domain for admin-triggered jobs.

It covers:

- queue model
- runtime state model
- worker behavior
- job types
- enqueue rules from other tabs

It does not define post/comment history storage details.

## Purpose

Provide one shared serial runtime for low-frequency admin-triggered work without mixing that work into the main orchestrator/text/media runtime lanes.

## Current Implementation Status

Implemented:

- `job_tasks` queue and `job_runtime_state`
- serial polling worker and script entry
- `memory_compress`
- `image_generation`
- text persistence jobs for `public_task` and `notification_task`

Not implemented yet:

- panel-side enqueue/actions UI
- jobs-runtime read API for the `Jobs` tab
- richer operator result/detail views

## Naming

- runtime domain: `jobs-runtime`
- queue table: `job_tasks`
- runtime state table: `job_runtime_state`

## Supported Job Types

Initial job types:

- `public_task`
- `notification_task`
- `image_generation`
- `memory_compress`

These job types may read from:

- `persona_tasks`
- `media`
- `persona_memories`
- `personas`
- `posts`
- `comments`

## Text Job Execution Architecture

For `public_task` and `notification_task`, the current execution shape is:

1. load the latest `persona_task`
2. build source/board/target context
3. call shared `runPersonaInteraction()`
4. parse post/comment output
5. hand off to persistence

Persistence is shared:

- `persistGeneratedResult()`
- checks `persona_tasks.result_id/result_type` right before writing
- inserts a new `post/comment` when the task has no persisted target yet
- overwrites an existing `post/comment` and appends `content_edit_history` when the task already points at a persisted target
- updates `persona_tasks.result_id/result_type` and marks the task `DONE` after either write path

Important boundary:

- `AiAgentPersonaTaskService` is generation-only
- `AiAgentPersonaTaskPersistenceService` owns Supabase writes
- notification text generation reuses the shared comment-generation path

## `job_tasks` Proposed Schema

Suggested first version:

- `id`
  - uuid primary key

- `runtime_key`
  - text lane key
  - defaults to `global`
  - mirrors `AI_AGENT_RUNTIME_STATE_KEY` for the current process
  - isolates queue claim and runtime control between `global` and `local`

- `job_type`
  - text enum-like field
  - values:
    - `public_task`
    - `notification_task`
    - `image_generation`
    - `memory_compress`

- `subject_kind`
  - the primary resource locator used to load the latest runtime input
  - values:
    - `persona_task`
    - `media`
    - `persona`

- `subject_id`
  - primary row id used to load the latest runtime input at execution time

- `dedupe_key`
  - normalized active-job fingerprint
  - used only to block duplicate `PENDING` / `RUNNING` rows for the same job intent

- `status`
  - values:
    - `PENDING`
    - `RUNNING`
    - `DONE`
    - `FAILED`
    - `SKIPPED`

- `payload`
  - jsonb
  - minimal operator/runtime context only
  - should not freeze full source content

- `requested_by`
  - admin user id or stable operator actor label

- `scheduled_at`
  - when the job becomes eligible to run

- `started_at`
  - nullable

- `completed_at`
  - nullable

- `retry_count`
  - non-negative int

- `max_retries`
  - non-negative int

- `lease_owner`
  - nullable
  - current worker id while `RUNNING`

- `lease_until`
  - nullable

- `error_message`
  - nullable text

- `created_at`
  - row creation time

- `updated_at`
  - row update time

## Minimal Payload Direction

`payload` should stay small and job-specific.

Examples:

- `public_task`
  - `{ "persona_task_id": "..." }`
- `notification_task`
  - `{ "persona_task_id": "..." }`
- `image_generation`
  - `{ "media_id": "..." }`
- `memory_compress`
  - `{ "persona_id": "..." }`

The worker should still load the latest source rows from the database instead of trusting payload snapshots.

## Recommended Constraints

- active dedupe should be enforced for `PENDING` and `RUNNING` rows only
- redo must create a fresh row after terminal completion
- `subject_kind + subject_id` must be coherent with `job_type`
- `scheduled_at <= now()` is required before claim

## Execution Model

- single worker only
- one claimed job at a time
- poll every 10 seconds
- no parallel execution
- latest source rows are read at execution time

Admin button clicks do not directly run LLM work inline in the web request.

Instead:

1. the tab action inserts a `job_tasks` row
2. the worker picks it up on the next poll
3. the worker executes the job
4. the job finishes as `DONE` or `FAILED`

No explicit wake endpoint is required for the initial version because a 10-second poll interval is acceptable.

The worker does not execute LLM work inline in the HTTP request path.
Only the background worker process claims and executes queued jobs.

## Queue Ordering

`Jobs` tab ordering:

- pending/running rows first
- terminal rows after that
- newest relevant timestamp first within each group

Queue claim ordering:

- oldest eligible `PENDING` job first
- stable tiebreak by creation time

## Active Dedupe

Jobs should use active-only dedupe.

Rule:

- if the same job fingerprint already exists as `PENDING` or `RUNNING`, do not insert a new row
- instead return the existing active row to the caller
- once that row reaches a terminal state, a new `Redo` action may insert a fresh row
- active dedupe must be scoped by `runtime_key`

Suggested fingerprint basis:

- `public_task`: `job_type + persona_task_id`
- `notification_task`: `job_type + persona_task_id`
- `image_generation`: `job_type + media_id`
- `memory_compress`: `job_type + persona_id`

## Runtime State

`job_runtime_state` should minimally support:

- `runtime_key`
- `paused`
- `lease_owner`
- `lease_until`
- `runtime_app_seen_at`
- `last_started_at`
- `last_finished_at`
- `updated_at`

Each state row controls one queue lane keyed by `runtime_key`.

`global` and `local` must never share one ambiguous runtime state row.

This is enough to power:

- `Pause`
- `Start`
- online/offline state
- currently running vs idle state

## Runtime Key Rule

- `job_tasks.runtime_key` and `job_runtime_state.runtime_key` must use the same lane key
- that lane key is bound to `AI_AGENT_RUNTIME_STATE_KEY`
- each worker claims only rows from its own `runtime_key`
- `global` and `local` therefore cannot claim the same queue row
- `local` is still allowed to write real business data when its execution path does so

## Local Testing Note

- `AI_AGENT_MANUAL_LLM=true` may still be used during local testing of text-producing jobs
- it remains a process-wide manual LLM switch, not the formal queue/runtime contract
- non-writing generation mode is `preview`; there is no separate `test` mode anymore

## Enqueue Sources

### Public

- `Redo task` or future admin first-run inserts `public_task`
- only allowed for completed rows

### Notification

- `Redo task` or future admin first-run inserts `notification_task`
- only allowed for completed rows
- notification text generation still uses the same comment LLM flow as other comment-style tasks

### Image

- `Redo image` or future admin first-run inserts `image_generation`
- only allowed for completed image rows

### Memory

- `Run` inserts `memory_compress`
- enqueue unit is `persona_id`, not a single memory row id

## Memory-Specific Rule

The `Memory` tab reads from `persona_memories`, but the runtime job unit is persona-scoped.

The queue payload should therefore persist a persona reference, not a raw memory-row reference, for compression jobs.

The corresponding persona list should be queried in oldest-successful-compression-first order using `personas.last_compressed_at`, not loaded arbitrarily and re-sorted only in the client.

## Jobs Tab Columns

The `Jobs` tab should stay intentionally narrow.

Columns:

- `Job`
- `Target`
- `Status`
- `Finished`
- `Actions`

Column intent:

- `Job`
  - human-readable job type label such as `Public Task`, `Notification Task`, `Image`, or `Memory`
- `Target`
  - task jobs: render the target task as a URL
  - image jobs: show the current image URL
  - memory jobs: render the target persona using shared persona UI
- `Status`
  - render queue execution state from `job_tasks.status`
  - values include `PENDING`, `RUNNING`, `DONE`, `FAILED`, `SKIPPED`
- `Finished`
  - terminal completion time or `-` for non-terminal rows
- `Actions`
  - terminal rows may expose `Redo`

Do not add dedicated `Source` or `Requested` columns in the initial operator table.

## Status Meaning

`status` remains the backend queue execution state that powers the dedicated `Status` column in the operator table.

Values:

- `PENDING`
- `RUNNING`
- `DONE`
- `FAILED`
- `SKIPPED`

## Future Extension

If more admin-triggered tasks are added later, they should join this runtime only if they remain:

- low-frequency
- serial-safe
- clearly operator-triggered

Do not expand `jobs-runtime` into a generic replacement for the main AI runtime.
