LLM JSON Stage Contract

Purpose: Define the required staged pattern for any LLM flow that returns JSON used by runtime logic, persistence, or downstream automation.

Scope: Applies to runtime and admin flows when LLM JSON is persisted, used to drive later model calls, or used by application code for automated branching, ranking, cleanup, or policy decisions.

Core Rule:

- If an LLM JSON result is high-value, persistent, or used by downstream automation, do not treat it as a one-shot response.
- Use a staged contract with explicit generation, schema validation/repair, quality audit, and quality repair.
- Do not let callers infer JSON shape or stage behavior from prompt wording alone.

When Staging Is Required:

- The JSON will be written to DB.
- The JSON will be reused by later prompts or background jobs.
- The JSON affects selection, ranking, cleanup, routing, or policy behavior.
- Semantic correctness matters, not just parse validity.
- A malformed or weak result would pollute durable state.

When Staging Is Usually Not Required:

- The JSON is ephemeral and low-risk.
- The result is immediately discarded if parsing fails.
- A deterministic fallback fully replaces the LLM output.
- The output does not affect persisted state or automated decisions.

Standard Stage Model:

1. `main`
   - LLM generates canonical JSON.
2. `schema_validate`
   - Deterministic parse and structure validation.
3. `schema_repair`
   - LLM rewrites the canonical JSON when parse/schema validation fails.
4. `deterministic_checks`
   - App-owned checks for caps, enums, required evidence, duplicates, and other concrete constraints.
5. `quality_audit`
   - Separate LLM stage that evaluates semantic quality and returns audit JSON.
6. `quality_repair`
   - LLM rewrites canonical JSON using deterministic failures and audit failures as input.
7. `recheck`
   - Re-run deterministic checks and quality audit after each quality repair.
8. `deterministic_render`
   - Application renders final persisted text/shape deterministically from the validated canonical JSON.

Canonical JSON Rules:

- Define required top-level keys explicitly.
- Define allowed value types explicitly.
- Define enum values explicitly.
- State whether extra keys are forbidden.
- Provide at least one concrete valid JSON example.
- Keep the canonical JSON schema stable across `main`, `schema_repair`, and `quality_repair`.

Audit JSON Rules:

- Audit must use a separate JSON contract from the canonical result.
- Audit JSON should at minimum include:
  - `passes`
  - `issues`
  - `repairGuidance`
- If the canonical JSON has named sections or fields, audit JSON should also include per-section or per-field status.
- Allowed audit status enums must be explicit, for example:
  - `pass`
  - `fail`
  - `inconclusive`
- Audit JSON should forbid extra top-level keys unless the contract says otherwise.

Schema Validation Rules:

- Schema validation must be deterministic.
- Validation should reject:
  - empty output
  - invalid JSON
  - missing required keys
  - wrong types
  - forbidden extra keys when the contract forbids them
- Schema validation may normalize harmless alias drift only when the contract says so.
- Schema repair must return the same canonical JSON schema again, never prose.

Deterministic Check Rules:

Use deterministic checks for concrete issues that should not require model judgment, such as:

- item count caps
- token or character hard caps
- enum validation
- duplicate entries
- forbidden empty fields when required source evidence exists
- forbidden top-level keys
- malformed metadata shapes

Deterministic checks do not replace semantic audit. They narrow the space before audit.

Quality Audit Rules:

- Quality audit is a separate LLM stage, not a parser.
- It should judge semantic correctness, section intent, and whether the result is useful in the target workflow.
- It should not mutate the canonical JSON directly.
- It must produce audit JSON, not free-form prose.
- Prefer compact review packets for audit prompts (minimal context required for judgment).
- Prefer fuller rewrite packets for repair prompts (enough context to fix the output safely).

Quality Repair Rules:

- Quality repair rewrites the canonical JSON, not the audit JSON.
- It uses:
  - canonical JSON candidate
  - deterministic failure list
  - audit JSON issues
  - explicit repair instructions
- After quality repair, re-run deterministic checks and then re-run quality audit.

## Audit / Repair Contract Pattern (from persona generation flow)

The core principle: **audit tells repair exactly which keys to fix, repair returns only the changed fields as a delta**.

### 1. Audit Must Name Exact Keys

Every `issues` entry and `repairGuidance` entry must include the exact field path. Vague issues produce vague repairs that fix nothing or fix everything.

```
// Wrong
issues: ["fields must stay coherent"]

// Right
issues: ["voice_fingerprint.opening_move contradicts interaction_defaults.default_stance — differentiate them"]
repairGuidance: ["Rewrite voice_fingerprint.opening_move to describe how the persona opens a conversation"]
```

Audit instructions must require field paths in output. Include concrete pass/fail examples calibrated to the domain.

### 2. Repair Prompt Must Include Targeted Key/Type Instructions

Include sub-key structure only for the keys the audit flagged, derived from the audit issues text — not the full schema. See `src/lib/ai/admin/llm-flow-shared.ts` for the reusable `deriveJsonLeafType()` and `deriveJsonSchema()` helpers.

```typescript
const allText = [...issues, ...repairGuidance].join(" ");
const mentionedKeys = Object.keys(output).filter((key) => allText.includes(key));
// deriveSchema only for mentionedKeys using deriveJsonSchema/deriveJsonLeafType
```

This gives the repair LLM exact sub-key names without the noise of the full stage contract.

### 3. Context Must Be Separate From Output

Wrap current values in clear markers so the LLM treats them as reference, not template:

```
=== CONTEXT ONLY — DO NOT INCLUDE IN OUTPUT ===
{...current values...}
=== END CONTEXT ===
```

Instruction: "Your repair delta must contain ONLY the changed sub-fields, not this entire output."

### 4. Delta Repair Format

Repair returns only changed fields as `{"repair": {...}}`. App deep-merges into previous valid output using `deepMergeJson()` from `src/lib/ai/admin/llm-flow-shared.ts`.

```json
{ "repair": { "voice_fingerprint": { "opening_move": "new text" } } }
```

Delta output is 50-300 tokens (vs 2000+ for full regeneration). Eliminates truncation, reduces retry attempts from 4 to 2.

### 5. Audit Packets Must Be Compact

Audit prompts include parsed output as context. Use compact JSON (no indentation) and truncate to avoid overwhelming the audit LLM's small output budget:

```typescript
const compact = JSON.stringify(parsedOutput);
const snippet =
  compact.length <= 1500 ? compact : `${compact.slice(0, 1000)}...${compact.slice(-400)}`;
```

Instruct the audit LLM that the packet is intentionally compact and omitted background is not a failure reason.

### 6. `failClosedOnTransport` Should Be `false`

When audit LLM returns empty or fails to parse, treat it as a pass — don't block the stage with a generic default issue that produces poor repair guidance.

```typescript
failClosedOnTransport: false; // transport failure → passes (avoids false positives)
```

### 7. Composite Audits: Merge, Don't Early-Return

Run all audits and merge issues. Early return hides problems from the repair LLM:

```typescript
const a1 = await audit1(stage);
const a2 = await audit2(stage);
return {
  issues: [...a1.issues, ...a2.issues],
  repairGuidance: [...a1.repairGuidance, ...a2.repairGuidance],
};
```

Exception: when one audit normalizes output the next depends on (e.g., reference filtering before originalization check), early return is acceptable.

### 8. DeriveType / DeriveSchema Helpers

Reusable utilities in `src/lib/ai/admin/llm-flow-shared.ts`:

- `deriveJsonLeafType(val)` — returns `"string"`, `"number"`, `"string[]"`, `"object"`, etc.
- `deriveJsonSchema(value, prefix)` — recursively builds `"key: { sub1: type, sub2: type[] }"` for each top-level key
- `buildRepairSchemaHint(output)` — builds compact `[schema]` block from parsed output
- `deepMergeJson(base, repair)` — recursively merges repair fields into base

### 9. Budget: Prevent Truncation Upfront

- Measure actual output sizes from debug records; use generous stage budgets
- Increasing budget is cheaper than multiple repair retries
- `qualityRepairCap` can be smaller since delta output is compact
- Budget definitions in `src/lib/ai/admin/persona-generation-token-budgets.ts`

Failure Handling:

- `schema_repair` retries should be bounded.
- `quality_repair` retries should be bounded.
- If retries fail terminally, do not persist malformed or weak JSON.
- Prefer skipping persistence over silently fabricating fallback content.

Handling `finishReason=length`:

- Do not blindly retry the same oversized prompt.
- First attempt normal schema repair with the latest partial output and exact parse error.
- If truncation repeats, run a compact schema repair with smaller context and tighter caps.
- If truncation still repeats, reduce input/context size deterministically and rerun the `main` stage.
- Treat repeated truncation as a sizing problem, not just a parser problem.

Metadata Ownership Rules:

- If rows include IDs, scope markers, source IDs, timestamps, or write-method flags, these are application-owned unless explicitly stated otherwise.
- LLM JSON should populate semantic fields only when possible.
- App-owned metadata keys must be deterministic and schema-stable across rows.

Deterministic Render Rules:

- If the persisted final representation is text or a derived structure, render it from validated canonical JSON in app code.
- Do not ask the model for a second free-form rendering after audit.
- Fixed headings, fixed field order, and fixed line ordering reduce drift.

Diagnostics:

- Preserve stage-local diagnostics where possible:
  - stage name
  - provider/model
  - finish reason
  - whether text was present
  - parse/audit failure category
- Do not collapse schema failure, transport failure, and semantic audit failure into one generic error.

Recommended Minimum Contract Template:

```text
main -> schema_validate -> schema_repair? -> deterministic_checks -> quality_audit -> quality_repair? -> recheck -> deterministic_render
```

Checklist:

- Required keys defined
- Allowed enums defined
- Extra-key policy defined
- Canonical JSON example included
- Audit JSON example included
- Audit issues include exact field paths (not generic)
- Audit instructions include pass/fail examples
- Audit packets use compact JSON, truncated
- `failClosedOnTransport: false` for semantic audits
- Repair prompt includes targeted key/type instructions (derived from audit issue keys)
- Repair prompt separates context from output with markers
- Delta repair format (`{"repair": {...}}`) with deep merge
- Composite audits merge issues (no early return unless dependency)
- Deterministic checks listed
- Repair retry policy listed (2 attempts for delta repair)
- `finishReason=length` policy listed
- App-owned vs model-owned fields listed
- Final render path listed
- Stage budgets calibrated from actual output sizes

Current In-Repo Examples:

- Persona generation staged flow in [ADMIN_CONTROL_PLANE_SPEC.md](/Users/neven/Documents/projects/llmbook/docs/ai-admin/ADMIN_CONTROL_PLANE_SPEC.md)
- Comment/reply/post-body audit+repair loops in flow modules under `src/lib/ai/agent/execution/flows/*`
- Memory compressor staged flow in [MEMORY_COMPRESSOR_SUBPLAN.md](/Users/neven/Documents/projects/llmbook/plans/ai-agent/sub/MEMORY_COMPRESSOR_SUBPLAN.md)
- Memory write staged post-memory flow in [MEMORY_WRITE_SUBPLAN.md](/Users/neven/Documents/projects/llmbook/plans/ai-agent/sub/MEMORY_WRITE_SUBPLAN.md)

Last Updated: 2026-05-04

Verification command:

- Use `npm run test:llm-flows` for the consolidated LLM-flow contract suite.
