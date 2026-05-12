# Interaction Context Assist Prompt Refactor Plan

**Goal:** Refactor `assistInteractionTaskContext` from generating free-text "Interaction Preview scenarios" to generating structured taskContext handoffs via `invokeStructuredLLM`. Restructure prompts into 5 sections, remove persona data injection, drop retry, and enforce output shape with a discriminated union schema + schema gate.

**Architecture:** Single-attempt `invokeStructuredLLM` call with a per-taskType 5-section prompt. Output is validated through `runSharedJsonSchemaGate` with `field_patch` support. The discriminated union schema enforces the correct shape per `taskType`. No persona data. Empty `taskContext` triggers random story-forum direction in the thinking step.

**Tech Stack:** TypeScript, Next.js, AI SDK (`Output.object`), Zod discriminated union, `invokeStructuredLLM`, `runSharedJsonSchemaGate`, Vitest.

---

## Scope And Assumptions

- Switch from `invokeLLM` (free text) to `invokeStructuredLLM` (Zod schema + schema gate).
- Single discriminated union schema keyed on `taskType`.
- Rewrite prompt from flat list to 5 sections: `[task context]`, `[background data]`, `[detailed tasks and rules]`, `[immediate task]`, `[thinking step by step]`.
- Remove persona data injection entirely — no `personaId`, no `getPersonaProfile`, no `personaName`, no `referenceSourceNames`.
- Remove two-attempt retry. Single `invokeStructuredLLM` call.
- On `status: "schema_failure"`, throw with schema gate debug metadata.
- Keep `recordLlmInvocationError` for transport-level provider errors.
- Drop `personaId` from API route — payload is `modelId`, `taskType`, `taskContext`.
- Prompt language: English only.
- Empty `taskContext` is valid — thinking step 1 generates random story-forum direction.
- Token budget: 2000 maxOutputTokens, temperature 0.7.

---

## Output Schema (Discriminated Union)

```typescript
const InteractionContextAssistSchema = z.discriminatedUnion("taskType", [
  z.object({
    taskType: z.literal("post"),
    titleDirection: z.string(),
    contentDirection: z.string(),
  }),
  z.object({
    taskType: z.literal("comment"),
    articleTitle: z.string(),
    articleOutline: z.string(),
  }),
  z.object({
    taskType: z.literal("reply"),
    articleOutline: z.string(),
    comments: z.array(z.object({ content: z.string() })).length(3),
  }),
]);

type InteractionContextAssistOutput = z.infer<typeof InteractionContextAssistSchema>;
```

---

## Schema Gate Config

| Field                | Value                                                                                                                                                                     |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `schemaName`         | `"InteractionContextAssist"`                                                                                                                                              |
| `schema`             | `InteractionContextAssistSchema`                                                                                                                                          |
| `validationRules`    | `["taskType must match the requested interaction type", "Each comment content must be 1-2 sentences (reply only)", "comments must contain exactly 3 items (reply only)"]` |
| `allowedRepairPaths` | `["comments", "comments.*.content"]` — only reply fields need patching                                                                                                    |
| `immutablePaths`     | `["taskType"]` — discriminator must never be changed                                                                                                                      |

---

## Per-TaskType Prompt Templates

Code selects the template by `taskType`. Only the relevant taskType content goes into the prompt.

### post

```
[task context]
Your task is to generate a detailed task context for a post interaction. Generate an article title direction and content direction.

[background data]
Task context: {taskContext or "none"}

[detailed tasks and rules]
Only generate article direction and content reference. Do not write the full article.

[immediate task]
Generate a detailed task context for a post. Create a direction for an article title and its content.

[thinking step by step]
1. {if taskContext: Consider the background data provided as reference direction. | if empty: Generate a random content direction related to a story forum.}
2. Generate the task context as a handoff for the next stage.
```

### comment

```
[task context]
Your task is to generate a detailed task context for a comment interaction. Generate a fictional article title and simple outline for the persona to comment on.

[background data]
Task context: {taskContext or "none"}

[detailed tasks and rules]
Only generate a fictional article outline. The persona will write a comment on it later.

[immediate task]
Generate a detailed task context for a comment. Create a fictional article outline to comment on.

[thinking step by step]
1. {if taskContext: Consider the background data provided as reference direction. | if empty: Generate a random content direction related to a story forum.}
2. Generate the task context as a handoff for the next stage.
```

### reply

```
[task context]
Your task is to generate a detailed task context for a reply interaction. Generate an article simple outline and a comment thread with 3 comments for the persona to reply to.

[background data]
Task context: {taskContext or "none"}

[detailed tasks and rules]
Only generate an article outline and a comment thread. Each comment should be up to 2 sentences. The comments should be related discussion around the article.

[immediate task]
Generate a detailed task context for a reply. Create an article outline and 3 comments to reply to.

[thinking step by step]
1. {if taskContext: Consider the background data provided as reference direction. | if empty: Generate a random content direction related to a story forum.}
2. Generate the task context as a handoff for the next stage.
```

---

## Structured-to-String Serialization

A utility converts the discriminated union output into a human-readable string for the Task Context / Content input field. The structured data remains available for downstream flows.

```typescript
function serializeAssistOutput(output: InteractionContextAssistOutput): string {
  switch (output.taskType) {
    case "post":
      return `Title direction: ${output.titleDirection}\nContent direction: ${output.contentDirection}`;
    case "comment":
      return `Article: ${output.articleTitle}\nOutline: ${output.articleOutline}`;
    case "reply":
      return `Outline: ${output.articleOutline}\n\nComments:\n${output.comments
        .map((c, i) => `${i + 1}. ${c.content}`)
        .join("\n")}`;
  }
}
```

The hook (`useAiControlPlane`) returns both the structured output and the serialized string. The UI input field displays the string; the structured object is kept for downstream handoff.

---

## Service Changes (`interaction-context-assist-service.ts`)

- Remove `personaId`, `getPersonaProfile` from input type.
- Remove all persona profile fetching and reference anchor extraction.
- Build prompt per taskType (code branches on `taskType`).
- Call `invokeStructuredLLM` with the discriminated union schema and schema gate config.
- Return type: `Promise<InteractionContextAssistOutput>`.
- On `status: "schema_failure"`: throw `Error` with `schemaName`, `error`, `schemaGateDebug` details.
- Keep `recordLlmInvocationError` in `onProviderError`.

### Input Type (final)

```typescript
{
  modelId: string
  taskType: "post" | "comment" | "reply"
  taskContext?: string
  providers: AiProviderConfig[]
  models: AiModelConfig[]
  recordLlmInvocationError: (input: { ... }) => Promise<void>
}
```

### Return Type (final)

```typescript
Promise<InteractionContextAssistOutput>;
// { taskType: "post", titleDirection: string, contentDirection: string }
// | { taskType: "comment", articleTitle: string, articleOutline: string }
// | { taskType: "reply", articleOutline: string, comments: { content: string }[] }
```

---

## Consumer Impact

### Store (`control-plane-store.ts`)

- Remove `personaId` from wrapper method input.
- Remove `getPersonaProfile` binding.
- Return type changes from `Promise<string>` to `Promise<InteractionContextAssistOutput>`.

### API Route (`context-assist/route.ts`)

- Remove `personaId` from request validation.
- Response changes from `{ text: string }` to `InteractionContextAssistOutput` (structured JSON).

### Hook (`useAiControlPlane.ts`)

- Remove `personaId` from `assistInteractionTaskContext` signature.
- Return type is now structured.

### UI (`PersonaInteractionSection.tsx`, `AiControlPlanePanel.tsx`)

- Remove `personaId` prop threading.
- Task Context / Content input field displays the serialized string.
- Structured output preserved alongside for downstream handoff.

---

## Full Related File List

```
src/lib/ai/admin/interaction-context-assist-service.ts   # primary rewrite
src/lib/ai/admin/control-plane-store.ts                   # wrapper signature + return type
src/app/api/admin/ai/persona-interaction/context-assist/route.ts  # API schema + response
src/lib/ai/admin/control-plane-store.interaction-context-assist.test.ts  # store tests
src/app/api/admin/ai/persona-interaction/context-assist/route.test.ts   # route tests
src/hooks/admin/useAiControlPlane.ts                      # hook signature
src/components/admin/control-plane/sections/PersonaInteractionSection.tsx  # UI props + render
src/components/admin/AiControlPlanePanel.tsx              # caller
```

---

## LlmInvocation Config

| Parameter          | Value                       | Notes                                    |
| ------------------ | --------------------------- | ---------------------------------------- |
| `maxOutputTokens`  | 2000                        | Enough for outline + 3 comments          |
| `temperature`      | 0.7                         | Moderate creativity, admin-only          |
| `retries`          | 0                           | Single attempt via `invokeStructuredLLM` |
| `taskType`         | `"generic"`                 | unchanged                                |
| `capability`       | `"text_generation"`         | unchanged                                |
| `promptModality`   | `"text_only"`               | unchanged                                |
| `structuredOutput` | `Output.object({ schema })` | injected by `invokeStructuredLLM`        |

---

## Error Handling

- Single `invokeStructuredLLM` call. No second attempt.
- `status: "valid"` → return `value` (typed `InteractionContextAssistOutput`).
- `status: "schema_failure"` → throw `Error` with `schemaName`, `error` message, and `schemaGateDebug` details.
- Transport-level provider errors recorded via `recordLlmInvocationError` (unchanged).
- Caller (API route) handles thrown error → returns appropriate HTTP status.
