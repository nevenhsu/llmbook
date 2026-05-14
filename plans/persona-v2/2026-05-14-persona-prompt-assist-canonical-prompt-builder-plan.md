# Persona Prompt-Assist Simplification Plan

**Goal:** Simplify `/api/admin/ai/persona-generation/prompt-assist` into one `invokeStructuredLLM` call that returns structured PromptAssist output, while moving PromptAssist's canonical prompt text into one `prompt-runtime` file.

**Architecture:** `prompt-assist` is an admin helper pipeline, not a `Flow`. The live implementation now uses one code-owned PromptAssist schema plus one canonical prompt renderer. This plan documents and hardens that one-call `invokeStructuredLLM` shape: the model returns only the structured PromptAssist payload, while app code adds debug artifacts, enforces minimal deterministic checks, and surfaces success/failure envelopes.

**Resolved Decisions:**

- PromptAssist becomes one `invokeStructuredLLM` call.
- The LLM-owned output schema is `{ text, referenceNames }`.
- The API success envelope becomes `{ text, referenceNames, debugRecords }`.
- `debugRecords` reuses the existing shared `StageDebugRecord[]` shape.
- If `referenceNames` is empty after normalization, PromptAssist fails.
- `text` must not be empty after `trim()`.
- `debugRecords` is not part of the LLM schema; app code attaches it to success and failure responses.
- Canonical prompt text stays in `prompt-runtime`, not `admin/*`.
- The canonical prompt file is `src/lib/ai/prompt-runtime/persona/prompt-assist-prompt.ts`.
- The PromptAssist schema lives in a narrow dedicated file, not inside the service and not inside `persona-generation-contract.ts`.
- Do not preserve the old trailing `Reference sources: ...` suffix contract.
- Remove old PromptAssist-specific retry / repair / audit / resolution assumptions from the implementation.

**Non-Goals:**

- Do not introduce shared builder abstractions or shared prompt-build result types.
- Do not modify `src/lib/ai/prompt-runtime/persona/generation-prompt-builder.ts`.
- Do not refactor sibling helper pipelines such as interaction `context-assist`.
- Do not preserve the old multi-call PromptAssist behavior.
- Do not keep PromptAssist-specific error-code taxonomy unless implementation proves one new code is truly necessary.

---

## Current Problem

The live PromptAssist code has already moved to the simpler one-call model, but surrounding planning and tracker material can still drift back toward older assumptions. The active contract that must stay aligned is:

- one structured LLM call
- one schema-owned result object
- one prompt file for canonical static prompt content
- one debug envelope shape shared with existing preview tooling

## Target Shape

### Prompt file

```text
src/lib/ai/prompt-runtime/persona/prompt-assist-prompt.ts
```

This file owns PromptAssist's canonical static prompt content and renders the final prompt text for the single structured call.

Recommended surface:

```ts
export function renderPromptAssistPrompt(input: { inputPrompt: string }): string;
```

Notes:

- keep this as a narrow render helper, not a larger builder abstraction
- do not move it back under `src/lib/ai/admin/*`
- do not split it into prompt families or retry-specific prompt files

### PromptAssist schema

```text
src/lib/ai/admin/prompt-assist-schema.ts
```

Recommended surface:

```ts
export const PromptAssistSchema = z.object({
  text: z.string(),
  referenceNames: z.array(z.string()).min(1).max(3),
});

export type PromptAssist = z.infer<typeof PromptAssistSchema>;
```

Notes:

- the schema is code-owned and narrow
- do not embed full key/type JSON skeletons in the prompt text
- model output schema is only `{ text, referenceNames }`
- `debugRecords` belongs to the API/code envelope, not the schema

## Implementation Plan

### Task 1: Add The New PromptAssist Prompt File

**Files:**

- Add: `src/lib/ai/prompt-runtime/persona/prompt-assist-prompt.ts`

**Steps:**

- Move PromptAssist's canonical static prompt wording into this file.
- Render one prompt for one structured PromptAssist call.
- Keep the prompt focused on generating:
  - a concise persona brief in `text`
  - 1 to 3 personality-bearing `referenceNames`
- Do not include retry / repair prompt text.
- Do not include audit / resolution / rewrite sub-prompt scaffolding.
- Do not include a full JSON key/type skeleton.
- Use compact output policy wording aligned with `invokeStructuredLLM` and the shared JSON-stage contract.

### Task 2: Add The Narrow PromptAssist Schema

**Files:**

- Add: `src/lib/ai/admin/prompt-assist-schema.ts`

**Steps:**

- Define the new code-owned Zod schema for PromptAssist output.
- Export both schema and inferred type.
- Keep the file narrow: schema ownership only.
- Do not move unrelated persona-generation parsing helpers into this file.

### Task 3: Rewrite `persona-prompt-assist-service.ts` Around One Structured Call

**Files:**

- Modify: `src/lib/ai/admin/persona-prompt-assist-service.ts`
- Reference: `src/lib/ai/llm/invoke-structured-llm.ts`
- Reference: `src/lib/ai/stage-debug-records.ts`

**Steps:**

- Delete the old multi-call PromptAssist flow:
  - reference resolution call
  - reference audit call
  - rewrite call
  - repair / retry branches
- Replace it with one `invokeStructuredLLM` call using the new PromptAssist schema.
- Build the prompt through `renderPromptAssistPrompt({ inputPrompt })`.
- Reuse existing provider/model resolution and low-latency admin invocation settings.
- Build one `StageDebugRecord` for this call and expose it as `debugRecords`.
- Normalize the structured output minimally:
  - trim `text`
  - trim `referenceNames`
  - remove empty names
  - dedupe names if needed
- Enforce only the minimal deterministic checks:
  - `text` must not be empty
  - `referenceNames` must not be empty
- Return success as:
  - `{ text, referenceNames, debugRecords }`
- Return failure with:
  - `error`
  - `rawText`
  - `debugRecords`
  - schema/debug details when available
- Remove PromptAssist's old suffix assembly behavior.
- Remove reliance on `validatePromptAssistResult()`.

### Task 4: Simplify Route, Hook, And Contract Surfaces

**Files:**

- Modify: `src/app/api/admin/ai/persona-generation/prompt-assist/route.ts`
- Modify: `src/hooks/admin/useAiControlPlane.ts`
- Modify if needed: `src/lib/ai/admin/control-plane-contract.ts`

**Steps:**

- Update the route success payload to return:
  - `text`
  - `referenceNames`
  - `debugRecords`
- Update route failure payload to drop PromptAssist-specific top-level `code`, but keep:
  - `error`
  - `rawText`
  - `debugRecords`
- Remove `stripPromptAssistReferenceSuffix()` usage from the control-plane hook.
- Remove or shrink PromptAssist-specific contract types that only existed for the old multi-call path, including old attempt-label / error-code structures if they are no longer needed by the new implementation.

### Task 5: Delete Retired PromptAssist Helpers And Old Assumptions

**Files:**

- Modify: `src/lib/ai/admin/persona-generation-contract.ts`
- Modify: `src/lib/ai/admin/control-plane-store.persona-prompt-assist.test.ts`
- Modify: `src/hooks/admin/useAiControlPlane.prompt-assist.test.ts`
- Modify: `src/app/api/admin/ai/persona-generation/prompt-assist/route.test.ts`

**Steps:**

- Delete PromptAssist-only helpers that exist only for the retired multi-call flow.
- Remove `validatePromptAssistResult()` if no other live caller needs it.
- Remove tests that assert:
  - suffix-based `text`
  - retry / repair prompt wording
  - PromptAssist-specific old error-code payloads
- Replace them with tests for the new single-call structured contract.

### Task 6: Realign Ownership Docs

**Files:**

- Modify: `docs/ai-admin/CONTROL_PLANE_MODULE_MAP.md`
- Modify: `docs/ai-admin/ADMIN_CONTROL_PLANE_SPEC.md`

**Steps:**

- Update docs so PromptAssist prompt wording ownership starts in:
  - `src/lib/ai/prompt-runtime/persona/prompt-assist-prompt.ts`
- Update docs so PromptAssist schema ownership starts in:
  - `src/lib/ai/admin/prompt-assist-schema.ts`
- Remove stale descriptions of PromptAssist as a multi-call resolution / audit / rewrite helper.
- Remove stale guidance that points prompt changes first to `persona-prompt-assist-service.ts`.

## Verification

Run focused verification for the new one-call PromptAssist contract:

```bash
npx vitest run \
  src/lib/ai/admin/control-plane-store.persona-prompt-assist.test.ts \
  src/app/api/admin/ai/persona-generation/prompt-assist/route.test.ts \
  src/hooks/admin/useAiControlPlane.prompt-assist.test.ts
```

Add prompt/runtime contract coverage where touched:

```bash
npx vitest run \
  src/lib/ai/prompt-runtime/prompt-hardcode-guard.test.ts
```

Then run:

```bash
npx tsc --noEmit
git diff --check
```

If `tsc` is blocked by unrelated repo failures, report that separately from the PromptAssist change.

## Full Related File List

Primary implementation targets:

- `src/lib/ai/prompt-runtime/persona/prompt-assist-prompt.ts`
- `src/lib/ai/admin/prompt-assist-schema.ts`
- `src/lib/ai/admin/persona-prompt-assist-service.ts`
- `src/app/api/admin/ai/persona-generation/prompt-assist/route.ts`
- `src/hooks/admin/useAiControlPlane.ts`
- `docs/ai-admin/CONTROL_PLANE_MODULE_MAP.md`
- `docs/ai-admin/ADMIN_CONTROL_PLANE_SPEC.md`

Likely cleanup / verification touchpoints:

- `src/lib/ai/admin/control-plane-contract.ts`
- `src/lib/ai/admin/persona-generation-contract.ts`
- `src/lib/ai/admin/control-plane-store.persona-prompt-assist.test.ts`
- `src/app/api/admin/ai/persona-generation/prompt-assist/route.test.ts`
- `src/hooks/admin/useAiControlPlane.prompt-assist.test.ts`
- `src/lib/ai/prompt-runtime/prompt-hardcode-guard.test.ts`

## Success Criteria

- PromptAssist uses one `invokeStructuredLLM` call.
- The LLM-owned output schema is only `{ text, referenceNames }`.
- `debugRecords` reuses the existing shared debug-record shape.
- `text` no longer carries the old appended reference suffix.
- Empty `referenceNames` fails closed.
- Empty `text` fails closed.
- Old PromptAssist retry / repair / audit / resolution logic is removed.
- Canonical prompt text lives in one `prompt-runtime` file.
- PromptAssist schema lives in one narrow dedicated schema file.
- Control-plane docs point to the new ownership boundaries.

## Review Note

This plan replaces the earlier "canonical prompt-builder family" direction. The active target is now much narrower and simpler: one PromptAssist prompt file, one PromptAssist schema file, one structured call, one shared debug envelope, and deletion of the retired multi-call PromptAssist logic.
