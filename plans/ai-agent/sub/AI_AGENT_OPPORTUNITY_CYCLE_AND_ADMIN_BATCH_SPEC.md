# AI Agent Opportunity Cycle And Admin Batch Spec

## Goal

Refine the persisted `ai_opps -> opportunities -> candidates -> persona_tasks` flow with:

1. configurable runtime public-cycle limits
2. configurable public persona-match stop limits
3. deterministic public opportunity priority ordering
4. admin-page manual batch execution that processes exactly one 10-row API batch per click
5. dedupe-safe persistence so admin refresh/rerun does not double-insert tasks or double-increment matched persona counts

This spec updates runtime and admin behavior only. Preview remains fixture-backed and should continue to mirror the latest stage contract, but it does not own these persistence rules.

---

## 1. Config Changes

Add two new `ai_agent_config` keys:

### 1.1 `public_opportunity_cycle_limit`

- type: positive integer
- default: `100`
- meaning:
  - max number of public opportunities considered in one runtime cycle
  - applies to runtime only
  - does **not** constrain admin-page tables or admin manual runs

### 1.2 `public_opportunity_persona_limit`

- type: positive integer
- default: `3`
- meaning:
  - stop feeding a public opportunity into later candidate matching once it has accumulated this many unique personas
  - applies to both runtime and admin

### 1.3 Naming Rule

Use `public_opportunity_persona_limit`, not `public_opportunity_persona_target`.

---

## 2. Shared Public Opportunity Stop Rule

A public opportunity is candidate-eligible only when:

- `selected = true`
- `matched_persona_count < public_opportunity_persona_limit`

This limit is shared by runtime and admin.

This count is:

- cumulative
- monotonic
- based on unique resolved/inserted personas
- never decremented by reruns, refreshes, or group resets

---

## 3. Runtime Public Opportunity Query Rules

### 3.1 Runtime candidate set

At the start of a runtime public cycle, build the candidate set from `ai_opps` where:

- `kind = 'public'`
- and either:
  - `probability IS NULL`
  - or `selected = true AND matched_persona_count < public_opportunity_persona_limit`

### 3.2 Runtime ordering

Sort this candidate set with the exact priority:

1. `probability IS NULL` first
2. `source_created_at DESC`
3. `matched_persona_count ASC`
4. `created_at DESC`

### 3.3 Runtime limit

After sorting, apply:

- `LIMIT public_opportunity_cycle_limit`

This limited result is the full public working set for the cycle.

### 3.4 Important consequence

If there are more than `public_opportunity_cycle_limit` rows satisfying the candidate-set filter, runtime only works on the top-N rows for that cycle.

Rows outside the limit wait for later cycles.

### 3.5 Notification cycle limit

Runtime notification opportunities must also respect the same cycle-size cap:

- `public_opportunity_cycle_limit`

This means notification `Opportunities LLM` does not score an unbounded notification set in one runtime cycle.

For notification rows:

- build the notification opportunity candidate set
- order newest first
- apply `LIMIT public_opportunity_cycle_limit`
- only then pass `probability IS NULL` rows into `Opportunities LLM`

Notification rows still bypass `Candidates` after selection, but their opportunities-stage scoring budget is constrained by the same cycle limit as public.

---

## 4. Runtime Opportunities Stage Rules

### 4.1 Input set

From the runtime working set, pass only rows with:

- `probability IS NULL`

to `Opportunities LLM`.

For `public`, the working set is the limited public candidate set described above.

For `notification`, the working set is the newest-first notification set limited by `public_opportunity_cycle_limit`.

### 4.2 Batch size

- batch size is fixed at `10`
- runtime may process multiple 10-row batches in one cycle

### 4.3 Persistence rule

Each completed opportunities batch must immediately update `ai_opps`:

- `probability`
- `selected = probability > 0.5`
- prompt/model/evaluated metadata

Do not buffer all updates until the entire cycle finishes.

### 4.4 Stage boundary

Runtime must finish all `Opportunities LLM` batches for the current working set before starting `Candidates LLM`.

That means:

1. query working set
2. process all `probability IS NULL` batches
3. persist all probabilities
4. re-query eligible selected rows
5. only then run candidates

---

## 5. Runtime Candidates Stage Rules

### 5.1 Input query

After the opportunities stage finishes for the current cycle, re-query `ai_opps` using the same public-cycle ordering and limit logic, then filter for candidate processing:

- `kind = 'public'`
- `selected = true`
- `matched_persona_count < public_opportunity_persona_limit`

and also exclude rows already processed for the current public group:

- matching `(candidate_epoch, effective_group_index, batch_size)` in `ai_opp_groups`

### 5.2 Limit

The runtime candidates query must also respect:

- `LIMIT public_opportunity_cycle_limit`

This means runtime candidates does **not** run over an unbounded selected set. It stays inside the same configured cycle size.

### 5.3 Batch size

- candidates run in 10-opportunity batches
- runtime may continue through multiple batches within the same cycle

### 5.4 Persistence rule

Each completed candidates batch must immediately:

1. persist `ai_opp_groups`
2. insert `persona_tasks`
3. update `matched_persona_count`

before the next batch starts

### 5.5 Persona fallback

If a public opportunity finishes candidate resolution with no usable persona:

- no selected speakers
- or no active/non-duplicate persona after resolution

then select one random usable persona from the current reference group.

This fallback happens without re-running the LLM.

---

## 6. Admin Table Query Rules

Admin tables are not constrained by `public_opportunity_cycle_limit`.

### 6.1 Admin opportunities table

For `public`, query `ai_opps` where:

- `kind = 'public'`
- and either:
  - `probability IS NULL`
  - or `selected = true AND matched_persona_count < public_opportunity_persona_limit`

Sort with the same priority as runtime:

1. `probability IS NULL` first
2. `source_created_at DESC`
3. `matched_persona_count ASC`
4. `created_at DESC`

Do **not** apply `public_opportunity_cycle_limit`.

### 6.2 Admin candidates table input domain

Admin candidate-stage source data should follow the same shared eligibility rule:

- `selected = true`
- `matched_persona_count < public_opportunity_persona_limit`

but the page is still manually batched by the operator, not automatically drained like runtime.

---

## 7. Admin Manual Run Rules

### 7.0 Admin batch-size scope

Admin page batch number is page-local only.

Rules:

- admin page batch number does **not** write back to `ai_agent_config`
- admin page batch number is decoupled from `selector_reference_batch_size`
- changing admin batch number must not affect runtime reference-batch behavior
- changing admin batch number must not affect runtime opportunities/candidates limits

`selector_reference_batch_size` remains runtime/shared reference-batch configuration.

Admin manual run batch number is only the number of rows the page sends in one click.

### 7.1 Opportunities run

Admin `Opportunities -> Run` behavior:

- client picks the first 10 currently visible eligible rows from the ordered admin table
- client sends exactly one API request with those 10 row ids
- server processes only those ids
- server does not automatically fetch/process the next 10
- page updates after the request finishes
- next click processes the next current 10 rows

### 7.2 Candidates run

Admin `Candidates -> Run` behavior:

- client picks the first 10 currently visible eligible selected opportunities
- client sends exactly one API request with those 10 row ids
- server processes only those ids
- server does not automatically fetch/process the next 10
- page updates after the request finishes
- next click processes the next current 10 rows

### 7.3 No admin auto-chaining

Admin must not auto-call the next API batch.

One click equals one 10-row server batch.

---

## 8. Admin Page State Rules

### 8.1 Opportunities page state

After one admin `Opportunities -> Run` request completes:

- page refreshes the opportunity data from persisted `ai_opps`
- updated `Probability` and `Selected` must reflect the server result
- already-scored rows must not be re-sent by that same click

### 8.2 Candidates page state

After one admin `Candidates -> Run` request completes:

- `Candidates` rows update to reflect the resolved speaker/persona assignments from that batch
- `Tasks` rows update to reflect the save outcomes from that batch
- processed opportunities should no longer be offered for the same admin run session if they are already completed for that page state

This page-local state is an operator convenience only. It is not the final integrity guard.

---

## 9. Refresh And Rerun Safety

Admin refresh can discard page-local memory, so persistence must still prevent bad duplication.

### 9.1 Task insertion dedupe

Supabase / `inject_persona_tasks` remains the real protection against duplicate `persona_tasks` inserts.

Expected behavior:

- repeating the same public `(opportunity, persona)` insertion attempt must not create a duplicate active task
- repeating the same selected notification opportunity for the same recipient persona must also be blocked

### 9.2 matched_persona_count safety

`matched_persona_count` must only increase for new unique persona matches that were actually accepted as newly inserted downstream work.

It must **not** increase again when:

- admin refreshes the page
- admin reruns the same 10-row batch
- runtime and admin overlap on the same opportunity/persona pair
- the insert was skipped by dedupe/cooldown logic

### 9.3 Required implementation consequence

Do not update `matched_persona_count` by blindly counting candidate outputs.

Instead, tie increments to newly accepted unique downstream insertions.

---

## 10. Persistence Rules Summary

### 10.1 `ai_opps`

Source of truth for:

- normalized snapshot opportunity rows
- `probability`
- `selected`
- cumulative `matched_persona_count`
- notification processed marker

### 10.2 `ai_opp_groups`

Source of truth for:

- whether a selected public opportunity has already been processed for a given `(epoch, group, batch_size)`

Runtime uses this for group rotation.

Admin must not own or mutate runtime cursor state, but may still write candidate results for the selected manual batch if the batch truly ran.

### 10.3 `persona_tasks`

Remains downstream only.

It is not responsible for:

- opportunity ordering
- runtime group cursor
- admin page batch sequencing

It is responsible for:

- dedupe-safe task insertion
- execution queueing

---

## 11. API Contract Changes

### 11.1 Admin opportunities batch route

Route:

- `/api/admin/ai/agent/lab/opportunities/[kind]`

Input:

```json
{
  "opportunityIds": ["opp-1", "opp-2", "... up to 10"]
}
```

Rules:

- process only the supplied ids
- do not expand to the next 10 automatically
- used by admin page only

### 11.2 Admin candidates batch route

Route:

- `/api/admin/ai/agent/lab/candidates/public`

Input:

```json
{
  "opportunityIds": ["opp-1", "opp-2", "... up to 10"],
  "groupIndex": 0,
  "batchSize": 10
}
```

Rules:

- process only the supplied ids
- do not expand to the next 10 automatically
- return explicit task outcomes

Output must include:

- resolved candidate rows
- explicit task outcomes keyed by `(opportunityId, personaId)`

so the admin page can update state deterministically without reconstructing save outcomes indirectly.

---

## 12. Required Query Examples

### 12.1 Runtime public working set

Conceptual SQL:

```sql
SELECT *
FROM ai_opps
WHERE kind = 'public'
  AND (
    probability IS NULL
    OR (selected = true AND matched_persona_count < :public_opportunity_persona_limit)
  )
ORDER BY
  CASE WHEN probability IS NULL THEN 0 ELSE 1 END ASC,
  source_created_at DESC NULLS LAST,
  matched_persona_count ASC,
  created_at DESC
LIMIT :public_opportunity_cycle_limit;
```

### 12.2 Admin public table

Conceptual SQL:

```sql
SELECT *
FROM ai_opps
WHERE kind = 'public'
  AND (
    probability IS NULL
    OR (selected = true AND matched_persona_count < :public_opportunity_persona_limit)
  )
ORDER BY
  CASE WHEN probability IS NULL THEN 0 ELSE 1 END ASC,
  source_created_at DESC NULLS LAST,
  matched_persona_count ASC,
  created_at DESC;
```

No cycle limit.

---

## 13. Required Code Changes

### 13.1 Config

- `src/lib/ai/agent/config/agent-config.ts`
- `supabase/migrations/*.sql`
- `supabase/schema.sql`

Add:

- config keys
- parser support
- defaults

### 13.2 Opportunity query/store

- `src/lib/ai/agent/intake/opportunity-store.ts`

Add:

- runtime ordered+limited public working-set query
- runtime ordered+limited public selected query for candidates
- admin ordered public query without cycle limit

Replace hardcoded `3` with `public_opportunity_persona_limit`.

### 13.3 Runtime pipeline

- `src/lib/ai/agent/intake/opportunity-pipeline-service.ts`

Update:

- remove hardcoded `MAX_PUBLIC_SCORE_ROWS_PER_SYNC`
- load `public_opportunity_cycle_limit`
- load `public_opportunity_persona_limit`
- ensure opportunities stage fully completes before candidate query begins
- apply cycle limit to both runtime opportunities and runtime candidates

### 13.4 Admin page

- `src/components/admin/agent-lab/AdminAiAgentLabClient.tsx`
- `src/lib/ai/agent/intake/admin-lab-source-service.ts`
- admin lab routes

Update:

- ordered admin query
- one click -> one 10-row API call
- no client auto-loop to next batch
- remove any admin-page writeback coupling to `ai_agent_config.selector_reference_batch_size`

### 13.5 Deduped matched count

Review and fix:

- `src/app/api/admin/ai/agent/lab/save-task/route.ts`
- `src/lib/ai/agent/intake/opportunity-pipeline-service.ts`
- any matched-count update helpers in `AiOpportunityStore`

Requirement:

- only increment when a new unique persona insertion is truly accepted
- never increment from duplicate/skipped rows

---

## 14. Verification Checklist

### 14.1 Runtime

- config values load correctly from `ai_agent_config`
- runtime public working set respects `public_opportunity_cycle_limit`
- runtime opportunities stage processes only `probability IS NULL`
- runtime opportunities stage completes all batches before candidates begin
- runtime candidates query also respects `public_opportunity_cycle_limit`
- runtime selected opportunities with `matched_persona_count >= public_opportunity_persona_limit` do not enter candidates

### 14.2 Admin

- admin opportunities table ordering matches spec
- admin opportunities table is not clipped by cycle limit
- one click on `Opportunities -> Run` sends exactly one 10-row request
- one click on `Candidates -> Run` sends exactly one 10-row request
- second batch is only triggered by clicking `Run` again

### 14.3 Deduplication

- refreshing admin page does not create duplicate `persona_tasks`
- refreshing admin page does not double-increment `matched_persona_count`
- rerunning the same admin candidate batch after refresh remains safe

---

## 15. Non-Goals

This spec does **not** change:

- preview fixture behavior beyond staying contract-aligned
- notification bypass of candidates
- runtime public group cursor ownership
- `persona_tasks` role as downstream execution queue only

---

## 16. Final Behavioral Summary

### Runtime

- one cycle considers at most `public_opportunity_cycle_limit` public opportunities
- one cycle also considers at most `public_opportunity_cycle_limit` notification opportunities for opportunities scoring
- newest unscored public opportunities are prioritized first
- opportunities stage finishes all scoring for that working set
- then candidates stage runs on the selected subset from that same limited cycle scope

### Admin

- tables show the full ordered eligible set, not a cycle-limited subset
- one click only processes one 10-row batch
- no automatic next-batch chaining
- reruns and refreshes remain safe because downstream insertions dedupe and `matched_persona_count` only increments for new accepted unique persona matches
