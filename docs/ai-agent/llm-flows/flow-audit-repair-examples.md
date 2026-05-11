# Flow Audit / Repair Examples -- SUPERSEDED

> **Status:** Audit and repair stages (`schema_repair`, `quality_audit`, `quality_repair`) have been removed from all active flows.

The migration away from these stages was planned and executed in:
[2026-05-11-llm-flow-audit-repair-removal-deepseek-handoff-plan.md](/Users/neven/Documents/projects/llmbook/plans/persona-v2/2026-05-11-llm-flow-audit-repair-removal-deepseek-handoff-plan.md)

## Current Repair Architecture

All JSON repair is now handled by the shared, deterministic pipeline:

1. **Zod schemas are code-owned** in [persona-v2-flow-contracts.ts](/Users/neven/Documents/projects/llmbook/src/lib/ai/prompt-runtime/persona-v2-flow-contracts.ts). The AI SDK `Output.object({ schema })` enforces the JSON contract at generation time.

2. **Shared schema gate** ([schema-gate.ts](/Users/neven/Documents/projects/llmbook/src/lib/ai/json-repair/schema-gate.ts)) provides:
   - Deterministic syntax salvage (structural closers only -- no invented values)
   - Loose normalization
   - Schema validation against the code-owned Zod schema
   - Optional `field_patch` for allowlisted paths

3. **Field patch** ([field-patch-schema.ts](/Users/neven/Documents/projects/llmbook/src/lib/ai/json-repair/field-patch-schema.ts)) handles parseable JSON that fails schema validation on allowlisted missing/invalid fields. Patch paths are checked against `allowedRepairPaths` and `immutablePaths`.

4. **Response finisher** ([response-finisher.ts](/Users/neven/Documents/projects/llmbook/src/lib/ai/json-repair/response-finisher.ts)) handles deterministic render from validated JSON.

## Key Principle: Prompts Describe Field Purpose, Not JSON Structure

Prompt text should describe what each field means and what constraints exist on its content. It must never describe JSON structure or hardcode key/type declarations. The Zod schema (passed via `Output.object({ schema })`) is the single source of truth for structure.

Example of a good prompt description for a field:

> The `body` field contains the full post content as markdown. It must be at least 50 words and should reflect the persona's discourse style.

Example of what to avoid:

> `"body": "string"` -- the post body content

The schema enforces JSON shape. The prompt explains intent.

## No Semantic Audit, Quality Audit, or Repair Stages

Active flows use:

```
main -> shared schema gate -> deterministic checks -> deterministic render
```

There are no separate `schema_repair`, `quality_audit`, `quality_repair`, or finish-continuation stages. If a flow retries `main`, that is reported as retry bookkeeping around the same stage, not as a distinct repair stage.
