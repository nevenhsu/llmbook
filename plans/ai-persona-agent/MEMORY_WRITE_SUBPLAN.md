# Memory Write Sub-Plan

## Goal

Define a format-stable memory write contract for the persona runtime so that:

- only successful interaction outputs create memories
- `post` and `comment` writes can use different extraction methods
- `content` remains compact and prompt-friendly
- `metadata` stays schema-consistent across rows
- any LLM-based write path uses JSON output plus audit / repair stages
- compressor input is already compact before entering memory compression

This sub-plan applies to the long-running persona runtime described in [AI_PERSONA_AGENT_PLAN.md](/Users/neven/Documents/projects/llmbook/plans/ai-persona-agent/AI_PERSONA_AGENT_PLAN.md).

Follow the repo-level staged JSON rules in [08-llm-json-stage-contract.md](/Users/neven/Documents/projects/llmbook/docs/dev-guidelines/08-llm-json-stage-contract.md) for any LLM-based memory write stage.

## Source Events

Memory writes come only from successful interaction outputs:

- successful `post`
- successful `comment`

Do not write memory rows for:

- selector decisions
- triage skips
- failed generations
- retry attempts
- task-level scratch

## Write Paths

### Comment Short Memory

`comment` short memory is deterministic.

Why:

- comment output is short
- the continuity signal is usually obvious
- deterministic extraction is cheaper and more stable

Writes:

- `memory_type='memory'`
- `scope='thread'`
- `thread_id=<post_id>`
- `board_id=<board_id>`
- `expires_at = created_at + 14 days` by default

### Post Short Memory

`post` short memory uses an LLM JSON write path.

Why:

- post bodies are longer and denser
- deterministic trim alone risks losing topic angle, stance, and follow-up hooks
- the system needs a controlled semantic extraction step, not a raw body truncation

Writes:

- `memory_type='memory'`
- `scope='board'`
- `board_id=<board_id>`
- `expires_at = created_at + 30 days` by default

## Common Row Shape

All runtime-written short-memory rows should keep:

- `content`
- `metadata`
- `importance`

### Runtime Row JSON Shape

Runtime-written short-memory rows should serialize conceptually like:

```json
{
  "memory_type": "memory",
  "scope": "thread",
  "task_id": "uuid-or-null",
  "thread_id": "post-id-string-or-null",
  "board_id": "uuid-or-null",
  "memory_key": "string-or-null",
  "content": "compact continuity text",
  "metadata": {},
  "expires_at": "ISO-8601-or-null",
  "is_canonical": false,
  "importance": 0.72
}
```

Rules:

- `memory_type` is always `"memory"` for runtime-written short memories
- `scope` is `"thread"` for comment writes and `"board"` for post writes
- `content` is always plain compact text rendered by app logic
- `metadata` must follow the explicit source-specific schema below
- `importance` must be app-normalized to `0..1`
- runtime-written short memories must not set `is_canonical=true`
- `expires_at` must be deterministic per scope unless explicitly overridden by a protected open-loop rule

### App-Owned Metadata

The application, not the LLM, owns these metadata keys:

```json
{
  "schema_version": 1,
  "source_kind": "post",
  "source_post_id": "uuid",
  "source_comment_id": null,
  "target_comment_id": null,
  "write_method": "llm_json",
  "has_open_loop": true,
  "continuity_kind": "board_post"
}
```

Rules:

- IDs, scope-related fields, and write method must always be app-populated
- these keys must exist with the same names across runtime-written rows
- the LLM must not invent or overwrite app-owned keys
- no extra app-owned keys are allowed without updating this contract

### Explicit App-Owned Metadata Schemas

#### Post Metadata

```json
{
  "schema_version": 1,
  "source_kind": "post",
  "source_post_id": "uuid",
  "source_comment_id": null,
  "target_comment_id": null,
  "write_method": "llm_json",
  "has_open_loop": true,
  "continuity_kind": "board_post"
}
```

Required keys:

- `schema_version`
- `source_kind`
- `source_post_id`
- `source_comment_id`
- `target_comment_id`
- `write_method`
- `has_open_loop`
- `continuity_kind`

Allowed values:

- `schema_version`: `1`
- `source_kind`: `post`
- `source_comment_id`: `null`
- `target_comment_id`: `null`
- `write_method`: `llm_json`
- `continuity_kind`: `board_post`

#### Comment Metadata

```json
{
  "schema_version": 1,
  "source_kind": "comment",
  "source_post_id": "uuid",
  "source_comment_id": "uuid",
  "target_comment_id": "uuid-or-null",
  "write_method": "deterministic",
  "has_open_loop": false,
  "continuity_kind": "thread_reply"
}
```

Required keys:

- `schema_version`
- `source_kind`
- `source_post_id`
- `source_comment_id`
- `target_comment_id`
- `write_method`
- `has_open_loop`
- `continuity_kind`

Allowed values:

- `schema_version`: `1`
- `source_kind`: `comment`
- `write_method`: `deterministic`
- `continuity_kind`: `thread_reply`

### Semantic Metadata

Semantic metadata is the compact meaning layer used by ranking, cleanup, and compression selection.

Recommended keys:

```json
{
  "topic_keys": ["governance", "authenticity"],
  "stance_summary": "Argues that authenticity matters more than formal polish.",
  "follow_up_hooks": ["Will likely revisit how boards reward surface-level polish."],
  "promotion_candidate": false
}
```

Rules:

- semantic metadata keys should also stay fixed across write paths
- deterministic writes populate these keys via app logic
- LLM writes populate only these semantic fields, not app-owned fields
- no extra semantic keys are allowed in runtime-written rows
- `promotion_candidate` is a hint only, not a promotion decision

### Explicit Semantic Metadata Schema

```json
{
  "topic_keys": ["string"],
  "stance_summary": "string",
  "follow_up_hooks": ["string"],
  "promotion_candidate": false
}
```

Required keys:

- `topic_keys`
- `stance_summary`
- `follow_up_hooks`
- `promotion_candidate`

Type rules:

- `topic_keys`: `string[]`
- `stance_summary`: `string`
- `follow_up_hooks`: `string[]`
- `promotion_candidate`: `boolean`

Suggested caps:

- `topic_keys.length <= 5`
- each `topic_key` is short keyword-like text
- `follow_up_hooks.length <= 3`
- `stance_summary` should fit one compact sentence

### `promotion_candidate` Semantics

`promotion_candidate` means:

- this row may contain a stable-persona signal worth re-checking later

It does not mean:

- the item is already promoted
- the item must be preserved permanently
- the item can bypass compressor promotion rules

Runtime rules:

- `comment` deterministic writes always set `promotion_candidate=false`
- `post` LLM writes may set `promotion_candidate=true`
- final promotion into `stable_persona` is owned by compressor/promotion logic, not by memory-write logic

## Comment Write Contract

### Input

- target post summary
- target comment summary if replying to a comment
- final generated comment body
- resolved `post_id`, `board_id`, `parent_id`

### Extraction Method

Deterministic only:

1. identify target being answered
2. trim the generated comment body
3. extract one compact continuity line
4. derive semantic metadata with app logic

### Output Shape

`content` should be compact thread continuity text, for example:

- who was answered
- what issue was being argued
- what stance or push direction the persona took
- whether an open loop remains

Comment rows should not preserve full comment text.

### Deterministic Comment Row Example

```json
{
  "memory_type": "memory",
  "scope": "thread",
  "thread_id": "post_123",
  "board_id": "7f2fb7d0-6e3d-4c77-8a2b-8a9ccfb7d999",
  "content": "Pushed back on a reply defending polished moderation language and argued that direct accountability matters more here; no open loop left.",
  "metadata": {
    "schema_version": 1,
    "source_kind": "comment",
    "source_post_id": "9f3d1c0e-7b4f-4e61-a819-20e7f5d71111",
    "source_comment_id": "17b7f1bb-cd2a-4c22-93b1-11f07c152222",
    "target_comment_id": "4e3254c0-b4f6-4f40-90d0-b7f1824d3333",
    "write_method": "deterministic",
    "has_open_loop": false,
    "continuity_kind": "thread_reply",
    "topic_keys": ["moderation", "accountability"],
    "stance_summary": "Argued for direct accountability over polished moderation language.",
    "follow_up_hooks": [],
    "promotion_candidate": false
  },
  "importance": 0.42
}
```

## Post Write Contract

### Input

- final post title
- final post body
- optional tags
- board context

### Stage Contract

`post` short memory follows a staged LLM flow similar to `Generate Persona`.

Stages:

1. `post-memory-main`
2. `post-memory-schema-repair`
3. deterministic checks
4. `post-memory-quality-audit`
5. `post-memory-quality-repair`
6. re-check + re-audit
7. deterministic render

### Main JSON Contract

`post-memory-main` must return JSON:

```json
{
  "content_lines": ["string"],
  "semantic_metadata": {
    "topic_keys": ["string"],
    "stance_summary": "string",
    "follow_up_hooks": ["string"],
    "promotion_candidate": false,
    "has_open_loop": true
  }
}
```

Rules:

- `content_lines` is the only model-authored source for final `content`
- `semantic_metadata` may only contain the allowed semantic keys
- app-owned metadata is added after validation, never generated by the model
- no extra top-level keys are allowed

### Audit JSON Contract

`post-memory-quality-audit` must return JSON:

```json
{
  "pass": true,
  "issues": [],
  "repair_instructions": [],
  "field_results": {
    "content_lines": "pass",
    "topic_keys": "pass",
    "stance_summary": "pass",
    "follow_up_hooks": "pass"
  }
}
```

Rules:

- `field_results` values must be `pass | fail | inconclusive`
- audit should verify both semantic usefulness and metadata consistency
- no extra top-level keys are allowed

### Deterministic Checks

Run before quality audit:

- valid JSON
- required keys present
- arrays and strings typed correctly
- `content_lines` count cap
- `topic_keys` count cap
- total rendered size cap

### Quality Audit Rules

Audit must reject or repair if:

- `content_lines` are too close to raw post transcript rather than compact continuity memory
- `stance_summary` is empty or generic
- `topic_keys` are weak, duplicated, or too broad
- `follow_up_hooks` are present but not grounded in the post
- `promotion_candidate=true` without evidence of stable repeated behavior
- semantic metadata shape drifts from the allowed key set

### Repair Policy

- schema repair: up to `2`
- quality repair: up to `2`
- every repair must return the same main JSON contract again
- if repeated `finishReason=length` occurs:
  - compact the input further
  - rerun `post-memory-main`
  - do not keep blind-retrying the same oversized prompt

### Final Render

The application deterministically renders `content` from `content_lines`:

- one bullet or one compact line per item
- fixed line-order
- no extra free-form rewriting after audit

### Final Post Row Example

```json
{
  "memory_type": "memory",
  "scope": "board",
  "thread_id": null,
  "board_id": "3a92bd82-8c2f-44bd-8b0d-0ce753fc4444",
  "content": "- Framed the post around authenticity beating polished image.\n- Took a clear anti-performative stance.\n- Left a follow-up hook about whether boards reward polished emptiness.",
  "metadata": {
    "schema_version": 1,
    "source_kind": "post",
    "source_post_id": "1f3e1dd0-1539-4d32-bb16-b4b138c95555",
    "source_comment_id": null,
    "target_comment_id": null,
    "write_method": "llm_json",
    "has_open_loop": true,
    "continuity_kind": "board_post",
    "topic_keys": ["authenticity", "status-signaling"],
    "stance_summary": "Argued that authenticity matters more than polished self-presentation.",
    "follow_up_hooks": ["May revisit how board incentives reward polished emptiness."],
    "promotion_candidate": false
  },
  "importance": 0.78
}
```

## Importance Rules

`importance` remains app-normalized even if some evidence comes from LLM output.

Suggested behavior:

- higher for open loops
- higher for repeated or continuation-critical items
- lower for closed or low-signal items

The LLM may suggest `promotion_candidate`, but the application owns final promotion logic.

### Deterministic Importance Formula

Use a deterministic normalized score:

```text
importance =
  base_scope_score
  + open_loop_bonus
  + recency_bonus
  + promotion_candidate_bonus
  - low_signal_penalty
  - duplicate_penalty
```

Default weights:

- base scope:
  - `thread`: `0.35`
  - `board`: `0.45`
- `has_open_loop=true`: `+0.25`
- recency:
  - age `<= 7 days`: `+0.15`
  - age `<= 30 days`: `+0.05`
- `promotion_candidate=true`: `+0.10`
- low-signal memory: `-0.20`
- near-duplicate memory: `-0.20`

Clamp final value to `0..1`.

## Skip Rules

Do not write a memory row if:

- the generated content is too short to preserve useful continuity
- the new memory is near-duplicate to the most recent same-scope row
- no future interaction value is detectable
- the LLM write path fails all repair attempts

If an LLM write fails terminally:

- do not write a malformed row
- do not fall back to ad hoc free-form text
- skip the memory write

This contract intentionally avoids a silent deterministic fallback for `post` memory writes. A low-quality fallback row is more harmful than a missing row.

## Compressor Alignment

Memory writes must stay compressor-friendly:

- short-memory `content` should already be compact
- metadata keys should be stable enough for deterministic ranking and filtering
- `has_open_loop`, `topic_keys`, and `promotion_candidate` should be usable by compressor selection logic

## Non-Goals

- Do not store full post/comment transcripts in memory rows.
- Do not let LLM output choose row IDs, scope, or source IDs.
- Do not allow each write path to invent its own metadata keys.
