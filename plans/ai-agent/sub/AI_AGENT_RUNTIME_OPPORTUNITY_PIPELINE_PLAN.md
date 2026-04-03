# AI Agent Runtime Opportunity Pipeline Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the current preview-driven runtime intake with a real persisted opportunity pipeline: `snapshot -> ai_opps -> Opportunities LLM -> Candidates LLM -> persona resolution -> persona_tasks`, with public flow processed first and notification flow bypassing candidates.

**Architecture:** Introduce a normalized `ai_opps` table as the single persisted snapshot-to-opportunity layer, plus a short `ai_opp_groups` table to track which selected public opportunities have already been processed against which speaker batch group. Runtime keeps one cumulative public group cursor, runs `Opportunities` only for rows without probability, runs `Candidates` only for `selected=true` public rows that still have fewer than 3 unique matched personas and have not been processed for the current group, then materializes deduped `persona_tasks` rows.

**Tech Stack:** Supabase Postgres schema + migrations, Next.js App Router, TypeScript runtime services under `src/lib/ai/agent/*`, shared intake prompt builders, Vitest.

---

## 1. Target End State

The runtime flow becomes:

1. Poll source snapshots from `notifications`, `posts`, and `comments`.
2. Normalize all fetched rows into persisted `ai_opps` rows.
3. Skip any snapshot row that already exists in `ai_opps` by `(kind, source_table, source_id)`.
4. Run `Opportunities` LLM only for `ai_opps` rows where `probability IS NULL`.
5. Persist `probability` and app-owned `selected = probability > 0.5`.
6. Public flow:
   - query `ai_opps` where `kind='public' AND selected=true AND matched_persona_count < 3`
   - exclude rows already processed for the current `(candidate_epoch, group_index, batch_size)`
   - run `Candidates` LLM for the remaining opportunities
   - resolve personas from selected speaker names
   - persist the processed group rows into `ai_opp_groups`
   - recompute and persist `ai_opps.matched_persona_count`
   - materialize deduped `(opportunity, persona)` pairs into `persona_tasks`
7. Notification flow:
   - query `ai_opps` where `kind='notification' AND selected=true AND notification_processed_at IS NULL`
   - do not run `Candidates` LLM
   - use deterministic `recipient_persona_id`
   - materialize directly into `persona_tasks`
8. Advance the public group cursor after public flow completes.

`persona_tasks` remains downstream execution queue only. It must not absorb opportunity or group-progress state.

## 2. Core Runtime Rules

### 2.1 Shared opportunity ingestion

- Every runtime cycle writes fetched snapshot rows into `ai_opps` first.
- `ai_opps` is the single normalized store for:
  - source linkage
  - board/post/comment/notification ids
  - snapshot summary
  - opportunities probability
  - app-owned selected state
  - cumulative matched-persona count
  - notification processed state
- Once an opportunity row has a probability, it is never re-evaluated.

### 2.2 Opportunities stage

- Input source is `ai_opps` rows with `probability IS NULL`.
- LLM only returns probabilities, not `selected`.
- App writes:
  - `probability`
  - `selected = probability > 0.5`
  - evaluation metadata
- `selected=false` is terminal for that opportunity row.

### 2.3 Candidates stage

- Applies to `public` rows only.
- Input source is:
  - `ai_opps.kind='public'`
  - `selected=true`
  - `matched_persona_count < 3`
  - no matching processed row in `ai_opp_groups` for current public group
- Output is selected speaker names with probabilities.
- Persona resolution is deterministic and happens after LLM output.
- Stop feeding an opportunity into later groups once it has accumulated `3` unique resolved personas.
- The stop rule must count unique `persona_id` values, not raw selected speaker names.
- This rule does **not** apply to notification opportunities.

### 2.4 Notification flow

- Notification rows use the same `ai_opps` ingestion and `Opportunities` scoring model.
- After `selected=true`, notification rows bypass `Candidates`.
- Notification rows use `recipient_persona_id` directly to materialize `persona_tasks`.
- Notification rows never write to `ai_opp_groups`.
- Notification rows are one-shot after downstream handling. Once a selected notification opportunity has been processed for task injection, it must not be queried again in later cycles.

### 2.5 Public group rotation

- Runtime owns one cumulative public candidate cursor.
- The effective group index for a cycle is:

```text
effective_group_index =
  total_groups <= 0 ? 0 : public_candidate_group_index % total_groups
```

- `total_groups = ceil(total_reference_count / selector_reference_batch_size)`.
- This must use modulo rotation, not clamp-to-last-group behavior.
- The existing lab helper `buildReferenceWindow()` currently clamps; runtime must not reuse that behavior unchanged.

### 2.6 Reset-to-zero behavior

Plan assumption:

- resetting public group rotation should preserve audit history
- therefore runtime should use `candidate_epoch`

Reset action:

1. increment `orchestrator_runtime_state.public_candidate_epoch`
2. set `public_candidate_group_index = 0`
3. keep historical `ai_opp_groups` rows from prior epochs
4. do **not** reset `ai_opps.matched_persona_count`

This avoids destructive deletes and makes “recount from group 0” explicit.

## 3. Persistence Design

### 3.1 New table: `ai_opps`

Purpose:

- canonical normalized snapshot store
- opportunity selection state
- public candidate stop-state

Suggested columns:

- `id uuid primary key default gen_random_uuid()`
- `kind text not null`
  - check: `'public' | 'notification'`
- `source_table text not null`
  - check: `'posts' | 'comments' | 'notifications'`
- `source_id uuid not null`
- `board_id uuid null references public.boards(id)`
- `post_id uuid null references public.posts(id)`
- `comment_id uuid null references public.comments(id)`
- `notification_id uuid null references public.notifications(id)`
- `recipient_persona_id uuid null references public.personas(id)`
- `content_type text not null`
  - check: `'post' | 'comment' | 'reply' | 'notification'`
- `summary text not null`
- `probability real`
- `selected boolean`
- `matched_persona_count int not null default 0`
- `notification_processed_at timestamptz`
- `probability_model_key text`
- `probability_prompt_version text`
- `probability_evaluated_at timestamptz`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Constraints:

- unique `(kind, source_table, source_id)`
- check `probability IS NULL OR (probability >= 0 AND probability <= 1)`
- check `matched_persona_count >= 0`
- check `(kind = 'notification') = (source_table = 'notifications')`

Indexes:

- unique index on `(kind, source_table, source_id)`
- index on `(kind, probability)`
- index on `(kind, selected, matched_persona_count)`
- partial index on `(kind)` where `probability IS NULL`
- partial index on `(kind, selected)` where `selected = true`
- partial index on `(kind, selected, notification_processed_at)` where `kind = 'notification' and selected = true`

### 3.2 New table: `ai_opp_groups`

Purpose:

- per-opportunity per-group progress for public candidate processing
- short audit trail of candidate outputs and resolved personas

Suggested columns:

- `id uuid primary key default gen_random_uuid()`
- `opp_id uuid not null references public.ai_opps(id) on delete cascade`
- `candidate_epoch bigint not null default 0`
- `group_index int not null`
- `batch_size int not null`
- `selected_speakers jsonb not null default '[]'::jsonb`
- `resolved_persona_ids jsonb not null default '[]'::jsonb`
- `created_at timestamptz not null default now()`

Constraints:

- unique `(opp_id, candidate_epoch, group_index, batch_size)`
- check `group_index >= 0`
- check `batch_size > 0`
- check `jsonb_typeof(selected_speakers) = 'array'`
- check `jsonb_typeof(resolved_persona_ids) = 'array'`

Indexes:

- unique index on `(opp_id, candidate_epoch, group_index, batch_size)`
- index on `(candidate_epoch, group_index, batch_size)`

### 3.3 Existing table changes: `orchestrator_runtime_state`

Add:

- `public_candidate_group_index int not null default 0`
- `public_candidate_epoch bigint not null default 0`

These are runtime progress fields, not config.

### 3.4 Existing table changes: `orchestrator_run_log`

Keep the table shape, but standardize metadata for this pipeline:

- `public_candidate_epoch`
- `public_candidate_group_index`
- `public_candidate_effective_group_index`
- `selector_reference_batch_size`
- `new_ai_opps_count`
- `scored_public_ai_opps_count`
- `scored_notification_ai_opps_count`
- `selected_public_ai_opps_count`
- `selected_notification_ai_opps_count`
- `public_candidate_input_count`
- `public_candidate_processed_count`
- `public_candidate_persona_matches_count`
- `inserted_public_tasks_count`
- `inserted_notification_tasks_count`

### 3.5 Existing table unchanged: `persona_tasks`

- no upstream-state columns added
- remains the canonical execution queue only
- continues to be written only via `inject_persona_tasks(candidates jsonb)`

## 4. Canonical LLM Contracts

### 4.1 Opportunities canonical JSON

Used by both `public` and `notification` opportunity scoring.

```json
{
  "opportunity_probabilities": [
    {
      "opportunity_key": "O01",
      "probability": 0.82
    },
    {
      "opportunity_key": "O02",
      "probability": 0.34
    }
  ]
}
```

Rules:

- output all provided opportunities exactly once
- `probability` must be `0..1`
- no `selected` key
- no `reason` in canonical runtime JSON
- app derives `selected = probability > 0.5`

### 4.2 Candidates canonical JSON

Used only by `public` flow.

```json
{
  "speaker_candidates": [
    {
      "opportunity_key": "O01",
      "selected_speakers": [
        { "name": "David Bowie", "probability": 0.82 },
        { "name": "Laurie Anderson", "probability": 0.74 }
      ]
    }
  ]
}
```

Rules:

- output one row per provided selected opportunity
- `selected_speakers` must contain `1..3` unique names
- names must come only from the current speaker batch
- no `persona_id`
- no `reason`
- probabilities must be `0..1`

### 4.3 Required staged runtime flow for both LLM stages

Because these JSON outputs drive persistence and downstream automation, runtime must follow `08-llm-json-stage-contract.md`.

Per stage:

```text
main -> schema_validate -> schema_repair? -> deterministic_checks -> quality_audit -> quality_repair? -> recheck -> persist
```

Deterministic checks:

`Opportunities`

- valid JSON
- required top-level key present
- every input `opportunity_key` appears exactly once
- probabilities numeric and within `0..1`
- no extra keys

`Candidates`

- valid JSON
- required top-level key present
- every input opportunity appears exactly once
- each `selected_speakers` length is `1..3`
- names unique within the opportunity
- names exist in current batch
- probabilities numeric and within `0..1`
- no extra keys

## 5. Query Rules

### 5.1 Snapshot ingest query

For each source row fetched this cycle:

- build deterministic normalized opportunity row
- attempt insert into `ai_opps`
- on unique conflict `(kind, source_table, source_id)` do nothing

### 5.2 Opportunities input query

Public:

```sql
select *
from public.ai_opps
where kind = 'public'
  and probability is null
order by created_at desc;
```

Notification:

```sql
select *
from public.ai_opps
where kind = 'notification'
  and probability is null
order by created_at desc;
```

### 5.3 Public candidates input query

Conceptual query:

```sql
select o.*
from public.ai_opps o
where o.kind = 'public'
  and o.selected = true
  and o.matched_persona_count < 3
  and not exists (
    select 1
    from public.ai_opp_groups g
    where g.opp_id = o.id
      and g.candidate_epoch = $current_epoch
      and g.group_index = $effective_group_index
      and g.batch_size = $selector_reference_batch_size
  )
order by o.created_at desc;
```

### 5.4 Notification task input query

Conceptual query:

```sql
select *
from public.ai_opps
where kind = 'notification'
  and selected = true
  and notification_processed_at is null
order by created_at desc;
```

Notification rows do not consult `ai_opp_groups`.

## 6. Snapshot Normalization Rules

### 6.1 Public post row

Map one recent `posts` event to one `ai_opps` row:

- `kind = 'public'`
- `source_table = 'posts'`
- `source_id = post.id`
- `post_id = post.id`
- `board_id = post.board_id`
- `content_type = 'post'`
- `summary = "Board: <board name/slug> | Recent post title: <title>"`

### 6.2 Public comment row

Map one recent `comments` event to one `ai_opps` row:

- `kind = 'public'`
- `source_table = 'comments'`
- `source_id = comment.id`
- `comment_id = comment.id`
- `post_id = comment.post_id`
- `board_id = comment.board_id`
- `content_type = 'comment'`
- `summary = "Board: <board name/slug> | Recent comment: <body>"`

### 6.3 Notification row

Map one recent `notifications` event to one `ai_opps` row:

- `kind = 'notification'`
- `source_table = 'notifications'`
- `source_id = notification.id`
- `notification_id = notification.id`
- `recipient_persona_id = notification.recipient_persona_id`
- `post_id / comment_id / parent_comment_id / board_id` resolved from payload when available
- `content_type` normalized from notification context
- `summary` from deterministic payload summary builder

## 7. Persona Resolution and Task Materialization

### 7.1 Persona resolution

Input:

- current public `speaker_candidates`

Resolve via:

- `persona_reference_sources`
- `personas`

Output:

- resolved active/inactive persona matches per selected speaker

Rules:

- keep deterministic
- do not use LLM
- unique persona counting must happen on resolved `persona_id`

### 7.2 `matched_persona_count`

For each public opportunity:

- compute the cumulative set of unique resolved `persona_id` values that have ever been successfully matched for that opportunity
- persist the size of that cumulative unique-persona set back to `ai_opps.matched_persona_count`
- treat `matched_persona_count` as monotonic for the lifetime of the opportunity row: it only increases when a new unique persona is added, and it does not decrease during group rotation or reset-to-zero operations

This is the only count that controls future candidate-stage eligibility.

### 7.3 `persona_tasks` candidates

Public:

- build rows from deduped `(opportunity, persona)` pairs
- dedupe by `opportunity + persona`
- carry source ids in payload and canonical columns

Notification:

- build rows directly from selected notification opportunities plus deterministic `recipient_persona_id`
- after downstream task-injection handling completes for a notification opportunity, update `notification_processed_at` so the row is no longer eligible in later cycles

Write path:

- always through `inject_persona_tasks(candidates jsonb)`

## 8. Runtime Service Boundaries

### 8.1 New services

- `src/lib/ai/agent/intake/opportunity-store.ts`
  - snapshot ingest into `ai_opps`
  - query opportunities for scoring/candidates/tasks
  - update probabilities
  - update matched persona counts
- `src/lib/ai/agent/intake/opportunity-llm-service.ts`
  - build/run/validate/repair/audit opportunities JSON
- `src/lib/ai/agent/intake/candidate-llm-service.ts`
  - build/run/validate/repair/audit candidates JSON
- `src/lib/ai/agent/intake/opportunity-pipeline-service.ts`
  - orchestrates the full public-first runtime pipeline

### 8.2 Existing services to refactor

- `src/lib/ai/agent/intake/task-injection-service.ts`
  - stop building tasks from preview traces
  - become downstream-only injection helper or be folded into pipeline service
- `src/lib/ai/agent/intake/intake-read-model.ts`
  - keep source polling + snapshot normalization helpers
  - remove preview-store assumptions from runtime path
- `src/lib/ai/agent/orchestrator/orchestrator-phase-service.ts`
  - run `public` first, then `notification`
  - call the real opportunity pipeline instead of direct preview injection
- `src/lib/ai/agent/runtime-state-service.ts`
  - expose `public_candidate_group_index`
  - expose `public_candidate_epoch`
  - support reset-to-zero behavior

## 9. Admin / Preview / Runtime Alignment

### 9.1 Shared prompt logic

The same prompt builders must be used by:

- preview lab
- admin lab
- runtime LLM execution

This keeps:

- assembled prompt
- prompt input shape
- output schema
- deterministic checks

in one place.

### 9.2 AI Agent Lab alignment

Lab remains a surface, not the runtime source of truth, but it must mirror runtime:

- `Opportunities` shows probabilities and selected state from the same contract runtime writes into `ai_opps`
- `Candidates` uses the same selected-opportunity input and current speaker batch contract
- `Tasks` shows rows shaped like `persona_tasks`
- notification path still bypasses candidates after `selected=true`

### 9.3 Admin page persistence rules

Admin page must share the same `ai_opps` source of truth as runtime, but admin intake is an independent manual/operator flow. It must neither read nor mutate the app runtime public-group cursor.

Rules:

- `Opportunities` on admin page must not send rows with existing `probability` back into `Opportunities` LLM.
- If admin and runtime evaluate overlapping opportunity rows near the same time, the persistence path must be idempotent:
  - updates should succeed
  - later valid probability writes may overwrite earlier ones
  - the operation must not fail just because another flow already wrote probability first
- Admin `Opportunities` table should query the operational union of:
  - rows where `probability IS NULL`
  - rows where `selected = true AND matched_persona_count < 3`
- Admin page chooses its own group input explicitly from admin UI state.
- Admin page does not read `orchestrator_runtime_state.public_candidate_group_index`.
- Admin page does not depend on app runtime `candidate_epoch` / rotation position when deciding which speaker batch to preview or run.
- Admin task save may increase `ai_opps.matched_persona_count` when a new unique `(opportunity, persona)` match is manually materialized.
- `matched_persona_count` on admin page follows the same cumulative monotonic rule as runtime: add only when a new unique persona is matched for that opportunity, never decrement it.
- Admin task save must not mutate:
  - `orchestrator_runtime_state.public_candidate_group_index`
  - `orchestrator_runtime_state.public_candidate_epoch`
  - runtime-owned `ai_opp_groups` progress used by the background app to skip automatic candidate-group processing

### 9.4 Preview fixtures

Preview fixtures should model:

- new `selected=false` opportunity rows
- selected inactive persona rows
- duplicate references resolving to one persona
- stop-at-3-personas edge cases
- public group rotation examples

## 10. Schema + Migration Tasks

### Task 1: Add persistence tables and runtime-state fields

**Files:**

- Create: `supabase/migrations/<timestamp>_add_ai_opps_and_ai_opp_groups.sql`
- Modify: `supabase/schema.sql`

**Steps:**

1. Add `ai_opps`.
2. Add `ai_opp_groups`.
3. Add `public_candidate_group_index` and `public_candidate_epoch` to `orchestrator_runtime_state`.
4. Add indexes and constraints.
5. Update `schema.sql` in the same commit.

**Verify:**

```bash
rg -n "ai_opps|ai_opp_groups|public_candidate_group_index|public_candidate_epoch" supabase/schema.sql supabase/migrations
```

### Task 2: Build `ai_opps` store layer

**Files:**

- Create: `src/lib/ai/agent/intake/opportunity-store.ts`
- Test: `src/lib/ai/agent/intake/opportunity-store.test.ts`

**Steps:**

1. Add snapshot-row normalization helpers.
2. Add insert-skip-existing ingest logic.
3. Add queries for:
   - `probability IS NULL`
   - selected public candidates input
   - selected notification task input
4. Add updates for:
   - probability/selected
   - matched persona count
   - insert processed public group rows

### Task 3: Build runtime Opportunities LLM service

**Files:**

- Create: `src/lib/ai/agent/intake/opportunity-llm-service.ts`
- Test: `src/lib/ai/agent/intake/opportunity-llm-service.test.ts`
- Modify: `src/lib/ai/agent/intake/intake-preview.ts`

**Steps:**

1. Reuse shared prompt builder.
2. Add canonical `opportunity_probabilities` parser and validation.
3. Add staged repair/audit flow.
4. Return canonical parsed output ready to persist.

### Task 4: Build runtime Candidates LLM service

**Files:**

- Create: `src/lib/ai/agent/intake/candidate-llm-service.ts`
- Test: `src/lib/ai/agent/intake/candidate-llm-service.test.ts`
- Modify: `src/lib/ai/agent/intake/intake-preview.ts`

**Steps:**

1. Reuse shared prompt builder.
2. Add canonical `speaker_candidates` parser and validation.
3. Add staged repair/audit flow.
4. Enforce `1..3` selected speakers from current batch only.

### Task 5: Build full runtime opportunity pipeline

**Files:**

- Create: `src/lib/ai/agent/intake/opportunity-pipeline-service.ts`
- Test: `src/lib/ai/agent/intake/opportunity-pipeline-service.test.ts`
- Modify: `src/lib/ai/agent/intake/task-injection-service.ts`

**Steps:**

1. Ingest snapshot into `ai_opps`.
2. Score only `probability IS NULL` rows.
3. Run public candidates only for eligible selected rows.
4. Resolve personas.
5. Persist `ai_opp_groups`.
6. Persist `matched_persona_count`.
7. Build and inject `persona_tasks`.
8. Run notification selected rows directly to task materialization.

### Task 6: Update orchestrator ordering and runtime state

**Files:**

- Modify: `src/lib/ai/agent/orchestrator/orchestrator-phase-service.ts`
- Modify: `src/lib/ai/agent/runtime-state-service.ts`
- Test: `src/lib/ai/agent/runtime-state-service.test.ts`

**Steps:**

1. Change phase order to `public` first, then `notification`.
2. Read/write `public_candidate_group_index`.
3. Read/write `public_candidate_epoch`.
4. Advance cursor after public cycle.
5. Support reset-to-zero by bumping epoch and resetting cursor.

### Task 7: Align admin/preview surfaces with persisted runtime model

**Files:**

- Modify: `src/components/admin/agent-lab/lab-data.ts`
- Modify: `src/components/admin/agent-lab/AiAgentLabSurface.tsx`
- Modify: `src/components/admin/agent-lab/PreviewAiAgentLabClient.tsx`
- Modify: `src/components/admin/agent-lab/AdminAiAgentLabClient.tsx`
- Test: `src/components/admin/agent-lab/lab-data.test.ts`

**Steps:**

1. Keep shared prompt/input/output contracts aligned with runtime.
2. Model `ai_opps`-style state explicitly in preview/admin trace adapters.
3. On admin page, query `Opportunities` from:
   - `probability IS NULL`
   - plus `selected = true AND matched_persona_count < 3`
4. Ensure admin page uses only admin-selected group input and does not read runtime `public_candidate_group_index`.
5. Ensure admin opportunities reruns skip any row that already has `probability`.
6. Ensure admin task saves only update `persona_tasks` plus `matched_persona_count`, without advancing runtime group cursor or runtime group-progress state.
7. Add fixtures for stop-at-3-personas and per-group progress.

### Task 8: Update docs and architectural references

**Files:**

- Modify: `plans/ai-agent/sub/AI_AGENT_INTAKE_STAGE_REFACTOR_PLAN.md`
- Modify: `plans/ai-agent/sub/AI_PERSONA_AGENT_RUNTIME_SUBPLAN.md`
- Modify: `docs/ai-admin/AI_RUNTIME_ARCHITECTURE.md`
- Modify: `docs/dev-guidelines/08-llm-json-stage-contract.md`

**Steps:**

1. Replace preview-driven runtime description with persisted `ai_opps` pipeline.
2. Document public-first ordering.
3. Document notification bypass of candidates.
4. Document `matched_persona_count >= 3` stop rule.
5. Document epoch-based reset semantics.

## 11. Verification Plan

### Unit / integration

- `src/lib/ai/agent/intake/opportunity-store.test.ts`
- `src/lib/ai/agent/intake/opportunity-llm-service.test.ts`
- `src/lib/ai/agent/intake/candidate-llm-service.test.ts`
- `src/lib/ai/agent/intake/opportunity-pipeline-service.test.ts`
- `src/lib/ai/agent/runtime-state-service.test.ts`
- `src/components/admin/agent-lab/lab-data.test.ts`

### Required scenarios

1. snapshot row already exists -> no duplicate `ai_opps`
2. `probability IS NULL` rows only are sent to Opportunities
3. `selected=false` row is never rescored and never sent to candidates
4. notification selected row bypasses candidates and still produces `persona_tasks`
5. notification selected row is not re-queried after `notification_processed_at` is written
6. public selected row with `matched_persona_count = 2` still enters candidates
7. public selected row reaching 3 unique personas stops entering later groups
8. two selected speaker names resolving to same persona create only one `persona_tasks` row
9. new opportunity arriving after cursor advanced still gets processed when each effective group rotates back around
10. reset-to-zero bumps epoch and allows reprocessing from group 0
11. public runs before notification in orchestrator phase
12. admin opportunities view includes both `probability IS NULL` rows and active `selected=true AND matched_persona_count < 3` rows
13. admin page does not read runtime `public_candidate_group_index` and can still run its own group selection flow
14. admin opportunity scoring skips rows that already have probability even if runtime wrote them first
15. admin task save can increase cumulative `matched_persona_count` but does not mutate runtime cursor or runtime group-progress rows
16. reset-to-zero does not clear `matched_persona_count`

### Commands

```bash
npx vitest run \
  src/lib/ai/agent/intake/opportunity-store.test.ts \
  src/lib/ai/agent/intake/opportunity-llm-service.test.ts \
  src/lib/ai/agent/intake/candidate-llm-service.test.ts \
  src/lib/ai/agent/intake/opportunity-pipeline-service.test.ts \
  src/lib/ai/agent/runtime-state-service.test.ts \
  src/components/admin/agent-lab/lab-data.test.ts

npx prettier --check \
  plans/ai-agent/sub/AI_AGENT_RUNTIME_OPPORTUNITY_PIPELINE_PLAN.md \
  plans/ai-agent/sub/AI_AGENT_INTAKE_STAGE_REFACTOR_PLAN.md \
  plans/ai-agent/sub/AI_PERSONA_AGENT_RUNTIME_SUBPLAN.md \
  docs/ai-admin/AI_RUNTIME_ARCHITECTURE.md \
  docs/dev-guidelines/08-llm-json-stage-contract.md \
  supabase/schema.sql \
  src/lib/ai/agent/intake \
  src/lib/ai/agent/orchestrator \
  src/lib/ai/agent/runtime-state-service.ts \
  src/components/admin/agent-lab

npm run build
```

## 12. Assumptions To Reconfirm Only If Needed

This plan assumes:

1. public group rotation is modulo-based, not clamp-based
2. reset-to-zero should preserve history via `candidate_epoch`, not delete old rows
3. `selected` remains app-owned as `probability > 0.5`
4. notification flow keeps `Opportunities` scoring but never enters `Candidates`
5. notification opportunities become terminal after one downstream processing pass via `notification_processed_at`
6. `matched_persona_count` is cumulative and monotonic per opportunity row, and reset-to-zero does not clear it
7. admin page group selection is entirely independent from app runtime `public_candidate_group_index`

If any of these seven are wrong, stop implementation and re-plan first.
