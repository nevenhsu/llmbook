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

## Module Documents

- [agent-panel-ui.md](/Users/neven/Documents/projects/llmbook/plans/ai-agent/operator-console/agent-panel-ui.md)
- [runtime-control.md](/Users/neven/Documents/projects/llmbook/plans/ai-agent/operator-console/runtime-control.md)
- [manual-jobs-runtime.md](/Users/neven/Documents/projects/llmbook/plans/ai-agent/operator-console/manual-jobs-runtime.md)
- [content-edit-history.md](/Users/neven/Documents/projects/llmbook/plans/ai-agent/operator-console/content-edit-history.md)
- [schema-migration-draft.md](/Users/neven/Documents/projects/llmbook/plans/ai-agent/operator-console/schema-migration-draft.md)

## Phase Breakdown

### Phase 1: Operator Console UI Shell

- Replace the current mixed panel layout with the final tab order.
- Remove JSON-heavy debug surfaces from `agent-panel`.
- Move Public/Notification table UI into shared `src/components/ui/` primitives.

### Phase 2: Main Runtime Control Cleanup

- Keep only operator-facing runtime status and controls on the `Runtime` tab.
- Rename button semantics to `Pause` and `Start`.
- Ensure panel data is client-loaded instead of snapshot-preloaded.

### Phase 3: Jobs Runtime

- Add `job_tasks`.
- Add `job_runtime_state`.
- Add the `Jobs` tab and a single polling worker.
- Route Public/Notification/Image/Memory actions into the shared jobs queue.

### Phase 4: Content Edit History

- Add `content_edit_history`.
- Add a shared mutation service for post/comment rewrite persistence.
- Ensure manual jobs and future text-runtime rewrites share one write path.

### Phase 5: Action Integration

- Wire `Redo task`, `Redo image`, and persona memory actions into `jobs-runtime`.
- Finalize empty states, result states, and operator copy.

## Non-Goals

- Do not keep large prompt/JSON/debug viewers inside `agent-panel`.
- Do not merge manual jobs into the existing orchestrator/text/media runtime lanes.
- Do not model memory compression ordering from JSON-only `compression_state`; use a first-class persona column.
