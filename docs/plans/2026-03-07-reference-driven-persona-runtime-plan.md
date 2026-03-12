# Reference-Driven Persona Runtime Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a minimal persona-centered creative runtime that powers admin persona generation, admin policy/interaction preview, and live AI agent execution while keeping the persisted model limited to `personas`, `persona_cores`, `persona_memories`, `persona_tasks`, and the existing business tables.

**Architecture:** Introduce shared logic modules for `persona synthesis`, `runtime creative planning`, `candidate generation`, `auto-ranking`, and `final action rendering`, then have admin preview flows and production execution call those same modules. Persist only persona core and unified persona memory, keep `persona_tasks` as the execution record, and write final outputs directly into the existing business tables.

**Tech Stack:** TypeScript, Next.js route handlers, Vitest, Supabase SQL migrations, shared AI prompt/runtime modules

---

### Task 1: Replace the old design docs with the new canonical plan

**Files:**

- Create: `docs/plans/2026-03-07-reference-driven-persona-runtime-design.md`
- Create: `docs/plans/2026-03-07-reference-driven-persona-runtime-plan.md`
- Delete: `docs/plans/2026-03-06-action-output-contract-design.md`
- Delete: `docs/plans/2026-03-06-action-output-contract-plan.md`
- Delete: `docs/plans/2026-03-06-board-context-prompt-design.md`
- Delete: `docs/plans/2026-03-06-board-context-prompt-plan.md`

**Step 1: Review current plan docs**

Run: `rg --files docs/plans`
Expected: old prompt-centric plan docs are still present

**Step 2: Write the new design and implementation plan**

- Capture the three top-level modules: admin UI, production execution, AI agent workflow
- Capture the shared core logic modules and runtime-first strategy
- Record the non-goals and migration direction

**Step 3: Remove obsolete plan docs**

- Delete the four old design/plan files so this new design becomes the single active plan set

**Step 4: Verify the docs directory**

Run: `rg --files docs/plans`
Expected: only the new `2026-03-07-reference-driven-persona-runtime-*` docs remain

### Task 2: Introduce the new persisted persona core schema

**Files:**

- Modify: `supabase/schema.sql`
- Create: `supabase/migrations/<timestamp>_reference_driven_persona_runtime.sql`
- Review: current persona soul schema and related runtime types
- Test: schema tests once identified

**Step 1: Write the failing schema expectations**

- Define a dedicated persisted structure for persona core instead of growing a single generic prompt blob
- Define tables or columns for persona core and unified persona memory
- Ensure persona core persists explicit reference attribution fields for admin inspection and runtime reuse

**Step 2: Inspect current schema dependencies**

Run: `rg -n "persona_souls|soul_profile|persona" supabase/schema.sql src`
Expected: current runtime still depends mainly on `persona_souls` and existing persona tables

**Step 3: Add the migration and schema updates**

- Add normalized storage for persona core
- Add unified persona memory storage
- Extend `poll_votes` so personas can vote on polls
- Keep runtime-first artifacts ephemeral and do not add generation run/trace/output tables

**Step 4: Verify schema parity**

Run: `git diff -- supabase/schema.sql supabase/migrations`
Expected: schema and migration reflect the same new contract

### Task 3: Build the shared persona synthesis module

**Files:**

- Create: `src/lib/ai/persona-synthesis/` module files
- Modify: admin persona generation route/store files once identified
- Test: persona generation preview/store tests once identified

**Step 1: Write failing tests**

- Persona generation should output normalized persona core JSON
- Reference entities should influence synthesis without producing direct cloning
- Persona generation should emit explicit `reference_sources`, `reference_derivation`, and `originalization_note`
- Save flow should persist the canonical payload:
  - `personas`
  - `persona_core`
  - `reference_sources`
  - `reference_derivation`
  - `originalization_note`
  - `persona_memories`
- Legacy preview/save payload sections (`persona_souls`, `persona_memory`, `persona_long_memories`) should no longer appear

**Step 2: Run targeted tests**

Run: `rg -n "persona-generation|prompt-assist|persona-interaction" src -g '*test.ts'`
Expected: identify the current preview/store coverage to extend

**Step 3: Implement minimal synthesis module**

- Accept seed brief plus optional references
- Generate structured persona core
- Include human-readable bio plus structured reference attribution
- Return preview-safe JSON for admin UI
- Save through the new persistence contract

**Step 4: Re-run tests**

Run: `npx vitest run <persona generation related test files>`
Expected: PASS

### Task 4: Build the runtime creative planning module

**Files:**

- Create: `src/lib/ai/runtime-creative-planning/` module files
- Modify: prompt assembly/runtime files currently used by preview and execution
- Test: prompt/runtime planning tests once identified

**Step 1: Write failing tests**

- Planning should assemble task framing, grounding, inferred creator logic, and structure plan
- Policy preview should expose the planning output for each task type

**Step 2: Run targeted tests**

Run: `rg -n "prompt-builder|reply-prompt-runtime|preview" src -g '*test.ts'`
Expected: identify current prompt preview/runtime tests that still assume prompt-only behavior

**Step 3: Implement minimal planning module**

- Load persona core and memory
- Retrieve contextual grounding when needed
- Produce structured planning output shared by preview and execution

**Step 4: Re-run tests**

Run: `npx vitest run <planning related test files>`
Expected: PASS

### Task 5: Build candidate generation and auto-ranking

**Files:**

- Create: `src/lib/ai/candidate-generation/` module files
- Create: `src/lib/ai/auto-ranking/` module files
- Modify: admin interaction preview and production execution entry points
- Test: new unit tests plus existing interaction preview tests

**Step 1: Write failing tests**

- A generation plan should yield multiple candidates
- Auto-ranking should score candidates and mark one as selected
- Interaction preview should show candidates plus final selected output

**Step 2: Run targeted tests**

Run: `rg -n "interaction preview|reply|vote|poll" src -g '*test.ts'`
Expected: identify preview/runtime tests to extend

**Step 3: Implement minimal generation and ranking**

- Generate 3-5 candidates per plan
- Apply a rubric prioritizing groundedness, usefulness, persona fit, and freshness
- Return selected candidate with reasons

**Step 4: Re-run tests**

Run: `npx vitest run <interaction preview and generation test files>`
Expected: PASS

### Task 6: Add final action rendering and persistence wiring

**Files:**

- Create: `src/lib/ai/final-action-renderer/` module files
- Modify: production execution/orchestrator files under `src/agents/phase-1-reply-vote/orchestrator/`
- Modify: persistence helpers once identified
- Test: orchestrator and persistence tests once identified

**Step 1: Write failing tests**

- Selected candidate should be normalized into action-specific final payloads
- Production execution should write final results directly into the existing business tables and update `persona_tasks.result_id/result_type`

**Step 2: Run targeted tests**

Run: `rg -n "orchestrator|atomic persistence|reply execution" src/agents src -g '*test.ts'`
Expected: identify execution and persistence tests to extend

**Step 3: Implement minimal renderer and persistence**

- Normalize final action contracts
- Thread selected candidate into existing execution flow
- Persist only what the task queue and business tables need; do not introduce separate generation output tables

**Step 4: Re-run tests**

Run: `npx vitest run <execution and persistence test files>`
Expected: PASS

### Task 7: Rewire admin UI previews to shared logic modules

**Files:**

- Modify: admin control panel UI/store files once identified
- Modify: admin preview route handlers once identified
- Test: admin preview route/store tests

**Step 1: Write failing tests**

- Persona Generation preview should use persona synthesis
- Persona Generation preview should show explicit source references for the generated persona
- Policy Preview should use runtime creative planning
- Interaction Preview should use planning + candidate generation + auto-ranking + final action

**Step 2: Run targeted tests**

Run: `npx vitest run <admin preview related test files>`
Expected: FAIL against old prompt-only preview path

**Step 3: Implement minimal rewiring**

- Remove duplicated preview-only assembly logic
- Call shared logic modules from admin routes/stores
- Preserve current UI affordances where possible

**Step 4: Re-run tests**

Run: `npx vitest run <admin preview related test files>`
Expected: PASS

### Task 8: Rewire AI agent workflow to production execution

**Files:**

- Modify: task dispatcher / execution agent / runtime integration files once identified
- Test: execution flow integration tests

**Step 1: Write failing tests**

- Runtime task execution should call the new production execution pipeline
- Task types should continue to flow through policy, safety, and persistence boundaries

**Step 2: Run targeted tests**

Run: `npx vitest run <execution flow integration test files>`
Expected: FAIL until workflow is wired to the new execution layer

**Step 3: Implement minimal workflow wiring**

- Keep dispatch/policy/memory orchestration in workflow
- Delegate creative logic to production execution modules

**Step 4: Re-run tests**

Run: `npx vitest run <execution flow integration test files>`
Expected: PASS

### Task 9: Verify integrated behavior and record review evidence

**Files:**

- Modify: `tasks/todo.md`

**Step 1: Run combined targeted verification**

Run: `npx vitest run <all touched test files>`
Expected: PASS

**Step 2: Run focused type validation**

Run: `npx tsc --noEmit --pretty false`
Expected: PASS or no new errors in touched areas

**Step 3: Review database contract consistency**

Run: `git diff -- supabase/schema.sql supabase/migrations`
Expected: migration and schema stay aligned

**Step 4: Update review log**

- Record changed modules, verification commands, and results in `tasks/todo.md`
