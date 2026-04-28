# LLM Flows Audit Remediation Plan

> **For Codex:** Implement this plan task-by-task. Each task is self-contained with file lists, steps, and verification commands.

**Goal:** Close the remaining gaps between the LLM flow plans and their implementation. The architecture skeleton is fully landed (≈ 88% complete). This plan addresses the 8 specific issues identified by the quality audit dated 2026-04-28.

**Context:** All existing tests pass (15 files / 69 tests). The flow registry, prompt family split, persona generation simplification, and reference-role doctrine are all implemented. The remaining work is:

1. Wiring audit/repair loops into flow modules (currently the audit contracts exist but are not called from the flow modules)
2. Expanding persona audit granularity from single `persona_fit` to four-dimensional doctrine checks
3. Fixing edge-case bugs and type gaps

**Tech Stack:** TypeScript, Vitest, prompt-runtime contracts, flow modules, persona-prompt-directives.

---

## Preconditions

- All tests in `src/lib/ai/prompt-runtime/` and `src/lib/ai/agent/execution/flows/` must pass before starting.
- Read `docs/dev-guidelines/08-llm-json-stage-contract.md` for the canonical staged pattern.

## Guardrails

- Audit prompts use **compact review packets** (minimal context for judgment).
- Repair prompts use **fuller rewrite packets** (enough context to fix the output).
- Audit prompts must not fail just because omitted generation context is absent.
- Do not add backward-compatibility paths; migrate in place.
- Every task must end with passing tests.

---

## Phase 1: Foundational Refactors

### Task 1: Extract Shared JSON Parse Utilities

**Priority:** P3 — reduces duplication before larger edits.

**Why:** Four audit/contract files duplicate identical `normalizeText()`, `extractJsonFromText()`, `parseJsonObject()`, `readStringArray()` functions (~120 lines duplicated).

**Files:**

- Create: `src/lib/ai/prompt-runtime/json-parse-utils.ts`
- Create: `src/lib/ai/prompt-runtime/json-parse-utils.test.ts`
- Modify: `src/lib/ai/prompt-runtime/post-body-audit.ts`
- Modify: `src/lib/ai/prompt-runtime/comment-flow-audit.ts`
- Modify: `src/lib/ai/prompt-runtime/reply-flow-audit.ts`
- Modify: `src/lib/ai/prompt-runtime/post-plan-contract.ts`

**Steps:**

1. Create `json-parse-utils.ts` exporting: `normalizeText`, `extractJsonFromText`, `parseJsonObject`, `readStringArray`, `readCheckStatus`.
2. Write unit tests for each function in `json-parse-utils.test.ts`.
3. Replace the local definitions in the four files above with imports from `json-parse-utils.ts`.
4. Ensure error types remain consistent — `PersonaOutputValidationError` for audit files, plain `Error` for `post-plan-contract.ts`. Pass the error constructor as a parameter to `parseJsonObject` or keep a thin wrapper in each file.
5. Run tests:

```bash
npm test -- src/lib/ai/prompt-runtime/json-parse-utils.test.ts src/lib/ai/prompt-runtime/post-body-audit.test.ts src/lib/ai/prompt-runtime/comment-flow-audit.test.ts src/lib/ai/prompt-runtime/reply-flow-audit.test.ts src/lib/ai/prompt-runtime/post-plan-contract.test.ts
```

Expected: PASS.

### Task 2: Move `formatPersonaEvidenceForAudit` To Its Natural Home

**Priority:** P3 — fixes module coupling before audit wiring.

**Why:** `formatPersonaEvidenceForAudit()` is defined in `post-body-audit.ts` but imported by `comment-flow-audit.ts` and `reply-flow-audit.ts`. The function's natural home is `persona-prompt-directives.ts` where `PromptPersonaEvidence` type is defined.

**Files:**

- Modify: `src/lib/ai/prompt-runtime/persona-prompt-directives.ts` — add `formatPersonaEvidenceForAudit()`
- Modify: `src/lib/ai/prompt-runtime/post-body-audit.ts` — remove definition, import from new location
- Modify: `src/lib/ai/prompt-runtime/comment-flow-audit.ts` — update import
- Modify: `src/lib/ai/prompt-runtime/reply-flow-audit.ts` — update import

**Steps:**

1. Move `formatPersonaEvidenceForAudit()` from `post-body-audit.ts` to `persona-prompt-directives.ts`.
2. Update all import paths.
3. Run tests:

```bash
npm test -- src/lib/ai/prompt-runtime/persona-prompt-directives.test.ts src/lib/ai/prompt-runtime/post-body-audit.test.ts src/lib/ai/prompt-runtime/comment-flow-audit.test.ts src/lib/ai/prompt-runtime/reply-flow-audit.test.ts
```

Expected: PASS.

---

## Phase 2: Audit/Repair Loop Wiring (P1)

### Task 3: Wire Comment/Reply Audit And Repair Into `single-stage-writer-flow.ts`

**Priority:** P1 — the audit contracts exist but are never called from the flow module.

**Why:** `single-stage-writer-flow.ts` only passively reads `preview.auditDiagnostics`. The plan requires the flow module to actively call the compact-packet audit prompts and run the repair loop.

**Files:**

- Modify: `src/lib/ai/agent/execution/flows/single-stage-writer-flow.ts`
- Modify: `src/lib/ai/agent/execution/flows/comment-flow-module.test.ts`
- Modify: `src/lib/ai/agent/execution/flows/reply-flow-module.test.ts`

**Steps:**

1. Add a new `runAuditRepairLoop` internal function to `single-stage-writer-flow.ts` that:
   - Takes the generated markdown, `flowKind`, `personaEvidence`, and context texts
   - Calls `buildCommentAuditPrompt()` or `buildReplyAuditPrompt()` based on `flowKind`
   - Parses the result with `parseCommentAuditResult()` or `parseReplyAuditResult()`
   - If `passes === false`, calls `buildCommentRepairPrompt()` or `buildReplyRepairPrompt()`
   - Re-parses the repaired output
   - Updates the `attempt.repair` counter
   - Returns the final markdown and audit diagnostics
2. Wire this function into the main flow after successful markdown parsing (line ~114).
3. To call the audit/repair LLM invocations, the function needs a `runPersonaInteraction`-like invoker. Use the existing `invokeGeneration` pattern but with a new `taskType` of `"comment_audit"` or `"reply_audit"`. If the `PromptActionType` union does not yet include audit types, use the existing `comment` / `reply` task type but with the audit prompt as the task context override.
4. Ensure `personaEvidence` is available — it needs to be built from `RuntimeCoreProfile` and `personaCore`. Add a `personaEvidence` field to `TextFlowModuleRunInput` or derive it inside the flow.
5. Update test files to verify the audit/repair path is exercised.
6. Run tests:

```bash
npm test -- src/lib/ai/agent/execution/flows/comment-flow-module.test.ts src/lib/ai/agent/execution/flows/reply-flow-module.test.ts src/lib/ai/prompt-runtime/comment-flow-audit.test.ts src/lib/ai/prompt-runtime/reply-flow-audit.test.ts
```

Expected: PASS.

**Design decision:** The audit invocation should use the same `runPersonaInteraction` callback already passed to the flow module. The audit prompt replaces the normal prompt content — the model invocation path is the same, only the prompt differs. This avoids adding a separate audit-specific LLM call path.

### Task 4: Wire Post Body Audit And Repair Into `post-flow-module.ts`

**Priority:** P1 — body audit contract exists but is not called from the flow module.

**Why:** `post-flow-module.ts` only reads `preview.auditDiagnostics` passively. The plan requires the flow module to actively call `buildPostBodyAuditPrompt()` after body generation and run the repair loop if the audit fails.

**Files:**

- Modify: `src/lib/ai/agent/execution/flows/post-flow-module.ts`
- Modify: `src/lib/ai/agent/execution/flows/post-flow-module.test.ts`

**Steps:**

1. After successful body parsing (around line 265), add an audit step:
   - Build the `personaEvidence` from the prompt context
   - Call `buildPostBodyAuditPrompt()` with the selected plan text, rendered post, board context, and persona evidence
   - Invoke the audit via `invokeStage` with `taskType: "post_body"` and the audit prompt as task context
   - Parse with `parsePostBodyAuditResult()`
   - If `passes === false`, call `buildPostBodyRepairPrompt()` and re-invoke
   - Re-parse the body output
   - Update `bodyAttempt.repair` counter
2. Update `FlowDiagnostics.bodyAudit` to reflect the actual audit result instead of the passively-read diagnostics.
3. Update tests to cover the audit/repair path.
4. Run tests:

```bash
npm test -- src/lib/ai/agent/execution/flows/post-flow-module.test.ts src/lib/ai/prompt-runtime/post-body-audit.test.ts
```

Expected: PASS.

### Task 5: Fix Schema Repair Counter Reset On Regenerate

**Priority:** P2 — edge case where regenerate path skips schema repair.

**Why:** In `post-flow-module.ts`, `planningAttempt.schemaRepair` is not reset when the flow enters the fresh regenerate path, so the regenerate attempt can never trigger schema repair.

**Files:**

- Modify: `src/lib/ai/agent/execution/flows/post-flow-module.ts`
- Modify: `src/lib/ai/agent/execution/flows/post-flow-module.test.ts`

**Steps:**

1. In the `runPlanningAttempt` function, reset `planningAttempt.schemaRepair = 0` when `countsAsRegenerate` is `true` (at the top of the function, after incrementing `main`).
2. Add a test case that verifies: when the first planning attempt fails the gate and the fresh regenerate returns invalid JSON, schema repair is still attempted.
3. Run tests:

```bash
npm test -- src/lib/ai/agent/execution/flows/post-flow-module.test.ts
```

Expected: PASS.

---

## Phase 3: Quality Enhancements (P2 + P3)

### Task 6: Expand Comment/Reply Audit Checks With Four-Dimensional Persona Doctrine

**Priority:** P2 — audit granularity insufficient for persona quality.

**Why:** `comment_audit` and `reply_audit` only have a single `persona_fit` check. The plan and `post_body_audit` require four persona doctrine dimensions: `value_fit`, `reasoning_fit`, `discourse_fit`, `expression_fit`.

**Files:**

- Modify: `src/lib/ai/prompt-runtime/comment-flow-audit.ts`
- Modify: `src/lib/ai/prompt-runtime/comment-flow-audit.test.ts`
- Modify: `src/lib/ai/prompt-runtime/reply-flow-audit.ts`
- Modify: `src/lib/ai/prompt-runtime/reply-flow-audit.test.ts`

**Steps:**

1. Replace `persona_fit: CommentAuditCheckStatus` with four fields in `CommentAuditChecks`:
   - `value_fit`
   - `reasoning_fit`
   - `discourse_fit`
   - `expression_fit`
2. Do the same for `ReplyAuditChecks`.
3. Update the audit prompt templates to list the four persona checks instead of one.
4. Update the JSON output constraint blocks to show the four fields.
5. Update parsers to read the four fields.
6. Update existing tests and add new test cases.
7. Run tests:

```bash
npm test -- src/lib/ai/prompt-runtime/comment-flow-audit.test.ts src/lib/ai/prompt-runtime/reply-flow-audit.test.ts
```

Expected: PASS.

**Note:** If Task 3 is already complete, also update the audit diagnostics reading in `single-stage-writer-flow.ts` to map the four persona checks into `FlowDiagnostics.audit.checks`.

### Task 7: Add `reply` To `PersonaDirectiveActionType`

**Priority:** P2 — reply flow falls back to comment persona directives.

**Why:** `PersonaDirectiveActionType` is `Extract<PromptActionType, "post" | "comment">`, excluding `"reply"`. This means `derivePromptPersonaDirectives()` cannot be called with `"reply"`, so reply prompts use comment-style persona directives without thread-native reaction cues.

**Files:**

- Modify: `src/lib/ai/prompt-runtime/persona-prompt-directives.ts`
- Modify: `src/lib/ai/prompt-runtime/persona-prompt-directives.test.ts`

**Steps:**

1. Change `PersonaDirectiveActionType` to `Extract<PromptActionType, "post" | "comment" | "reply">`.
2. In `derivePromptPersonaDirectives()`:
   - Treat `"reply"` as similar to `"comment"` for most directives but with thread-specific cues.
   - Use `isPost` for the `"post"` branch, `isReply` for the `"reply"` branch, and default to `"comment"`.
   - Add reply-specific in-character examples that show thread-native reactions (responding to a specific point, forwarding the exchange, not restarting from scratch).
   - Add reply-specific anti-style rules: "Do not write a top-level essay or standalone analysis when replying in a thread."
3. Add test cases for `"reply"` action type.
4. Run tests:

```bash
npm test -- src/lib/ai/prompt-runtime/persona-prompt-directives.test.ts
```

Expected: PASS.

### Task 8: Add `kind: "reply"` To `AiAgentPersonaTaskGeneratedOutput`

**Priority:** P3 — reply flow results are mapped to `kind: "comment"`, erasing flow-level semantics.

**Files:**

- Modify: `src/lib/ai/agent/execution/persona-task-generator.ts`
- Modify: `src/lib/ai/agent/execution/persona-task-generator.test.ts`

**Steps:**

1. Add a `kind: "reply"` variant to `AiAgentPersonaTaskGeneratedOutput`:

```typescript
| {
    kind: "reply";
    body: string;
  }
```

2. Update `mapFlowResultToLegacyOutput` to map `flowKind === "reply"` to `kind: "reply"` instead of `kind: "comment"`.
3. Check all consumers of `AiAgentPersonaTaskGeneratedOutput` and ensure they handle the new `kind: "reply"` — since `reply` persists to the `comments` table, persistence code should treat `"reply"` like `"comment"` for table writes but can log the distinction.
4. Update tests.
5. Run tests:

```bash
npm test -- src/lib/ai/agent/execution/persona-task-generator.test.ts src/lib/ai/agent/execution/persona-task-persistence-service.test.ts
```

Expected: PASS.

---

## Final Verification

After all tasks are complete, run the full verification:

```bash
npm test -- src/lib/ai/prompt-runtime/ src/lib/ai/agent/execution/flows/ src/lib/ai/agent/execution/persona-task-generator.test.ts src/lib/ai/agent/execution/persona-task-persistence-service.test.ts src/lib/ai/agent/execution/persona-interaction-service.test.ts
```

Expected: PASS.

Then run typecheck:

```bash
npm run typecheck
```

Expected: PASS.

## Completion Checklist

- [x] Task 1: JSON parse utils extracted and shared
- [x] Task 2: `formatPersonaEvidenceForAudit` moved to `persona-prompt-directives.ts`
- [x] Task 3: Comment/reply audit/repair loop wired in `single-stage-writer-flow.ts`
- [x] Task 4: Post body audit/repair loop wired in `post-flow-module.ts`
- [x] Task 5: Schema repair counter reset on regenerate
- [x] Task 6: Comment/reply audit expanded to four-dimensional persona checks
- [x] Task 7: `reply` added to `PersonaDirectiveActionType`
- [x] Task 8: `kind: "reply"` added to `AiAgentPersonaTaskGeneratedOutput`
- [x] All tests pass
- [x] Typecheck passes

## Completion Notes (2026-04-28)

- Final verification command passed:

```bash
npm test -- src/lib/ai/prompt-runtime/ src/lib/ai/agent/execution/flows/ src/lib/ai/agent/execution/persona-task-generator.test.ts src/lib/ai/agent/execution/persona-task-persistence-service.test.ts src/lib/ai/agent/execution/persona-interaction-service.test.ts
```

- Typecheck passed:

```bash
npm run typecheck
```

- Additional hardening after plan completion:
  - Added negative-path flow tests for `comment` and `reply` audit-repair loops:
    - audit fail -> repair -> re-audit fail -> fresh regenerate -> audit pass
