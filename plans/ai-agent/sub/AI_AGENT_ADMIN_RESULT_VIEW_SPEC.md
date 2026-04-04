# AI Agent Admin Result View Spec

## Goal

Define the admin-page behavior for `/admin/ai/agent-lab` after the Phase A persistence refactor.

This spec is about:

1. how admin page data loads from `ai_opps`
2. how `Opportunities -> Run` updates table state
3. how notification rows auto-route into `persona_tasks`
4. how `Candidates` and `Tasks` tables should reflect those results
5. how resave behavior works after auto-save

This spec does **not** redefine runtime cycle rules. Runtime behavior remains governed by:

- [AI_AGENT_OPPORTUNITY_CYCLE_AND_ADMIN_BATCH_SPEC.md](/Users/neven/Documents/projects/llmbook/plans/ai-agent/sub/AI_AGENT_OPPORTUNITY_CYCLE_AND_ADMIN_BATCH_SPEC.md)
- [AI_AGENT_PHASE_A_RUNTIME_CONTROL_SPEC.md](/Users/neven/Documents/projects/llmbook/plans/ai-agent/sub/AI_AGENT_PHASE_A_RUNTIME_CONTROL_SPEC.md)

---

## 1. Core UI Model

Admin `Opportunities` table uses a **result view**, not a pure queue view.

Meaning:

- page load data may start from the currently eligible persisted rows
- after one manual `Run`, the rows processed in that batch remain visible in the table
- those processed rows must show the newly written `probability` / `selected`
- the next `Run` must skip already-scored rows and process the next `probability IS NULL` batch

Therefore:

- admin does **not** remove processed rows immediately from the table just because they no longer match the next batch input
- batch input and visible table rows are not identical concepts

---

## 2. Admin Load Semantics

### 2.1 Page load

On page load for each source mode:

1. ingest latest snapshot rows into `ai_opps`
2. query persisted admin table rows from `ai_opps`
3. render the page from persisted data

Page load does **not** auto-run `Opportunities LLM`.

### 2.2 Source-mode refresh

Refreshing the source-mode dataset follows the same rule:

1. ingest snapshot
2. query persisted rows
3. do not auto-run `Opportunities LLM`

### 2.3 Loading UI

`Opportunities` table must expose loading UI while the admin source-mode dataset is being refreshed.

This loading state covers:

- initial page load
- source-mode refresh
- any manual refresh path that re-ingests and re-queries `ai_opps`

---

## 3. Admin Query Rules

### 3.1 Public opportunities base query

Public admin base rows come from persisted `ai_opps` using the admin rules defined in the shared cycle spec.

The server-side base query still represents the "currently eligible/unscored" persisted set.

### 3.2 Notification opportunities base query

Notification admin base rows must be:

- `kind = 'notification'`
- `probability IS NULL`
- ordered by:
  1. `coalesce(source_created_at, created_at) DESC`
- capped with:
  - `LIMIT 1000`

Notification admin base query should not include already-scored rows.

### 3.3 Result-view merge rule

Because the page is a result view:

- visible `Opportunities` rows = `server base rows + current-session completed rows`

This merge must:

- dedupe by `recordId`
- prefer the latest known state for processed rows
- preserve the newly written `probability` and `selected`

This is what allows:

- batch input = only unscored rows
- visible table = includes the rows just processed

without losing result visibility.

---

## 4. Opportunities Run Rules

### 4.1 Shared click behavior

For both `public` and `notification`:

- one click = one API call
- one API call = at most 10 rows
- client must not auto-chain the next batch

### 4.2 Batch input

Batch input is always the first 10 rows from the currently visible/admin-eligible rows where:

- `probability IS NULL`

Rows that already have `probability` must not be sent to `Opportunities LLM`.

### 4.3 Post-run result view behavior

After one successful `Opportunities -> Run`:

- processed rows stay visible in `Opportunities` table
- processed rows show the new `probability`
- processed rows show the new `selected`
- next click only processes the next `probability IS NULL` rows

---

## 5. Notification Opportunities Run Rules

Notification has deterministic recipient identity, so it should auto-route further than public.

### 5.1 Inactive recipient prefilter

Before calling `Opportunities LLM`, the batch must prefilter by recipient persona activity:

- if `recipient_persona_id` is inactive:
  - do not send row to `Opportunities LLM`
  - directly persist:
    - `probability = 0`
    - `selected = false`

### 5.2 Active recipients

For active recipient rows:

- run `Opportunities LLM`
- persist `probability`
- persist `selected = probability > 0.5`

### 5.3 Auto-route after scoring

For notification rows where:

- recipient persona is active
- `selected = true`

admin page must immediately:

1. build notification task candidates
2. insert into `persona_tasks`
3. mark task save outcomes
4. reflect those outcomes in `Candidates` and `Tasks`

Notification admin flow does **not** require a separate `Candidates -> Run`.

`Opportunities -> Run` is enough to:

- score the notification opportunity
- determine selection
- auto-save the downstream task if selected

### 5.4 Probability persistence rule

Notification `Opportunities -> Run` must always persist probability outcomes for the processed batch:

- inactive recipient -> `probability = 0`
- active recipient + LLM scored -> `probability = scored value`

No processed notification batch row should remain without a persisted probability result.

---

## 6. Candidates Table Rules

### 6.1 Public

Public `Candidates` table continues to reflect public candidate-stage output and task-materialization flow.

### 6.2 Notification

Notification `Candidates` table is a direct-recipient reflection surface.

After notification `Opportunities -> Run`:

- rows with `selected = true` should show the direct recipient persona as matched
- rows with `selected = false` should remain unassigned

This table is not waiting on a second LLM stage.

---

## 7. Tasks Table Rules

### 7.1 Auto-save visibility

After notification `Opportunities -> Run` auto-saves selected rows:

- `Tasks` table must immediately show the inserted/saved outcomes
- save state must no longer remain `idle`

### 7.2 Resave policy

`Tasks` table manual save actions become retry-only behavior:

- `success` rows are not saveable again
- `Save` / `Save All` should only target failed rows

This applies after auto-save and after public candidate auto-save as well.

### 7.3 Save-state meaning

Save-state semantics:

- `idle`: task row exists but no insert attempt yet
- `saving`: current request in flight
- `success`: insert accepted / task saved
- `failed`: insert attempt completed but failed or was skipped in a way that still needs operator attention

For notification auto-save, selected rows should normally land directly in:

- `success`
- or `failed`

not remain `idle`

---

## 8. API Contract Expectations

The admin opportunities batch route should return more than `{ ok: true }`.

It should return canonical batch results sufficient to update all three tables.

Suggested response shape:

```json
{
  "kind": "notification",
  "opportunityResults": [
    {
      "opportunityId": "opp_1",
      "probability": 0.78,
      "selected": true
    },
    {
      "opportunityId": "opp_2",
      "probability": 0,
      "selected": false
    }
  ],
  "notificationAutoRoute": {
    "candidateRows": [
      {
        "opportunityId": "opp_1",
        "personaId": "persona_1"
      }
    ],
    "taskRows": [
      {
        "opportunityId": "opp_1",
        "personaId": "persona_1",
        "taskId": "task_1"
      }
    ],
    "taskOutcomes": [
      {
        "opportunityId": "opp_1",
        "personaId": "persona_1",
        "inserted": true,
        "taskId": "task_1",
        "skipReason": null,
        "status": "PENDING",
        "errorMessage": null
      }
    ]
  }
}
```

The critical property is:

- admin client must not have to infer notification auto-save results indirectly from a later refresh

The response should directly support updating:

- `Opportunities`
- `Candidates`
- `Tasks`

in the same click result.

---

## 9. Acceptance Criteria

### 9.1 Notification result view

Given a notification admin page with unscored rows:

- page load ingests snapshot and queries persisted rows
- `Opportunities` table shows only unscored notification rows
- click `Run`
- first 10 rows are processed
- inactive persona rows receive `probability = 0`
- active selected rows auto-save to `persona_tasks`
- processed rows remain visible in `Opportunities` table with their new probabilities
- `Candidates` table updates immediately
- `Tasks` table updates immediately with save states
- next click processes the next unscored 10 rows

### 9.2 Retry-only task save

Given notification/public rows already auto-saved:

- `Save` / `Save All` do not resend `success` rows
- only failed rows are retried

### 9.3 Public result view

Given public unscored rows:

- click `Opportunities -> Run`
- first 10 `probability IS NULL` rows are scored
- those rows remain visible with their new probabilities
- next click processes the next unscored 10 rows
