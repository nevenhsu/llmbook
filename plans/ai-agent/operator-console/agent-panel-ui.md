# Agent Panel UI Design

## Scope

This document defines only the operator-facing information architecture and page composition for `/admin/ai/agent-panel`.

It does not define runtime state internals, queue worker behavior, or content history persistence details.

## Page Role

`/admin/ai/agent-panel` is the admin operator console for Phase B and ad hoc admin operations.

`/admin/ai/agent-lab` remains the snapshot/debug surface for Phase A and deeper inspection.

## Data Loading

- The page should render an authenticated shell only.
- No server snapshot preload via `AiAgentOverviewStore().getSnapshot()`.
- Each tab loads its own data client-side.
- Polling should be limited to tabs that need live runtime state.

## Final Tab Order

1. `Runtime`
2. `Jobs`
3. `Public`
4. `Notification`
5. `Memory`

## Tab Responsibilities

### Runtime

- Main AI runtime status
- Main AI runtime controls
- Queue summary for the main runtime domains
- Minimal recent-state visibility

### Jobs

- Shared queue view for all admin manual jobs
- Manual-jobs runtime state
- Manual-jobs controls
- Status/result visibility for ad hoc work triggered from other tabs
- Queue execution status must be visible in the table UI, not hidden inside a detail view
- `Status` should be one merged cell that shows:
  - the execution-state badge
  - queue/finished timing as secondary text
  - state-specific information color treatment
- Failed rows should expose their error text directly in the table, showing `-` when no error exists
- Row actions should distinguish:
  - `Clone`: create a new `job_tasks` row with the same payload
  - `Retry`: requeue the same errored `job_tasks` row instead of cloning it

### Public

- Public task table
- Redo action for completed rows only
- Queue-first ordering and pagination

### Notification

- Notification task table
- Redo action for completed rows only
- Queue-first ordering and pagination

### Memory

- Persona-aggregated table derived from `persona_memories`
- Persona-scoped `Run` action that enqueues a memory job into `jobs-runtime`
- Table ordering should prioritize personas that have gone the longest without successful compression

## Dedicated Admin Image Queue Page

Image queue inspection and rerun no longer belong inside `/admin/ai/agent-panel`.

Approved target:

- dedicated route: `/admin/ai/image-queue`
- dedicated admin page for media/image queue operations
- separate from `jobs-runtime`
- separate from `Runtime / Jobs / Public / Notification / Memory`

Responsibilities:

- media queue table
- inline thumbnail preview beside the image URL target when `imageUrl` is present
- `Rerun` is active only for rows that already have a generated image
- `Rerun` should go back into the LLM image queue directly, not into `jobs-runtime`
- rerun should regenerate the image and overwrite the Supabase `media` image URL
- no image edit history requirement

## Shared Table UI

Public and Notification should share one reusable table component in `src/components/ui/`.

Shared behaviors:

- queue rows first, then completed rows
- within each group, newest relevant timestamp first for queue/task views
- 10 rows per page
- consistent status badges
- consistent action cell layout
- consistent empty/loading/error states

Jobs and the dedicated image queue page may reuse the same table shell primitives, but their columns and actions remain domain-specific.

Important boundary:

- image queue actions are not part of `jobs-runtime`
- image queue belongs to the dedicated image/media queue domain
- `/admin/ai/agent-panel` should not continue carrying the image queue as a tab

## Memory Table Shape

The `Memory` tab should not expose raw `persona_memories` rows as the primary table unit.

Primary row unit:

- persona
- long-memory present
- short-memory count
- latest memory update
- `last_compressed_at`
- compression priority hint
- `Run`

Query ordering:

- `last_compressed_at asc nulls first`
- then `priorityScore desc`
- then stable persona sort

Interaction rule:

- `Run` never executes inline from the `Memory` tab
- `Run` inserts a persona-scoped job into the shared `Jobs` runtime queue

Persona cell:

- reuse existing persona UI presentation patterns instead of inventing a dedicated Memory-only cell
- prefer shared persona avatar/name/username rendering that can be reused across admin tables

## UI Constraints

- Remove JSON-heavy cards, prompt viewers, and low-level artifact viewers from `agent-panel`.
- Favor small operator summaries and row actions over debug detail panes.
- If deeper inspection is needed later, link outward or add row-level detail views without restoring the old panel shape.
