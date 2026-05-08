# Tasks

## Active

- [x] Inspect one-stage persona-generation budget call sites and isolate legacy multi-stage naming.
- [x] Add focused coverage for one-stage budget semantics.
- [x] Refactor persona-generation budgets to one-stage/purpose-based constants and update direct call sites.
- [x] Run focused verification and record the remaining unrelated prompt-assist test drift.

## Current References

- LLM JSON contract: `docs/dev-guidelines/08-llm-json-stage-contract.md`
- AI-agent flows: `docs/ai-agent/llm-flows`

## Review

- **2026-05-08:** Simplified `persona-generation-token-budgets.ts` to match the one-stage Persona Core v2 flow. Replaced legacy multi-stage exports (`seed`, `persona_core`, stage-summed preview output, and standalone prompt-assist constants) with purpose-based grouped budgets: `PERSONA_GENERATION_BUDGETS` and `PROMPT_ASSIST_BUDGETS`. Updated the direct runtime/template/mock call sites so preview output now tracks one-stage main generation instead of `seed + persona_core`, and prompt-template input budget no longer multiplies by stage count. Added focused budget tests. Focused tests for token budgets, prompt template, preview service, and preview mock page passed; `git diff --check` passed; TypeScript grep for the touched persona budget files returned no matches. `src/lib/ai/admin/control-plane-store.persona-prompt-assist.test.ts` still has unrelated pre-existing expectation drift because it asserts the old string return contract instead of the current `{ text, referenceNames }` shape.
- **2026-05-08:** Fixed `persona-generation-preview-service.ts` audit-flow drift. `persona_core_v2` now actually runs the compact `persona_core_quality_audit` through `validateQualityAsync`, using a narrow audit packet with `identity_anchor` and `persona_core_focus` instead of leaving the semantic-audit helper dead. Also updated quality-repair key targeting from retired v1 keys to current Persona Core v2 keys (`identity`, `mind`, `taste`, `voice`, `forum`, `narrative`, `reference_style`, `anti_generic`). Added focused regression coverage for the audit invocation and prompt packet shape. Verified with focused Vitest runs and `git diff --check`.
- **2026-05-08:** Fixed DeepSeek prompt-assist reference audit wiring. Service now correctly handles structured `object` results when text is empty. Updated provider to forward `providerOptions` (reasoning effort). Refined `PersonaPromptCard` UI and API to handle `referenceNames`.
- **2026-05-08:** Hardened Persona v2 schema gate: `schema_version` is now fully code-owned and removed from prompt/audit instructions. Added direct coverage for `invokeStructuredLLM` surfacing `schemaGateDebug`.
- **2026-05-07:** Finalized Phase 2.5 static prompt constants and Phase 2.7 shared schema repair plans. Defined quality-only audit boundaries and content-mode-specific (discussion/story) prompt blocks.
- **2026-05-06:** Added compact thinking procedures and narrative story support to Persona v2 runtime projection and prompt family plans.
