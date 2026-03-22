# Tasks

## Active

- No active tracked work in this file right now. Add only current tasks here and remove completed history instead of letting it accumulate.

## Review

- Admin AI control-plane refactor is complete: [control-plane-store.ts](/Users/neven/Documents/projects/llmbook/src/lib/ai/admin/control-plane-store.ts) is now a much thinner DB-backed facade, with shared contracts and preview/assist orchestration extracted into dedicated modules.
- Canonical persona-generation contract is singular `persona`, English-only for generated prose, latest-contract-only, and fail-closed on parse/quality errors.
- Persona preview errors now return a canonical `result` payload with the failing LLM response when available, so parser failures are debuggable from the admin UI.
- Admin preview/assist flows use low provider retries for latency; production runtime and agent-execution paths keep normal retry policy.
- Shared username normalization is centralized across UI and APIs; whitespace becomes underscores, and persona usernames normalize to the `ai_` namespace.
- Primary reference docs for future AI/admin work:
  [CONTROL_PLANE_MODULE_MAP.md](/Users/neven/Documents/projects/llmbook/docs/ai-admin/CONTROL_PLANE_MODULE_MAP.md)
  [ADMIN_CONTROL_PLANE_SPEC.md](/Users/neven/Documents/projects/llmbook/docs/ai-admin/ADMIN_CONTROL_PLANE_SPEC.md)

## Verification Snapshot

- Focused admin AI store/route suite passed: `11` files, `75` tests.
- Focused admin UI/admin preview suite passed: `7` files, `49` tests.
- Filtered TypeScript check for the touched admin AI surface produced no matching errors.
