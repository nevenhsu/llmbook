# Tasks

## Active

- [x] Update the repo architecture documentation in English across `README.md`, `src/lib/ai/README.md`, and a dedicated AI runtime architecture doc so the current orchestrator/text-lane/image/memory model is discoverable outside the plan file.
- [x] Review `plans/ai-persona-agent/AI_PERSONA_AGENT_PLAN.md` against the current schema/runtime and settle the open contracts for watermark ownership, self-recall cooldown semantics, memory scopes/compression, image support parity, and daily usage reset behavior.
- [x] Split persona-generation references into `reference_sources` (personality-bearing only) and `other_reference_sources` (non-personality references) across prompts, parsers, mocks, UI previews, and docs.
- [x] Make the seed-stage semantic audit use LLM output to keep only personality-bearing `reference_sources`, trigger repair if none remain, and stop storing non-personality references in `persona_reference_sources`.
- [x] Update create/update save payloads, admin persona routes, and stored `persona_cores.core_profile` writes to carry `other_reference_sources` while indexing only `reference_sources`.
- [x] Replace prompt-assist internal `{ text, namedReferences }` rewrite output with a two-stage flow: reference JSON resolution first, text-only rewrite second.
- [x] Make prompt-assist audit/repair operate only on the reference JSON stage, then assemble the final public text by appending a fixed trailing reference suffix in app code.
- [x] Update prompt-assist tests/docs and remove stale wording about the old combined structured rewrite contract.
- [x] Move persona-batch reference entry off the inline toolbar textarea into a persona-batch-local modal reused by both admin and preview surfaces.
- [x] Remove the last prompt-assist regex skip-resolution path so optimize mode always resolves personality-bearing references from the input clues.
- [x] Return top-level `rawText` in prompt-assist error payloads for direct debug inspection.
- [x] Remove duplicate prompt-assist error payload fields so the final LLM raw output is exposed only once as `rawText`.
- [x] Update focused prompt-assist tests/docs to match the new resolver flow and debug payload shape, and remove stale wording about old free-text behavior.
- [x] Remove the last deterministic visible-name gate from prompt-assist final validation; reference preservation should now be decided by structured output plus audit/repair only.
- [x] Decide whether prompt-assist should stay free-text with stricter fail-closed audit or migrate to a structured JSON output contract.
- [x] If prompt-assist stays in production use, eliminate audit fail-open behavior for missing-reference checks and cover the regression with focused tests.
- [x] If approved, migrate prompt-assist to a small structured contract that returns final text plus explicit named references before assembling the API response.
- [x] Fix prompt-assist explicit reference preservation for accented multi-word names such as `Gabriel García Márquez`.
- [x] Ground prompt-assist reference audit/repair in the original input so name-only or title-only inputs cannot silently pass as anonymous style descriptions.
- [x] Re-run focused prompt-assist tests and update docs/lessons for the stricter named-reference handling.
- [x] Add a shared generated-persona display-name formatter and use it wherever model output auto-seeds persona identity.
- [x] Keep manual persona identity edits untouched, but auto-format generated names before deriving persona usernames.
- [x] Let paused persona-batch bulk actions stay clickable so the same action resumes remaining rows and a different action can switch to a fresh eligible bulk run.
- [x] Tighten prompt-assist so final persona briefs keep at least one explicit related reference name in visible text, not just a bare stylistic adjective.
- [x] Surface preview-stage LLM attempt details (`finishReason`, provider/model, attempt stage) in preview error payloads.
- [x] Stop re-capping preview repair attempts by the base stage budget so repair/quality-repair flows can use the shared retry headroom.
- [x] Add truncation rescue for preview quality-repair and final compact-retry failures so stage JSON truncation does not surface as generic invalid JSON/missing-field errors.
- [x] Reuse the control-plane persona info card inside the shared persona modal instead of maintaining a second summary-card UI.
- [x] Make persona modal reference labels/count derive only from `personaData.reference_sources`, not a merged row reference list.
- [x] Add a dedicated `persona_reference_sources` table plus schema migration for stored persona references.
- [x] Replace JSON-scan reference checks with indexed reference-table lookups using shared romanized match-key normalization.
- [x] Sync persona reference rows on create/update save paths, add a backfill script, and cover the new behavior with focused tests/docs.
- [x] Write shared batch contracts and persona save-payload mapper for generated persona rows.
- [x] Add bulk reference existence check support via one new admin API and store facade method.
- [x] Extract shared error-detail and persona-data modals plus shared task-status badge UI.
- [x] Build the `/admin/ai/persona-batch` page shell, table, row modals, and chunk-size control.
- [x] Implement row-level and bulk queue orchestration with timers, skip rules, duplicate checks, and disable rules.
- [x] Add focused route/store/hook/component tests and update admin AI docs/module map.
- [x] Polish persona-batch table header placement and dark-theme cell divider contrast.
- [x] Restore persona-batch persona summary card and tighten compact row action styling.
- [x] Refine persona-batch add/check dedupe flow and simplify header/error status UI.
- [x] Align persona-batch header controls, copy feedback, and chunk-size clamping UX.
- [x] Expose row prompt-assist from the edit-context modal and align row action wording to `Prompt`.
- [x] Add preview-only refresh reset and auto-finish bulk loading for persona-batch mock state.
- [x] Return prompt-assist failing LLM output in the API error payload so debug modals can show the actual model response.
- [x] Replace prompt-assist regex reference gating with LLM audit/repair for final explicit-reference validation.
- [x] Add compact retry for length-truncated prompt-assist reference-resolution repairs and stop empty audit transport failures from rejecting already-valid namedReferences JSON.
- [x] Make persona-generation preview quality repair retry on empty/provider-error outputs, add a final quality-repair truncation rescue, and tolerate `creator_admiration` as stage-local context alias drift.
- [x] Let persona-generation preview run another quality-repair round when the previous repair is valid JSON but still fails deterministic quality checks like English-only enforcement.
- [x] Refine persona-batch bulk UX so row time badges are task-colored, resume recomputes current eligible rows, and bulk actions auto-loop until no eligible rows remain or progress stops.
- [x] Add persona-batch auto-next-step bulk sequencing, wire it through the real page plus preview sandbox, and keep the stop condition phrased as a single rule: stop when the eligible set no longer shrinks.
- [x] Default persona-batch `Auto next step` to enabled on both the real page and preview sandbox so bulk flows chain without an extra first-run toggle.

## Review

- AI persona agent plan has been updated to clarify heartbeat vs run-log ownership, self-loop cooldown orchestration, prompt-local selector keys, full post/comment media parity, memory scope definitions, and timezone-aware daily usage reset windows.
- AI persona agent plan now also splits source-layer polling from task-layer decision snapshots, adds a notification-driven reply path bound to `recipient_persona_id`, and updates the notifications schema contract for explicit human/persona recipients.
- AI persona agent plan now treats orchestrator decisions, post/comment generation, and memory compression as one shared text-execution lane with explicit priority ordering: notification replies, public comments, posts, then idle-window memory compression; image generation remains independent.
- AI persona agent plan now clarifies the phase model: Phase A runs Orchestrator alone, Phase B drains all text tasks in priority order, and Phase C uses any cooldown gap for idle maintenance such as memory compression.
- Repo-level docs now expose the current architecture in English: `README.md` includes the high-level execution model, `src/lib/ai/README.md` maps the shared runtime boundaries, and `docs/ai-admin/AI_RUNTIME_ARCHITECTURE.md` provides the detailed cross-cutting runtime overview.
- Existing AI/admin docs now link back to the new architecture overview so operators can find the current orchestrator/text-lane/image/memory model without starting from the implementation plan.
- Admin AI control-plane refactor is complete: [control-plane-store.ts](/Users/neven/Documents/projects/llmbook/src/lib/ai/admin/control-plane-store.ts) is now a much thinner DB-backed facade, with shared contracts and preview/assist orchestration extracted into dedicated modules.
- Canonical persona-generation contract is singular `persona`, English-only for generated prose, latest-contract-only, and fail-closed on parse/quality errors.
- Persona preview errors now return a canonical `result` payload with the failing LLM response when available, so parser failures are debuggable from the admin UI.
- Admin preview/assist flows use low provider retries for latency; production runtime and agent-execution paths keep normal retry policy.
- Shared username normalization is centralized across UI and APIs; whitespace becomes underscores, and persona usernames normalize to the `ai_` namespace.
- Persona batch generation now exists as a separate admin page plus preview sandbox:
  - [/Users/neven/Documents/projects/llmbook/src/app/admin/ai/persona-batch/page.tsx](/Users/neven/Documents/projects/llmbook/src/app/admin/ai/persona-batch/page.tsx)
  - [/Users/neven/Documents/projects/llmbook/src/app/preview/persona-batch/page.tsx](/Users/neven/Documents/projects/llmbook/src/app/preview/persona-batch/page.tsx)
- Batch flow reuses existing prompt-assist / preview / persona save APIs, adds one bulk duplicate-check API, and treats row identity as the save source of truth.
- Persona reference duplicate checking now uses indexed rows in `persona_reference_sources` instead of scanning `persona_cores.core_profile`, and runtime persona create/update keeps that index in sync.
- Prompt-assist now uses a two-stage contract: resolve/audit/repair `namedReferences` JSON first, then generate plain `text`, then append a fixed `Reference sources: ...` suffix before returning `{ text }`.
- Prompt-assist error payloads now expose the final LLM output exactly once as top-level `rawText`, so batch/debug UIs can inspect failures without parsing nested details.
- Prompt-assist no longer tries to prove name visibility inside the free-text rewrite itself; semantic judgment now stays in the reference-resolution audit/repair stage, and the final API text gets a fixed trailing source suffix assembled in app code.
- If prompt-assist reference-resolution repair comes back empty with `finishReason=length`, the service now runs one smaller compact retry before surfacing `prompt_assist_repair_output_empty`.
- If the reference audit transport itself returns empty/invalid output twice, that audit failure is now treated as inconclusive rather than as a semantic rejection when the resolver JSON already parsed into valid `namedReferences`.
- Persona-generation preview quality-repair now retries once when the first repair comes back empty or provider-failed, and it can run a final `quality-repair-3` truncation rescue before surfacing invalid-JSON errors.
- Persona-generation preview quality-repair now also retries parseable-but-still-invalid repaired JSON, so mixed-script/English-only violations get another repair round instead of surfacing immediately as terminal quality failures.
- Persona-generation preview now also retries a non-empty but malformed quality-repair response once more in strict JSON-only mode before surfacing a terminal invalid-JSON error.
- Stage parsers now treat both `creator_admiration` and `task_style_matrix.comment.body_shape` as harmless alias drift and normalize them into canonical `creator_affinity` / `feedback_shape`.
- Persona-generation seed output now splits canonical references into `reference_sources` (personality-bearing only) and `other_reference_sources`; the seed semantic audit trims `reference_sources` with LLM-kept names and forces repair if no valid personality-bearing reference survives.
- Persona create/update now writes `other_reference_sources` into `persona_cores.core_profile`, while `persona_reference_sources` indexes only the filtered personality-bearing `reference_sources`.
- Persona-batch row time badges now use task-specific tones: `Prompt` neutral, `Generate` info, `Save` success.
- Persona-batch bulk actions now recompute eligible rows on resume instead of replaying a stale paused order, and they auto-run additional rounds while the eligible set keeps shrinking.
- Persona-batch now supports an `Auto next step` header toggle in admin and preview: after `Prompt` finishes it can chain into `Generate`, then `Save`, while still stopping once the eligible set stops shrinking.
- `/preview/persona-batch` now mirrors the same bulk semantics as the real hook: chunked bulk tasks auto-run additional rounds, and resume recomputes the current eligible rows instead of continuing a stale paused order.
- Persona-batch header `Clear` now removes both duplicate and saved rows, and the shared tooltip text explicitly matches that broader destructive scope in admin and preview.
- Persona-batch `Reference Sources` entry is now modal-driven: the toolbar only shows a one-line header plus `Add`, while the shared modal owns the textarea, row count, add timer, and add/close controls in both admin and preview.
- Primary reference docs for future AI/admin work:
  [CONTROL_PLANE_MODULE_MAP.md](/Users/neven/Documents/projects/llmbook/docs/ai-admin/CONTROL_PLANE_MODULE_MAP.md)
  [ADMIN_CONTROL_PLANE_SPEC.md](/Users/neven/Documents/projects/llmbook/docs/ai-admin/ADMIN_CONTROL_PLANE_SPEC.md)

## Verification Snapshot

- Current split-reference persona-generation suite passed: `11` files, `73` tests.
- Filtered TypeScript check for the touched admin AI / preview / shared persona-reference surface produced no matching errors.

- [x] Change persona-batch default chunk size from 10 to 5 in real hook and preview mock.
- [x] Update focused persona-batch tests for the new default.
- [x] Verify focused tests and diff hygiene.
