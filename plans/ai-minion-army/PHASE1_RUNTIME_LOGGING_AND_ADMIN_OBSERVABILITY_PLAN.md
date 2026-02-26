# Phase1 Runtime Logging + Admin Observability Plan

## Objective

Persist AI runtime/worker logs to DB and provide an admin-only page to inspect:

- current runtime health
- circuit breaker state
- queue/task execution status
- provider/tool/prompt runtime events

Scope must be minimal-intrusion and must not break existing phase1 flow semantics.

## Non-Goals

- No changes to policy/safety/review gate semantics.
- No replacement of existing task queue lifecycle.
- No broad UI redesign outside admin observability page.

## Constraints

- Reuse existing orchestrator/memory/soul/runtime modules.
- Runtime logging failure must be best-effort and must not block main execution.
- Follow migration rule: any `supabase/migrations/*.sql` change must update `supabase/schema.sql` in same commit.

## Deliverables

1. DB schema for runtime events + worker status.
2. Runtime sinks wiring (provider/tool/prompt/execution + worker heartbeat + breaker state).
3. Admin APIs for status/events/tasks.
4. Admin page `/admin/ai/runtime` for observability.
5. Tests (unit/integration/regression).
6. Verification script `ai:runtime:verify`.
7. Docs updates (`README`, `REASON_CODES`, phase1 README).

## Data Model

### Table: `ai_runtime_events`

Columns:

- `id uuid primary key default gen_random_uuid()`
- `layer text not null` (`provider_runtime|tool_runtime|model_adapter|execution|dispatcher|worker`)
- `operation text not null` (`CALL|FALLBACK|RETRY|TOOL_CALL|TOOL_LOOP|TASK|HEARTBEAT|BREAKER`)
- `reason_code text not null`
- `entity_id text not null`
- `task_id uuid null`
- `persona_id uuid null`
- `worker_id text null`
- `metadata jsonb not null default '{}'::jsonb`
- `occurred_at timestamptz not null`
- `created_at timestamptz not null default now()`

Indexes:

- `(occurred_at desc)`
- `(layer, occurred_at desc)`
- `(reason_code, occurred_at desc)`
- `(entity_id, occurred_at desc)`

### Table: `ai_worker_status`

Columns:

- `worker_id text primary key`
- `agent_type text not null` (`phase1_reply_runner` etc.)
- `status text not null` (`RUNNING|IDLE|DEGRADED|STOPPED`)
- `circuit_open boolean not null default false`
- `circuit_reason text null`
- `last_heartbeat timestamptz not null`
- `current_task_id uuid null`
- `metadata jsonb not null default '{}'::jsonb`
- `updated_at timestamptz not null default now()`

Indexes:

- `(status, updated_at desc)`
- `(circuit_open, updated_at desc)`

## Runtime Integration Plan

### 1) Event sink persistence

- Add `SupabaseRuntimeEventSink` under `src/lib/ai/observability/`.
- Keep existing in-memory recorder behavior; append DB sink write in best-effort mode.
- Persist events for:
  - provider runtime (`invokeLLM`)
  - tool runtime (`generateTextWithToolLoop`)
  - prompt/model adapter fallback events
  - execution-level breaker transitions

### 2) Circuit breaker observability

- In `ReplyExecutionAgent`, emit events when breaker opens.
- Add method/readout for breaker snapshot so runner can publish status heartbeat.
- Update runner loop to upsert `ai_worker_status` at fixed interval and at lifecycle boundaries.

### 3) Task health rollups

- Reuse `persona_tasks` + `task_transition_events` for counters.
- Add lightweight query helpers for status summary used by admin API.

## Admin API Plan

### `GET /api/admin/ai/runtime/status`

Returns:

- worker status rows
- queue counts (`PENDING/RUNNING/IN_REVIEW/DONE/SKIPPED/FAILED`)
- degraded flags (e.g. breaker open)
- last event timestamp

### `GET /api/admin/ai/runtime/events`

Filters:

- `layer`
- `reasonCode`
- `entityId`
- `from/to`
- cursor pagination

### `GET /api/admin/ai/runtime/tasks`

Returns recent tasks with:

- task status
- error/skip reason
- lease owner/timestamps
- linked latest runtime event summary

Security:

- admin-only route guard, consistent with existing admin endpoints.

## Admin UI Plan

Page: `/admin/ai/runtime`

Sections:

1. Runtime Health cards
   - overall status
   - breaker open/closed
   - last heartbeat per worker
2. Queue Status panel
   - counts + trend delta
3. Runtime Event stream
   - table with filters (layer/reason/time)
4. Recent Tasks panel
   - task status + reason + deep link to related events

Behavior:

- polling every 10-15s
- manual refresh
- URL query sync for filters

## Test Plan

### Unit

- runtime event sink mapping/serialization
- worker status upsert logic
- breaker event emit conditions

### Integration

- admin APIs: auth guard, filters, pagination, shape
- runner updates worker status + event write path

### Regression

- phase1 execution remains functional when DB event writes fail
- policy/safety/review gate semantics unchanged

## Verification Commands

- `npm test -- src/lib/ai/observability/*.test.ts`
- `npm test -- src/agents/phase-1-reply-vote/orchestrator/reply-execution-agent.test.ts`
- `npm test -- src/app/api/admin/ai/runtime/*.test.ts`
- `npm run ai:runtime:verify`

`ai:runtime:verify` should print:

- current worker status (circuit open/closed)
- active provider/model route
- queue counts
- recent runtime events summary

## Rollout Strategy

1. Ship DB schema + sink code behind best-effort writes.
2. Enable worker heartbeat/status updates.
3. Ship admin APIs.
4. Ship admin UI page.
5. Run verification and capture results in `tasks/todo.md` review section.

## Acceptance Criteria

- Runtime events are queryable from DB with expected fields.
- Admin can see breaker state without checking process logs.
- Admin can identify stuck/failed/skipped tasks quickly.
- Existing phase1 flow continues to run without behavior regression.
- Tests and verify script pass.

## Next Session Execution Checklist

- [ ] Create migration + schema sync for `ai_runtime_events` and `ai_worker_status`.
- [ ] Implement runtime event DB sink and wire into recorder.
- [ ] Emit breaker/worker heartbeat status from execution runner.
- [ ] Implement admin runtime APIs (status/events/tasks).
- [ ] Build `/admin/ai/runtime` page.
- [ ] Add tests and `ai:runtime:verify`.
- [ ] Update docs and add review evidence.
