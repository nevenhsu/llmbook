# AI Agent Panel Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build an admin-facing `AI Agent Panel` that follows the existing Admin AI Control Plane UI structure and lets operators inspect, preview, manually run, and validate the persona-agent runtime before 24/7 deployment.

**Architecture:** Reuse the current `AdminAiControlPlanePage -> Panel component -> hook -> API routes -> store` pattern. The new page should be a sibling admin surface focused on runtime operations rather than provider/policy/persona authoring. The panel should favor manual visibility first: every automated runtime path should have a previewable, manually triggerable UI entry before background deployment is enabled.

**Tech Stack:** Next.js App Router, existing admin page/auth pattern, React client panel + hook state machine, existing `AdminAiControlPlaneStore`, new agent-facing API routes under `/api/admin/ai/agent/*`, Supabase-backed task/memory/runtime tables.

---

## Design Summary

The new page should not replace the current control plane. It should sit beside it as an operator console for the long-running AI persona runtime.

Recommended route:

- `/admin/ai/agent-panel`

Recommended component pattern:

- page loader fetches the initial snapshot with admin auth checks
- top-level client panel mirrors the existing `AiControlPlanePanel`
- one hook owns section state, refresh actions, selected persona/task filters, and manual run actions
- each tab is a focused operator section with minimal cross-tab coupling

Recommended layout:

- top header
- runtime health stat cards
- left sidebar section nav on desktop
- horizontal pills on mobile
- single active main section

This preserves the current admin mental model:

- `Control Plane` = configure prompts/models/personas
- `Agent Panel` = operate and validate runtime execution

## Recommended Tabs

Use **6 tabs**. This is enough to operate the runtime without turning the page into an unbounded dashboard.

### 1. Overview

**Purpose**

- show whether the runtime is safe to run
- summarize agent health before the admin drills deeper
- provide the first-stop operator entry point

**Primary content**

- orchestrator status
- last run time
- pending/running/failed task counts
- pending media count
- pending compression count
- recent error count
- top-level pause / resume runtime control
- refresh-all action

**Primary actions**

- `Refresh snapshot`
- `Pause runtime`
- `Resume runtime`
- `Run one full cycle now`

**Why first**

- the operator should see system state before injecting tasks or manually running workers

### 2. Intake

**Purpose**

- preview and manually trigger task injection into `persona_tasks`
- validate notification/public-opportunity selection logic before autonomous running

**Primary content**

- candidate notifications ready for injection
- candidate public opportunities ready for injection
- dedupe / cooldown diagnostics
- why each candidate is eligible or skipped

**Primary actions**

- `Preview notification intake`
- `Preview public intake`
- `Inject selected`
- `Inject all eligible`

**Why second**

- task creation is the start of the runtime pipeline; admins need to verify intake quality before queue processing

### 3. Tasks

**Purpose**

- inspect the actual `persona_tasks` queue and intervene manually

**Primary content**

- filterable task table
- status chips: `PENDING | RUNNING | DONE | FAILED | DEAD`
- task type / dispatch kind / persona / source / retries / cooldown / lease info
- selected-row detail drawer with raw metadata

**Primary actions**

- `Claim test task`
- `Retry task`
- `Mark dead`
- `Requeue`
- `Open related notification/post/comment`

**Why third**

- after intake, the next operator concern is whether queue state and retry behavior are correct

### 4. Run

**Purpose**

- manually execute the worker/orchestrator slices one at a time
- support controlled end-to-end testing before 24H deployment

**Primary content**

- runner cards for:
  - `Orchestrator cycle`
  - `Text worker`
  - `Media worker`
  - `Memory compressor`
- last run result per runner
- elapsed time
- produced side effects summary

**Primary actions**

- `Run orchestrator once`
- `Run next text task`
- `Run next media task`
- `Run next compression batch`
- optional `Dry run` where supported

**Why fourth**

- this is the main manual validation tab; it should only be used after intake and task state look sane

### 5. Memory

**Purpose**

- inspect runtime-written memory and compression outputs
- validate the memory-write and long-memory contracts from the UI

**Primary content**

- persona selector
- canonical long memory viewer
- recent board/thread short memory table
- compression inputs / outputs preview
- memory metadata summary:
  - `source_kind`
  - `continuity_kind`
  - `topic_keys`
  - `promotion_candidate`
  - `expires_at`

**Primary actions**

- `Refresh persona memory`
- `Preview compression input`
- `Run compression for persona`
- `Delete selected short memories` only if you decide to allow manual cleanup later

**Why fifth**

- once a run succeeds, the next validation target is whether memory persistence matches the latest subplans

### 6. Logs

**Purpose**

- inspect failures, retries, and runtime observability without opening SQL manually

**Primary content**

- recent orchestrator run log
- recent AI runtime events
- recent worker failures
- typed reason codes
- raw JSON diagnostics / error details

**Primary actions**

- `Filter by persona`
- `Filter by reason code`
- `Open raw payload`
- `Copy diagnostics`

**Why sixth**

- logs are critical, but they are a support tab rather than the main operator workflow

## Recommended Operator Sequence

Use this exact order in the UI and in documentation. It matches how an admin should validate the runtime before turning on 24/7 deployment.

1. **Overview**
   - confirm runtime is not paused for the wrong reason
   - confirm no obvious failure spikes or stale runner state

2. **Intake**
   - preview what will become tasks
   - confirm dedupe/cooldown behavior
   - manually inject a small batch

3. **Tasks**
   - confirm tasks were created with the expected type/status/priority
   - inspect one or two rows before execution

4. **Run**
   - run one orchestrator cycle or one worker action at a time
   - confirm post/comment/media/compression side effects

5. **Memory**
   - verify memory rows and canonical long memory after successful runs
   - confirm memory shape matches the latest contract

6. **Logs**
   - inspect any errors, slow runs, retries, or malformed output

7. **Only after repeated successful manual runs**
   - enable long-running server process / external scheduler / 24H deployment

## Page-Level UX Rules

- Keep the page operator-first, not analytics-first.
- Every automated action should have a visible manual equivalent.
- Prefer explicit action buttons over hidden background behavior.
- Show typed status and reason codes whenever possible.
- Show raw JSON only in drawers/modals, not inline by default.
- Reuse the current control-plane visual language:
  - stat cards
  - section cards
  - compact helper text
  - preview modal patterns

## Reuse Plan From Existing Admin UI

Reuse directly where possible:

- page auth/loading pattern from `src/app/admin/ai/control-plane/page.tsx`
- top-level panel composition from `src/components/admin/AiControlPlanePanel.tsx`
- section registry pattern from `src/lib/ai/admin/control-plane-types.tsx`
- hook-owned client state pattern from `src/hooks/admin/useAiControlPlane.ts`
- preview surfaces / modal style from:
  - `src/components/admin/control-plane/PreviewPanel.tsx`
  - `src/components/admin/control-plane/InteractionPreviewModal.tsx`
  - `src/components/admin/control-plane/PersonaGenerationPreviewSurface.tsx`

Do not reuse:

- provider/policy/persona-generation business logic inside the agent panel hook
- persona-generation modal state machine as-is for runtime operations

## Proposed Data Snapshot For Initial Render

Initial server payload should include:

- recent orchestrator status summary
- task count summary by status
- runner availability summary
- top personas with pending work
- recent failure summary

Avoid loading full task tables or memory tables on first render. Those should load on demand per tab/filter.

## Proposed APIs By Tab

### Overview

- `GET /api/admin/ai/agent/overview`
- `POST /api/admin/ai/agent/runtime/pause`
- `POST /api/admin/ai/agent/runtime/resume`
- `POST /api/admin/ai/agent/runtime/run-cycle`

### Intake

- `GET /api/admin/ai/agent/intake/preview?kind=notification`
- `GET /api/admin/ai/agent/intake/preview?kind=public`
- `POST /api/admin/ai/agent/intake/inject`

### Tasks

- `GET /api/admin/ai/agent/tasks`
- `POST /api/admin/ai/agent/tasks/[id]/retry`
- `POST /api/admin/ai/agent/tasks/[id]/requeue`
- `POST /api/admin/ai/agent/tasks/[id]/dead`

### Run

- `POST /api/admin/ai/agent/run/orchestrator-once`
- `POST /api/admin/ai/agent/run/text-once`
- `POST /api/admin/ai/agent/run/media-once`
- `POST /api/admin/ai/agent/run/compress-once`

### Memory

- `GET /api/admin/ai/agent/memory/personas/[id]`
- `POST /api/admin/ai/agent/memory/personas/[id]/compress`

### Logs

- `GET /api/admin/ai/agent/logs`
- `GET /api/admin/ai/agent/events`

## Recommended Implementation Order

### Phase 1: Shell

- create route and top-level page
- add sidebar section registry
- add overview stat cards
- add shared refresh flow

### Phase 2: Read-Only Ops

- ship `Overview`, `Tasks`, `Logs` as read-only first
- verify snapshot correctness against DB state

### Phase 3: Manual Control

- add `Intake` preview + inject actions
- add `Run` actions for orchestrator/text/media/compression

### Phase 4: Memory Validation

- add `Memory` inspection surface
- add compression preview/manual trigger

### Phase 5: Production Readiness

- add pause/resume guardrails
- add clearer diagnostics and confirmation modals
- document the manual validation checklist before 24H deployment

## Testing Plan

### UI Tests

- section switching
- stat cards render with snapshot data
- action buttons show loading/error/success states
- task table filters
- memory viewer persona switching

### API Tests

- admin-only access
- overview snapshot shape
- intake preview/inject success and error states
- task action routes
- manual runner routes
- memory/log routes

### Manual Validation Flow

1. Open `Overview`
2. Preview intake candidates
3. Inject one small batch
4. Confirm tasks appear in `Tasks`
5. Run one text task in `Run`
6. Verify side effects in DB/UI
7. Inspect new memory in `Memory`
8. Check diagnostics in `Logs`

## Open Assumptions

- The agent panel should be a separate page, not a fifth tab inside the existing control plane.
- The panel should optimize for runtime operations, not persona authoring.
- Manual-run actions are required before 24H deployment is considered safe.
- Read-only visibility should ship before destructive or high-impact actions.
