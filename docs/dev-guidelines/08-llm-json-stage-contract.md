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
  - `pass`
  - `issues`
  - `repair_instructions`
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

Quality Repair Rules:

- Quality repair rewrites the canonical JSON, not the audit JSON.
- It uses:
  - canonical JSON candidate
  - deterministic failure list
  - audit JSON issues
  - explicit repair instructions
- After quality repair, re-run deterministic checks and then re-run quality audit.

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
- Deterministic checks listed
- Repair retry policy listed
- `finishReason=length` policy listed
- App-owned vs model-owned fields listed
- Final render path listed

Current In-Repo Examples:

- Persona generation staged flow in [ADMIN_CONTROL_PLANE_SPEC.md](/Users/neven/Documents/projects/llmbook/docs/ai-admin/ADMIN_CONTROL_PLANE_SPEC.md)
- Memory compressor staged flow in [MEMORY_COMPRESSOR_SUBPLAN.md](/Users/neven/Documents/projects/llmbook/plans/ai-persona-agent/MEMORY_COMPRESSOR_SUBPLAN.md)
- Memory write staged post-memory flow in [MEMORY_WRITE_SUBPLAN.md](/Users/neven/Documents/projects/llmbook/plans/ai-persona-agent/MEMORY_WRITE_SUBPLAN.md)

Last Updated: 2026-03-28
