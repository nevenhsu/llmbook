# Interaction Preview Downstream Handoff Plan

**Goal:** Wire the structured output from `assistInteractionTaskContext` into the "Run Preview" flow. The preview API accepts structured context, maps it to `taskContext` string for the interaction service, and the UI disables the button when both structured data and input text are empty.

**Architecture:** The hook stores both `structuredContext` (typed discriminated union) and `taskContext` (serialized string in textarea). On "Run Preview", the hook sends `structuredContext` to the preview API. The API serializes it to `taskContext` string internally before passing to the existing interaction service (`AiAgentPersonaInteractionService`). The interaction service remains unchanged.

**Tech Stack:** TypeScript, Next.js, React hooks, Vitest.

---

## Data Flow

```
assistInteractionTaskContext()
  → API returns InteractionContextAssistOutput (structured)
  → hook stores:
      structuredContext = { taskType: "reply", articleOutline: "...", comments: [...] }
      taskContext = serialize(structuredContext) → textarea displays "Outline: ...\nComments:\n1. ..."

Run Preview button
  → hook sends { structuredContext } to preview API
  → preview API: taskContext = serialize(structuredContext)
  → store.previewPersonaInteraction({ taskContext: string, ... })
  → AiAgentPersonaInteractionService.run({ taskContext, ... })  // unchanged
```

---

## Hook Changes (`useAiControlPlane.ts`)

### State Addition

```typescript
const [structuredContext, setStructuredContext] = useState<InteractionContextAssistOutput | null>(
  null,
);
```

### `assistInteractionTaskContext` (updated)

After API returns structured output:

```typescript
const output: InteractionContextAssistOutput = res.data;
setStructuredContext(output);
setInteractionInput((prev) => ({
  ...prev,
  taskContext: serializeAssistOutput(output),
}));
```

### `runInteractionPreview` (updated)

```typescript
const runInteractionPreview = async () => {
  // validation unchanged

  const payload: {
    personaId: string;
    modelId: string;
    taskType: string;
    taskContext?: string;
    structuredContext?: InteractionContextAssistOutput;
  } = {
    personaId: interactionInput.personaId,
    modelId: interactionInput.modelId,
    taskType: interactionInput.taskType,
  };

  if (structuredContext) {
    // structured data takes precedence — API will serialize
    payload.structuredContext = structuredContext;
  } else {
    payload.taskContext = interactionInput.taskContext;
  }

  // POST to preview API with payload
};
```

### Button Disable Logic

```typescript
const runPreviewDisabled =
  (structuredContext === null && interactionInput.taskContext.trim().length === 0) ||
  interactionPreviewModalPhase === "loading";
```

Also disable the Assist button when `structuredContext` is already present (don't re-assist over existing structured data):

```typescript
const assistDisabled = !interactionInput.modelId || structuredContext !== null;
```

When the user edits the textarea manually, clear `structuredContext` (the manual edit invalidates the structured handoff):

```typescript
onChange={(e) => {
  setStructuredContext(null)
  setInteractionInput((prev) => ({ ...prev, taskContext: e.target.value }))
}}
```

---

## Preview API Route Changes (`context-assist/route.ts` → `preview/route.ts`)

### Request Body

Add optional `structuredContext` field:

```typescript
const body = (await req.json()) as {
  personaId?: string
  modelId?: string
  taskType?: PromptActionType
  taskContext?: string
  structuredContext?: InteractionContextAssistOutput  // NEW
  boardContext?: { ... }
  targetContext?: { ... }
}
```

### Mapping Logic

Before calling the store:

```typescript
// If structured context provided, serialize to taskContext string
const resolvedTaskContext = body.structuredContext
  ? serializeAssistOutput(body.structuredContext)
  : (body.taskContext ?? "");

preview = await store.previewPersonaInteraction({
  personaId: body.personaId.trim(),
  modelId: body.modelId.trim(),
  taskType: body.taskType,
  taskContext: resolvedTaskContext,
  boardContext: normalizeBoardContext(body.boardContext),
  targetContext: normalizeTargetContext(body.targetContext),
});
```

### Validation Update

`taskContext` is no longer required if `structuredContext` is provided:

```typescript
if (!body.taskContext?.trim() && !body.structuredContext) {
  return http.badRequest("taskContext or structuredContext is required");
}
```

---

## Serialization Utility (Shared)

Used by both hook (for textarea display) and API route (for mapping to interaction service):

```typescript
export function serializeAssistOutput(output: InteractionContextAssistOutput): string {
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

Place in `src/lib/ai/admin/interaction-context-assist-service.ts` alongside the schema definition (co-located with the type it serializes).

---

## Interaction Service (Unchanged)

`AiAgentPersonaInteractionService.run()` continues to accept `taskContext: string`. No changes needed. The mapping from structured data to string happens upstream (API route), so the interaction service sees the same `taskContext` string it always has.

---

## UI Changes (`PersonaInteractionSection.tsx`)

### Props

Add `structuredContext` and associated setter:

```typescript
export interface PersonaInteractionSectionProps {
  // ... existing props ...
  structuredContext: InteractionContextAssistOutput | null;
  setStructuredContext: Dispatch<SetStateAction<InteractionContextAssistOutput | null>>;
  assistInteractionTaskContext: () => Promise<void>;
}
```

### Layout Order (within Task Context / Content card)

```
textarea
  ↓
structured context row (visible when structuredContext !== null)
  ↓
hint / status text
  ↓
Run Preview button
```

### Textarea onChange

Clear structured context on manual edit:

```typescript
onChange={(e) => {
  setStructuredContext(null)
  setInteractionInput((prev) => ({ ...prev, taskContext: e.target.value }))
}}
```

### Assistant Status Text

When structured context is present, show a confirmation hint:

```typescript
{
  structuredContext
    ? "Structured context ready. Edit the text to discard and switch to manual mode."
    : (taskAssistStatus ?? "Use AI to generate a random scenario for this interaction preview.");
}
```

### Assist Button

Disable when structured context already exists:

```typescript
disabled={!interactionInput.modelId || structuredContext !== null}
```

---

## Structured Context Row UI

A compact card displayed below the textarea when `structuredContext` is non-null. Shows each field with a label and value. Layout differs per `taskType`.

### Container

Bordered card with muted background, sits between textarea and hint text:

```
<div className="mt-2 rounded-lg border border-base-300 bg-base-200/60 px-3 py-2.5">
  <!-- per-taskType fields -->
</div>
```

### post

```
┌──────────────────────────────────────────────────┐
│  Title Direction                                 │
│  A cosmic horror story exploring the limits...   │
│                                                  │
│  Content Direction                               │
│  Focus on worldbuilding and creature design...   │
└──────────────────────────────────────────────────┘
```

```tsx
<FieldRow label="Title Direction" value={output.titleDirection} />
<div className="mt-2">
  <FieldRow label="Content Direction" value={output.contentDirection} />
</div>
```

### comment

```
┌──────────────────────────────────────────────────┐
│  Article                                         │
│  The Unspeakable Truth About R'lyeh              │
│                                                  │
│  Outline                                         │
│  - Origins of the sunken city                    │
│  - Key witnesses and accounts                    │
└──────────────────────────────────────────────────┘
```

```tsx
<FieldRow label="Article" value={output.articleTitle} />
<div className="mt-2">
  <FieldRow label="Outline" value={output.articleOutline} />
</div>
```

### reply

```
┌──────────────────────────────────────────────────┐
│  Article Outline                                 │
│  A discussion about the Necronomicon's...        │
│                                                  │
│  Comment Thread                          (3)     │
│  1. The Mad Arab's account suggests...           │
│  2. Has anyone cross-referenced...               │
│  3. I think the translation misses...            │
└──────────────────────────────────────────────────┘
```

```tsx
<FieldRow label="Article Outline" value={output.articleOutline} />
<div className="mt-2">
  <div className="flex items-baseline justify-between">
    <span className="text-xs font-semibold opacity-50">Comment Thread</span>
    <span className="text-[10px] opacity-35">{output.comments.length}</span>
  </div>
  <div className="mt-1 space-y-0.5">
    {output.comments.map((c, i) => (
      <div key={i} className="flex gap-1.5 text-xs">
        <span className="mt-0.5 select-none font-medium opacity-25">{i + 1}.</span>
        <span className="opacity-75">{c.content}</span>
      </div>
    ))}
  </div>
</div>
```

### `FieldRow` Helper

Simple label + value:

```tsx
function FieldRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs font-semibold opacity-50">{label}</div>
      <div className="mt-0.5 text-sm leading-relaxed opacity-80">{value}</div>
    </div>
  );
}
```

### Visual Hierarchy

| Element                  | Style                                                          |
| ------------------------ | -------------------------------------------------------------- |
| Container                | `border border-base-300 bg-base-200/60 rounded-lg px-3 py-2.5` |
| Field label              | `text-xs font-semibold opacity-50`                             |
| Field value              | `text-sm leading-relaxed opacity-80`                           |
| Comment number           | `text-xs font-medium opacity-25 select-none`                   |
| Comment count badge      | `text-[10px] opacity-35`                                       |
| Spacing between fields   | `mt-2`                                                         |
| Spacing between comments | `space-y-0.5`                                                  |

### Zero-State / Edge Cases

| Case                          | Behavior                                                                                |
| ----------------------------- | --------------------------------------------------------------------------------------- |
| `structuredContext === null`  | Row hidden entirely (no mount)                                                          |
| `taskType` is `post`          | Show Title Direction + Content Direction                                                |
| `taskType` is `comment`       | Show Article + Outline                                                                  |
| `taskType` is `reply`         | Show Article Outline + numbered Comment Thread                                          |
| String field is empty         | Still render label + empty value (consistency)                                          |
| Comments array has != 3 items | Schema gate enforces `.length(3)`, so this shouldn't happen; render whatever is present |

---

## Full Related File List

```
src/lib/ai/admin/interaction-context-assist-service.ts   # add serializeAssistOutput, export schema type
src/app/api/admin/ai/persona-interaction/preview/route.ts # accept structuredContext, map to taskContext
src/hooks/admin/useAiControlPlane.ts                      # structuredContext state, updated assist + preview
src/components/admin/control-plane/sections/PersonaInteractionSection.tsx  # disable logic, edit clearing
src/components/admin/AiControlPlanePanel.tsx              # pass structuredContext prop
```

---

## Edge Cases

| Scenario                                                     | Behavior                                                                           |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| User clicks Assist, gets structured data, clicks Run Preview | structured data serialized → sent as taskContext to preview API                    |
| User clicks Assist, then manually edits textarea             | `structuredContext` cleared, manual text used for preview                          |
| User types text manually, never clicks Assist                | `structuredContext` is null, `taskContext` string used directly                    |
| User clicks Assist twice                                     | Button disabled while structuredContext present; user must edit first to re-enable |
| Both structuredContext null and textarea empty               | Run Preview button disabled                                                        |
| Preview loading                                              | Run Preview button disabled (existing behavior)                                    |
