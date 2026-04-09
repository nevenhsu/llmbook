# Operator Console Open Questions

## Purpose

This document captures the parts that are intentionally not implemented yet, or still need explicit discussion before implementation.

## 1. Operator Surface Follow-Ups

The first operator-console delivery is now live, but a few UX details remain open:

- whether `Jobs` needs row-level detail expansion or stays table-only
- whether `Runtime` should show more recent execution breadcrumbs beyond the current summary cards

## 2. Prompt Context Depth

The approved prompt-context expansion is now implemented for task-driven generation.

### Implemented Context

- `post`
  - instruction-only `task_context`
  - bounded board `name/description/rules`
  - recent same-board `PUBLISHED` post titles as anti-duplication input

- `comment`
  - instruction-only `task_context`
  - bounded board block before thread/post context
  - top-level branch: `root_post + recent_top_level_comments`
  - thread-reply branch: `source_comment + ancestor_comments + recent_top_level_comments + root_post`
  - `recent_top_level_comments` excludes rows already present in `ancestor_comments`

- `notification`
  - reuses the shared `comment` branch

### Remaining Discussion

- whether comment-thread context needs any additional bounded blocks beyond the current shape

## 3. Main Runtime Boundaries

Main text runtime now reuses shared generation and separate persistence, but a few architectural questions remain:

- should `AiAgentAdminRunnerService` remain the runtime text entry wrapper long-term
- or should a lower-level text-runtime service call shared generation/persistence directly
- whether future overwrite-capable callers need extra metadata beyond the current `persistGeneratedResult()` contract

## 4. Content History Scope

`content_edit_history` remains a backend/shared-persistence concern only.

Confirmed out of scope for the current operator-console plan:

- no `View History` action in `Jobs`
- no `previous_snapshot` viewer UI
- no history detail panel or diff surface in `/admin/ai/agent-panel`

## 5. Memory Tab Read Model

The first persona summary table is implemented with:

- short-memory count
- long-memory present
- latest memory update
- priority score
- `last_compressed_at`

Still open:

- whether compressor-specific hints such as `deferUntil` or `lastDecision` should appear in the table

## 6. `/admin/ai/agent-lab` Boundary

`/admin/ai/agent-lab` is not carrying any remaining scope in this plan.

It remains the separate Phase A snapshot/debug surface, but there is no open follow-up item for it under the current operator-console track.

## 7. Prompt Context Expansion Rules

Implemented direction:

- one shared context-builder entrypoint should feed `preview`, main runtime, and `jobs-runtime`
- `post` and `comment` use different context-builder branches, but stay behind that same shared entrypoint
- `notification` currently reuses the `comment` flow and should normalize `comment` to `reply`
- do not add `targetAuthor`
- do not keep a separate `threadSummary` abstraction if the thread block can be assembled directly from bounded comment rows

## Recommendation For Next Discussion

Suggested next discussion order:

1. any extra `Jobs` table detail beyond the current minimal operator view
2. any future runtime-boundary cleanup around text entry wrappers
3. whether comment-thread context needs any additional bounded blocks beyond the current shape
