# Interaction Preview Content Mode Plan

**Goal:** Add `contentMode` selector ("discussion" | "story") to the Interaction Preview card. Thread the value through the hook, API route, store, and into the existing interaction stage service which already supports it. Also wire `contentMode` into the prompt-assist (context-assist) API so the generated task context differs per mode.

**Architecture:** `contentMode` defaults to `"discussion"` everywhere (current behavior). Adding a dropdown lets the user switch to `"story"`. The stage service already passes `contentMode` to `buildV2Blocks` → `buildPersonaPromptFamilyV2`, which calls `buildContentModePolicyForFlow` — this generates distinct policies for discussion vs story across all 4 flows (post_plan, post_body, comment, reply). The assist prompt also needs `contentMode` to generate appropriate context (discussion topics vs story premises).

**Tech Stack:** TypeScript, React, Next.js, Vitest.

---

## Investigation Findings

### Interaction Flow — contentMode Fully Supported

`buildContentModePolicyForFlow(flow, contentMode)` in `persona-v2-prompt-family.ts` returns per-flow × contentMode policies. Example for `post_body`:

- **discussion**: "Write forum-native markdown carrying a clear claim, structure, and concrete usefulness. Do not write fiction."
- **story**: "Write long story markdown prose using the persona's story logic and voice. Do not turn the story into writing advice, a moral explainer, or a synopsis."

`buildActionModePolicyForFlow` also differentiates per flow. `buildAntiGenericContract` applies to both modes.

**Dead code**: The per-flow × contentMode constants (`POST_BODY_DISCUSSION_TASK_CONTEXT`, `COMMENT_STORY_ACTION_POLICY`, etc.) are defined but never referenced. The actual content is built inline in `buildActionModePolicyForFlow` and `buildContentModePolicyForFlow`. **Removed as part of this plan.**

### Prompt-Assist API — Does NOT Support contentMode

The context-assist prompt (`buildPrompt` in `interaction-context-assist-service.ts`) generates the same output regardless of content mode. For story mode, it should generate story-appropriate context (story premise, narrative direction) instead of discussion topics.

---

## What Already Exists

- `ContentMode = "discussion" | "story"` defined in `persona-core-v2.ts`
- `PersonaInteractionStageInput.contentMode?: ContentMode` — threaded to `buildV2Blocks`
- `AiAgentPersonaInteractionInput.contentMode?: ContentMode` — accepted by interaction service
- Stage service defaults to `"discussion"` when not provided (line 236)
- V2 prompt family has per-flow × contentMode constants (e.g., `POST_BODY_DISCUSSION_*` vs `POST_BODY_STORY_*`)

## What's Missing (The Plan)

### 1. UI — `PersonaInteractionSection.tsx`

Add a `contentMode` field to `interactionInput` state:

```typescript
interactionInput: {
  personaId: string;
  modelId: string;
  taskType: "post" | "comment" | "reply";
  taskContext: string;
  contentMode: "discussion" | "story"; // NEW
}
```

Add a `<select>` dropdown below Task Category:

```tsx
<select
  className="select select-bordered select-sm w-full"
  value={interactionInput.contentMode}
  onChange={(e) => {
    const contentMode = e.target.value as "discussion" | "story";
    setStructuredContext(null);
    setInteractionInput((prev) => ({ ...prev, contentMode }));
  }}
>
  <option value="discussion">Discussion</option>
  <option value="story">Story</option>
</select>
```

Label: "Content Mode". Clears `structuredContext` on change (same pattern as taskType).

### 2. Hook — `useAiControlPlane.ts`

Add `contentMode: "discussion"` to `interactionInput` default state.

Update `runInteractionPreview` to include `contentMode` in the API payload:

```typescript
payload.contentMode = interactionInput.contentMode;
```

### 3. Preview API Route — `preview/route.ts`

Accept `contentMode` in request body:

```typescript
const body = (await req.json()) as {
  // ... existing fields ...
  contentMode?: "discussion" | "story";
};
```

Pass to store:

```typescript
preview = await store.previewPersonaInteraction({
  // ... existing fields ...
  contentMode: body.contentMode,
});
```

### 4. Store — `control-plane-store.ts`

Add `contentMode` to `previewPersonaInteraction` input and forward to service:

```typescript
public async previewPersonaInteraction(input: {
  // ... existing fields ...
  contentMode?: "discussion" | "story";
}): Promise<PreviewResult> {
  return previewPersonaInteraction({
    ...input,
    ...(await this.getActiveControlPlane()),
    getPersonaProfile: ...,
    recordLlmInvocationError: ...,
  });
}
```

### 5. Prompt-Assist Service — `interaction-context-assist-service.ts`

Add `contentMode` to the service input and `buildPrompt` function. The prompt varies per contentMode:

- **discussion**: "Generate an article title direction and content direction for a discussion post."
- **story**: "Generate a story title direction and premise for a story post."

Update `buildPrompt` to accept `contentMode` and adjust the `[task context]` and `[detailed tasks and rules]` sections per mode. The `InteractionContextAssistOutput` schema stays the same — the structured fields (`titleDirection`, `contentDirection`, etc.) work for both modes.

### 6. Prompt-Assist API Route — `context-assist/route.ts`

Accept `contentMode` in request body, pass to store.

### 7. Store — `control-plane-store.ts`

Add `contentMode` to `assistInteractionTaskContext` method input, forward to service.

### 8. Hook — `useAiControlPlane.ts` (assist)

Pass `interactionInput.contentMode` in the context-assist API call.

### 9. Mock Page — `InteractionPreviewMockPage.tsx`

Add `contentMode: "discussion"` to default input state.

---

## Files To Change

```
# UI + state
src/components/admin/control-plane/sections/PersonaInteractionSection.tsx
src/components/admin/control-plane/InteractionPreviewMockPage.tsx
src/hooks/admin/useAiControlPlane.ts

# Preview API (thread contentMode to interaction flow)
src/app/api/admin/ai/persona-interaction/preview/route.ts
src/lib/ai/admin/control-plane-store.ts                     # previewPersonaInteraction method

# Assist API (thread contentMode to prompt generation)
src/app/api/admin/ai/persona-interaction/context-assist/route.ts
src/lib/ai/admin/interaction-context-assist-service.ts      # buildPrompt + service input
src/lib/ai/admin/control-plane-store.ts                     # assistInteractionTaskContext method

# Dead code removal
src/lib/ai/prompt-runtime/persona-v2-prompt-family.ts       # remove 24 unused constants

# Tests
src/components/admin/control-plane/sections/PersonaInteractionSection.test.ts
src/lib/ai/admin/control-plane-store.interaction-context-assist.test.ts
src/app/api/admin/ai/persona-interaction/context-assist/route.test.ts
src/app/api/admin/ai/persona-interaction/preview/route.test.ts
```

## Dead Code Removal

### 10. `persona-v2-prompt-family.ts` — Remove Unused Constants

24 exported constants are defined but never referenced. The real implementations are inline in `buildActionModePolicyForFlow` and `buildContentModePolicyForFlow`. Remove all of them:

**Task Context (8):**

- `POST_PLAN_DISCUSSION_TASK_CONTEXT` / `POST_PLAN_STORY_TASK_CONTEXT`
- `POST_BODY_DISCUSSION_TASK_CONTEXT` / `POST_BODY_STORY_TASK_CONTEXT`
- `COMMENT_DISCUSSION_TASK_CONTEXT` / `COMMENT_STORY_TASK_CONTEXT`
- `REPLY_DISCUSSION_TASK_CONTEXT` / `REPLY_STORY_TASK_CONTEXT`

**Action Policy (8):**

- `POST_PLAN_DISCUSSION_ACTION_POLICY` / `POST_PLAN_STORY_ACTION_POLICY`
- `POST_BODY_DISCUSSION_ACTION_POLICY` / `POST_BODY_STORY_ACTION_POLICY`
- `COMMENT_DISCUSSION_ACTION_POLICY` / `COMMENT_STORY_ACTION_POLICY`
- `REPLY_DISCUSSION_ACTION_POLICY` / `REPLY_STORY_ACTION_POLICY`

**Content Policy (8):**

- `POST_PLAN_DISCUSSION_CONTENT_POLICY` / `POST_PLAN_STORY_CONTENT_POLICY`
- `POST_BODY_DISCUSSION_CONTENT_POLICY` / `POST_BODY_STORY_CONTENT_POLICY`
- `COMMENT_DISCUSSION_CONTENT_POLICY` / `COMMENT_STORY_CONTENT_POLICY`
- `REPLY_DISCUSSION_CONTENT_POLICY` / `REPLY_STORY_CONTENT_POLICY`

Also check tests for any references to these constants and remove them.

## Not Changed

- `AiAgentPersonaInteractionInput` — already has `contentMode?: ContentMode`
- `PersonaInteractionStageInput` — already has `contentMode?: ContentMode`
- `buildV2Blocks` / `buildPersonaPromptFamilyV2` — already consume `contentMode`
- `AiAgentPersonaInteractionService` — already forwards `contentMode`
- Stage service default (`"discussion"`) — unchanged
- `InteractionContextAssistOutput` schema — same fields work for both modes
