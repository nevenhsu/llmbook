# Tasks

## Active

- No active tasks.

## Current References

- LLM-flow docs target folder: `docs/ai-agent/llm-flows`

## Review

- Fixed the Interaction Preview migration for `/admin/ai/control-plane`: post/comment/reply previews now run through the same registered flow modules used by `AiAgentPersonaTaskGenerator` without importing the generator into admin preview code. The preview response now carries flow diagnostics, the existing modal surfaces final status, terminal stage, attempts, and gate details, and reply is accepted through the route/UI path. Also restored the mock preview page's seeded task context after the Gemini change had blanked it. Verification passed with `npm run typecheck`, `npm run test:llm-flows` (20 files / 131 tests), and the focused Interaction Preview suite (5 files / 17 tests).
- Cleaned up the Interaction Preview task-type boundary: admin preview explicitly rejects internal post-stage task types such as `post_body`, the route error now lists `reply`, and the service fallback no longer carries old `post`/`post_body` rendering branches. User-facing `post` remains the full staged `post_plan -> post_body` flow. Verification passed with `npm run typecheck`, `npm run test:llm-flows` (20 files / 131 tests), and focused Interaction Preview tests (5 files / 18 tests).
- Verified `/admin/ai/control-plane` → `Interaction Preview` against the current LLM interaction-flow framework. Conclusion: partially aligned, not fully. The tab is not a prompt-only stub and it does use the shared `previewPersonaInteraction()` / `AiAgentPersonaInteractionService` / `runPersonaInteractionStage()` path with selected model routing, persisted persona core, compact prompt assembly, render parsing, and zero admin provider retries. However, the tab calls only `stagePurpose: "main"` and returns `auditDiagnostics: null`, so it bypasses the newer `post/comment/reply` flow modules that perform schema repair, compact semantic audit, quality repair, and flow diagnostics. The route/UI also omits `reply` from the selectable/accepted task types despite the spec listing it. Verification passed with `npm run test:llm-flows` (20 files / 131 tests) plus focused interaction preview tests (3 files / 11 tests).
- Verified `/admin/ai/control-plane` → `Generate Persona` against the current LLM-flow persona-generation contract. The button path uses `POST /api/admin/ai/persona-generation/preview`, which runs the dedicated two-stage `seed -> persona_core` staged JSON flow with parse repair, deterministic quality checks, semantic audit, quality repair, compact carry-forward context, and admin preview retries capped at `0`. `npm run test:llm-flows` passed 20 files / 131 tests. Minor caveat: the pre-run `View Prompt` modal uses a mirrored static prompt-template preview, so it is currently aligned but remains a possible drift point from the runtime service.
- Completed the remaining LLM-flow hardening pass: strict persona-generation parser contracts, fail-closed persona semantic audits, no generate-persona memory payload forwarding, semantic `post_plan` audit/repair, runtime/operator flow-failure diagnostics, and consistent `[output_constraints]` JSON key/type shapes for the previously missing prompts.
- Final verification passed with `npm run verify`: typecheck passed, lint passed with the existing 9 warnings, and `test:llm-flows` passed 20 files / 131 tests.
- Moved completed LLM-flow plan/reference documents into `docs/ai-agent/llm-flows` and updated repo references to the new docs location.
- Tidied `docs/ai-agent/llm-flows`: added a docs index, archived completed implementation plans, renamed current reference docs, removed task-execution sections from current references, and verified stale path checks.
