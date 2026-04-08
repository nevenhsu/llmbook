# Tasks

## Active

- [x] Write a temporary impact note for the shared persist-or-overwrite text write path so upcoming API/UI work has one reference.
- [x] Refactor persona-task runtime persistence so both main text runtime and jobs-runtime decide insert vs overwrite at write time instead of assuming fixed write modes.
- [x] Sync outdated core design docs under `docs/ai-admin` to the current shared generation and persistence architecture.
- [x] Extract a shared `runPersonaInteraction` execution core for post/comment generation so admin preview, main runtime, jobs-runtime, and tests can reuse the same LLM path.
- [x] Refactor `AiAgentPersonaTaskService` into a generation-only service and move overwrite persistence responsibilities out of the persona service layer.
- [x] Rewire the main text runtime to persist first-run post/comment results from shared generation output instead of `execution-preview` output.
- [x] Refactor `AiAgentPersonaTaskService` so shared generation ignores `mode` for prompt construction and does not require persisted result metadata before generation.
- [x] Keep completed-result validation only in the final overwrite persistence path, while continuing to reuse the shared comment flow for notification tasks.
- [x] Add targeted regression tests for the shared persona-task flow refactor and rerun verification semantics.
- [x] Rename the overwrite-only persona-task persistence API so runtime contracts no longer leak the removed `rerun` mode terminology.
- [x] Update operator-console design/status docs to reflect the shared generation refactor, current implementation status, and remaining discussion points.
- [x] Explore current `/admin/ai/agent-lab` and `/admin/ai/agent-panel` implementation, related tests, existing plans, and recent AI agent runtime commits.
- [x] Clarify that `/admin/ai/agent-panel` is moving toward `Operator Console + Hard Split`, and that this turn is design discussion first rather than implementation.
- [x] Revise the panel design around a client-loaded operator console with no server snapshot dependency on page entry.
- [x] Propose an independent admin jobs-runtime so operator-triggered content-edit and persona-memory jobs do not conflict with the existing AI runtime loop.
- [x] Present the validated design for the simplified `/admin/ai/agent-panel` information architecture, tab order, shared table UI, and jobs-runtime controls.
- [x] Ensure the `Memory` tab reads from `persona_memories` and enqueues persona-scoped memory jobs into the shared jobs-runtime instead of executing inline.
- [x] Write the agreed modular design docs under `/plans/ai-agent/operator-console` and update this task log with the reviewed scope.
- [x] Converge the first schema migration draft for `job_tasks`, `job_runtime_state`, `content_edit_history`, and `personas.last_compressed_at`.
- [x] Implement the first jobs-runtime schema migration and sync `supabase/schema.sql`.
- [x] Add a server-side jobs-runtime loop with a script entrypoint to start queue execution.
- [x] Update memory compression persistence to write `personas.last_compressed_at`.
- [x] Allow server-side media regeneration to rerun completed media rows so image redo matches operator rules.
- [x] Implement the real `public_task` / `notification_task` jobs-runtime rewrite path against completed `persona_tasks`.
- [x] Add shared `content_edit_history` persistence for post/comment overwrite mutations so both jobs-runtime and future main runtime overwrite flows append history rows to the same timeline.
- [x] Add targeted tests for jobs-runtime text rewrite execution and content edit history persistence.
- [ ] Implement the remaining `/admin/ai/agent-lab` Phase A page work required by the approved scope.
- [ ] Add or update targeted tests for any `agent-lab` or `agent-panel` behavior changed in this pass.
- [ ] Run verification commands, capture results, and record the review outcome here before closing.

## Previous Review

- [x] Add a local one-shot Phase A dev command that runs the shared persisted Phase A flow without starting the background runtime loop.
- [x] Add test coverage first for the new dev command and Phase A terminal logging behavior.
- [x] Add structured Phase A terminal logs for snapshot source, ingest/new-row counts, opportunities LLM batch progress, candidate/task injection counts, and computed cooldown timing.
- [x] Ensure the local dev command never runs Phase B or Phase C work and does not persist orchestrator cooldown/lease updates to Supabase.
- [x] Verify the new command and targeted tests, then record the review result here.

## Review

- Added `npm run ai:phase-a:once` as a one-shot local Phase A debug command backed by the shared persisted Phase A pipeline.
- The local command prints terminal logs for snapshot source, new `ai_opps` count, opportunities batch progress, public/notification task injection counts, and the computed cooldown timestamp that would be used by runtime.
- The local command does not claim runtime leases, does not start Phase B/Phase C workers, and does not persist orchestrator cooldown state to `orchestrator_runtime_state`.
- Verified with `npm test -- src/lib/ai/agent/intake/opportunity-pipeline-service.test.ts src/lib/ai/agent/orchestrator/local-phase-a-runner-service.test.ts`.
- Added the first `jobs-runtime` server loop under `src/agents/jobs-runtime/runner.ts` and script entry `npm run ai:jobs-runtime:start`.
- Added new schema artifacts for `job_runtime_state`, `job_tasks`, `content_edit_history`, and `personas.last_compressed_at` in `supabase/migrations/20260408093000_add_jobs_runtime_tables.sql`, with matching updates in `supabase/schema.sql`.
- The first executable jobs-runtime path supports `memory_compress` and `image_generation`; `public_task` and `notification_task` are explicitly marked `SKIPPED` until the content rewrite execution path lands.
- Memory compression now persists `personas.last_compressed_at` on successful compression, and media regeneration now allows rerunning completed media rows so redo can overwrite the existing asset metadata.
- Verified with `npm test -- src/lib/ai/agent/jobs/jobs-runtime-service.test.ts src/lib/ai/agent/memory/memory-admin-service.test.ts src/lib/ai/agent/execution/media-job-service.test.ts src/lib/ai/agent/execution/media-job-action-service.test.ts`.
- Verified targeted lint with `npx eslint src/lib/ai/agent/jobs/jobs-runtime-service.ts src/lib/ai/agent/jobs/job-runtime-state-service.ts src/lib/ai/agent/jobs/job-store.ts src/lib/ai/agent/jobs/jobs-runtime-service.test.ts src/lib/ai/agent/memory/memory-admin-service.ts src/lib/ai/agent/execution/media-job-service.ts src/lib/ai/agent/execution/media-job-action-service.ts src/agents/jobs-runtime/runner.ts`.
- `npx tsc --noEmit` still fails due pre-existing unrelated test/type drift in other files; no TypeScript errors were reported for the newly added `jobs-runtime` files or the touched memory/media server files when filtered by path.
- Added shared `AiAgentPersonaTaskService` so `persona_task -> prompt -> persona interaction generation -> parse` is reusable across `first_run`, `rerun`, and preview/test flows.
- Added shared `AiAgentContentMutationService` to append `content_edit_history` rows and overwrite existing `posts/comments`, with post tag replacement support for rewritten posts.
- `jobs-runtime` now executes `public_task` and `notification_task` by rerunning completed `persona_tasks`, then overwriting the persisted `post/comment` target instead of skipping text jobs.
- Verified with `npm test -- src/lib/ai/agent/execution/content-mutation-service.test.ts src/lib/ai/agent/jobs/persona-task-service.test.ts src/lib/ai/agent/jobs/jobs-runtime-service.test.ts src/lib/ai/agent/memory/memory-admin-service.test.ts src/lib/ai/agent/execution/media-job-service.test.ts src/lib/ai/agent/execution/media-job-action-service.test.ts`.
- Verified targeted lint with `npx eslint src/lib/ai/agent/execution/content-mutation-service.ts src/lib/ai/agent/execution/content-mutation-service.test.ts src/lib/ai/agent/jobs/persona-task-service.ts src/lib/ai/agent/jobs/persona-task-service.test.ts src/lib/ai/agent/jobs/jobs-runtime-service.ts src/lib/ai/agent/jobs/jobs-runtime-service.test.ts`.
- Verified filtered TypeScript with `npx tsc --noEmit 2>&1 | rg "src/lib/ai/agent/execution/content-mutation-service|src/lib/ai/agent/jobs/persona-task-service|src/lib/ai/agent/jobs/jobs-runtime-service|src/lib/ai/agent/jobs/persona-task-service.test.ts|src/lib/ai/agent/execution/content-mutation-service.test.ts|src/lib/ai/agent/jobs/jobs-runtime-service.test.ts"` and no matches for the touched/new files.
- Refined `AiAgentPersonaTaskService` to use only `runtime/test` modes: prompt construction is mode-agnostic, notification tasks continue through the shared comment path, and only the persistence wrapper decides whether a runtime write is allowed.
- Verified the refactor with `npm test -- src/lib/ai/agent/jobs/persona-task-service.test.ts src/lib/ai/agent/jobs/jobs-runtime-service.test.ts src/lib/ai/agent/execution/content-mutation-service.test.ts`.
- Verified targeted lint with `npx eslint src/lib/ai/agent/jobs/persona-task-service.ts src/lib/ai/agent/jobs/persona-task-service.test.ts src/lib/ai/agent/jobs/jobs-runtime-service.ts src/lib/ai/agent/jobs/jobs-runtime-service.test.ts`.
- Verified filtered TypeScript with `npx tsc --noEmit 2>&1 | rg "src/lib/ai/agent/jobs/persona-task-service|src/lib/ai/agent/jobs/jobs-runtime-service|src/lib/ai/agent/execution/content-mutation-service|src/lib/ai/agent/jobs/persona-task-service.test.ts|src/lib/ai/agent/jobs/jobs-runtime-service.test.ts|src/lib/ai/agent/execution/content-mutation-service.test.ts"` and no matches for the touched files.
- Renamed the overwrite-only persistence wrapper from `rerunPersistedResult` to `overwritePersistedResult`, and aligned the paired result/worker names (`AiAgentPersonaTaskOverwriteResult`, `executeTextOverwrite`, `textOverwriteResult`) so jobs-runtime no longer carries removed `rerun` terminology.
- Verified the naming refactor with `npm test -- src/lib/ai/agent/jobs/persona-task-service.test.ts src/lib/ai/agent/jobs/jobs-runtime-service.test.ts`.
- Verified targeted lint with `npx eslint src/lib/ai/agent/jobs/persona-task-service.ts src/lib/ai/agent/jobs/persona-task-service.test.ts src/lib/ai/agent/jobs/jobs-runtime-service.ts src/lib/ai/agent/jobs/jobs-runtime-service.test.ts`.
- Verified filtered TypeScript with `npx tsc --noEmit 2>&1 | rg "src/lib/ai/agent/jobs/persona-task-service|src/lib/ai/agent/jobs/jobs-runtime-service|src/lib/ai/agent/jobs/persona-task-service.test.ts|src/lib/ai/agent/jobs/jobs-runtime-service.test.ts"` and no matches for the touched files.
- Extracted shared `runPersonaInteraction()` from the old preview-only surface and added `AdminAiControlPlaneStore.runPersonaInteraction()` so admin preview and runtime generation now share the same post/comment LLM core.
- Added `AiAgentPersonaTaskPersistenceService` for runtime writes, split into `persistGeneratedResult()` for new post/comment inserts and `overwriteGeneratedResult()` for overwrite flows with `content_edit_history`.
- Refactored `AiAgentPersonaTaskService` into generation-only responsibility: it now builds task context, runs the shared interaction core, parses post/comment output, and never writes Supabase rows directly.
- Rewired the main text runtime in `AiAgentAdminRunnerService` to use `generateTaskContent -> persistGeneratedTaskResult` instead of persisting from `execution-preview` output.
- Unified the non-writing generation mode into `preview`; persona-task generation modes are now `runtime | preview`.
- Updated the operator-console docs to reflect the implemented shared generation split:
  - `README.md` now links design, status, and open-question docs
  - `implementation-status.md` records what is already live
  - `open-questions.md` captures what is still not implemented or still needs discussion
  - module docs now describe `runPersonaInteraction()`, generation-only persona service, and separate runtime persistence
- Verified with `npm test -- src/lib/ai/agent/jobs/persona-task-service.test.ts src/lib/ai/agent/execution/persona-task-persistence-service.test.ts src/lib/ai/agent/jobs/jobs-runtime-service.test.ts src/lib/ai/agent/execution/admin-runner-service.test.ts`.
- Verified preview regressions with `npm test -- src/lib/ai/admin/control-plane-store.preview-persona-interaction.test.ts src/app/api/admin/ai/persona-interaction/preview/route.test.ts`.
- Verified targeted lint on the touched runtime/generation files with `npx eslint src/lib/ai/admin/interaction-preview-service.ts src/lib/ai/agent/jobs/persona-task-service.ts src/lib/ai/agent/jobs/persona-task-service.test.ts src/lib/ai/agent/execution/persona-task-persistence-service.ts src/lib/ai/agent/execution/persona-task-persistence-service.test.ts src/lib/ai/agent/execution/admin-runner-service.ts src/lib/ai/agent/execution/admin-runner-service.test.ts src/lib/ai/agent/jobs/jobs-runtime-service.ts src/lib/ai/agent/jobs/jobs-runtime-service.test.ts src/lib/ai/agent/execution/index.ts`; `src/lib/ai/admin/control-plane-store.ts` still reports pre-existing unused-import warnings outside this change.
- Filtered TypeScript for the touched runtime/generation files produced no matches after narrowing away pre-existing `control-plane-store.*` test fixture drift.
- Synced the repo-level core design docs under `docs/ai-admin` so they now describe the current shared generation split instead of the older preview-only or `execution-preview` era wording.
- `CONTROL_PLANE_MODULE_MAP.md` now documents `runPersonaInteraction()` as the shared post/comment core and points runtime persistence responsibilities at `persona-task-persistence-service.ts`.
- `AI_RUNTIME_ARCHITECTURE.md` now includes the implemented `jobs-runtime` lane, the `job_tasks` / `job_runtime_state` queue model, and the current `AiAgentPersonaTaskService -> runPersonaInteraction() -> AiAgentPersonaTaskPersistenceService` text path.
- `AI_PROMPT_ASSEMBLY_DEV_SPEC.md` now states that admin preview, runtime, jobs-runtime, and tests share the same post/comment prompt contract, and it records the current source-context depth and known missing thread data.
- `ADMIN_CONTROL_PLANE_SPEC.md` now treats `Interaction Preview` as a no-write wrapper over the shared core and removes stale `rerun state` wording from preview sandbox guidance.
- Verified doc consistency with `rg -n "rerun state|execution-preview|buildExecutionPreviewFromTask|first run|first-run|runtime \\| test|rerunPersistedResult" docs/ai-admin -g '*.md'`, which returned no matches.
- Reworked `AiAgentPersonaTaskPersistenceService.persistGeneratedResult()` into the single shared write path: it now checks `persona_tasks.result_id/result_type` right before persistence, inserts new content when no target exists, and overwrites existing content with `content_edit_history` when a target already exists.
- `jobs-runtime` no longer assumes text jobs are overwrite-only; it now reuses the same shared persistence path and reports whether the write inserted new content or overwrote an existing target.
- Added regression coverage for insert and overwrite decisions in `persona-task-persistence-service.test.ts`, plus a `jobs-runtime` text insert case.
- Added `plans/ai-agent/operator-console/shared-text-write-impact-note.md` as a temporary reference listing every code path, test surface, and doc/UI follow-up affected by the shared persist-or-overwrite rule.
- Verified with `npm test -- src/lib/ai/agent/execution/persona-task-persistence-service.test.ts src/lib/ai/agent/jobs/jobs-runtime-service.test.ts src/lib/ai/agent/execution/admin-runner-service.test.ts src/lib/ai/agent/execution/text-lane-service.test.ts`.
- Verified targeted lint with `npx eslint src/lib/ai/agent/execution/persona-task-persistence-service.ts src/lib/ai/agent/execution/persona-task-persistence-service.test.ts src/lib/ai/agent/jobs/jobs-runtime-service.ts src/lib/ai/agent/jobs/jobs-runtime-service.test.ts src/lib/ai/agent/execution/admin-runner-service.test.ts src/lib/ai/agent/execution/text-lane-service.test.ts`.
- Verified filtered TypeScript with `npx tsc --noEmit 2>&1 | rg "src/lib/ai/agent/execution/persona-task-persistence-service|src/lib/ai/agent/jobs/jobs-runtime-service|src/lib/ai/agent/execution/admin-runner-service.test.ts|src/lib/ai/agent/execution/text-lane-service.test.ts|src/lib/ai/agent/execution/persona-task-persistence-service.test.ts|src/lib/ai/agent/jobs/jobs-runtime-service.test.ts"` and no matches for the touched files.
