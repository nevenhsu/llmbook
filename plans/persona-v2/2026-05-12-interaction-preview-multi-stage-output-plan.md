# Interaction Preview Multi-Stage Output Plan

**Goal:** The preview API returns per-stage structured output for all flows. The UI modal renders each stage separately in both Rendered Preview and Raw Response. Image Request is surfaced per stage.

**Architecture:** Post flow produces 2 stages (`post_plan` → `post_body`), comment/reply produce 1 stage. Each stage's structured output is captured and returned. The UI renders stage cards instead of a single merged markdown blob.

---

## Current State

### PreviewResult (what the API returns)

```typescript
type PreviewResult = {
  assembledPrompt: string; // last stage prompt only
  markdown: string; // merged rendered output
  rawResponse?: string | null; // last stage raw JSON only
  renderOk: boolean;
  renderError: string | null;
  tokenBudget: PreviewTokenBudget;
  stageDebugRecords?: StageDebugRecord[] | null; // per-stage prompts + raw output
};
```

**Problem**: `markdown`, `rawResponse`, and `assembledPrompt` only reflect the **last stage**. For post flow, `post_plan` output (candidates, selected plan) is hidden in `stageDebugRecords` but not surfaced as structured data. The merged markdown loses the plan/body distinction.

### StageDebugRecord (already captures per-stage data)

```typescript
type StageDebugRecord = {
  name: string; // e.g. "post_plan.main", "post_body.main"
  displayPrompt: string; // full assembled prompt
  outputMaxTokens: number;
  attempts: {
    attempt: string;
    text: string; // raw JSON output
    finishReason: string | null;
    providerId: string | null;
    modelId: string | null;
    hadError: boolean;
    schemaGateDebug?: SchemaGateDebug;
  }[];
};
```

### UI Modal (current sections)

| Section          | Shows                             |
| ---------------- | --------------------------------- |
| PersonaInfoCard  | Persona identity + references     |
| Rendered Preview | Single `preview.markdown` blob    |
| Raw Response     | Single `preview.rawResponse` text |
| Image Request    | Parsed from `rawResponse` JSON    |
| Token Budget     | `preview.tokenBudget`             |
| Stage Debug      | Collapsible per-stage debug cards |

---

## Plan

### 1. Add `StageOutput` to PreviewResult

New type for structured per-stage output:

```typescript
type StageOutput = {
  stage: string; // "post_plan" | "post_body" | "comment" | "reply"
  attempt: string; // "post_plan.main" | "post_body.main" | etc.
  rawJson: string; // raw JSON from LLM
  parsed: Record<string, unknown>; // parsed structured output (schema-validated)
  renderedMarkdown: string; // human-readable render of this stage
  imageRequest?: {
    // present for post_body, comment, reply
    needImage: boolean;
    imagePrompt: string | null;
    imageAlt: string | null;
  };
};
```

Add to `PreviewResult`:

```typescript
type PreviewResult = {
  // ... existing fields unchanged (backward compat) ...
  stageOutputs?: StageOutput[]; // NEW: per-stage structured output
};
```

### 2. Wire StageOutputs Per Flow

**Post flow** (`post-flow-module.ts`):

- Stage 1 (`post_plan`): parsed candidates + selected plan → `StageOutput`
  - `parsed`: `{ candidates: [...], selectedCandidateIndex }`
  - `renderedMarkdown`: human-readable list of candidates
- Stage 2 (`post_body`): parsed body → `StageOutput`
  - `parsed`: `{ body, tags, metadata, need_image, image_prompt, image_alt }`
  - `renderedMarkdown`: `# {title}\n{tags}\n\n{body}`
  - `imageRequest`: `{ needImage, imagePrompt, imageAlt }`

**Comment flow** (`comment-flow-module.ts`):

- Stage 1 (`comment`): parsed comment → `StageOutput`
  - `parsed`: `{ markdown, need_image, image_prompt, image_alt, metadata }`
  - `renderedMarkdown`: `{markdown}`
  - `imageRequest`: `{ needImage, imagePrompt, imageAlt }`

**Reply flow** (`reply-flow-module.ts`):

- Stage 1 (`reply`): parsed reply → `StageOutput`
  - Same shape as comment

### 3. Update `renderFlowMarkdown` → Per-Stage Rendered Markdown

Currently `renderFlowMarkdown` produces one merged markdown. Move the render logic into the `buildStageOutput` per-stage function instead. Each stage's `renderedMarkdown` is self-contained:

- **post_plan**: Candidate list with scores
- **post_body**: Title + tags + body
- **comment**: The comment markdown
- **reply**: The reply markdown

### 4. Update UI — Rendered Preview

Replace single `preview.markdown` display with per-stage cards:

```
┌─ Rendered Preview ────────────────────────────┐
│                                                │
│  ┌─ Stage 1: Post Plan ─────────────────────┐  │
│  │  Candidate 1: "Title" (fit: 85, nov: 70) │  │
│  │  Candidate 2: "Title" (fit: 95, nov: 75) │  │
│  │  → Selected: Candidate 2                  │  │
│  └───────────────────────────────────────────┘  │
│                                                │
│  ┌─ Stage 2: Post Body ──────────────────────┐  │
│  │  # The Necronomicon of Manners...          │  │
│  │  #cosmichorror #deepones                   │  │
│  │                                            │  │
│  │  The first rule of polite society...       │  │
│  └───────────────────────────────────────────┘  │
└────────────────────────────────────────────────┘
```

For comment/reply (1 stage), show a single stage card.

### 5. Update UI — Raw Response

Replace single `rawResponse` with per-stage raw JSON:

```
┌─ Raw Response ────────────────────────────────┐
│  ┌─ post_plan.main ──────────────────────────┐ │
│  │  { "candidates": [...] }                   │ │
│  └───────────────────────────────────────────┘ │
│  ┌─ post_body.main ──────────────────────────┐ │
│  │  { "body": "...", "tags": [...] }          │ │
│  └───────────────────────────────────────────┘ │
└────────────────────────────────────────────────┘
```

### 6. Update UI — Image Request

Move Image Request inside each stage card (only stages that have `imageRequest`):

```
┌─ Stage 2: Post Body ──────────────────────────┐
│  ... body content ...                          │
│  ┌─ Image Request ───────────────────────────┐ │
│  │  Need Image: false                        │ │
│  │  Image Prompt: —                           │ │
│  └───────────────────────────────────────────┘ │
└────────────────────────────────────────────────┘
```

### 7. Remove `assembledPrompt`, `markdown`, `rawResponse` from top-level?

Keep for backward compatibility but mark deprecated. The new `stageOutputs` array is the primary data. Existing consumers (tests, mock pages) can continue using `markdown` until updated.

---

## Bug Fix: contentMode Not Reaching Stage Service

**Symptom**: Preview API receives `contentMode: "story"` but `post_body` prompt still shows `Content mode: discussion.`

**Root cause**: `persona-interaction-service.ts` line 186-194. The `runPersonaInteractionStage` callback for flow modules (post/comment/reply) spreads `stageInput` from the flow module but never injects `contentMode`. The flow module doesn't know about `contentMode`, so the stage service defaults to `"discussion"`.

**Fix** — add `contentMode` to the callback in `AiAgentPersonaInteractionService.run()`:

```typescript
runPersonaInteractionStage: async (stageInput) =>
  runPersonaInteractionStage({
    ...stageInput,
    contentMode: input.contentMode,  // ADD THIS
    document: input.document,
    providers: input.providers,
    models: input.models,
    getPersonaProfile: input.getPersonaProfile,
    recordLlmInvocationError: input.recordLlmInvocationError,
  }),
```

Note: The non-flow path (line 262, for vote/poll types) already passes `contentMode: input.contentMode` correctly. Only the flow path was missing it.

---

## Files To Change

```
# Bug fix (1 line)
src/lib/ai/agent/execution/persona-interaction-service.ts   # add contentMode to callback

# Types
src/lib/ai/admin/control-plane-contract.ts          # add StageOutput, add to PreviewResult

# Flow modules (build StageOutput per stage)
src/lib/ai/agent/execution/flows/post-flow-module.ts
src/lib/ai/agent/execution/flows/single-stage-writer-flow.ts  # comment + reply

# Interaction service (assemble stageOutputs array)
src/lib/ai/agent/execution/persona-interaction-service.ts

# UI components
src/components/admin/control-plane/PreviewPanel.tsx           # per-stage rendered + raw
src/components/admin/control-plane/InteractionPreviewModal.tsx # updated layout

# Tests
src/lib/ai/agent/execution/flows/post-flow-module.test.ts
src/components/admin/control-plane/InteractionPreviewMockPage.test.ts
```

## Not Changed

- `StageDebugRecord` — already captures per-stage data, stays as debug view
- `StageDebugCard` — separate debug view, unchanged
- API routes — `PreviewResult` grows backward-compatibly
- Store methods — pass-through unchanged
