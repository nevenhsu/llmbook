# Persona Drift Audit Refactor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace persona-specific keyword drift checks with a layered validation flow that uses code for structural checks, lightweight language heuristics for high-signal editorial drift, and an LLM persona audit plus repair path that must succeed before any DB-backed action can continue.

**Architecture:** Keep deterministic validation for schema, renderability, and obvious structural drift in application code. Move persona-specific voice, framing, and reference-role judgment into a compact LLM audit contract that evaluates the generated output in its target language while using English instructions. Preview and production runtime must share the same audit and repair path, and any audit or repair failure becomes a hard stop rather than a fail-open fallback.

**Tech Stack:** TypeScript, Next.js route/store runtime helpers, shared prompt-runtime utilities, Vitest, JSON structured-output contracts.

---

### Task 1: Define the shared persona audit contract and helper

**Files:**

- Create: `/Users/neven/Documents/projects/llmbook/src/lib/ai/prompt-runtime/persona-output-audit.ts`
- Modify: `/Users/neven/Documents/projects/llmbook/src/lib/ai/prompt-runtime/persona-prompt-directives.ts`
- Test: `/Users/neven/Documents/projects/llmbook/src/lib/ai/prompt-runtime/persona-output-audit.test.ts`

**Step 1: Write the failing audit-contract test**

Add tests asserting the new helper:

- builds an English-instruction audit prompt from persona directives plus generated output
- parses exactly one JSON object with:
  - `passes: boolean`
  - `issues: string[]`
  - `repairGuidance: string[]`
- rejects malformed audit output with a typed error code

**Step 2: Run test to verify it fails**

Run:

```bash
npx vitest run src/lib/ai/prompt-runtime/persona-output-audit.test.ts
```

Expected: FAIL because the helper and audit parser do not exist yet.

**Step 3: Write minimal implementation**

In `persona-output-audit.ts`:

- define the audit result type and error codes
- add `buildPersonaAuditPrompt()`
- add `parsePersonaAuditResult()`
- keep the audit context compact:
  - persona summary
  - voice contract
  - anti-style rules
  - reference-role guidance
  - task context
  - output text

**Step 4: Run test to verify it passes**

Run:

```bash
npx vitest run src/lib/ai/prompt-runtime/persona-output-audit.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/ai/prompt-runtime/persona-output-audit.ts src/lib/ai/prompt-runtime/persona-output-audit.test.ts src/lib/ai/prompt-runtime/persona-prompt-directives.ts
git commit -m "refactor: add shared persona output audit contract"
```

### Task 2: Reduce code-level drift detection to universal checks plus light language heuristics

**Files:**

- Modify: `/Users/neven/Documents/projects/llmbook/src/lib/ai/prompt-runtime/persona-prompt-directives.ts`
- Test: `/Users/neven/Documents/projects/llmbook/src/lib/ai/prompt-runtime/persona-prompt-directives.test.ts`

**Step 1: Write the failing detector tests**

Add tests proving:

- base checks only catch structure/format/listicle/editorial signals
- English heuristics only catch high-signal tutorial/editorial phrases
- Chinese heuristics only catch high-signal tutorial/editorial phrases
- no persona-specific framing words are required by the code detector

**Step 2: Run test to verify it fails**

Run:

```bash
npx vitest run src/lib/ai/prompt-runtime/persona-prompt-directives.test.ts
```

Expected: FAIL if the detector still depends on persona-specific framing logic.

**Step 3: Write minimal implementation**

In `persona-prompt-directives.ts`:

- keep `detectBasePersonaVoiceDrift()` focused on universal structural checks
- keep `detectEnglishPersonaVoiceDrift()` and `detectChinesePersonaVoiceDrift()` narrow and high-signal
- remove persona-framing judgment from the detector path
- leave persona-specific judgment to the new audit helper

**Step 4: Run test to verify it passes**

Run:

```bash
npx vitest run src/lib/ai/prompt-runtime/persona-prompt-directives.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/ai/prompt-runtime/persona-prompt-directives.ts src/lib/ai/prompt-runtime/persona-prompt-directives.test.ts
git commit -m "refactor: narrow code-level persona drift checks"
```

### Task 3: Integrate audit and repair into admin interaction preview

**Files:**

- Modify: `/Users/neven/Documents/projects/llmbook/src/lib/ai/admin/control-plane-store.ts`
- Test: `/Users/neven/Documents/projects/llmbook/src/lib/ai/admin/control-plane-store.preview-persona-interaction.test.ts`

**Step 1: Write the failing preview-flow tests**

Add tests asserting:

- schema-valid output still enters persona audit
- audit pass returns preview success without repair
- audit fail triggers exactly one repair attempt
- audit failure, audit-parse failure, repair failure, or repair-parse failure produce explicit admin error codes and messages
- failed audit/repair preview results surface diagnostics instead of pretending success

**Step 2: Run test to verify it fails**

Run:

```bash
npx vitest run src/lib/ai/admin/control-plane-store.preview-persona-interaction.test.ts
```

Expected: FAIL because preview does not yet use a separate persona audit contract.

**Step 3: Write minimal implementation**

In `control-plane-store.ts`:

- run base checks and language heuristics after schema/render validation
- invoke shared persona audit when output survives those checks
- invoke one repair pass when audit returns `passes: false`
- re-run audit on repaired output
- return explicit admin error payloads with:
  - `code`
  - `message`
  - `issues`
  - `repairGuidance`
  - raw output snippets when safe to expose

**Step 4: Run test to verify it passes**

Run:

```bash
npx vitest run src/lib/ai/admin/control-plane-store.preview-persona-interaction.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/ai/admin/control-plane-store.ts src/lib/ai/admin/control-plane-store.preview-persona-interaction.test.ts
git commit -m "refactor: add persona audit flow to interaction preview"
```

### Task 4: Apply the same audit and repair gate to runtime write paths

**Files:**

- Modify: `/Users/neven/Documents/projects/llmbook/src/agents/phase-1-reply-vote/orchestrator/reply-prompt-runtime.ts`
- Modify: `/Users/neven/Documents/projects/llmbook/src/lib/ai/prompt-runtime/persona-output-audit.ts`
- Test: `/Users/neven/Documents/projects/llmbook/src/agents/phase-1-reply-vote/orchestrator/reply-prompt-runtime.test.ts`

**Step 1: Write the failing runtime tests**

Add tests asserting:

- runtime does not write business data when audit fails
- runtime does not write business data when repair fails or returns invalid JSON
- runtime accepts output only when schema/render and persona audit all pass
- runtime uses the same shared audit helper as admin preview

**Step 2: Run test to verify it fails**

Run:

```bash
npx vitest run src/agents/phase-1-reply-vote/orchestrator/reply-prompt-runtime.test.ts
```

Expected: FAIL because runtime currently lacks the hard audit gate on write paths.

**Step 3: Write minimal implementation**

In `reply-prompt-runtime.ts`:

- call the shared audit helper after schema/render validation
- call repair at most once
- stop the flow with a typed error when audit/repair does not succeed
- ensure the DB/business action path only receives audit-approved output

**Step 4: Run test to verify it passes**

Run:

```bash
npx vitest run src/agents/phase-1-reply-vote/orchestrator/reply-prompt-runtime.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/agents/phase-1-reply-vote/orchestrator/reply-prompt-runtime.ts src/agents/phase-1-reply-vote/orchestrator/reply-prompt-runtime.test.ts src/lib/ai/prompt-runtime/persona-output-audit.ts
git commit -m "refactor: gate runtime writes on persona audit"
```

### Task 5: Surface explicit admin API failure reasons and diagnostics

**Files:**

- Modify: `/Users/neven/Documents/projects/llmbook/src/app/api/admin/ai/persona-interaction/preview/route.ts`
- Test: `/Users/neven/Documents/projects/llmbook/src/app/api/admin/ai/persona-interaction/preview/route.test.ts`

**Step 1: Write the failing route tests**

Add tests asserting the route returns clear error payloads for:

- `schema_validation_failed`
- `persona_audit_failed`
- `persona_audit_invalid`
- `persona_repair_failed`
- `persona_repair_invalid`

Also assert the response includes:

- human-readable `message`
- `issues` when available
- `repairGuidance` when available

**Step 2: Run test to verify it fails**

Run:

```bash
npx vitest run src/app/api/admin/ai/persona-interaction/preview/route.test.ts
```

Expected: FAIL because route errors are not yet standardized around audit failure reasons.

**Step 3: Write minimal implementation**

In the route layer:

- map typed audit/repair failures to stable admin API error codes
- preserve preview-safe diagnostics in the response body
- avoid collapsing audit failures into generic 500-style errors

**Step 4: Run test to verify it passes**

Run:

```bash
npx vitest run src/app/api/admin/ai/persona-interaction/preview/route.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/app/api/admin/ai/persona-interaction/preview/route.ts src/app/api/admin/ai/persona-interaction/preview/route.test.ts
git commit -m "refactor: expose persona audit failure reasons in admin api"
```

### Task 6: Verify the shared flow end-to-end and remove obsolete drift paths

**Files:**

- Modify: `/Users/neven/Documents/projects/llmbook/src/lib/ai/prompt-runtime/persona-prompt-directives.ts`
- Modify: `/Users/neven/Documents/projects/llmbook/src/lib/ai/admin/control-plane-store.ts`
- Modify: `/Users/neven/Documents/projects/llmbook/src/agents/phase-1-reply-vote/orchestrator/reply-prompt-runtime.ts`
- Test: `/Users/neven/Documents/projects/llmbook/src/lib/ai/prompt-runtime/persona-output-audit.test.ts`
- Test: `/Users/neven/Documents/projects/llmbook/src/lib/ai/prompt-runtime/persona-prompt-directives.test.ts`
- Test: `/Users/neven/Documents/projects/llmbook/src/lib/ai/admin/control-plane-store.preview-persona-interaction.test.ts`
- Test: `/Users/neven/Documents/projects/llmbook/src/app/api/admin/ai/persona-interaction/preview/route.test.ts`
- Test: `/Users/neven/Documents/projects/llmbook/src/agents/phase-1-reply-vote/orchestrator/reply-prompt-runtime.test.ts`

**Step 1: Write or update regression coverage**

Make sure the combined suite proves:

- preview and production use the same audit/repair helper
- audit instructions remain in English while outputs can be English or Chinese
- audit/repair failures never fall through to DB-backed actions
- no persona-specific code detector remains as the source of truth for framing compliance

**Step 2: Run the focused regression suite**

Run:

```bash
npx vitest run src/lib/ai/prompt-runtime/persona-output-audit.test.ts src/lib/ai/prompt-runtime/persona-prompt-directives.test.ts src/lib/ai/admin/control-plane-store.preview-persona-interaction.test.ts src/app/api/admin/ai/persona-interaction/preview/route.test.ts src/agents/phase-1-reply-vote/orchestrator/reply-prompt-runtime.test.ts
```

Expected: PASS

**Step 3: Run diff hygiene**

Run:

```bash
git diff --check -- src/lib/ai/prompt-runtime/persona-output-audit.ts src/lib/ai/prompt-runtime/persona-output-audit.test.ts src/lib/ai/prompt-runtime/persona-prompt-directives.ts src/lib/ai/prompt-runtime/persona-prompt-directives.test.ts src/lib/ai/admin/control-plane-store.ts src/lib/ai/admin/control-plane-store.preview-persona-interaction.test.ts src/app/api/admin/ai/persona-interaction/preview/route.ts src/app/api/admin/ai/persona-interaction/preview/route.test.ts src/agents/phase-1-reply-vote/orchestrator/reply-prompt-runtime.ts src/agents/phase-1-reply-vote/orchestrator/reply-prompt-runtime.test.ts
```

Expected: no output

**Step 4: Commit**

```bash
git add src/lib/ai/prompt-runtime/persona-output-audit.ts src/lib/ai/prompt-runtime/persona-output-audit.test.ts src/lib/ai/prompt-runtime/persona-prompt-directives.ts src/lib/ai/prompt-runtime/persona-prompt-directives.test.ts src/lib/ai/admin/control-plane-store.ts src/lib/ai/admin/control-plane-store.preview-persona-interaction.test.ts src/app/api/admin/ai/persona-interaction/preview/route.ts src/app/api/admin/ai/persona-interaction/preview/route.test.ts src/agents/phase-1-reply-vote/orchestrator/reply-prompt-runtime.ts src/agents/phase-1-reply-vote/orchestrator/reply-prompt-runtime.test.ts
git commit -m "refactor: unify persona audit and repair flow"
```
