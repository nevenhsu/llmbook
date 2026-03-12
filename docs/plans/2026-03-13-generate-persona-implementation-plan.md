# Generate Persona Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Complete the `generate persona` feature so Admin Control Plane can preview/save canonical persona payloads, Prompt AI can preserve or suggest named references, and AI agent runtime can consume the same stored persona without any legacy `soulProfile` or split-memory contract.

**Architecture:** Keep one canonical persona contract centered on `personas`, `persona_cores.core_profile`, and unified `persona_memories`. The admin-side generator only produces and saves that canonical payload; Prompt AI must allow explicit reference target names such as creators, artists, public figures, and fictional/IP characters; the agent runtime reads the same persisted shape through the existing `persona_core -> runtime summary` adapter in `runtime-soul-profile.ts`.

**Tech Stack:** Next.js route handlers, React admin control-plane hook/components, Supabase admin client, Vitest, TypeScript, JSON prompt contracts.

---

### Task 1: Lock the canonical persona generation contract

**Files:**

- Modify: `/Users/neven/Documents/projects/llmbook/src/lib/ai/admin/control-plane-store.ts`
- Test: `/Users/neven/Documents/projects/llmbook/src/lib/ai/admin/control-plane-store.persona-generation-preview.test.ts`
- Docs: `/Users/neven/Documents/projects/llmbook/docs/ai-admin/AI_PROMPT_ASSEMBLY_DEV_SPEC.md`

**Step 1: Write or update the failing preview parser test**

Add assertions that the generator prompt and parsed output require:

- `personas`
- `persona_core`
- `reference_sources`
- `reference_derivation`
- `originalization_note`
- `persona_memories`

**Step 2: Run test to verify it fails**

Run:

```bash
npx vitest run src/lib/ai/admin/control-plane-store.persona-generation-preview.test.ts
```

Expected: FAIL if parser or prompt still references legacy payload sections.

**Step 3: Write minimal implementation**

In `control-plane-store.ts`:

- keep `PersonaGenerationStructured` canonical
- keep `parsePersonaGenerationOutput()` strict on required top-level keys
- keep `previewPersonaGeneration()` prompt block aligned to canonical JSON keys only

**Step 4: Run test to verify it passes**

Run:

```bash
npx vitest run src/lib/ai/admin/control-plane-store.persona-generation-preview.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/ai/admin/control-plane-store.ts src/lib/ai/admin/control-plane-store.persona-generation-preview.test.ts docs/ai-admin/AI_PROMPT_ASSEMBLY_DEV_SPEC.md
git commit -m "refactor: lock canonical persona generation contract"
```

### Task 2: Make persona save use the same canonical payload

**Files:**

- Modify: `/Users/neven/Documents/projects/llmbook/src/hooks/admin/useAiControlPlane.ts`
- Modify: `/Users/neven/Documents/projects/llmbook/src/app/api/admin/ai/personas/route.ts`
- Modify: `/Users/neven/Documents/projects/llmbook/src/lib/ai/admin/control-plane-store.ts`
- Test: `/Users/neven/Documents/projects/llmbook/src/app/api/admin/ai/personas/route.test.ts`

**Step 1: Write or extend the failing save route test**

Add a POST test asserting the route passes:

- `personas`
- `personaCore`
- `referenceSources`
- `referenceDerivation`
- `originalizationNote`
- `personaMemories`

to `createPersona()`.

**Step 2: Run test to verify it fails**

Run:

```bash
npx vitest run src/app/api/admin/ai/personas/route.test.ts
```

Expected: FAIL if route or hook still serializes legacy fields.

**Step 3: Write minimal implementation**

- In `useAiControlPlane.ts`, serialize preview output to canonical camelCase request payload
- In `route.ts`, validate `personas.display_name` and `personas.bio`
- In `control-plane-store.ts`, persist to:
  - `personas`
  - `persona_cores`
  - `persona_memories`

**Step 4: Run test to verify it passes**

Run:

```bash
npx vitest run src/app/api/admin/ai/personas/route.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/hooks/admin/useAiControlPlane.ts src/app/api/admin/ai/personas/route.ts src/app/api/admin/ai/personas/route.test.ts src/lib/ai/admin/control-plane-store.ts
git commit -m "refactor: save canonical persona payload"
```

### Task 3: Make persona load and patch return canonical profile data

**Files:**

- Modify: `/Users/neven/Documents/projects/llmbook/src/app/api/admin/ai/personas/[id]/route.ts`
- Modify: `/Users/neven/Documents/projects/llmbook/src/lib/ai/admin/control-plane-store.ts`
- Test: `/Users/neven/Documents/projects/llmbook/src/app/api/admin/ai/personas/[id]/route.test.ts`

**Step 1: Write the failing profile route test**

Add tests that:

- `GET` returns `persona`, `personaCore`, `personaMemories`
- `PATCH` passes `personaCore` and `longMemory`

**Step 2: Run test to verify it fails**

Run:

```bash
npx vitest run src/app/api/admin/ai/personas/[id]/route.test.ts
```

Expected: FAIL if route still uses `soulProfile`.

**Step 3: Write minimal implementation**

- `getPersonaProfile()` reads `persona_cores` and `persona_memories`
- `PATCH` route forwards `personaCore`
- `patchPersonaProfile()` upserts `persona_cores.core_profile`

**Step 4: Run test to verify it passes**

Run:

```bash
npx vitest run src/app/api/admin/ai/personas/[id]/route.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/app/api/admin/ai/personas/[id]/route.ts src/app/api/admin/ai/personas/[id]/route.test.ts src/lib/ai/admin/control-plane-store.ts
git commit -m "refactor: expose canonical persona profile routes"
```

### Task 4: Align interaction preview with persona_core naming

**Files:**

- Modify: `/Users/neven/Documents/projects/llmbook/src/components/admin/control-plane/sections/PersonaInteractionSection.tsx`
- Modify: `/Users/neven/Documents/projects/llmbook/src/hooks/admin/useAiControlPlane.ts`
- Modify: `/Users/neven/Documents/projects/llmbook/src/app/api/admin/ai/persona-interaction/preview/route.ts`
- Test: `/Users/neven/Documents/projects/llmbook/src/app/api/admin/ai/persona-interaction/preview/route.test.ts`
- Test: `/Users/neven/Documents/projects/llmbook/src/lib/ai/admin/control-plane-store.preview-persona-interaction.test.ts`

**Step 1: Write the failing interaction preview tests**

Assert:

- request payload uses `personaCoreOverride`
- UI/state naming uses `personaCoreOverrideJson`
- preview still builds prompt successfully with canonical persona data

**Step 2: Run tests to verify they fail**

Run:

```bash
npx vitest run src/app/api/admin/ai/persona-interaction/preview/route.test.ts src/lib/ai/admin/control-plane-store.preview-persona-interaction.test.ts
```

Expected: FAIL if any layer still uses `soulOverride`.

**Step 3: Write minimal implementation**

- rename override payload to `personaCoreOverride`
- rename UI label to `Persona Core Override`
- keep runtime prompt building through `normalizeSoulProfile()` adapter

**Step 4: Run tests to verify they pass**

Run:

```bash
npx vitest run src/app/api/admin/ai/persona-interaction/preview/route.test.ts src/lib/ai/admin/control-plane-store.preview-persona-interaction.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/components/admin/control-plane/sections/PersonaInteractionSection.tsx src/hooks/admin/useAiControlPlane.ts src/app/api/admin/ai/persona-interaction/preview/route.ts src/app/api/admin/ai/persona-interaction/preview/route.test.ts src/lib/ai/admin/control-plane-store.preview-persona-interaction.test.ts src/lib/ai/admin/control-plane-store.ts
git commit -m "refactor: rename interaction preview to persona core override"
```

### Task 5: Update active docs and operator notes

**Files:**

- Modify: `/Users/neven/Documents/projects/llmbook/docs/plans/2026-03-07-reference-driven-persona-runtime-design.md`
- Modify: `/Users/neven/Documents/projects/llmbook/docs/plans/2026-03-07-reference-driven-persona-runtime-plan.md`
- Modify: `/Users/neven/Documents/projects/llmbook/src/lib/ai/README.md`
- Modify: `/Users/neven/Documents/projects/llmbook/src/lib/ai/memory/README.md`
- Modify: `/Users/neven/Documents/projects/llmbook/src/agents/persona-generator/README.md`
- Modify: `/Users/neven/Documents/projects/llmbook/src/agents/persona-generator/SOUL_GENERATION_RULES.md`
- Modify: `/Users/neven/Documents/projects/llmbook/tasks/todo.md`
- Modify: `/Users/neven/Documents/projects/llmbook/tasks/lessons.md`

**Step 1: Write the documentation delta**

Document:

- canonical persona generation payload
- `persona_cores` as source of truth
- unified `persona_memories`
- docs-first migration rule for this feature

**Step 2: Run focused grep verification**

Run:

```bash
rg -n "persona_souls|soulProfile|persona_memory|persona_long_memories" docs src/lib/ai src/agents/persona-generator src/hooks/admin src/components/admin src/app/api/admin/ai -g'*.md' -g'*.ts' -g'*.tsx'
```

Expected: only intentional migration-history references remain.

**Step 3: Update docs minimally**

Keep only active docs aligned with canonical contract. Historical migration notes may still mention removed tables, but no active operator doc should instruct legacy payload usage.

**Step 4: Commit**

```bash
git add docs/plans/2026-03-07-reference-driven-persona-runtime-design.md docs/plans/2026-03-07-reference-driven-persona-runtime-plan.md src/lib/ai/README.md src/lib/ai/memory/README.md src/agents/persona-generator/README.md src/agents/persona-generator/SOUL_GENERATION_RULES.md tasks/todo.md tasks/lessons.md
git commit -m "docs: align generate persona feature with canonical persona core contract"
```

### Task 6: Extend Prompt AI so it can preserve named references

**Files:**

- Modify: `/Users/neven/Documents/projects/llmbook/src/lib/ai/admin/control-plane-store.ts`
- Modify: `/Users/neven/Documents/projects/llmbook/src/hooks/admin/useAiControlPlane.ts`
- Modify: `/Users/neven/Documents/projects/llmbook/src/components/admin/control-plane/sections/PersonaGenerationSection.tsx`
- Test: `/Users/neven/Documents/projects/llmbook/src/lib/ai/admin/control-plane-store.persona-prompt-assist.test.ts`

**Step 1: Write the failing Prompt AI behavior test**

Target the `/admin/ai/control-plane` page's `Generate Persona -> Context / Extra Prompt -> Prompt AI` interaction.

Add assertions that Prompt AI can preserve or generate prompts containing explicit named references, for example:

- creator names
- artist names
- public figure names
- fictional/IP character names

and that optimization does not strip those names into generic wording.

**Step 2: Run test to verify it fails**

Run:

```bash
npx vitest run src/lib/ai/admin/control-plane-store.persona-prompt-assist.test.ts
```

Expected: FAIL if prompt assist still removes reference names.

**Step 3: Write minimal implementation**

- Update `assistPersonaPrompt()` instructions so explicit reference names are allowed and preserved when relevant
- Update `PersonaGenerationSection.tsx` helper text and placeholder in `Context / Extra Prompt` so users know they can type reference target names into Prompt AI input
- Keep `useAiControlPlane.ts` behavior scoped to the existing `assistPersonaPrompt()` action for that field only
- Keep output plain text and concise; only the content rule changes

**Step 4: Run test to verify it passes**

Run:

```bash
npx vitest run src/lib/ai/admin/control-plane-store.persona-prompt-assist.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/ai/admin/control-plane-store.ts src/hooks/admin/useAiControlPlane.ts src/components/admin/control-plane/sections/PersonaGenerationSection.tsx src/lib/ai/admin/control-plane-store.persona-prompt-assist.test.ts
git commit -m "feat: allow prompt ai to preserve named references"
```

### Task 7: Verify end-to-end generate persona flow

**Files:**

- Verify only

**Step 1: Run targeted vitest suite**

Run:

```bash
npx vitest run src/lib/ai/admin/control-plane-store.persona-generation-preview.test.ts src/lib/ai/admin/control-plane-store.persona-prompt-assist.test.ts src/lib/ai/admin/control-plane-store.preview-persona-interaction.test.ts src/app/api/admin/ai/persona-generation/preview/route.test.ts src/app/api/admin/ai/persona-interaction/preview/route.test.ts src/app/api/admin/ai/personas/route.test.ts src/app/api/admin/ai/personas/[id]/route.test.ts
```

Expected: PASS

**Step 2: Run diff check**

Run:

```bash
git diff --check -- src/lib/ai/admin/control-plane-store.ts src/hooks/admin/useAiControlPlane.ts src/components/admin/control-plane/sections/PersonaInteractionSection.tsx src/app/api/admin/ai/persona-generation/preview/route.ts src/app/api/admin/ai/persona-interaction/preview/route.ts src/app/api/admin/ai/personas/route.ts src/app/api/admin/ai/personas/[id]/route.ts docs/plans/2026-03-07-reference-driven-persona-runtime-design.md docs/plans/2026-03-07-reference-driven-persona-runtime-plan.md src/lib/ai/README.md src/lib/ai/memory/README.md src/agents/persona-generator/README.md src/agents/persona-generator/SOUL_GENERATION_RULES.md tasks/todo.md tasks/lessons.md
```

Expected: no whitespace or merge-marker errors

**Step 3: Record review notes**

Update `tasks/todo.md` Review section with:

- what changed
- which tests passed
- any known remaining gaps

**Step 4: Commit**

```bash
git add tasks/todo.md
git commit -m "chore: record generate persona verification results"
```

## Known Remaining Work Outside This Plan

- `vote / poll_vote` production execution still needs its own execution-path implementation plan
- runtime still uses `normalizeSoulProfile()` as an adapter for prompt assembly; that is acceptable for now because the persisted source of truth is already `persona_cores.core_profile`
- full-repo `npx tsc --noEmit` may still fail on unrelated pre-existing issues outside this slice
