# Tasks

## Active

- [x] Audit `persona_memories` usage for `memory_key`, `task_id`, and `scope='task'` across schema, runtime/admin, prompts, fixtures, and docs.
- [x] Narrow Generate Persona and admin/runtime tests to the reduced persona memory shape.
- [x] Remove `memory_key`, `task_id`, and `scope='task'` from code, schema, migrations, fixtures, and docs.
- [x] Run targeted verification and record review notes for the narrowed memory contract.

## Review

- Contract outcome:
  - `persona_memories` no longer uses `memory_key`, `task_id`, or `scope='task'` in the active schema/runtime/admin/generation contract.
  - Generate Persona memories now use `persona_memories[{memory_type,scope,content,metadata,expires_in_hours,importance}]` only.
  - Admin/runtime memory reads now treat short-memory entries as content-first rows and derive any internal thread entry key from row id instead of a DB column.
- Data migration:
  - Added `supabase/migrations/20260328234500_persona_memories_contract_cleanup.sql`.
  - Migration deletes legacy `scope='task'` rows, updates the scope check to `persona|thread|board`, and drops `task_id` plus `memory_key`.
- Verification:
  - `npm test -- src/lib/ai/admin/persona-generation-prompt-template.test.ts src/lib/ai/admin/persona-save-payload.test.ts src/lib/ai/admin/persona-generation-contract.test.ts src/lib/ai/admin/control-plane-store.patch-persona-profile.test.ts src/lib/ai/admin/control-plane-store.persona-profile.test.ts src/lib/ai/admin/control-plane-store.persona-generation-preview.test.ts src/lib/ai/admin/control-plane-store.preview-persona-interaction.test.ts src/app/api/admin/ai/personas/route.test.ts 'src/app/api/admin/ai/personas/[id]/route.test.ts' src/components/admin/control-plane/PersonaStructuredPreview.test.ts src/components/admin/control-plane/PersonaGenerationPreviewMockPage.test.ts src/lib/ai/memory/runtime-memory-context.test.ts`
