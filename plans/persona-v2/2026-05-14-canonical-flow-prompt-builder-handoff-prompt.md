# Canonical Flow Prompt Builder Handoff Prompt

Use this as a reusable handoff prompt when refactoring any flow prompt from duplicated runtime/admin preview assembly into one canonical shared prompt builder.

---

## Handoff Prompt

Implement a canonical prompt-builder refactor for `<FLOW_NAME>`.

### Goal

Refactor `<FLOW_NAME>` prompt assembly so runtime invocation and admin/debug/view-prompt surfaces consume one canonical prompt builder. Remove duplicated preview-only or service-local prompt assembly and make prompt edits happen in one shared prompt-runtime location.

### Required Outcome

- runtime prompt assembly is the only source of truth
- preview/debug/view-prompt becomes a consumer of the canonical builder, not a second builder
- all static prompt content for this flow lives together in one prompt-runtime file or folder
- the builder returns generic prompt-building data only
- admin-only presentation data is derived outside the builder

### Target Architecture

Create or refactor to this shape:

```text
src/lib/ai/prompt-runtime/<FLOW_FOLDER>/
  <FLOW_BUILDER_FILE>.ts
  <FLOW_BUILDER_FILE>.test.ts
```

The canonical builder should return a generic result like:

```ts
type FlowPromptBuildResult = {
  assembledPrompt: string;
  blocks: Array<{
    name: string;
    content: string;
  }>;
  messages: Array<{
    role: "system" | "user" | "assistant";
    content: string;
  }>;
};
```

Do not return admin preview UI state, modal copy, or flow-specific presentation wrappers from the builder.

### Core Rules

- keep prompt shape one-stage unless the active contract explicitly requires more than one stage
- do not preserve retired stage wrappers just because old preview UI expected them
- keep code-owned schema/type enforcement out of prompt text unless current product truth explicitly requires leaf-level guidance
- keep dynamic placeholders in the builder
- if placeholder fallback text is specified, preserve the placeholder block and replace the placeholder literally
- do not add admin-local fallback builders or compatibility shells unless explicitly requested
- do not move unrelated flows in the same change

### Inputs You Must Inspect First

1. active plan/spec for `<FLOW_NAME>`
2. current runtime invocation path
3. current preview/view-prompt/debug path
4. current prompt-template or duplicated builder path
5. focused tests covering runtime prompt assembly, preview prompt assembly, and token-budget display
6. ownership docs that describe where this flow currently lives

### Implementation Tasks

#### Task 1: Create The Canonical Shared Builder

- move the static prompt content for `<FLOW_NAME>` into `src/lib/ai/prompt-runtime/<FLOW_FOLDER>/<FLOW_BUILDER_FILE>.ts`
- define one builder entrypoint for the active flow contract
- keep static prompt constants together in this file or local folder
- expose `assembledPrompt`, `blocks`, and `messages`
- remove retired builder/template naming from the API
- add focused tests for:
  - same input => same prompt
  - no legacy stage/template artifacts remain
  - placeholders render correctly
  - empty-placeholder fallback behavior matches the active contract

#### Task 2: Rewire Runtime To Consume The Builder

- remove inline prompt assembly from runtime preview/service code
- import the canonical builder and use its `assembledPrompt` as the real runtime payload
- keep runtime service ownership limited to orchestration:
  - model/provider resolution
  - schema-gate invocation
  - deterministic quality checks
  - response assembly
- if token-budget calculation is still needed, derive it from the actual rendered prompt blocks, not from stale pre-render fragments

#### Task 3: Rewire Preview / View Prompt / Debug Consumers

- remove preview-only builder logic
- derive admin/debug preview state from the canonical builder result
- render the exact prompt block payload the model sees, including block labels if those are part of the assembled prompt
- remove stale staged-preview copy if the flow is now one prompt bundle
- keep admin-specific labels, modal wording, and token-budget presentation outside the builder

#### Task 4: Delete Retired Prompt Assembly Paths

- delete the old preview-only prompt-template/builder file
- remove all imports pointing to it
- update docs/module maps so ownership points to the new prompt-runtime builder
- keep historical docs historical; do not leave retired prompt paths looking current

#### Task 5: Verification

Run focused verification for the touched flow:

```bash
npx vitest run <FOCUSED_TEST_FILES>
git diff --check
```

If repo-wide typecheck is part of the request, run:

```bash
npx tsc --noEmit
```

If full `tsc` is blocked by pre-existing repo errors, report that explicitly and separate it from the touched refactor.

### Full Related File List

Fill this before implementation:

- canonical builder:
  - `src/lib/ai/prompt-runtime/<FLOW_FOLDER>/<FLOW_BUILDER_FILE>.ts`
  - `src/lib/ai/prompt-runtime/<FLOW_FOLDER>/<FLOW_BUILDER_FILE>.test.ts`
- runtime consumer:
  - `<RUNTIME_SERVICE_FILE>`
- preview/debug consumers:
  - `<PREVIEW_SECTION_FILE>`
  - `<PROMPT_MODAL_FILE>`
  - `<PREVIEW_MOCK_FILE>`
- retired path:
  - `<OLD_TEMPLATE_OR_BUILDER_FILE>`
  - `<OLD_TEMPLATE_OR_BUILDER_TEST_FILE>`
- ownership docs:
  - `<MODULE_MAP_OR_DOC_FILE>`

### Non-Goals

- do not change the flow’s schema-gate or persistence contract unless the active plan explicitly requires it
- do not refactor prompt-assist, context-assist, or sibling flows in the same change unless they share the exact duplicate prompt path
- do not leave half-migrated tests asserting the retired prompt shape

### Success Criteria

- one canonical prompt builder exists
- runtime and preview use the same builder output
- no duplicated prompt constants remain
- no retired stage/template wrapper remains unless still required by the active contract
- focused tests reflect the new builder shape and pass
- ownership docs point to the new shared builder path

---

## Adaptation Notes

When reusing this prompt for another flow, fill these placeholders first:

- `<FLOW_NAME>`
- `<FLOW_FOLDER>`
- `<FLOW_BUILDER_FILE>`
- `<RUNTIME_SERVICE_FILE>`
- `<PREVIEW_SECTION_FILE>`
- `<PROMPT_MODAL_FILE>`
- `<PREVIEW_MOCK_FILE>`
- `<OLD_TEMPLATE_OR_BUILDER_FILE>`
- `<OLD_TEMPLATE_OR_BUILDER_TEST_FILE>`
- `<MODULE_MAP_OR_DOC_FILE>`
- `<FOCUSED_TEST_FILES>`

If the target flow has explicit placeholder fallback text, copy the exact fallback strings into the active builder contract and tests. Do not generalize or paraphrase them.

## Review Note

This handoff prompt is derived from the `generate persona` canonical prompt-builder refactor, but rewritten as a reusable structural prompt so the same pattern can be applied to other flow prompts without carrying `generate persona`-specific file names or retired stage assumptions.
