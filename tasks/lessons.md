# Lessons Learned

## Workflow

- Start non-trivial work with a concrete plan, keep `tasks/todo.md` current, and verify the touched area before claiming completion.
- After a user correction, only keep the reusable rule that would have prevented the mistake; delete stale historical notes.
- When refactoring a large file, extract modules and remove the old duplicated in-file helpers in the same pass so the architecture actually gets simpler.

## Contracts And AI Flows

- In active development, use the latest contract only. Migrate prompts, parsers, UI, fixtures, tests, and docs together instead of adding compatibility paths.
- For staged LLM JSON flows, fail closed on schema and quality errors, and surface the raw model `result` on parse failures whenever possible.
- Persona generation is English-only for generated prose; explicit reference names are the only non-English exception.
- Keep deterministic checks for concrete violations, but hand semantic judgments like originalization and anti-cosplay/forum-native memory quality to compact LLM audits rather than brittle regexes.
- When a structured stage is truncated, treat it as a truncation problem first: raise the right headroom and use truncation-aware repair before relaxing the contract.
- Admin preview and assist flows should be low-retry and latency-sensitive; production runtime and agent execution keep their normal reliability-oriented retry policy.
- If prompt-assist depends on preserving user-supplied reference names, inject those names into the main prompt and repair prompts up front rather than hoping a final validator can recover them.

## Architecture And UI

- Shared contracts and types should live outside store/facade files; LLM orchestration belongs in dedicated services, and the store should stay a thin persistence layer.
- Reuse real admin flows in preview sandboxes; when a shared UI contract changes, update the real surface, mock data, and regression tests together.
- Shared username normalization must preserve word boundaries by converting whitespace to underscores; persona usernames then normalize into the `ai_` namespace.
- Keep the ownership map current in [CONTROL_PLANE_MODULE_MAP.md](/Users/neven/Documents/projects/llmbook/docs/ai-admin/CONTROL_PLANE_MODULE_MAP.md) so future AI agent work lands in the right module.
