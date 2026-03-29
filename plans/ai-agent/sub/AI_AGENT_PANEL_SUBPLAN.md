# AI Agent Panel Subplan

> **Scope:** This subplan defines the operator console, dev test lab, and panel-side verification requirements under [AI_AGENT_INTEGRATION_DEV_PLAN.md](/Users/neven/Documents/projects/llmbook/plans/ai-agent/AI_AGENT_INTEGRATION_DEV_PLAN.md).

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build an admin-facing `AI Agent Panel` that lets operators inspect, preview, manually run, and validate every major `ai-persona-agent` runtime stage before 24/7 deployment, while also providing a dev-oriented UI test lab for stage-by-stage verification.

**Architecture:** Keep the production operator console and the development test harness separate. The operator page stays focused on real runtime state and real writes; the dev test lab adds fixture-driven previews, test-only persona-group overrides, and write-preview surfaces that would clutter the operator flow. Both surfaces must reuse the same runtime contracts, parsers, preview builders, and store facade so preview and production do not drift.

**Tech Stack:** Next.js App Router, existing admin auth/layout pattern, React client panel + hook state machine, shared admin preview components, Supabase-backed runtime tables, typed admin API routes under `/api/admin/ai/agent/*`, dev preview routes under `/preview/*`.

---

## Design Summary

This plan covers two related but different surfaces:

1. **Operator console**
   - route: `/admin/ai/agent-panel`
   - audience: admin/operator
   - purpose: inspect real runtime state, preview real candidates, inject real tasks, manually run real workers, verify writes

2. **Dev test lab**
   - route: `/preview/ai-agent-lab`
   - audience: developers during implementation/debugging
   - purpose: isolate each runtime stage with fixture or sampled data, override persona-group selection for testing, preview prompt I/O and DB write intents before touching production rows

3. **Memory UI test page**
   - route: `/preview/ai-agent-memory`
   - audience: developers validating memory write/compression behavior
   - purpose: test short-memory write previews, canonical long-memory render, compression input/output, and cleanup consequences without crowding the main panel
   - detailed plan: [MEMORY_UI_TEST_SUBPLAN.md](/Users/neven/Documents/projects/llmbook/plans/ai-agent/sub/MEMORY_UI_TEST_SUBPLAN.md)

Core rule:

- every automated runtime stage must have a corresponding UI preview surface before it is trusted in background execution
- detailed runtime payload inspection should use modal review surfaces, not drawers
- every LLM-backed stage should expose a `View Prompt` modal with `Copy Prompt`, so operators can copy the exact prompt bundle for external multi-round testing

That means the panel/test lab must cover:

- activity/source snapshot preview
- selector input preview
- selector output preview
- persona-group sizing and test-only group selection
- selected personas preview
- candidate task preview
- task write result preview
- task execution input preview
- task execution output preview
- post/comment/media/memory write preview
- persisted-result verification

## Scope And Non-Goals

### In Scope

- runtime health and queue inspection
- intake preview for notifications and public opportunities
- selector and resolver preview
- admin-editable persona reference batch size via `ai_agent_config.selector_reference_batch_size`
- test-only persona group selection override in dev UI
- selected persona preview before task injection
- candidate JSON preview before `inject_persona_tasks`
- task table inspection and manual queue actions
- execution preview for comment/post/media/compression paths
- memory write/compression preview and verification
- one end-to-end UI test flow that exercises the full persona-agent pipeline

### Out Of Scope

- replacing the existing Admin AI Control Plane
- adding a second runtime contract for preview-only execution
- hiding write side effects behind silent background actions
- using browser preview automation as the primary validation method in this planning pass

## Runtime Coverage Matrix

| Runtime stage            | Main source tables                                                          | Primary UI surface         | Preview needed before write                                                      | Write target                                                          |
| ------------------------ | --------------------------------------------------------------------------- | -------------------------- | -------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Runtime guard / cooldown | `orchestrator_runtime_state`, `ai_agent_config`                             | `Overview`                 | current lease, cooldown, pause/resume state                                      | `orchestrator_runtime_state`                                          |
| Activity polling         | `heartbeat_checkpoints`, `notifications`, `posts`, `comments`, `boards`     | `Intake`                   | source snapshot window, candidate counts, skipped reasons                        | none                                                                  |
| Notification triage      | `notifications` + task-layer snapshot                                       | `Intake`                   | prompt input, structured decision output, respond/skip reason                    | preview only until inject                                             |
| Comment selector         | `posts`, `comments`, `boards`, `persona_reference_sources`                  | `Intake`, `Dev test lab`   | selector prompt input, structured output, thread mapping                         | preview only until inject                                             |
| Post selector            | `boards`, `posts`, `persona_reference_sources`                              | `Intake`, `Dev test lab`   | selector prompt input, structured output, board mapping                          | preview only until inject                                             |
| Persona resolver         | `persona_reference_sources`, `personas`                                     | `Intake`, `Dev test lab`   | group membership, selected references, resolved `persona_id[]`                   | preview only until inject                                             |
| Task injection           | `persona_tasks`, `inject_persona_tasks` RPC                                 | `Intake`, `Tasks`          | candidate JSON, dedupe/cooldown check preview, RPC result preview                | `persona_tasks`                                                       |
| Text task execution      | `persona_tasks`, `persona_cores`, `persona_memories`, source content tables | `Run`                      | assembled task input, prompt payload, model output, audited output, write plan   | `posts` / `comments` / `media` / `persona_memories` / `persona_tasks` |
| Media execution          | `media`                                                                     | `Run`                      | prompt, image job payload, retry metadata                                        | `media`                                                               |
| Memory write             | `persona_memories`                                                          | `Memory`, memory test page | short-memory row preview and metadata preview                                    | `persona_memories`                                                    |
| Compression              | `persona_memories`                                                          | `Memory`, memory test page | selected batch, JSON output, audit output, rendered long memory, cleanup preview | `persona_memories`                                                    |
| Observability            | `orchestrator_run_log`, runtime event rows if added                         | `Logs`                     | raw payload modal, reason-code filters                                           | log rows                                                              |

## Data Tables And UI Responsibilities

| Table / object               | Role in runtime                                   | Required UI surfaces                  | Key columns / fields to show                                                                                                                                    | Primary actions                                  |
| ---------------------------- | ------------------------------------------------- | ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| `ai_agent_config`            | operator-tunable runtime config                   | `Overview`, `Intake`, `Run`, `Memory` | `orchestrator_cooldown_minutes`, `max_comments_per_cycle`, `max_posts_per_cycle`, `selector_reference_batch_size`, quotas, cooldown settings, memory thresholds | edit/save config, restore defaults where allowed |
| `orchestrator_runtime_state` | singleton lease and cooldown                      | `Overview`                            | `lease_owner`, `lease_until`, `cooldown_until`, `last_started_at`, `last_finished_at`                                                                           | pause/resume runtime, force cycle                |
| `heartbeat_checkpoints`      | source polling watermark                          | `Intake`, `Logs`                      | per-source `last_captured_at`, overlap window                                                                                                                   | refresh snapshot only                            |
| `ai_global_usage`            | quota guard state                                 | `Overview`                            | prompt/completion token totals, image count, current window                                                                                                     | refresh                                          |
| `orchestrator_run_log`       | cycle audit and metadata                          | `Overview`, `Logs`, `Intake`          | `run_at`, snapshot window, injected counts, `skipped_reason`, `metadata.persona_group_index`, preview/result diagnostics                                        | open raw JSON                                    |
| `notifications`              | notification-driven reply source                  | `Intake`                              | notification type, recipient persona, target object, created time                                                                                               | preview triage                                   |
| `posts`                      | source for public opportunities and post writes   | `Intake`, `Run`                       | board, author, title, trimmed body, created time                                                                                                                | open source context                              |
| `comments`                   | source for reply opportunities and comment writes | `Intake`, `Run`                       | thread chain, author, trimmed body, created time                                                                                                                | open thread context                              |
| `boards`                     | board-level context for post opportunities        | `Intake`, `Run`                       | board rules, description, post volume                                                                                                                           | open board context                               |
| `persona_reference_sources`  | selector reference list                           | `Intake`, `Dev test lab`              | `romanized_name`, linked persona, group index                                                                                                                   | preview groups                                   |
| `personas`                   | active persona resolution target                  | `Intake`, `Tasks`, `Run`, `Memory`    | display name, username, status, linked references                                                                                                               | preview selected personas                        |
| `persona_tasks`              | single runtime queue table                        | `Tasks`, `Run`, `Logs`                | `task_type`, `dispatch_kind`, `status`, `source_table`, `source_id`, `dedupe_key`, `cooldown_until`, lease/retry/result metadata                                | retry, requeue, mark dead, preview execution     |
| `media`                      | image generation queue and results                | `Run`, `Logs`                         | `status`, `retry_count`, `last_error`, `image_prompt`, linked post/comment                                                                                      | run media worker once                            |
| `persona_memories`           | short and long memory storage                     | `Memory`, memory test page            | `memory_type`, `scope`, `content`, `importance`, metadata keys, compression eligibility                                                                         | preview write, run compression                   |

## Information Architecture

### A. Operator Console: `/admin/ai/agent-panel`

Keep the existing six-tab structure, but expand each tab so the runtime can be validated without SQL.

1. **Overview**
2. **Intake**
3. **Tasks**
4. **Run**
5. **Memory**
6. **Logs**

### B. Dev Test Lab: `/preview/ai-agent-lab`

This is not a general dashboard. It is a staged testing page for developers working on selector, resolver, injector, worker, and persistence flows.

Recommended sections:

1. `Data Source`
2. `Persona Groups`
3. `Selector Input`
4. `Selector Output`
5. `Resolved Personas`
6. `Task Candidates`
7. `Task Execution Preview`
8. `Persisted Result Verification`

### C. Memory Test Page: `/preview/ai-agent-memory`

Keep this separate so memory write and compression work can evolve without overloading the main panel. See [MEMORY_UI_TEST_SUBPLAN.md](/Users/neven/Documents/projects/llmbook/plans/ai-agent/sub/MEMORY_UI_TEST_SUBPLAN.md).

## Main Page Tab Requirements

### 1. Overview

**Purpose**

- show whether runtime is healthy enough to test
- expose the config knobs that affect operator expectations

**Content**

- runtime lease/cooldown card
- usage/quota card
- task counts by status
- pending media count
- eligible compression count
- recent failure count
- selected runtime config summary:
  - `selector_reference_batch_size`
  - `max_comments_per_cycle`
  - `max_posts_per_cycle`
  - opportunity cooldowns

**Actions**

- `Refresh snapshot`
- `Pause runtime`
- `Resume runtime`
- `Run one full cycle now`
- `Open dev test lab`

### 2. Intake

**Purpose**

- inspect source snapshots and selector behavior before any task write

**Required subsections**

1. `Source snapshot`
   - notification candidates
   - public comment opportunities
   - public post opportunities
   - snapshot window and checkpoint diagnostics

2. `Selector controls`
   - show persisted `selector_reference_batch_size`
   - edit/save `selector_reference_batch_size` through admin config
   - test-only `group override` control for preview requests
   - optional `sample size` / `limit` controls for preview only

3. `Selector input preview`
   - prompt-local keys
   - target summaries
   - board rules
   - reference names in the currently selected group
   - `View Prompt` modal for:
     - notification triage
     - comment selector
     - post selector
   - modal should expose both:
     - human-readable assembled prompt blocks
     - actual model payload when the runtime uses compact / validated context
   - modal must include `Copy Prompt`

4. `Selector output preview`
   - notification triage `respond | skip`
   - comment selector structured output
   - post selector structured output
   - `View Raw JSON` modal

5. `Selected personas preview`
   - `selected_references[]`
   - resolver lookup result
   - resolved `persona_id[]`
   - active/inactive filtering result
   - modal preview of the opportunity-selected persona list
   - each selected persona should reuse the existing persona card UI and show `reference_sources`
   - support one summary modal for the full list plus optional per-persona detail modal

6. `Task candidate preview`
   - fully materialized candidate rows before RPC call
   - `dispatch_kind`
   - `source_table`
   - `source_id`
   - `dedupe_key`
   - `cooldown_until`
   - `decision_reason`
   - `payload`

7. `Task write preview`
   - preview of dedupe/cooldown expectation
   - actual RPC result after injection:
     - `candidate_index`
     - `inserted`
     - `skip_reason`
     - `task_id`

**Actions**

- `Preview notification intake`
- `Preview public intake`
- `Preview selector output`
- `View Prompt`
- `Preview resolved personas`
- `Preview task candidates`
- `Inject selected`
- `Inject all eligible`

### 3. Tasks

**Purpose**

- inspect the real queue after injection and before execution

**Required content**

- filterable task table
- status chips: `PENDING | RUNNING | DONE | FAILED | DEAD`
- detail modal with:
  - task payload JSON
  - source linkage
  - result metadata
  - retry/lease metadata
  - dedupe/cooldown metadata

**Required actions**

- `Retry task`
- `Requeue task`
- `Mark dead`
- `Open execution preview`
- `Open source context`

### 4. Run

**Purpose**

- manually execute one stage at a time and preview writes before persisting them

**Required runner cards**

- `Run orchestrator once`
- `Run next text task`
- `Run next media task`
- `Run next compression batch`

**Required execution preview flow**

1. select a task or runner target
2. load prompt/context input preview
3. run model or stage in preview mode
4. show raw output
5. show parsed/audited output
6. show DB write plan
7. optionally persist
8. show persisted result summary

**Task execution preview must expose**

- persona context summary
- source post/comment/board context
- current short/long memory summary
- assembled prompt blocks or compact validated context
- `View Prompt` modal for the active execution stage
- `Copy Prompt` inside that modal
- raw model output
- structured parsed output
- audit result if applicable
- final write preview:
  - post/comment row
  - media row if `need_image=true`
  - memory row
  - task result metadata

### 5. Memory

**Purpose**

- validate memory writes and compression without leaving the panel

**Required subsections**

1. `Recent short memories`
2. `Canonical long memory`
3. `Latest memory write preview/result`
4. `Compression candidate batch`
5. `Compression JSON output`
6. `Rendered long-memory preview`
7. `Cleanup preview`

**LLM prompt visibility**

- if the selected memory flow uses an LLM stage, expose `View Prompt` modal(s) for:
  - post short-memory extraction
  - compression main
  - compression quality audit
  - any repair stage that is surfaced for debugging
- each modal should include `Copy Prompt`
- when the app sends compact / validated payload instead of the pretty-printed prompt blocks, the modal should show both representations clearly labeled

**Actions**

- `Refresh persona memory`
- `Preview latest write`
- `Preview compression input`
- `Run compression for persona`
- `Open memory test page`

### 6. Logs

**Purpose**

- make all stage diagnostics inspectable from UI

**Required content**

- recent `orchestrator_run_log` rows
- runner result summaries
- structured skip reasons
- selector/worker/repair errors
- raw payload modal for:
  - snapshot metadata
  - selector output
  - injection result
  - compression diagnostics

## Dev Test Lab Specification

The dev lab exists to validate each implementation slice before the operator console is trusted for live writes.

### Route

- `/preview/ai-agent-lab`

### Lab Data Sources

Support two modes:

1. `Fixture mode`
   - deterministic mock snapshots
   - stable UI tests
   - no production writes

2. `Sampled DB mode`
   - read current DB rows
   - allow preview and optional write in guarded admin mode

### Lab Sections

#### 1. Data Source

- choose `notification`, `comment opportunity`, or `post opportunity`
- choose fixture or sampled DB mode
- set snapshot window / board / thread filters for test generation
- generate test input payload

#### 2. Persona Groups

- display persisted `selector_reference_batch_size`
- allow admin to edit the persisted config
- allow test-only override for preview requests
- show computed group count
- list groups with:
  - group index
  - size
  - first/last reference name
  - active persona count

#### 3. Selector Input

- render the exact input payload for:
  - notification triage
  - comment selector
  - post selector
- show prompt-local keys and source mapping
- show compact JSON and human-readable summary side by side
- provide `View Prompt` modal with `Copy Prompt` for each selector/triage stage

#### 4. Selector Output

- run preview
- show structured output JSON
- show parse/audit status
- allow row selection per opportunity

#### 5. Resolved Personas

- show `selected_references[]`
- show `persona_reference_sources` matches
- show resolved personas with inactive filtering
- warn on empty or partial resolution

#### 6. Task Candidates

- build candidate rows from the selected opportunities
- preview dedupe key and cooldown
- preview the exact `inject_persona_tasks` input JSON
- optionally dry-run the RPC and display result rows without persistence if implementation offers a dry-run helper

#### 7. Task Execution Preview

- choose one existing or newly injected task
- preview task input/context
- run preview execution
- expose `View Prompt` modal with `Copy Prompt` for the active worker stage
- show raw output
- show parsed/audited output
- show planned writes

#### 8. Persisted Result Verification

- write the task result when explicitly confirmed
- verify:
  - `persona_tasks.result_*`
  - created `posts` / `comments`
  - created `media`
  - created `persona_memories`
  - appended `orchestrator_run_log` or worker event diagnostics where applicable

## End-To-End Operator Flows

### Flow A: Notification Reply Validation

1. Open `Overview` and confirm runtime is not paused for an unexpected reason.
2. Open `Intake` and run `Preview notification intake`.
3. Review `notificationsSnapshot` candidates and skip reasons.
4. Review triage output preview and verify `respond | skip`.
5. Preview candidate task JSON for one or two `respond` rows.
6. Inject the selected candidates.
7. Open `Tasks` and confirm new rows were written with correct `dispatch_kind='notification'`.
8. Open `Run`, select one injected task, and open execution preview.
9. Verify prompt input, model output, parsed output, and write preview.
10. Persist the task execution.
11. Confirm task status/result metadata updated.
12. Verify created `comment` row, optional `media` row, and new thread short-memory row.
13. Open `Logs` to confirm diagnostics are visible.

### Flow B: Public Opportunity Validation

1. Open `Intake` and run `Preview public intake`.
2. Verify source opportunity summaries and prompt-local keys.
3. Confirm current `selector_reference_batch_size`.
4. In operator mode, use persisted config only; in dev lab, optionally set a test-only group override.
5. Preview selector input and output.
6. Open selected personas preview and confirm `selected_references[] -> persona_id[]`.
7. Preview candidate task JSON, including `dedupe_key` and `cooldown_until`.
8. Inject selected candidates.
9. Open `Tasks` and verify rows are `dispatch_kind='public'`.
10. Choose one task in `Run` and open execution preview.
11. Review output preview.
12. Persist write and verify post/comment, memory write, optional media, and task result.

### Flow C: Compression Validation

1. Open `Memory` for a persona with compressible rows.
2. Preview the selected short-memory batch.
3. Preview current canonical long memory.
4. Run compression preview.
5. Review compression JSON output, audit output, rendered long-memory preview, and cleanup preview.
6. Persist compression.
7. Verify canonical long-memory upsert and short-memory cleanup behavior.

## API Plan

### Operator Console APIs

- `GET /api/admin/ai/agent/overview`
- `POST /api/admin/ai/agent/runtime/pause`
- `POST /api/admin/ai/agent/runtime/resume`
- `POST /api/admin/ai/agent/runtime/run-cycle`
- `GET /api/admin/ai/agent/intake/preview?kind=notification`
- `GET /api/admin/ai/agent/intake/preview?kind=public`
- `POST /api/admin/ai/agent/intake/selector-preview`
- `POST /api/admin/ai/agent/intake/resolve-personas`
- `POST /api/admin/ai/agent/intake/candidate-preview`
- `POST /api/admin/ai/agent/intake/inject`
- `GET /api/admin/ai/agent/tasks`
- `GET /api/admin/ai/agent/tasks/[id]`
- `POST /api/admin/ai/agent/tasks/[id]/retry`
- `POST /api/admin/ai/agent/tasks/[id]/requeue`
- `POST /api/admin/ai/agent/tasks/[id]/dead`
- `POST /api/admin/ai/agent/tasks/[id]/preview-execution`
- `POST /api/admin/ai/agent/tasks/[id]/run`
- `POST /api/admin/ai/agent/run/orchestrator-once`
- `POST /api/admin/ai/agent/run/text-once`
- `POST /api/admin/ai/agent/run/media-once`
- `POST /api/admin/ai/agent/run/compress-once`
- `GET /api/admin/ai/agent/memory/personas/[id]`
- `POST /api/admin/ai/agent/memory/personas/[id]/preview-compression`
- `POST /api/admin/ai/agent/memory/personas/[id]/compress`
- `GET /api/admin/ai/agent/logs`
- `GET /api/admin/ai/agent/events`

### Dev Lab APIs

These should reuse the same lower-level services as the operator console, but allow fixture mode and test-only group overrides.

- `POST /api/admin/ai/agent/lab/generate-input`
- `POST /api/admin/ai/agent/lab/selector-preview`
- `POST /api/admin/ai/agent/lab/resolve-personas`
- `POST /api/admin/ai/agent/lab/candidate-preview`
- `POST /api/admin/ai/agent/lab/task-preview`
- `POST /api/admin/ai/agent/lab/task-run-preview`
- `POST /api/admin/ai/agent/lab/persist-task-result`

Recommended override payload keys for dev-only preview calls:

- `groupIndexOverride`
- `referenceBatchSizeOverride`
- `fixtureId`
- `dryRun`

These overrides must not silently mutate persisted `ai_agent_config`.

## UI Components To Reuse

Reuse where possible:

- page auth/loading pattern from `src/app/admin/ai/control-plane/page.tsx`
- panel composition from `src/components/admin/AiControlPlanePanel.tsx`
- section registry pattern from `src/lib/ai/admin/control-plane-types.tsx`
- hook-owned state pattern from `src/hooks/admin/useAiControlPlane.ts`
- preview surfaces / modal style from:
  - `src/components/admin/control-plane/PreviewPanel.tsx`
  - `src/components/admin/control-plane/InteractionPreviewModal.tsx`
  - `src/components/admin/control-plane/PromptAssemblyModal.tsx`
  - `src/components/admin/control-plane/PersonaGenerationPreviewSurface.tsx`
  - `src/components/admin/control-plane/PersonaInfoCard.tsx`

Do not reuse as-is:

- persona-generation business logic
- persona-generation prompt contracts
- generation-specific modal state machine

### Modal Rules

- Use modal as the detailed inspection surface for intake, task, log, and memory drill-down flows.
- Do not use side drawers for runtime payload inspection.
- `Selected personas preview` should open a modal that lists all personas chosen for the current opportunity/result set.
- Each selected persona in that modal should reuse the existing reference-aware persona card UI so the operator can see identity and `reference_sources` immediately.
- Every LLM-backed stage modal should support `View Prompt`.
- Every `View Prompt` modal should include `Copy Prompt`.
- If runtime invocation differs from the human-readable prompt assembly, the modal should show both:
  - `Assembled Prompt`
  - `Actual Model Payload`
- Labels must make it obvious which representation should be copied for faithful external reproduction.

## Testing Plan

### Unit / Hook Tests

- section switching and tab state
- config edit/save state for `selector_reference_batch_size`
- dev-only override state does not mutate persisted config
- selector preview request/response handling
- candidate preview shaping
- task execution preview state machine
- memory preview/compression preview state handling
- `View Prompt` modal open/close and `Copy Prompt` action wiring

### API Tests

- admin-only access
- overview snapshot shape
- intake preview shape for notification/public kinds
- selector preview + resolver preview response contracts
- candidate preview and inject success/error states
- task execution preview success/error states
- compression preview success/error states
- prompt-preview response shape for selector, worker, and compression stages

### Full UI Test

Create one complete UI test that validates the happy path through the dev lab.

**Recommended scenario**

1. Open `/preview/ai-agent-lab`.
2. Choose fixture mode with a mixed public-opportunity fixture.
3. Verify persisted `selector_reference_batch_size` is shown.
4. Set test-only `groupIndexOverride=1`.
5. Click `Generate test input`.
6. Verify opportunities preview renders prompt-local keys.
7. Click `View Prompt` and verify the selector prompt modal renders with `Copy Prompt`.
8. Click `Preview selector output`.
9. Verify selected references are shown.
10. Click `Preview resolved personas`.
11. Verify selected personas preview shows expected personas.
12. Click `Preview task candidates`.
13. Verify candidate JSON contains expected `dispatch_kind`, `dedupe_key`, and payload.
14. Inject or dry-run write depending on environment.
15. Select one resulting task and open execution preview.
16. Open the worker `View Prompt` modal and verify `Copy Prompt`.
17. Verify output preview shows raw output, parsed output, and write preview.
18. Persist task result in the guarded test environment.
19. Verify result summary shows task update plus post/comment/media/memory writes.

**Assertions**

- opportunity preview matches fixture
- selector output is rendered and parseable
- persona resolution count is correct
- candidate rows display deterministic fields
- selector and worker prompt modals render and expose copy affordance
- execution preview renders all required panels
- persisted result summary includes all linked writes

### Manual Validation Flow

1. `Overview`: confirm runtime health and config.
2. `Intake`: preview candidates, selector output, persona resolution, and candidate tasks.
3. `Tasks`: confirm queue rows.
4. `Run`: preview execution and persist one task.
5. `Memory`: verify short-memory or compression results.
6. `Logs`: inspect diagnostics and reason codes.

## Recommended Implementation Order

### Phase 1: Shell And Read Models

- create `/admin/ai/agent-panel`
- create `/preview/ai-agent-lab`
- create shared section registry/types
- add overview snapshot and read-only intake/task/log surfaces

### Phase 2: Preview Builders

- add selector input/output preview helpers
- add persona-group computation and group preview
- add resolver preview
- add candidate preview

### Phase 3: Write Path Controls

- inject selected candidates
- add task table detail modal
- add task execution preview
- add guarded persist action

### Phase 4: Memory Surfaces

- add memory preview to main panel
- implement memory UI test page from [MEMORY_UI_TEST_SUBPLAN.md](/Users/neven/Documents/projects/llmbook/plans/ai-agent/sub/MEMORY_UI_TEST_SUBPLAN.md)
- add compression preview and persist flow

### Phase 5: Full Validation

- add the complete UI test
- run manual validation flow against real admin data
- document operator checklist before 24/7 deployment

## Open Assumptions

- The agent panel remains a separate page rather than another control-plane tab.
- `selector_reference_batch_size` is the persisted admin-editable knob for persona group sizing.
- Group index override is dev-only and must never silently rewrite config.
- Preview and production must share the same runtime contracts and parser/audit helpers.
- The operator console should prefer real runtime visibility; deeper fixture-driven testing belongs in `/preview/*`.
