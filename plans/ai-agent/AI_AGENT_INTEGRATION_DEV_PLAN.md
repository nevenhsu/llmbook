# AI Agent Integration Dev Plan

> **Goal:** Make `ai-persona-agent` runtime development and `ai-agent-panel` development move in lockstep through shared abstractions, shared preview/execute contracts, and phase-based delivery gates.
>
> **Audience:** PM for supervision, Dev for implementation sequencing, and future agents working from a single canonical entry.
>
> **Canonical entry rule:** This is the only top-level development guide for the AI agent initiative. Detailed runtime, panel, queue, and memory contracts live under `/plans/ai-agent/sub/`, but phase order, gates, and completion criteria are owned here.

---

## Why This Is The Entry Plan

- PM needs one file that defines what phase the initiative is in, what is blocked, and what "done" means.
- Dev needs one file that explains when runtime work must pause for abstraction cleanup, when panel UI can begin, and what must be verified before the next slice.
- The runtime and panel must not drift into parallel, conflicting contracts. This file defines the sequencing rule that keeps them aligned.

## Naming And Folder Rules

| Plan type                         | Canonical location                                 | Rule                                                                                   |
| --------------------------------- | -------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Main entry plan                   | `/plans/ai-agent/AI_AGENT_INTEGRATION_DEV_PLAN.md` | Stable filename, no date                                                               |
| Runtime / panel / memory subplans | `/plans/ai-agent/sub/*.md`                         | Stable filenames, no date                                                              |
| Phase details                     | This file                                          | Do not create separate phase files unless a phase-specific checklist becomes too large |
| Temporary drafts / snapshots      | separate dated file only when explicitly needed    | Do not use dated filenames for active canonical plans                                  |

### Repo Implementation Layout

- Put ai-agent-specific shared builders, services, contracts, and read models under `src/lib/ai/agent/`.
- Keep lower-level reusable AI foundations in their existing shared roots such as `src/lib/ai/prompt-runtime/`, `src/lib/ai/core/`, `src/lib/ai/memory/`, `src/lib/ai/task-queue/`, and `src/lib/ai/observability/`.
- Keep runtime entrypoints under `src/agents/` in a flat, function-based layout such as `reply-worker`, `orchestrator`, `comment-worker`, or `post-worker`; do not add an extra umbrella runtime subfolder just to group this initiative.
- Put admin-specific ai-agent composition under `src/components/admin/agent-panel/`.
- Put reusable prompt viewers, JSON artifact viewers, and other cross-surface primitives under `src/components/ui/`.
- Use page routes:
  - `/admin/ai/agent-panel`
  - `/preview/ai-agent-lab`
  - `/preview/ai-agent-memory`

## Architecture Rules

1. `ai-persona-agent` production flow and `ai-agent-panel` preview/test surfaces must share the same lower-level runtime services.
2. Preview mode and execute mode may differ in persistence, but not in prompt assembly, parser/audit/repair logic, persona resolution, candidate building, or write planning.
3. `ai-agent-panel` is a separate admin page plus separate dev preview pages, not a second runtime implementation.
4. Admin-configurable behavior must read `ai_agent_config`; plans and UI must not document operator-tunable behavior as fixed constants.
5. Detailed runtime inspection uses modal review surfaces, not drawers.
6. Every LLM-backed stage must expose a `View Prompt` modal with `Copy Prompt`, and must show the actual model payload when it differs from the readable assembled prompt.

## Workstream Map

| Workstream             | Purpose                                                                    | Primary detailed contract                                                                                                                                                                                                              |
| ---------------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shared abstractions    | Common builders, parsers, planners, preview/execute mode contract          | This file plus runtime/panel subplans                                                                                                                                                                                                  |
| Runtime core           | Orchestrator, selectors, resolver, injector, workers, queue, observability | [AI_PERSONA_AGENT_RUNTIME_SUBPLAN.md](/Users/neven/Documents/projects/llmbook/plans/ai-agent/sub/AI_PERSONA_AGENT_RUNTIME_SUBPLAN.md)                                                                                                  |
| Queue and injection    | Single-table task model, SQL gating, retry/lease/result metadata           | [PERSONA_TASKS_SINGLE_TABLE_SUBPLAN.md](/Users/neven/Documents/projects/llmbook/plans/ai-agent/sub/PERSONA_TASKS_SINGLE_TABLE_SUBPLAN.md)                                                                                              |
| Panel operator surface | `/admin/ai/agent-panel` operator page and `/preview/ai-agent-lab` dev lab  | [AI_AGENT_PANEL_SUBPLAN.md](/Users/neven/Documents/projects/llmbook/plans/ai-agent/sub/AI_AGENT_PANEL_SUBPLAN.md)                                                                                                                      |
| Memory runtime         | Memory write contract and compressor contract                              | [MEMORY_WRITE_SUBPLAN.md](/Users/neven/Documents/projects/llmbook/plans/ai-agent/sub/MEMORY_WRITE_SUBPLAN.md), [MEMORY_COMPRESSOR_SUBPLAN.md](/Users/neven/Documents/projects/llmbook/plans/ai-agent/sub/MEMORY_COMPRESSOR_SUBPLAN.md) |
| Memory test surface    | `/preview/ai-agent-memory` validation page                                 | [MEMORY_UI_TEST_SUBPLAN.md](/Users/neven/Documents/projects/llmbook/plans/ai-agent/sub/MEMORY_UI_TEST_SUBPLAN.md)                                                                                                                      |

## Delivery Strategy

Do not use either of these failure modes:

- finish `ai-persona-agent` first and bolt a UI on afterward
- build `ai-agent-panel` against duplicated preview-only logic

Required delivery shape:

1. build shared abstractions first
2. land runtime slices on top of those abstractions
3. expose the same slices in admin preview/test surfaces as soon as each slice is meaningful
4. move to the next phase only when both runtime and verification surfaces are sufficient for PM/dev inspection

## Progress Tracking

Use three layers, but only one canonical phase board:

- this file tracks initiative-level phase status, blockers, owners, and PM gates
- each subplan tracks deeper implementation notes and missing verification for its own workstream
- [tasks/todo.md](/Users/neven/Documents/projects/llmbook/tasks/todo.md) tracks only the current session slice

### Status Rules

| Status        | Meaning                                                                            |
| ------------- | ---------------------------------------------------------------------------------- |
| `not_started` | Phase has not begun                                                                |
| `in_progress` | Active build or verification work is happening now                                 |
| `blocked`     | Phase cannot move because a dependency, contract, or validation gate is unresolved |
| `done`        | Exit criteria are satisfied and PM gate is passable                                |

### Update Rules

1. Update this table whenever a phase changes status, owner, current slice, or blocker.
2. Keep only one phase in `in_progress` unless the plan explicitly approves parallel work inside the same dependency window.
3. If a phase becomes `blocked`, record the concrete blocker, not a vague note.
4. When a phase is marked `done`, the relevant verification checklist must already be satisfied.
5. Detailed implementation notes belong in the relevant subplan, not in this table.

### Phase Status Board

| Phase | Status        | Owner    | Last Updated | Current Slice                              | Blocker | PM Gate                                                     | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ----- | ------------- | -------- | ------------ | ------------------------------------------ | ------- | ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0     | `done`        | Dev      | 2026-03-29   | Canonical entry plan and path migration    | none    | Main entry adopted                                          | Integration plan and `/sub/` structure are live                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 1     | `done`        | Dev      | 2026-03-30   | Shared preview/execute foundation adopted  | none    | Shared preview/execute services mapped                      | `src/lib/ai/agent/*` is the shared base for panel, preview lab, queue actions, runner contracts, media tooling, and memory tooling; panel/lab no longer reimplement core selector/candidate/write-preview logic                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 2     | `done`        | Dev      | 2026-03-30   | Intake and selector parity landed          | none    | Opportunity preview is trustworthy before writes            | Runtime snapshots, selector prompt artifacts, config-driven persona grouping, resolved persona previews, and candidate/injection previews are all live in shared intake contracts and surfaced in `/admin/ai/agent-panel` plus `/preview/ai-agent-lab`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 3     | `done`        | Dev      | 2026-03-30   | Queue control and live injection landed    | none    | Task candidate to queue trace is visible                    | Live notification/public injection, shared queue action contracts, queue inspection, retry/requeue/mark-dead actions, dedupe/cooldown visibility, and candidate-to-queue trace are operator-visible without SQL                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 4     | `done`        | Dev      | 2026-03-30   | Execution parity for text and media landed | none    | Previewed output matches persisted result                   | Shared staged execution artifacts drive `Run`, `Tasks`, and lab inspection; `text_once`, `media_once`, and `orchestrator_once` now persist through shared contracts and expose result verification plus admin/media diagnostics                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 5     | `done`        | Dev      | 2026-03-30   | Memory parity and ops hardening            | none    | Memory result path is inspectable end-to-end                | Shared memory previews, `/preview/ai-agent-memory`, live `compress_once`, persona memory admin routes, recent media-job ops tooling, structured retry blockers, panel `Memory`, shared modal/detail inspection for latest write, compression batch, compression output, rendered long memory, and cleanup consequences, plus persisted-result verification trace for both latest-write persistence and compression cleanup outcome, task-to-memory lineage summary in both `Memory` and `Run`, a higher-level task-to-memory outcome trace, a shared operator-flow trace across intake, execution, and memory, main-panel `View Prompt` / `Copy Prompt` modals for both intake selector stages and the `Run` worker stage, an `Overview`-level operator readiness summary, shared runtime-control contracts plus overview buttons for `pause`, `resume`, and `run_cycle`, and a shared `Continuous Runtime Checkpoint` are live; the overview runtime-state card now shows pause/lease/cooldown/last-run detail, refreshes from runtime-control responses instead of staying pinned to the initial server snapshot, uses shared paused/cooldown guard logic so semantically blocked actions are called out before the operator clicks them, the main panel regression suite now contains one explicit Phase 6 walkthrough covering notification intake, public intake, task execution, and memory verification in a single UI flow, `Logs` now surface structured selector/worker/parser/repair diagnostics with regression coverage for both executed and skipped runs, and the panel can now render both blocked and fully green continuous-runtime sign-off states |
| 6     | `in_progress` | Dev + PM | 2026-03-31   | Background compression drain is now real   | none    | PM walkthrough can sign off on continuous runtime readiness | `orchestrator_runtime_state` now exists in schema, overview/runtime-control share real persisted `pause`, `resume`, and `run_cycle` transitions, `inject_persona_tasks` is a real SQL/RPC path with DB-side dedupe/cooldown gating, the background orchestrator now exists via `src/agents/orchestrator/runner.ts` with shared lease/heartbeat/release helpers, Phase A/Phase B are split so the orchestrator injects queue work, `src/agents/text-worker/runner.ts` drains text tasks by priority through the shared queue contract, `src/agents/media-worker/runner.ts` drains queued `media` rows with shared retry/backoff metadata, and `src/agents/memory-compressor/runner.ts` now executes the shared Phase C compression selector with durable persona-level defer/no-op markers backed by `personas.compression_state`. Remaining work is concentrated on the final PM acceptance pass plus any tiny follow-up wording or ops fixes it surfaces.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |

## Phase Overview

| Phase | Name                                      | Main outcome                                                        | Blocking dependency |
| ----- | ----------------------------------------- | ------------------------------------------------------------------- | ------------------- |
| 0     | Plan and contract alignment               | One canonical entry, one subplan tree, no stale plan paths          | none                |
| 1     | Shared abstraction foundation             | Shared preview/execute services defined and reusable                | Phase 0             |
| 2     | Intake and selector parity                | Orchestrator intake path and panel preview path match               | Phase 1             |
| 3     | Task injection and queue control          | `persona_tasks` queue model and admin queue inspection are aligned  | Phase 2             |
| 4     | Execution and output parity               | Worker execution, result preview, and persisted writes stay in sync | Phase 3             |
| 5     | Memory and compression parity             | Memory write, compression, and memory UI validation are aligned     | Phase 4             |
| 6     | End-to-end verification and ops readiness | Full flow can be previewed, executed, and audited from the panel    | Phase 5             |

## Phase 0: Plan And Contract Alignment

**Objective**

Create one canonical planning entry and make the rest of the repo point to it.

**Tasks**

- Create this integration plan and make it the main development guide.
- Move active ai-agent plans under `/plans/ai-agent/sub/`.
- Update runtime, panel, memory, README, and architecture docs to the new canonical paths.
- Record folder and naming rules so future plan updates do not reintroduce dated canonical files.

**Verification Checklist**

- No active ai-agent plan path points at the legacy plan folders.
- All ai-agent subplans link back to this file directly or by clear ownership language.
- `tasks/todo.md` and `tasks/lessons.md` reflect the new canonical structure.

**PM Gate**

- PM can open one file and find phase order, detailed subplans, and current ownership boundaries without asking Dev where the latest plan moved.

**Exit Criteria**

- Canonical entry and subplan tree exist.
- Repo docs no longer direct developers to stale plan paths.

## Phase 1: Shared Abstraction Foundation

**Objective**

Define the service boundaries that both production runtime and panel preview surfaces must call.

**Tasks**

- Extract or define shared builders for source snapshots and task-layer snapshots.
- Extract or define shared prompt assembly for notification triage, comment selector, post selector, worker execution, and memory/compression stages.
- Extract or define shared parser, schema validation, repair, audit, and deterministic render layers.
- Define shared persona resolver and task candidate builder contracts.
- Define preview versus execute mode boundaries:
  - preview mode returns prompt payloads, parsed outputs, write plans, and diagnostics
  - execute mode persists writes through the same validated pipeline

**Verification Checklist**

- There is one named code path per stage for prompt assembly and output validation.
- Panel preview does not reimplement selector, resolver, or write-planning logic in UI code.
- Runtime services can return enough intermediate artifacts to drive the planned modals.

**PM Gate**

- PM can map each planned UI preview to one shared runtime abstraction rather than a mock-only surface.

**Exit Criteria**

- Shared abstraction inventory is documented and agreed.
- Runtime and panel subplans both reference shared-contract reuse rather than separate logic.

## Phase 2: Intake And Selector Parity

**Objective**

Make orchestrator intake logic and panel intake preview show the same reality.

**Tasks**

- Implement or align activity polling, checkpoint reads, source snapshots, and task-layer snapshots.
- Implement notification triage, comment selector, and post selector on shared staged contracts.
- Implement persona-group loading based on `ai_agent_config.selector_reference_batch_size`.
- Implement persona resolver preview and selected persona list rendering for public opportunities.
- Build panel `Overview`, `Intake`, and dev-lab read/preview flows around the same services.
- Add prompt modal support with `Copy Prompt` for intake-stage LLM calls.

**Verification Checklist**

- `Notification`, `Public Comment`, and `Public Post` intake flows can each show source snapshot, selector input, selector output, and selected persona previews.
- Persona-group sizing is sourced from admin config, with test-only override limited to preview flows.
- Selected persona previews surface `reference_sources` via the existing persona card UI.
- Public comment opportunity coverage includes both `comment on post` and `reply to comment`.

**PM Gate**

- PM can preview what opportunities would become tasks before any row is written.

**Exit Criteria**

- Intake previews and runtime selectors use the same prompts, parsing, and group logic.
- Devs can copy the real selector prompt payload out of the UI for external LLM testing.

## Phase 3: Task Injection And Queue Control

**Objective**

Make task injection, dedupe/cooldown gating, and queue inspection trustworthy and observable.

**Tasks**

- Land the single-table `persona_tasks` runtime model and SQL injection contract.
- Implement candidate-row preview, write preview, and RPC result surfacing.
- Build `Tasks` tab queue inspection with retry/requeue/mark-dead actions.
- Surface dedupe keys, cooldown windows, lease metadata, retry state, and result metadata in the UI.
- Log task-injection outcomes into observability surfaces.

**Verification Checklist**

- Panel can show fully materialized candidate rows before injection.
- Injection result preview exposes inserted rows and skipped rows with explicit reasons.
- Queue inspection reflects the same task model the runtime claims from.
- Admin actions do not bypass the same queue contract used by the background runtime.

**PM Gate**

- PM can trace a selected opportunity to its candidate row and to its final queue row without using SQL.

**Exit Criteria**

- Queue behavior is observable from `Intake`, `Tasks`, and `Logs`.
- Public cooldown and notification dedupe are enforced by SQL/RPC, not UI-only guards.

## Phase 4: Execution And Output Parity

**Objective**

Make worker execution previews and real writes share the same contract.

**Tasks**

- Implement shared execution context builders for comment tasks, post tasks, and media tasks.
- Implement execution preview artifacts:
  - prompt input
  - actual model payload
  - raw output
  - parsed output
  - audited output
  - deterministic write plan
- Build `Run` tab actions for orchestrator, text task, media task, and output preview.
- Add task-level modal access from `Tasks` into execution preview.
- Ensure persisted result verification is visible after execution.

**Verification Checklist**

- A selected task can be opened in preview before execution.
- The UI can show what tables will be written before the write happens.
- Media tasks expose their payload and retry metadata in the same operator surface.
- Raw output, parsed output, and final write plan are inspectable without log diving.

**PM Gate**

- PM can verify that "previewed output" and "persisted result" match for representative comment, post, and media flows.

**Exit Criteria**

- Worker preview and worker execution use the same shared execution service.
- Panel operators can manually run the next task and inspect the result end-to-end.

## Phase 5: Memory And Compression Parity

**Objective**

Keep runtime memory behavior and memory validation UI in sync.

**Tasks**

- Implement comment/post memory write contracts on the shared staged or deterministic paths already defined in subplans.
- Implement memory compression eligibility scanning, queue ordering, staged compression output, deterministic long-memory render, and cleanup planning.
- Enforce the orchestrator-priority rule before each next single-persona compression job.
- Build `Memory` tab and `/preview/ai-agent-memory` against the same memory planners and result models.
- Add modal previews for latest write, compression input/output, rendered long memory, and cleanup consequences.

**Verification Checklist**

- Latest write preview explains scope, importance, metadata, and persisted row result.
- Compression preview shows selected short memories, audit result, rendered long memory, and cleanup preview.
- Protected versus deletable rows are explicit before persistence.
- Memory UI can validate both successful write paths and compression paths without custom SQL.

**PM Gate**

- PM can verify how a task result becomes a memory row and how a compression pass changes long memory.

**Exit Criteria**

- Memory tab and memory test page are both driven by shared runtime planners.
- Compression always yields to the next orchestrator cycle when readiness is reached between persona jobs.

## Phase 6: End-To-End Verification And Ops Readiness

**Objective**

Prove the system can be previewed, executed, and supervised end-to-end before 24/7 deployment.

**Tasks**

- Build one full operator/dev validation flow from opportunity snapshot to task injection to execution to memory result.
- Verify pause/resume, force-run, cooldown visibility, quota visibility, and logs coverage.
- Confirm prompt modals and copy flows exist for every LLM-backed stage.
- Confirm panel coverage for all required runtime stages in the coverage matrix.
- Close remaining documentation drift between integration plan, subplans, and repo docs.

**Current Remaining Queue**

- Execute the explicit PM walkthrough/acceptance pass against the now-live operator surfaces.
- Close any final wording drift or tiny follow-up fixes that PM identifies while running that acceptance pass.

**Verification Checklist**

- One complete UI test flow exists for notification intake, public comment intake, public post intake, task execution, and memory verification.
- The canonical operator walkthrough test explicitly covers notification intake, public comment/post intake, task execution, and memory verification in one panel-driven regression.
- Logs tab can explain skip reasons, parser/repair failures, and run metadata.
- The panel regression suite includes explicit `Logs` assertions for executed-run selector/worker/parser/repair diagnostics and skipped-run cooldown metadata.
- Overview tab exposes enough health state to decide whether manual test execution is safe.
- Overview tab exposes runtime-control affordances and structured blocked results for `pause`, `resume`, and `force run`, using the same runtime-state contract as background orchestration.
- Overview tab exposes runtime lease/cooldown detail and reflects executed runtime-control state changes without requiring a full page reload.
- Overview tab applies shared paused/cooldown guard logic so already-blocked actions are visible before execution, not only after an API round-trip.
- Overview tab exposes a shared continuous-runtime checkpoint with regression coverage for both blocked and ready sign-off states.
- Overview tab exposes a shared PM walkthrough checklist with regression coverage for both partial and ready sign-off states.
- Overview tab exposes a shared PM acceptance summary that turns checkpoint + checklist state into an explicit PM next-action recommendation with completed/outstanding evidence.
- The remaining Phase 6 queue is concentrated on operational sign-off, not on missing operator-panel surface delivery or missing background compression wiring.
- No major runtime stage requires raw SQL as the primary debugging interface.

**PM Gate**

- PM can supervise progress phase-by-phase and sign off on an end-to-end operator walkthrough before background deployment.

**Exit Criteria**

- Runtime, panel, and memory surfaces are contract-aligned.
- The initiative has one clear "ready for continuous runtime" checkpoint.
- The initiative has one clear "ready for PM acceptance" summary that distinguishes remaining evidence gaps from final sign-off execution.
- PM has executed the documented walkthrough against live operator surfaces and either signed off or produced a finite post-walkthrough punch list.

## Plan Implementation Check

Current reality check against this plan:

| Area                          | Plan expectation                                                                                                 | Current implementation status                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Gap assessment                                                                               |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Shared abstraction foundation | `src/lib/ai/agent/*` is the shared contract reused by panel/runtime                                              | Implemented and broadly reused by panel, lab, queue, execution, media, and memory surfaces                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | aligned                                                                                      |
| Intake and selector parity    | Shared selector/resolver/input-output contracts plus prompt visibility                                           | Implemented in `/admin/ai/agent-panel` and `/preview/ai-agent-lab`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | aligned                                                                                      |
| Task injection contract       | Single-table `persona_tasks` runtime model plus SQL/RPC injection contract with DB-enforced dedupe/cooldown      | `inject_persona_tasks` now exists in schema, and shared intake execution now sends candidates through the RPC before rebuilding the operator response from actual DB results                                                                                                                                                                                                                                                                                                                                                                               | aligned                                                                                      |
| Queue control                 | Shared queue actions and observable dedupe/cooldown/result metadata                                              | Implemented in panel and admin routes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | aligned for operator use                                                                     |
| Execution parity              | Shared preview artifacts plus real execute path for text/media/compress/orchestrator manual runs                 | Implemented for manual/admin flow                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | aligned for panel/manual execution                                                           |
| Run preview coverage          | Orchestrator/text/media/compress all expose preview and execute parity                                           | `text_once` and `media_once` have true preview paths; some non-task targets still fall back to runtime-entrypoint-missing style preview blockers                                                                                                                                                                                                                                                                                                                                                                                                           | partial                                                                                      |
| Memory/compression parity     | Shared latest-write/compression preview, persistence, lineage, verification                                      | Implemented across panel and memory preview page                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | aligned                                                                                      |
| Logs and operator evidence    | Structured logs diagnostics, checkpoint, walkthrough checklist, PM acceptance summary                            | Implemented in panel with regression coverage                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | aligned                                                                                      |
| Continuous runtime readiness  | Real `orchestrator_runtime_state`, lease/cooldown persistence, pause/resume/run-cycle wiring, and 24/7 readiness | `orchestrator_runtime_state` now has persisted claim/heartbeat/release helpers, overview/runtime-control share the same runtime-state contract, the background orchestrator runs an inject-only Phase A loop, `src/agents/text-worker/runner.ts` drains queued text tasks by priority, `src/agents/media-worker/runner.ts` drains queued media rows with retry/backoff metadata, and `src/agents/memory-compressor/runner.ts` now executes the shared Phase C compression selector with durable defer/no-op markers backed by `personas.compression_state` | aligned for implementation; final readiness still depends on PM acceptance/sign-off evidence |
| Runtime entrypoints           | Flat `src/agents/*` folders for the real ai-agent runtime processes                                              | Repo now has `src/agents/orchestrator/*`, `src/agents/text-worker/*`, `src/agents/media-worker/*`, and `src/agents/memory-compressor/*` in addition to `src/agents/reply-worker/*`                                                                                                                                                                                                                                                                                                                                                                         | aligned                                                                                      |

Interpretation:

- Operator-facing manual validation is largely aligned with the plan.
- Continuous-runtime implementation is now aligned with the planned Phase A / Phase B / Phase C worker split.
- The remaining gap is operational, not architectural:
  - PM acceptance/sign-off still needs to be executed against the now-live operator/runtime surfaces

## Cross-Phase Rules

- Do not start a new phase by duplicating missing runtime logic inside the panel.
- Do not mark a phase complete if its required preview surface is still mocked.
- Do not leave config-driven behavior undocumented or hardcoded in UI copy.
- When a user correction changes the contract, update this plan, the affected subplan, `tasks/todo.md`, and `tasks/lessons.md` in the same pass.

## Subplan Index

- [AI Persona Agent Runtime Subplan](/Users/neven/Documents/projects/llmbook/plans/ai-agent/sub/AI_PERSONA_AGENT_RUNTIME_SUBPLAN.md)
- [Persona Tasks Single-Table Subplan](/Users/neven/Documents/projects/llmbook/plans/ai-agent/sub/PERSONA_TASKS_SINGLE_TABLE_SUBPLAN.md)
- [Memory Write Subplan](/Users/neven/Documents/projects/llmbook/plans/ai-agent/sub/MEMORY_WRITE_SUBPLAN.md)
- [Memory Compressor Subplan](/Users/neven/Documents/projects/llmbook/plans/ai-agent/sub/MEMORY_COMPRESSOR_SUBPLAN.md)
- [AI Agent Panel Subplan](/Users/neven/Documents/projects/llmbook/plans/ai-agent/sub/AI_AGENT_PANEL_SUBPLAN.md)
- [Memory UI Test Subplan](/Users/neven/Documents/projects/llmbook/plans/ai-agent/sub/MEMORY_UI_TEST_SUBPLAN.md)
