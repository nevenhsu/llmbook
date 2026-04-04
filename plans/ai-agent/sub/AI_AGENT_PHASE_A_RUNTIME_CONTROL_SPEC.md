# AI Agent Phase A Runtime Control Spec

> Status: implemented. This document remains as the canonical reference for Phase A operator/runtime control behavior.

**Goal:** Finish the operator-facing Phase A control flow so manual runtime execution requests are persisted by admin APIs, then consumed and executed by the background runtime app exactly once per click, without overlapping with normal runtime work.

**Architecture:** Keep Phase A business logic in the persisted opportunity pipeline, but never execute that long-running work inside a web request. `runtime-control-service` owns operator-facing guard logic plus manual-request persistence, `admin-runner-service` exposes a Phase A-only operator action, and the background orchestrator app (`src/agents/orchestrator/runner.ts`) consumes pending manual requests through the same shared lease/state model as automatic runtime execution.

**Tech Stack:** Next.js App Router admin routes, TypeScript runtime services under `src/lib/ai/agent/*`, Supabase-backed `orchestrator_runtime_state`, Vitest.

---

## 1. Scope

This spec only covers **Phase A**:

- snapshot ingest
- opportunities scoring
- public candidates selection
- notification deterministic task materialization
- insertion into `persona_tasks`

This spec does **not** cover:

- `text_once`
- `media_once`
- `compress_once`
- Phase B text drain
- Phase C idle maintenance

Those later-phase controls may continue to exist in UI/service code, but this implementation pass must not expand them.

---

## 2. Canonical Meaning Of `run_phase_a`

`run_phase_a` means:

1. operator clicks `Run Phase A`
2. web/admin layer persists a manual Phase A request into runtime state
3. background runtime app sees that request on its next poll
4. background runtime app claims lease with manual intent and `allowDuringCooldown = true`
5. background runtime app runs one full Phase A pass in canonical order
6. background runtime app releases lease
7. runtime state / latest run data reflect completion timestamps and results

Canonical order inside Phase A:

1. public snapshot ingest into `ai_opps`
2. public opportunities scoring
3. public candidates matching and `persona_tasks` insertion
4. notification snapshot ingest into `ai_opps`
5. notification opportunities scoring
6. notification direct task materialization into `persona_tasks`

It must **not**:

- execute text tasks
- create media jobs
- run memory compression
- mutate non-Phase-A worker queues beyond `persona_tasks`
- run the full Phase A workload inside a web request lifecycle

---

## 3. UI Placement

Manual Phase A controls belong on:

- `/admin/ai/agent-panel`

They do **not** belong on:

- `/admin/ai/agent-lab`
- `/preview/*`

Reason:

- `agent-panel` is the runtime/operator surface
- `agent-lab` is a manual inspection and stage-debug surface
- preview pages must not trigger live runtime control

UI changes required on `/admin/ai/agent-panel`:

- show `Run Phase A`
- keep `Pause runtime` and `Resume runtime`
- disable `Run Phase A` while a control request is pending
- disable `Run Phase A` when guard says manual Phase A is blocked
- show request acceptance / blocked state in `Runtime Control Result`
- rely on runtime/latest-run data to show completed Phase A effects

---

## 4. Manual Phase A Guard Rules

Manual `run_phase_a` request submission is allowed only when:

- runtime state is available
- `paused = false`
- there is **no active lease**
- the current client is not already waiting on another control request

Manual `run_phase_a` request submission is blocked when:

- runtime state is unavailable
- runtime is paused
- another runtime lease is active

Manual `run_phase_a` is **not** blocked by:

- active cooldown

Reason:

- cooldown is a scheduler rule for automatic background execution
- cooldown does not mean a cycle is currently running
- operators must still be able to request one explicit Phase A pass when no lease is active

### 4.1 Required reason codes

Operator-facing blocked reasons:

- `runtime_state_unavailable`
- `runtime_paused`
- `lease_active`

`cooldown_active` must not block manual `run_phase_a`.

### 4.2 Summary text requirements

Use Phase A language in operator-facing summaries:

- good: `Run Phase A is available.`
- good: `Runtime is paused; resume before running Phase A.`
- good: `Runtime lease is active until ...; wait for the current Phase A run to finish.`
- good: `Manual Phase A request accepted. Runtime app will execute it next.`
- bad: `another cycle`

---

## 5. How Runtime App Learns About Manual Phase A

This manual trigger must be persisted in `orchestrator_runtime_state`, not held in web memory.

Recommended new fields:

- `manual_phase_a_requested_at timestamptz null`
- `manual_phase_a_requested_by text null`
- `manual_phase_a_request_id uuid null`
- `manual_phase_a_started_at timestamptz null`
- `manual_phase_a_finished_at timestamptz null`
- `manual_phase_a_error text null`

Only one outstanding manual request is needed at a time.

Rules:

- if a manual request is already pending, another click should be blocked or treated as no-op
- a manual request is distinct from automatic scheduling state
- these fields must be durable so page refreshes do not lose operator intent

Runtime app polling logic:

1. load `orchestrator_runtime_state`
2. if `manual_phase_a_requested_at` exists, prioritize that request over normal cooldown-gated scheduling
3. try to claim lease with `allowDuringCooldown = true`
4. if claim fails because another active lease exists, leave the manual request pending and retry next poll
5. once claimed, set `manual_phase_a_started_at`
6. run canonical Phase A
7. set `manual_phase_a_finished_at`
8. clear `manual_phase_a_requested_at / requested_by / request_id`
9. clear `manual_phase_a_error`

If Phase A fails:

- still release lease in `finally`
- set `manual_phase_a_error`
- clear the active pending request marker so the system does not wedge forever

---

## 6. Lease And Overlap Rules

The same lease model must protect both:

- background runtime execution
- manual operator-triggered Phase A execution

### 6.1 Manual request start

When operator clicks `Run Phase A`:

1. validate guard rules using current runtime state
2. if blocked, return blocked response immediately
3. if allowed, persist manual request markers in `orchestrator_runtime_state`
4. do **not** claim lease in the web layer
5. do **not** run Phase A in the web layer

### 6.2 Runtime app execution start

When background runtime app sees a pending manual request:

1. claim runtime lease with manual/runtime owner
2. use `allowDuringCooldown = true`
3. if claim fails because another owner already holds an active lease, leave request pending
4. do **not** start Phase A work unless lease claim succeeds

### 6.3 Manual run finish

After the persisted Phase A pipeline completes:

1. release runtime lease
2. clear manual request markers
3. persist completion/cooldown timestamps
4. keep latest-run/operator summary data available for UI

### 6.4 Manual run failure

If Phase A throws:

1. release runtime lease in `finally`
2. preserve already-persisted per-batch work
3. clear or mark the manual request as failed
4. surface failure in runtime/latest-run diagnostics
5. do not leave the runtime stuck in a leased state

### 6.5 Background runtime interaction

If background runtime becomes eligible while a manual Phase A request is pending:

- the manual request takes precedence
- runtime app should execute the pending manual request first

If background runtime becomes eligible while a manual Phase A run is already active:

- the active lease prevents overlap
- no second Phase A pass may start

Once manual Phase A finishes and lease is released:

- background runtime may resume normal scheduling on the next poll

---

## 7. Timestamp Rules

Manual Phase A must update runtime timestamps the same way normal runtime execution does.

At minimum:

- `last_started_at`
- `last_finished_at`
- `lease_until`
- `cooldown_until`

Additional manual-specific timestamps:

- `manual_phase_a_requested_at`
- `manual_phase_a_started_at`
- `manual_phase_a_finished_at`

This is required so operator UI and runtime diagnostics stay truthful after a manual trigger.

---

## 8. `runtime-control-service` Responsibilities

File:

- `/Users/neven/Documents/projects/llmbook/src/lib/ai/agent/runtime-control-service.ts`

This service should own:

- operator-facing guard logic
- action naming and labels
- runtime state loading
- persistence of manual Phase A request markers

It should **not** own:

- opportunities/candidates business logic
- task insertion logic
- reference-batch selection logic
- the long-running Phase A workload itself

Those stay in:

- `AiAgentOpportunityPipelineService`
- `AiAgentOrchestratorLoopService`

### 8.1 Required action surface

Public action enum for control UI:

- `pause`
- `resume`
- `run_phase_a`

### 8.2 Required execution behavior

For `run_phase_a`:

1. load runtime state
2. build guard
3. if blocked, return blocked response
4. persist manual Phase A request marker into runtime state
5. return request-accepted response to UI
6. do **not** run the long Phase A workload inline in the web server

### 8.3 Response requirements

`run_phase_a` response should summarize:

- request accepted or blocked
- current runtime state
- whether a manual request is now pending
- manual-request wording, not “job finished” wording

Completed Phase A results should come later from runtime state / latest run data after the runtime app finishes.

---

## 9. `admin-runner-service` Responsibilities

File:

- `/Users/neven/Documents/projects/llmbook/src/lib/ai/agent/execution/admin-runner-service.ts`

This service remains the operator façade for admin execution buttons, but `orchestrator_once` must now mean **request one Phase A run from runtime app**, not execute it inline.

### 9.1 Required change

Current `orchestrator_once` behavior is too broad because it still chains:

- notification/public intake
- text execution
- optional media
- compression

New required behavior:

- `orchestrator_once` submits one manual Phase A request only
- it must call the same canonical request path used by `run_phase_a`
- actual work must occur in runtime app, not the web server
- later, when runtime app completes, resulting `persona_tasks` rows reflect that Phase A pass

### 9.2 Required summary shape

`orchestrator_once` response should summarize only:

- request accepted / blocked
- current runtime state
- manual Phase A request wording

It must not claim:

- public Phase A already finished
- notification Phase A already finished
- `persona_tasks` were already inserted
- text execution happened
- media was queued/generated
- compression ran

### 9.3 Allowed preview behavior

`previewTarget("orchestrator_once")` may still describe Phase A artifacts, but it must not imply later phases run as part of this action, and it should distinguish “request Phase A” from “Phase A already completed”.

---

## 10. Runtime App Changes

Files:

- `/Users/neven/Documents/projects/llmbook/src/agents/orchestrator/runner.ts`
- `/Users/neven/Documents/projects/llmbook/src/lib/ai/agent/orchestrator/orchestrator-loop-service.ts`
- `/Users/neven/Documents/projects/llmbook/src/lib/ai/agent/runtime-state-service.ts`

Required behavior:

1. background runtime loop must check for pending manual Phase A request each poll
2. pending manual Phase A request must bypass cooldown gating
3. pending manual Phase A request must still respect active lease gating
4. successful manual Phase A execution must update normal runtime timestamps plus manual-request timestamps
5. failed manual Phase A execution must release lease and persist error state

The runtime app remains the only process that actually runs Phase A.

---

## 11. API Route Surface

### 11.1 Runtime control route

File:

- `/Users/neven/Documents/projects/llmbook/src/app/api/admin/ai/agent/runtime/[action]/route.ts`

Required action names:

- `pause`
- `resume`
- `run_phase_a`

### 11.2 Admin runner route

File:

- `/Users/neven/Documents/projects/llmbook/src/app/api/admin/ai/agent/run/[target]/route.ts`

`orchestrator_once` remains a valid runner target, but its semantics change to Phase A request-only as defined above.

---

## 12. Result Surfaces

There are now two result surfaces:

1. manual request acknowledgement
2. completed Phase A execution result

### 12.1 Manual request acknowledgement

Minimum fields:

- `requestAccepted`
- `manualPhaseARequestPending`
- `runtimeState`
- operator-facing summary string

### 12.2 Completed Phase A execution result

This should come from runtime-owned latest-run / runtime-state data and may include:

- `insertedPublicTasks`
- `insertedNotificationTasks`
- `publicScoredOpportunities`
- `notificationScoredOpportunities`
- `publicCandidateProcessed`
- `runtimeState`
- operator-facing summary string

---

## 13. Testing Requirements

### 13.1 `runtime-control-service`

Add/adjust tests for:

- `run_phase_a` allowed during active cooldown when lease is inactive
- `run_phase_a` blocked when paused
- `run_phase_a` blocked when active lease exists
- `run_phase_a` persists a manual request instead of running inline

### 13.2 runtime control route

Add/adjust tests for:

- `/api/admin/ai/agent/runtime/run_phase_a` parses and returns request-ack response

### 13.3 `AiAgentPanel`

Add/adjust tests for:

- button label is `Run Phase A`
- button disabled when paused
- button disabled when lease active
- button remains enabled during cooldown if no lease is active
- runtime control result text uses Phase A request wording

### 13.4 `admin-runner-service`

Add/adjust tests for:

- `orchestrator_once` submits manual Phase A request only
- no text/media/compression side effects are triggered
- returned summary no longer mentions those later phases

### 13.5 runtime loop

Add/adjust tests for:

- pending manual request is prioritized by runtime app
- pending manual request bypasses cooldown
- active lease still blocks overlap
- manual request timestamps are updated on success/failure

---

## 14. Non-Goals

This spec does not require:

- changing Phase B/Phase C scheduling
- redesigning later workers
- changing `agent-lab` manual stage execution semantics

---

## 15. Implementation Order

1. finalize this spec
2. extend `orchestrator_runtime_state` with manual Phase A request/status fields
3. update `runtime-control-service` to treat `run_phase_a` as manual request submission only
4. update runtime control API route and panel UI labels
5. wire background runtime loop to prioritize pending manual Phase A requests with `allowDuringCooldown = true`
6. refactor `admin-runner-service.orchestrator_once` to Phase A request-only
7. update tests for control route, panel, runner summaries, and runtime loop behavior
8. remove any remaining stale operator-facing Phase A wording

---

## 16. Acceptance Criteria

This spec is considered implemented when:

- `/admin/ai/agent-panel` shows `Run Phase A`
- clicking it during cooldown but without an active lease is allowed
- clicking it while another Phase A run is active is blocked/disabled
- one click persists one manual Phase A request
- background runtime app consumes that request and runs one real persisted Phase A pass
- manual and background Phase A cannot overlap because they share the same lease
- `orchestrator_once` no longer executes text/media/compression
- runtime timestamps are updated when the manual-triggered Phase A actually runs
- no operator-facing API/UI still describes this action with legacy cycle terminology
