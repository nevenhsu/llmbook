# AI Agent Operator Console Design Index

## Goal

Refactor `/admin/ai/agent-panel` into a client-loaded operator console for Phase B admin operations, while keeping `/admin/ai/agent-lab` as the snapshot/debug surface for Phase A.

## Confirmed Decisions

- `/admin/ai/agent-lab` already owns snapshot-style inspection. `/admin/ai/agent-panel` must not preload another server snapshot.
- Final tab order is `Runtime / Jobs / Public / Notification / Image / Memory`.
- `Public` and `Notification` share one reusable table UI under `src/components/ui/`.
- Main runtime control uses operator wording:
  - `Pause`
  - `Start` = resume if paused, then request the next cycle immediately without waiting for cooldown
- Admin-triggered ad hoc work runs through a separate single-worker queue domain named `jobs-runtime`.
- `jobs-runtime` is serial only, polls every 10 seconds, and does not execute multiple jobs concurrently.
- `job_tasks` and `job_runtime_state` both carry `runtime_key`, and that key is bound to `AI_AGENT_RUNTIME_STATE_KEY` for the current process, so `global` and `local` lanes do not claim each other's rows.
- `local` is an isolated queue/control lane only; it may still write real business data.
- Jobs read the latest source rows at execution time.
- `Memory` tab is persona-aggregated, sourced from `persona_memories`, and enqueues persona-scoped jobs into `jobs-runtime`.
- `personas` should gain `last_compressed_at` so memory ordering can be based on actual successful compression time.
- Post/comment rewrite history must be modeled separately from queue/runtime control and reused by both manual jobs and future text-runtime mutations.
- Post/comment generation now has one shared execution core in `AiAgentPersonaInteractionService` (exported as `runPersonaInteraction()` for existing callers).
- Non-writing execution is unified as `preview`; persona-task generation modes are `runtime | preview`.
- `AiAgentPersonaTaskService` owns task-context construction, shared generation, and parse only.
- `AiAgentPersonaTaskPersistenceService` owns runtime text persistence:
  - `persistGeneratedResult()` as the shared write path
  - decides insert vs overwrite from persisted task metadata
  - appends `content_edit_history` only on overwrite writes
- Notification text generation reuses the shared comment-generation path; it does not use a dedicated notification-only LLM branch.

## Module Documents

- [agent-panel-ui.md](/Users/neven/Documents/projects/llmbook/plans/ai-agent/operator-console/agent-panel-ui.md)
- [runtime-control.md](/Users/neven/Documents/projects/llmbook/plans/ai-agent/operator-console/runtime-control.md)
- [manual-jobs-runtime.md](/Users/neven/Documents/projects/llmbook/plans/ai-agent/operator-console/manual-jobs-runtime.md)
- [content-edit-history.md](/Users/neven/Documents/projects/llmbook/plans/ai-agent/operator-console/content-edit-history.md)
- [schema-migration-draft.md](/Users/neven/Documents/projects/llmbook/plans/ai-agent/operator-console/schema-migration-draft.md)
- [implementation-status.md](/Users/neven/Documents/projects/llmbook/plans/ai-agent/operator-console/implementation-status.md)
- [open-questions.md](/Users/neven/Documents/projects/llmbook/plans/ai-agent/operator-console/open-questions.md)
- [shared-text-write-impact-note.md](/Users/neven/Documents/projects/llmbook/plans/ai-agent/operator-console/shared-text-write-impact-note.md)
- [prompt-block-examples.md](/Users/neven/Documents/projects/llmbook/plans/ai-agent/operator-console/prompt-block-examples.md)

## Current Status

Implemented backend/runtime pieces:

- schema + runtime lane for `job_tasks`, `job_runtime_state`, `content_edit_history`, and `personas.last_compressed_at`
- `jobs-runtime` worker + script entry
- shared post/comment overwrite history via `AiAgentContentMutationService`
- shared post/comment generation core via `AiAgentPersonaInteractionService`
- shared task-driven `post/comment` context builder via `AiAgentPersonaTaskContextBuilder`
- generation-only `AiAgentPersonaTaskService`
- runtime persistence split into `AiAgentPersonaTaskPersistenceService`
- main text runtime rewired to `generate -> persist`
- jobs-runtime text execution rewired to the same shared `generate -> persist` path

Still pending:

- any further prompt-context expansion beyond the current bounded post/thread shape

## Phase Breakdown

### Phase 1: Operator Console UI Shell

Status: implemented

- Replaced the current mixed panel layout with the final tab order.
- Removed JSON-heavy debug surfaces from `/admin/ai/agent-panel`.
- Added shared Public/Notification table UI and supporting primitives under `src/components/ui/`.

### Phase 2: Main Runtime Control Cleanup

Status: implemented

- Kept only operator-facing runtime status and controls on the `Runtime` tab.
- Panel/UI contracts now use `Pause` and `Start`.
- `/admin/ai/agent-panel` now loads data client-side instead of snapshot-preloading.

### Phase 3: Jobs Runtime

Status: implemented

- Add `job_tasks`.
- Add `job_runtime_state`.
- Added the `Jobs` tab and retained the single polling worker.
- Routed Public/Notification/Image/Memory actions into the shared jobs queue.

### Phase 4: Content Edit History

Status: backend implemented for overwrite flows

- Add `content_edit_history`.
- Add a shared mutation service for post/comment rewrite persistence.
- Ensure manual jobs and future text-runtime rewrites share one write path.
- Keep history read/view UI out of the current operator-console scope.
- Treat `/admin/ai/agent-lab` as already complete for this plan; no remaining Phase A page work is tracked here.

### Phase 5: Action Integration

Status: implemented for first operator-console delivery

- Wired `Redo task`, `Redo image`, and persona memory actions into `jobs-runtime`.
- Added first-pass empty/loading/error states and operator copy.

## Non-Goals

- Do not keep large prompt/JSON/debug viewers inside `agent-panel`.
- Do not merge manual jobs into the existing orchestrator/text/media runtime lanes.
- Do not model memory compression ordering from JSON-only `compression_state`; use a first-class persona column.
