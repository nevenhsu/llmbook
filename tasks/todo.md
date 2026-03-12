# Tasks

## Active

- [x] Diagnose why persona forum replies become agreeable but shallow
- [x] Define prompt constraints that require subjective stance and discussion advancement
- [x] Deliver revised prompt blocks and evaluation criteria
- [x] Design persona-driven creator affinity and composition framework architecture
- [x] Define required data model changes for grounded creative structuring
- [x] Produce implementation-ready design doc after discussion alignment
- [x] Rewrite active AI docs to align with reference-driven persona runtime architecture
- [x] Remove obsolete prompt-only plan docs and keep one canonical plan set
- [x] Update persona generation docs to require explicit reference attribution
- [x] Align minimal schema proposal with existing schema and draft migration SQL
- [x] Add minimal persona core and unified memory schema plus persona poll vote support
- [x] Switch runtime soul loader from `persona_souls` to `persona_cores` with a persona-core adapter
- [x] Switch runtime memory context from legacy memory tables to unified `persona_memories`
- [x] Extend runtime task/model/type unions and heartbeat payloads for `poll_vote`
- [x] Move admin control-plane persona persistence off legacy persona tables
- [x] Drop legacy persona tables and cleanup function from final schema/migrations
- [x] Cut admin persona generation/preview/save to the canonical `personas + persona_core + reference attribution + persona_memories` contract
- [x] Write a dedicated implementation plan for the remaining `generate persona` feature flow
- [x] Let `/admin/ai/control-plane` Prompt AI preserve named reference targets in `Context / Extra Prompt`
- [ ] Replace one-shot persona generation preview with segmented generation and server-side assembly
- [ ] Implement production dispatch/execution flow for non-reply `vote` / `poll_vote` tasks

## Review

- Root cause: prompt over-weights persona tone and cooperative brainstorming, but does not require disagreement, judgment, or new thread-value.
- Fix direction: add explicit reply objective, hard constraints for stance/new angle, anti-sycophancy rules, and evaluation rubric tied to discussion value rather than warmth.
- Approved new architecture direction: unify `reference-driven persona synthesis`, `runtime creative planning`, and `auto-ranking generation` under shared logic modules used by admin UI, production execution, and AI agent workflow.
- Runtime strategy: persist persona core and traces, keep creator/framework/knowledge selection runtime-first in V1, and remove old prompt-only plan docs so the new design is the single source of truth.
- Active docs updated: admin prompt/runtime spec, persona generator docs, phase1 runtime README, and shared AI README now describe the new module boundaries instead of treating prompt assembly or `persona_souls.soul_profile` as the long-term architecture center.
- Persona generation contract tightened: generated bio must be backed by explicit `reference_sources`, `reference_derivation`, and `originalization_note` so admin preview and runtime can both see who the persona was derived from.
- Minimal schema direction finalized: keep `personas` and `persona_tasks`, introduce `persona_cores` and unified `persona_memories`, write final outputs directly into existing business tables, and extend `poll_votes` so AI personas can vote on polls.
- Implemented schema layer only: added `persona_cores`, added unified `persona_memories`, extended `persona_tasks` and `task_intents` for `poll_vote`, extended `ai_thread_memories` task type coverage, and updated `poll_votes` to support either `user_id` or `persona_id`.
- Verification: `git diff --check -- supabase/schema.sql supabase/migrations/20260312093000_minimal_persona_core_and_poll_vote.sql` passed; schema and migration were also spot-checked with `rg` to confirm matching support for `persona_cores`, `persona_memories`, and persona poll voting.
- Runtime storage migration is now active for the AI agent path: soul loading reads `persona_cores.core_profile`, memory context reads `persona_memories`, and runtime keeps the previous prompt-facing shape via an adapter instead of dual-writing old tables.
- Runtime contracts now recognize `poll_vote` across task intents, queue/review/task model unions, LLM task typing, and heartbeat payload ingestion; `poll_votes` events now expose `personaId` in the runtime data source.
- Verification: targeted vitest suites passed for runtime soul, runtime memory, task dispatch, reply execution, and heartbeat intent collection. Full `tsc --noEmit` still fails on pre-existing unrelated errors outside this migration slice.
- Admin control-plane persistence now writes persona core and unified persona memories only; there are no remaining `src` SQL reads/writes against `persona_souls`, `persona_memory`, `ai_thread_memories`, or `persona_long_memories`.
- Legacy tables are removed from `supabase/schema.sql`, a dedicated drop migration was added, and `supabase/verification.sql` was updated to validate `persona_cores` plus `persona_memories` instead of the removed tables.
- Current migration focus: finish the app-facing persona generation contract so admin control plane and AI agent runtime both use the same canonical `persona_core` payload, without `soulProfile` or split memory payload sections.
- Persona generation is now cut to the canonical payload in the admin path: preview parser, save route, interaction preview override, and app-facing labels all use `persona_core`, explicit reference attribution, and unified `persona_memories`.
- Verification: targeted vitest suites passed for persona generation preview, persona interaction preview, persona create route, and persona profile get/patch route. `git diff --check` passed for the touched files.
- Dedicated implementation handoff is now saved in `docs/plans/2026-03-13-generate-persona-implementation-plan.md` so the feature can be executed task-by-task without re-deriving the contract.
- Prompt AI on `/admin/ai/control-plane` now treats `Context / Extra Prompt` as a valid place for named references; prompt assist instructions preserve explicit creator/artist/public-figure/fictional-character names instead of genericizing them.
- Verification: `control-plane-store.persona-prompt-assist`, `persona-generation-preview`, and `persona-generation/preview` route tests all passed, and the touched files pass `git diff --check`.
- Prompt assist no longer throws `prompt assist returned empty output` for blank model responses; it now falls back to the normalized user prompt when input exists, or to a safe default seed prompt when input is empty.
- Verification: prompt-assist store and route tests passed after adding explicit empty-output fallback coverage.
- Persona generation preview now retries once with a shorter repair prompt when the first model response is truncated or invalid JSON, and schema-invalid outputs now surface as 422 with the actual missing-field message instead of a generic JSON parse error.
- Verification: persona-generation preview store and route tests passed after adding retry and schema-error coverage.
- Persona generation prompt now constrains nested field shapes and shorter payloads more aggressively, reducing the chance of truncated JSON such as outputs that stop mid-`value_hierarchy`.
- Persona generation preview now performs a third ultra-compact retry when both the initial response and the first repair response are still truncated JSON, reducing repeated 422s from long persona payloads that stop mid-object.
- Verification: persona-generation preview and prompt-assist test suites passed after adding third-retry coverage for repeated truncation.
- New recommended fix direction: stop treating persona generation as a single JSON emission problem and split preview generation into smaller validated stages, while keeping the persisted canonical persona payload unchanged.

## Current State

- AI control plane persona generation uses shared runtime timeout/retry policy.
- Generate Persona uses a modal with loading state, elapsed timer, cancel support, preview/error display, and save gating.
- Prompt assist supports:
  - empty input -> concise English prompt
  - existing input -> concise same-language optimization
- Persona generation parse failures now surface raw model output in the modal.
- Transient model/provider errors such as timeout no longer auto-disable models; hard failures such as insufficient balance still can.
