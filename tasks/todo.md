# Tasks

## Active

- [x] Refactor persona runtime packet assembly so `thinkingProcedure` stays outside normal `sections` mutation/render flow.
- [x] Make budget enforcement return the final procedure tail text instead of mutating `sections.thinkingProcedure`.
- [x] Verify focused persona runtime packet tests after the procedure-tail cleanup.
- [x] Move post-flow prompt block order ownership into `src/lib/ai/prompt-runtime/post/post-prompt-builder.ts`.
- [x] Keep only shared `persona_runtime_packet` and `board_context` in the outer persona-v2 prompt family for post stages.
- [x] Add `schema_guidance` and `internal_process` to the post-stage outer block order between `task_context` and `output_contract`.
- [x] Verify focused post prompt builder and persona-v2 prompt family tests after the ownership shift.
- [x] Correct the target module after the user's clarification that the change belongs in `src/lib/ai/prompt-runtime/post/post-prompt-builder.ts`.
- [x] Add `[schema_guidance]` and `[internal_process]` blocks to the `post_frame` post-flow prompt contracts.
- [x] Verify the updated `post_frame` prompt output shape with focused tests.
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

- **2026-05-15:** Updated `src/lib/ai/prompt-runtime/persona-runtime-packets.ts` so every `selectSections()` branch now projects `reference_style.reference_names` alongside `abstract_traits` through a shared `buildReferenceStyleText()` helper. This retires the old runtime-packet assumption that reference names never render and keeps discussion/story packet variants aligned on the same reference-style projection. Verification: `npm test -- src/lib/ai/prompt-runtime/persona-runtime-packets.test.ts`.
- **2026-05-15:** Cleaned up `src/lib/ai/prompt-runtime/persona-runtime-packets.ts` so `thinkingProcedure` no longer round-trips through the normal `sections` render path. `selectSections()` / `renderPacketSections()` now operate on non-procedure sections only, while `enforceBudget()` returns the final procedure tail text separately. This removes the awkward `sections.thinkingProcedure = [procedureLine]` then `delete finalSections.thinkingProcedure` path and keeps budgeted procedure text aligned with the final rendered tail. Verification: `npm test -- src/lib/ai/prompt-runtime/persona-runtime-packets.test.ts`. Extra check `npm test -- src/lib/ai/prompt-runtime/persona-runtime-packets.thinking-procedure.test.ts` still hits a pre-existing baseline failure: `buildAuditPersonaPacket is not a function`.
- **2026-05-15:** Moved canonical post-flow outer block order into `src/lib/ai/prompt-runtime/post/post-prompt-builder.ts` via `POST_PROMPT_BLOCK_ORDER` / `getPostPromptBlockOrder()`, and moved post-owned block content assembly into `buildPostOwnedPromptBlockContent()`. `buildPersonaPromptFamilyV2()` now keeps only shared `persona_runtime_packet` and `board_context` for post stages while sourcing `action_mode_policy`, `content_mode_policy`, `target_context`, `task_context`, `schema_guidance`, `internal_process`, `output_contract`, and `anti_generic_contract` from the post builder. `schema_guidance` / `internal_process` are now distinct outer blocks for all post stages, and comment/reply now include placeholder `schema_guidance` / `internal_process` blocks so the outer block shape stays aligned pending real extraction. Verification: `npm test -- src/lib/ai/prompt-runtime/post/post-prompt-builder.test.ts` and `npm test -- src/lib/ai/prompt-runtime/persona-v2-prompt-family.test.ts`.
- **2026-05-15:** After the user corrected the target path, reverted the mistaken prompt-assist edit and moved the block work into `src/lib/ai/prompt-runtime/post/post-prompt-builder.ts`. The `post_frame` discussion/story policies now expose an explicit `[schema_guidance]` block for the flat `PostFrame` shape and replace the old `[quality_gate]` section with `[internal_process]` so the persona procedure plus quality checks stay explicitly internal. Per the follow-up correction, both blocks now come from helper functions keyed by `{ flow, stage, contentMode }` with a `switch (flow)` entrypoint instead of inline longform block strings. Also re-aligned adjacent `post_plan` prompt-contract text and stale prompt tests so the focused file matches the live contract. Verification: `npm test -- src/lib/ai/prompt-runtime/post/post-prompt-builder.test.ts`.
- **2026-05-14:** Wrote `plans/persona-v2/2026-05-14-post-flow-canonical-prompt-builder-plan.md` after grilling the post-flow boundary against the live repo. The resolved target keeps `buildPersonaPromptFamilyV2()` as the stable outer entrypoint and keeps `post` as the only public post-flow task type, while extracting post-stage prompt-visible ownership into `src/lib/ai/prompt-runtime/post/post-prompt-builder.ts`. The new plan centralizes post-stage instruction text plus selected-plan/post-frame handoff rendering in prompt-runtime, keeps `output_contract` beside `PostPlanOutputSchema` / `PostFrameSchema` / `PostBodyOutputSchema`, leaves `comment` and `reply` out of scope, and pushes `post-flow-module.ts` toward orchestration-only ownership. Verification for this docs-only planning task was limited to focused inspection of the live prompt-family, post-flow module, stage-service, preview route/tests, prompt-family architecture doc, control-plane module map, and diff review of the new plan plus tracker update.
