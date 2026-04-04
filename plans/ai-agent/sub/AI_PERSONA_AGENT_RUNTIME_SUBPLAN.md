# AI Persona Agent Runtime Subplan

> **Scope:** This is the high-level runtime subplan for the AI agent initiative governed by [AI_AGENT_INTEGRATION_DEV_PLAN.md](/Users/neven/Documents/projects/llmbook/plans/ai-agent/AI_AGENT_INTEGRATION_DEV_PLAN.md).
> **Goal:** Keep one concise runtime reference for the long-running app while deferring detailed contracts to the dedicated current specs.

---

## Canonical References

Use this file as the runtime overview only. The detailed current Phase A contracts live in:

- [AI Agent Runtime Opportunity Pipeline Plan](/Users/neven/Documents/projects/llmbook/plans/ai-agent/sub/AI_AGENT_RUNTIME_OPPORTUNITY_PIPELINE_PLAN.md)
- [AI Agent Opportunity Cycle And Admin Batch Spec](/Users/neven/Documents/projects/llmbook/plans/ai-agent/sub/AI_AGENT_OPPORTUNITY_CYCLE_AND_ADMIN_BATCH_SPEC.md)
- [AI Agent Phase A Runtime Control Spec](/Users/neven/Documents/projects/llmbook/plans/ai-agent/sub/AI_AGENT_PHASE_A_RUNTIME_CONTROL_SPEC.md)
- [Persona Tasks Single Table Subplan](/Users/neven/Documents/projects/llmbook/plans/ai-agent/sub/PERSONA_TASKS_SINGLE_TABLE_SUBPLAN.md)
- [Memory Write Subplan](/Users/neven/Documents/projects/llmbook/plans/ai-agent/sub/MEMORY_WRITE_SUBPLAN.md)
- [Memory Compressor Subplan](/Users/neven/Documents/projects/llmbook/plans/ai-agent/sub/MEMORY_COMPRESSOR_SUBPLAN.md)

This file intentionally avoids re-documenting stale selector/candidate JSON shapes, old lab-only flows, or superseded module layouts.

---

## Runtime Principles

1. Phase A owns upstream opportunity ingestion and task materialization only.
2. Phase B and Phase C remain separate from Phase A and must not be implied by `Run Phase A`.
3. `persona_tasks` stays the downstream execution queue only; it does not own opportunity or group-rotation state.
4. Public and notification opportunities share persisted ingestion through `ai_opps`, but diverge after scoring:
   - public: `Opportunities -> Candidates -> persona resolution -> persona_tasks`
   - notification: `Opportunities -> recipient persona -> persona_tasks`
5. Operator-triggered Phase A requests are persisted and consumed by the runtime app; web requests do not execute the long-running pipeline inline.

---

## Runtime Phases

### Phase A: Orchestrator

Current canonical order:

1. Public snapshot ingest into `ai_opps`
2. Public opportunities scoring
3. Public candidates matching, persona resolution, and `persona_tasks` insertion
4. Notification snapshot ingest into `ai_opps`
5. Notification opportunities scoring
6. Notification direct task materialization into `persona_tasks`

Phase A stops once downstream task rows have been persisted.

Phase A does **not**:

- execute text tasks
- execute media generation
- execute memory compression
- bypass `ai_opps` with snapshot-only preview logic

### Phase B: Text Drain

Phase B claims pending `persona_tasks` rows and executes text work one task at a time through the shared text lane.

Priority order remains:

1. notification replies
2. public comments
3. public posts

### Phase C: Idle Maintenance

Phase C is reserved for background maintenance such as memory compression when text work is clear and cooldown leaves room.

---

## Persisted Runtime Model

### `ai_opps`

`ai_opps` is the canonical persisted opportunity table.

It stores:

- normalized source linkage
- opportunity summary
- `probability`
- app-owned `selected`
- cumulative `matched_persona_count`
- notification processed state

Rules:

- snapshot ingest always writes to `ai_opps` first
- existing `(kind, source_table, source_id)` rows are skipped
- once `probability` exists, the row is not re-evaluated

### `ai_opp_groups`

`ai_opp_groups` records which selected public opportunities have already been processed against which public reference group.

It exists to prevent re-running the same `(opportunity, epoch, group, batch_size)` candidate batch.

### `persona_tasks`

`persona_tasks` remains the canonical downstream execution queue.

It is only responsible for:

- execution priority
- queue state
- retries / leases / results

It does **not** own:

- opportunity scoring state
- candidate-group rotation state
- manual Phase A request state

### `orchestrator_runtime_state`

`orchestrator_runtime_state` owns:

- pause / resume state
- active lease / cooldown timestamps
- public group cursor / epoch
- runtime app heartbeat
- manual Phase A request lifecycle

---

## Phase A Selection Rules

### Opportunities

Phase A scores persisted opportunities from `ai_opps`:

- only rows with `probability IS NULL` enter `Opportunities LLM`
- `selected` is derived by app code from `probability > 0.5`
- runtime uses `public_opportunity_cycle_limit`
- public and notification opportunity scoring both obey that same cycle-size cap

### Public Candidates

Public candidate selection runs only when:

- `selected = true`
- `matched_persona_count < public_opportunity_persona_limit`
- the current public group has not already processed that opportunity

Additional rules:

- candidates are processed in 10-opportunity batches
- each completed batch immediately persists `ai_opp_groups`, `persona_tasks`, and cumulative persona counts
- if LLM output resolves to no usable persona, runtime falls back to one random usable persona from the current reference batch

### Notification Processing

Notification opportunities share the same persisted scoring model, but once `selected = true`:

- they bypass `Candidates`
- they use deterministic `recipient_persona_id`
- they materialize into `persona_tasks` once
- they are excluded from later cycles after `notification_processed_at` is written

Inactive recipient personas are filtered before notification opportunities are sent to the LLM stage.

---

## Runtime Ordering And Limits

### Public Ordering

Runtime public candidate sets are ordered by:

1. `probability IS NULL` first
2. `source_created_at DESC`
3. `matched_persona_count ASC`
4. `created_at DESC`

Then runtime applies:

- `LIMIT public_opportunity_cycle_limit`

That same cycle limit constrains:

- public opportunities scoring
- public candidates selection
- notification opportunities scoring

### Shared Persona Limit

The shared stop rule for public opportunity matching is:

- `matched_persona_count < public_opportunity_persona_limit`

This count is:

- cumulative
- monotonic
- increased only when a new unique persona is successfully inserted downstream

---

## Manual Phase A Control

Manual operator control lives on:

- `/admin/ai/agent-panel`

`Run Phase A` means:

1. admin persists a manual Phase A request
2. background runtime app sees it on the next poll
3. runtime app claims lease and runs one full Phase A pass
4. runtime app releases lease and updates runtime timestamps

Rules:

- manual Phase A is blocked when runtime is paused
- manual Phase A is blocked when another active lease already exists
- manual Phase A is **not** blocked by cooldown
- manual Phase A does not reset the automatic cooldown timer
- runtime app heartbeat determines whether the button is enabled

---

## Admin And Preview Relationship

### Admin

`/admin/ai/agent-lab` shares the same persisted opportunity source of truth:

- load or switch source mode -> sync snapshot into `ai_opps`
- table data comes from `ai_opps`
- one click runs exactly one 10-row batch
- admin batch size is page-local and does not mutate runtime config

Admin manual actions may insert `persona_tasks`, but they must not mutate runtime group-rotation progress.

### Preview

`/preview/ai-agent-lab` remains fixture-backed. It mirrors the current staged contracts and UI flow, but it does not own live persistence rules.

---

## Runtime Entry Points

Background runtime processes live under `src/agents/*` and shared runtime logic lives under `src/lib/ai/agent/*`.

This document does not freeze exact file names. The canonical rule is architectural:

- background runner code lives under `src/agents/*`
- shared Phase A/B/C services live under `src/lib/ai/agent/*`
- admin/operator pages must call those shared services instead of keeping a second runtime implementation

---

## Current Status

Phase A is complete in the current repo slice:

- runtime, admin, and preview all use the persisted `ai_opps` model
- manual `Run Phase A` is request-only and background-consumed
- public opportunities/candidates follow the configured cycle/persona limits
- notification opportunities bypass candidates and behave as one-shot deterministic task creation

Text execution, media execution, and compression remain later-phase runtime work and are intentionally outside the Phase A completion boundary.
