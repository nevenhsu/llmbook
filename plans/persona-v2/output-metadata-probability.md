# Output Metadata Probability Plan

> **For Codex:** Before implementation, use `superpowers:executing-plans` and work this plan task by task. This plan should be read-only/review mode — do NOT implement.

**Goal:** Add a `metadata: { probability: number }` field (integer 0-100) to the post, comment, and reply JSON output contracts. The LLM self-rates its output creativity/quality and the probability flows through the existing parse → flow → persistence pipeline.

**Architecture:** The probability is a self-rating that the LLM emits. It is NOT validated by audit (yet). It flows through the existing action-output parser, into flow module output types, and optionally into persistence. No new prompt blocks, no new audit stages, no new DB columns — purely a contract extension.

**Tech Stack:** TypeScript, staged LLM JSON contracts.

---

## Design Decisions

### Why `metadata` wrapper instead of flat `probability` field?

Other fields in the output contract (`body`, `tags`, `markdown`, `need_image`) are direct content-bearing fields. `probability` is metadata about the generation, not content. Wrapping in `{ probability: number }`:

- Keeps the existing fields unchanged (backward-compatible)
- Leaves room for future metadata fields (`confidence`, `creativity_reason`, etc.)
- Makes it obvious this is LLM self-assessment, not factual content

### Why integer 0-100?

Matches the existing `persona_fit_score` and `novelty_score` convention in `post-plan-contract.ts`. Consistency across all scoring fields.

### Why no audit for probability (yet)?

Self-rating is inherently noisy. An audit of the self-rating ("was 85 actually justified?") requires a separate LLM call with complex reasoning. That's a v3 concern. For v2, the probability exists as a data point for operators to observe and correlate with downstream engagement metrics.

---

## Scope Notes

- This plan covers output contract changes for:
  - post body generation (`post_body` action type)
  - full post generation (`post` action type)
  - comment generation (`comment` action type)
  - reply generation (`reply` action type)
- Does NOT cover:
  - post plan candidates (already has `persona_fit_score` / `novelty_score`)
  - vote / poll actions (not text generation)
  - audit contract changes
  - UI display of scores

---

## Task 0: Extend Output Constraints (Prompt Layer)

**Files:**

- Modify: `src/lib/ai/prompt-runtime/prompt-builder.ts`

**Problem:** The LLM isn't told to emit a `metadata.probability` field.

**Steps:**

1. In `buildActionOutputConstraints("post_body")` (line 162-177), add:
   ```
   'metadata: { probability: number }'
   "The `probability` field must be an integer from 0 to 100 representing the model's self-assessed quality."
   ```
2. In `buildActionOutputConstraints("post")` (line 178-196), add same.
3. In `buildActionOutputConstraints("comment"/"reply")` (line 197-211), add same.

**Verification:**

```bash
npx vitest run src/lib/ai/prompt-runtime/prompt-builder.test.ts
```

**Acceptance Criteria:**

- Output constraint strings for post_body, post, comment, reply include `metadata: { probability: number }` instruction
- Existing prompt builder tests pass

---

## Task 1: Extend Action Output Types And Parsers

**Files:**

- Modify: `src/lib/ai/prompt-runtime/action-output.ts`

**Problem:** The parser doesn't know about `metadata.probability` and won't extract it from LLM JSON output.

**Steps:**

1. Add `metadata` type to `ActionOutput.output` (line 10-16):

   ```ts
   export type ActionOutput = {
     output: {
       markdown: string;
       imageRequest: MarkdownImageRequest;
       metadata: { probability: number };
     } | null;
     error: string | null;
   };
   ```

2. Add `metadata` type to `PostBodyActionOutput` (line 27-33):

   ```ts
   export type PostBodyActionOutput = {
     ...
     metadata: { probability: number };
     error: string | null;
   };
   ```

3. Add `metadata` type to `PostActionOutput` (line 18-25):

   ```ts
   export type PostActionOutput = {
     ...
     metadata: { probability: number };
     error: string | null;
   };
   ```

4. In `parseMarkdownActionOutput()` (line 56), after parsing the existing fields, extract:

   ```ts
   const metadata = parseMetadataProbability(parsed.metadata);
   ```

   Where `parseMetadataProbability()` reads `asRecord(parsed.metadata)?.probability`, validates integer 0-100, defaults to 0.

5. In `parsePostBodyActionOutput()` (line 258), same extraction.

6. In `parsePostActionOutput()` (line 185), same extraction.

7. Return `metadata` in all three parsers' successful output.

**Verification:**

```bash
npx vitest run src/lib/ai/prompt-runtime/action-output.test.ts
```

**Acceptance Criteria:**

- Parser extracts `metadata.probability` when present in JSON
- Missing `metadata` → defaults to `{ probability: 0 }`
- Out-of-range probability (< 0 or > 100) → defaults to 0
- Non-integer probability → defaults to 0

---

## Task 2: Extend Flow Module Output Types

**Files:**

- Modify: `src/lib/ai/agent/execution/flows/types.ts`

**Problem:** Flow module output types (`PostBodyOutput`, `RenderedPost`, `CommentOutput`, `ReplyOutput`) don't carry metadata.

**Steps:**

1. Add `metadata?: { probability: number }` to `PostBodyOutput` (line 191):

   ```ts
   export type PostBodyOutput = WriterMediaTail & {
     body: string;
     tags: string[];
     metadata?: { probability: number };
   };
   ```

2. Add `metadata?: { probability: number }` to `RenderedPost` (line 196):

   ```ts
   export type RenderedPost = WriterMediaTail & {
     title: string;
     body: string;
     tags: string[];
     metadata?: { probability: number };
   };
   ```

3. Add `metadata?: { probability: number }` to `CommentOutput` (line 202):

   ```ts
   export type CommentOutput = WriterMediaTail & {
     markdown: string;
     metadata?: { probability: number };
   };
   ```

4. Add `metadata?: { probability: number }` to `ReplyOutput` (line 206):
   ```ts
   export type ReplyOutput = WriterMediaTail & {
     markdown: string;
     metadata?: { probability: number };
   };
   ```

**Verification:**

```bash
npx tsc --noEmit --pretty false --ignoreDeprecations 6.0
```

Expect type errors only in assembly sites (post-flow-module.ts, single-stage-writer-flow.ts) — these are fixed in Task 3.

**Acceptance Criteria:**

- Types compile after Task 3 changes
- Optional `metadata` — not breaking existing consumers

---

## Task 3: Wire Metadata Through Flow Assembly

**Files:**

- Modify: `src/lib/ai/agent/execution/flows/post-flow-module.ts`
- Modify: `src/lib/ai/agent/execution/flows/single-stage-writer-flow.ts`

**Problem:** The flow modules' assembly code doesn't pass `metadata` from parsed output into their output types.

**Steps for `post-flow-module.ts`:**

1. In the `postBody` assembly (line 595-597), add `metadata: parsedBody.metadata`:

   ```ts
   postBody: {
     body: parsedBody.body,
     tags: parsedBody.tags,
     metadata: parsedBody.metadata,
     needImage: parsedBody.imageRequest.needImage,
     imagePrompt: parsedBody.imageRequest.imagePrompt,
     imageAlt: parsedBody.imageRequest.imageAlt,
   },
   ```

2. In the `renderedPost` assembly (line 599-605), add same:
   ```ts
   renderedPost: {
     title: selectedPostPlan.title,
     body: parsedBody.body,
     tags: parsedBody.tags,
     metadata: parsedBody.metadata,
     ...
   },
   ```

**Steps for `single-stage-writer-flow.ts`:**

3. Update `mapParsedOutput()` (line 345) signature to accept `metadata: { probability: number }`:

   ```ts
   function mapParsedOutput(
     flowKind: SingleStageWriterFlowKind,
     markdown: string,
     imageRequest: { needImage: boolean; imagePrompt: string | null; imageAlt: string | null },
     metadata: { probability: number },
   ): { comment: CommentOutput } | { reply: ReplyOutput };
   ```

4. Add `metadata` to the shared object (line 346-351):

   ```ts
   const shared = {
     markdown,
     needImage: imageRequest.needImage,
     imagePrompt: imageRequest.imagePrompt,
     imageAlt: imageRequest.imageAlt,
     metadata,
   };
   ```

5. At both call sites (lines 468-470, 477-479), pass `audited.parsed.output?.metadata ?? { probability: 0 }`.

**Verification:**

```bash
npx tsc --noEmit --pretty false --ignoreDeprecations 6.0
npx vitest run src/lib/ai/agent/execution/flows/post-flow-module.test.ts src/lib/ai/agent/execution/flows/comment-flow-module.test.ts src/lib/ai/agent/execution/flows/reply-flow-module.test.ts
```

**Acceptance Criteria:**

- Typecheck passes
- All flow tests pass
- Post flow test fixtures can optionally include `metadata` in parsed body JSON (optional enhancement)

---

## Task 4: (Optional) Propagate To Legacy Output

**Files:**

- Modify: `src/lib/ai/agent/execution/persona-task-generator.ts`
- Modify: `src/lib/ai/agent/execution/persona-task-persistence-service.ts`

**Problem:** `mapFlowResultToLegacyOutput()` and persistence don't carry metadata. This is optional — metadata doesn't need to persist in DB for v2. But wiring it through enables future persistence.

**Steps:**

1. In `AiAgentPersonaTaskGeneratedOutput` (line 45-61), add optional `metadata`:

   ```ts
   export type AiAgentPersonaTaskGeneratedOutput =
     | {
         kind: "post";
         title: string;
         body: string;
         tags: string[];
         metadata?: { probability: number };
       }
     | { kind: "comment"; body: string; metadata?: { probability: number } }
     | { kind: "reply"; body: string; metadata?: { probability: number } };
   ```

2. In `mapFlowResultToLegacyOutput()` (line 178), pass metadata through for each flow kind.

3. Update test fixtures in `persona-task-generator.test.ts` and `persona-task-persistence-service.test.ts`.

**Verification:**

```bash
npx vitest run src/lib/ai/agent/execution/persona-task-generator.test.ts src/lib/ai/agent/execution/persona-task-persistence-service.test.ts
```

**Acceptance Criteria:**

- Tests pass with new metadata field in fixtures
- `AiAgentPersonaTaskGeneratedOutput` carries optional metadata

---

## Task 5: Final Verification

**Commands:**

```bash
npx tsc --noEmit --pretty false --ignoreDeprecations 6.0
npx vitest run src/lib/ai/agent/execution/flows/post-flow-module.test.ts src/lib/ai/agent/execution/flows/comment-flow-module.test.ts src/lib/ai/agent/execution/flows/reply-flow-module.test.ts
npx vitest run src/lib/ai/prompt-runtime/action-output.test.ts src/lib/ai/prompt-runtime/prompt-builder.test.ts
npm run test:llm-flows
```

**Expected final state:**

- Typecheck passes
- All flow tests pass
- LLM flows test suite passes (or identifies only pre-existing failures)
- `metadata.probability` flows from LLM output → parser → flow module → flow result

---

## Review Checkpoints

- Is wrapping in `metadata` over-engineering for a single probability field? No — the wrapper leaves room for `confidence`, `creativity_reason`, `tone_probability` etc. without another contract change.
- Should the probability be validated by audit? Not in v2. Self-rating is a signal, not a gate. Adding audit would require a separate LLM call per flow, doubling cost.
- Should `metadata` be required or optional? Optional everywhere. The LLM may omit it; the parser defaults to `{ probability: 0 }`. This prevents schema repair from triggering on a missing self-rating.
- Scope guard: do not add new prompt blocks, new audit stages, new DB columns, or new UI sections. This is purely a contract extension.
