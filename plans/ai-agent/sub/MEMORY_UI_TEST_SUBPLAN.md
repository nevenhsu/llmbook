# Memory UI Test Page Sub-Plan

This sub-plan defines the dedicated memory validation page under [AI_AGENT_INTEGRATION_DEV_PLAN.md](/Users/neven/Documents/projects/llmbook/plans/ai-agent/AI_AGENT_INTEGRATION_DEV_PLAN.md) and complements the current operator/runtime contracts documented in the integration plan plus the live `/admin/ai/agent-panel` implementation.

## Goal

Create a dedicated dev page for validating `ai-persona-agent` memory behavior without overloading the main operator console.

Route:

- `/preview/ai-agent-memory`

This page should cover both:

- short-memory write verification after task execution
- long-memory compression verification during Phase C

## Why Separate This From The Main Panel

Memory work has its own debugging needs:

- row-level metadata inspection
- before/after comparison of canonical `long_memory`
- compression batch selection visibility
- cleanup preview for protected vs deletable short memories

Putting all of that into the main `Memory` tab would bury the core operator workflow.

## Data Dependencies

| Source               | Why it matters                       | UI requirement                    |
| -------------------- | ------------------------------------ | --------------------------------- |
| `persona_memories`   | short/long memory state              | table, filters, before/after diff |
| `persona_tasks`      | link memory rows back to source task | source task lookup                |
| `posts` / `comments` | source content for memory rows       | source context preview            |
| `personas`           | target persona selection             | persona picker                    |
| `ai_agent_config`    | compression thresholds               | config summary                    |

## Page Sections

### 1. Persona Picker

- searchable persona selector
- summary cards:
  - short-memory count
  - long-memory present/missing
  - compressible count
  - open-loop count if derivable

### 2. Recent Short Memories

- table grouped by `scope`
- columns:
  - created time
  - `scope`
  - `importance`
  - `content`
  - `metadata.source_kind`
  - `metadata.continuity_kind`
  - `metadata.has_open_loop`
  - `metadata.promotion_candidate`
  - `expires_at`

- row detail modal:
  - full metadata JSON
  - source task
  - source post/comment preview

### 3. Latest Write Preview

For the selected task or recent memory write:

- execution input summary
- deterministic or LLM write path indicator
- generated short-memory row preview
- final persisted row if already written

This must make it easy to answer:

- what would be written
- why this scope was chosen
- why `importance` has this value

### 4. Compression Candidate Batch

- list of selected short-memory row IDs
- queue reason and priority indicators
- protected rows vs deletable rows
- current canonical long memory

### 5. Compression Output Preview

- `compression_result` JSON
- `compression_audit_result` JSON
- deterministic validation issues if any
- rendered canonical long-memory preview

### 6. Cleanup Preview

- rows that would be deleted
- rows that remain protected
- reason for protection:
  - recent active thread
  - recent active board
  - unresolved open loop

### 7. Persisted Result

After compression write:

- new canonical long-memory row
- deleted short-memory IDs
- unchanged protected rows

## Actions

- `Preview latest write`
- `Preview compression batch`
- `Run compression preview`
- `Persist compression`
- `Refresh persona memory`

## API Plan

- `GET /api/admin/ai/agent/memory/personas/[id]`
- `GET /api/admin/ai/agent/memory/personas/[id]/latest-write-preview`
- `POST /api/admin/ai/agent/memory/personas/[id]/compression-batch-preview`
- `POST /api/admin/ai/agent/memory/personas/[id]/preview-compression`
- `POST /api/admin/ai/agent/memory/personas/[id]/compress`

## Test Cases

### Short-Memory Write Test

1. Select a persona with a recent successful comment task.
2. Open `Latest Write Preview`.
3. Verify the memory row preview has:
   - `scope='thread'`
   - deterministic metadata
   - expected `importance`
4. Confirm persisted row matches preview.

### Post Memory Write Test

1. Select a persona with a recent successful post task.
2. Verify LLM memory write preview shows:
   - `content_lines`
   - semantic metadata
   - app-owned metadata
3. Confirm persisted row matches the rendered preview.

### Compression Test

1. Select a persona with enough short memories to compress.
2. Preview compression batch.
3. Run compression preview.
4. Verify:
   - output JSON shape is correct
   - audit JSON shape is correct
   - rendered long memory contains the expected sections
   - cleanup preview does not delete protected rows
5. Persist compression and confirm DB result summary.

## Full UI Test For This Page

Recommended E2E flow:

1. Open `/preview/ai-agent-memory`.
2. Select fixture-backed persona memory data.
3. Verify recent short memories table renders both `thread` and `board` rows.
4. Open a row detail modal and confirm metadata fields render.
5. Preview compression batch.
6. Run compression preview.
7. Verify JSON output, audit output, rendered canonical preview, and cleanup preview all render.
8. Persist in the guarded test environment and verify result summary.
