# Tasks

## Active

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

## Review

- Admin AI control-plane refactor is complete: [control-plane-store.ts](/Users/neven/Documents/projects/llmbook/src/lib/ai/admin/control-plane-store.ts) is now a much thinner DB-backed facade, with shared contracts and preview/assist orchestration extracted into dedicated modules.
- Canonical persona-generation contract is singular `persona`, English-only for generated prose, latest-contract-only, and fail-closed on parse/quality errors.
- Persona preview errors now return a canonical `result` payload with the failing LLM response when available, so parser failures are debuggable from the admin UI.
- Admin preview/assist flows use low provider retries for latency; production runtime and agent-execution paths keep normal retry policy.
- Shared username normalization is centralized across UI and APIs; whitespace becomes underscores, and persona usernames normalize to the `ai_` namespace.
- Persona batch generation now exists as a separate admin page plus preview sandbox:
  - [/Users/neven/Documents/projects/llmbook/src/app/admin/ai/persona-batch/page.tsx](/Users/neven/Documents/projects/llmbook/src/app/admin/ai/persona-batch/page.tsx)
  - [/Users/neven/Documents/projects/llmbook/src/app/preview/persona-batch/page.tsx](/Users/neven/Documents/projects/llmbook/src/app/preview/persona-batch/page.tsx)
- Batch flow reuses existing prompt-assist / preview / persona save APIs, adds one bulk duplicate-check API, and treats row identity as the save source of truth.
- Persona reference duplicate checking now uses indexed rows in `persona_reference_sources` instead of scanning `persona_cores.core_profile`, and one-off rebuilds use [backfill-persona-reference-sources.ts](/Users/neven/Documents/projects/llmbook/scripts/backfill-persona-reference-sources.ts) via `npm run ai:persona-reference:backfill`.
- Primary reference docs for future AI/admin work:
  [CONTROL_PLANE_MODULE_MAP.md](/Users/neven/Documents/projects/llmbook/docs/ai-admin/CONTROL_PLANE_MODULE_MAP.md)
  [ADMIN_CONTROL_PLANE_SPEC.md](/Users/neven/Documents/projects/llmbook/docs/ai-admin/ADMIN_CONTROL_PLANE_SPEC.md)

## Verification Snapshot

- Focused admin AI store/route suite passed: `11` files, `75` tests.
- Focused admin UI/admin preview suite passed: `7` files, `49` tests.
- Focused persona-batch suite passed:
  - shared modal tests
  - batch queue test
  - batch hook test
  - batch table/page/preview tests
- Filtered TypeScript check for the touched admin AI surface produced no matching errors.
