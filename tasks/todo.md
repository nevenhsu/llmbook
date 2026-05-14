# Tasks

## Active

- [x] Grill the post-flow canonical prompt-builder boundary against the live runtime, preview, and prompt-runtime contracts.
- [x] Write a new `/plans/persona-v2` implementation plan for the post-flow canonical prompt-builder refactor.
- [x] Sync the active tracker to the new post-flow plan and its core ownership seams.

## Current References

- Target plan: `plans/persona-v2/2026-05-14-post-flow-canonical-prompt-builder-plan.md`
- Reusable handoff prompt: `plans/canonical-flow-prompt-builder-handoff-prompt.md`
- Stable outer entrypoint: `src/lib/ai/prompt-runtime/persona-v2-prompt-family.ts`
- Post orchestrator: `src/lib/ai/agent/execution/flows/post-flow-module.ts`
- Stage service: `src/lib/ai/agent/execution/persona-interaction-stage-service.ts`
- Ownership docs: `docs/ai-agent/llm-flows/prompt-family-architecture.md`, `docs/ai-admin/CONTROL_PLANE_MODULE_MAP.md`

## Review

- **2026-05-14:** Wrote `plans/persona-v2/2026-05-14-post-flow-canonical-prompt-builder-plan.md` after grilling the post-flow boundary against the live repo. The resolved target keeps `buildPersonaPromptFamilyV2()` as the stable outer entrypoint and keeps `post` as the only public post-flow task type, while extracting post-stage prompt-visible ownership into `src/lib/ai/prompt-runtime/post/post-prompt-builder.ts`. The new plan centralizes post-stage instruction text plus selected-plan/post-frame handoff rendering in prompt-runtime, keeps `output_contract` beside `PostPlanOutputSchema` / `PostFrameSchema` / `PostBodyOutputSchema`, leaves `comment` and `reply` out of scope, and pushes `post-flow-module.ts` toward orchestration-only ownership. Verification for this docs-only planning task was limited to focused inspection of the live prompt-family, post-flow module, stage-service, preview route/tests, prompt-family architecture doc, control-plane module map, and diff review of the new plan plus tracker update.
