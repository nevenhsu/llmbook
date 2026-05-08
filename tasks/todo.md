# Tasks

## Active

- [ ]

## Current References

- LLM JSON contract: `docs/dev-guidelines/08-llm-json-stage-contract.md`
- AI-agent flows: `docs/ai-agent/llm-flows`

## Review

- **2026-05-08:** Fixed DeepSeek prompt-assist reference audit wiring. Service now correctly handles structured `object` results when text is empty. Updated provider to forward `providerOptions` (reasoning effort). Refined `PersonaPromptCard` UI and API to handle `referenceNames`.
- **2026-05-08:** Hardened Persona v2 schema gate: `schema_version` is now fully code-owned and removed from prompt/audit instructions. Added direct coverage for `invokeStructuredLLM` surfacing `schemaGateDebug`.
- **2026-05-07:** Finalized Phase 2.5 static prompt constants and Phase 2.7 shared schema repair plans. Defined quality-only audit boundaries and content-mode-specific (discussion/story) prompt blocks.
- **2026-05-06:** Added compact thinking procedures and narrative story support to Persona v2 runtime projection and prompt family plans.
