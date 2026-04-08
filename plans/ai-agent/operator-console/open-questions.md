# Operator Console Open Questions

## Purpose

This document captures the parts that are intentionally not implemented yet, or still need explicit discussion before implementation.

## 1. Operator Console UI Delivery

Still needs concrete implementation decisions for:

- `Runtime / Jobs / Public / Notification / Image / Memory` tab composition
- client-side data loading hooks per tab
- shared table primitives under `src/components/ui/`
- queue action UX
- empty / loading / error states
- row detail strategy without bringing back JSON-heavy debug UI

## 2. Jobs Tab Data Contract

The backend queue/runtime exists, but the panel-facing read contract still needs definition:

- list/query API shape for `job_tasks`
- queue summary API
- runtime state API for `job_runtime_state`
- pagination, sort, and filter behavior
- whether the `Jobs` tab needs row-level detail expansion or stays table-only

## 3. Public / Notification / Image / Memory Enqueue APIs

Design is settled at the interaction level, but the panel contracts are still open:

- exact route shape for enqueueing `public_task`
- exact route shape for enqueueing `notification_task`
- exact route shape for enqueueing `image_generation`
- exact route shape for enqueueing `memory_compress`
- whether dedupe returns the active row directly or returns an action-level status envelope

## 4. Prompt Context Depth

Current prompt context is enough for basic generation, but not yet rich.

### Current Context

- `post`
  - source post title/body
  - board name/description

- `comment`
  - source comment body
  - parent post title
  - board name/description

- `notification`
  - reuses comment/post context from canonical source ids

### Missing Context Worth Discussing

- full comment thread hydration
- target author identity
- board rules
- richer notification context summary
- whether thread context should be summarized or included raw

## 5. Main Runtime Boundaries

Main text runtime now reuses shared generation and separate persistence, but a few architectural questions remain:

- should `AiAgentAdminRunnerService` remain the runtime text entry wrapper long-term
- or should a lower-level text-runtime service call shared generation/persistence directly
- whether future overwrite-capable callers need extra metadata beyond the current `persistGeneratedResult()` contract

## 6. Content History UI

Backend history exists, but operator surface is still open:

- where history is viewed
- whether history belongs in `Jobs`, `Public`, `Notification`, or a separate detail panel
- whether diff rendering is needed or raw `previous_snapshot` is enough initially

## 7. Memory Tab Read Model

High-level decision is settled, but exact query fields still need confirmation:

- short-memory count
- long-memory present
- latest memory update
- priority score
- whether more compressor-specific hints should appear in the table

## 8. Remaining `/admin/ai/agent-lab` Scope

This turn focused on runtime/domain refactoring, not the remaining Phase A page work.

Still needs separate discussion/implementation for:

- the unfinished `agent-lab` scope tracked in `tasks/todo.md`
- any tests/UI work tied specifically to that page

## 9. Prompt Context Expansion Rules

Before adding more thread/query context, the team should decide:

- which data is canonical enough to put directly into prompt blocks
- which data should be summarized first
- acceptable token budget growth for runtime generation
- whether `preview` and `runtime` should always see the exact same context depth

## Recommendation For Next Discussion

If the next session is still backend-focused, discuss this order:

1. Jobs tab read APIs
2. enqueue action APIs
3. prompt-context expansion for comment threads

If the next session shifts to UI delivery, discuss this order:

1. tab data-loading model
2. shared table primitives
3. Jobs/Public/Notification action UX
