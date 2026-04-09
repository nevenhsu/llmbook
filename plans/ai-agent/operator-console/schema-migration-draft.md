# Operator Console Schema Migration Draft

## Scope

This draft converges the first schema pass for:

- `job_tasks`
- `job_runtime_state`
- `content_edit_history`
- `personas.last_compressed_at`

Status:

- the first migration has already been applied in:
  - `supabase/migrations/20260408093000_add_jobs_runtime_tables.sql`
  - `supabase/schema.sql`
- this document now acts as the approved target/reference version after the image queue split
- note: follow-up migration `20260409173000_remove_image_jobs_from_job_tasks.sql` removes legacy `image_generation` rows and tightens `job_tasks` constraints to text+memory jobs only

## Migration Order

1. alter `personas`
2. create `job_runtime_state`
3. create `job_tasks`
4. create `content_edit_history`
5. create indexes
6. seed `job_runtime_state('global')`

The order matters because `content_edit_history.job_task_id` depends on `job_tasks`.

## Draft SQL

```sql
-- 1. personas: compression ordering field
ALTER TABLE public.personas
  ADD COLUMN last_compressed_at timestamptz;

-- 2. jobs runtime state
CREATE TABLE public.job_runtime_state (
  runtime_key text PRIMARY KEY DEFAULT 'global',
  paused boolean NOT NULL DEFAULT false,
  lease_owner text,
  lease_until timestamptz,
  runtime_app_seen_at timestamptz,
  last_started_at timestamptz,
  last_finished_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT job_runtime_state_runtime_key_not_blank_chk
    CHECK (btrim(runtime_key) <> '')
);

-- 3. admin jobs queue
CREATE TABLE public.job_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  runtime_key text NOT NULL DEFAULT 'global',
  job_type text NOT NULL,
  subject_kind text NOT NULL,
  subject_id uuid NOT NULL,
  dedupe_key text NOT NULL,
  status text NOT NULL DEFAULT 'PENDING',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  requested_by text,
  scheduled_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  retry_count int NOT NULL DEFAULT 0,
  max_retries int NOT NULL DEFAULT 3,
  lease_owner text,
  lease_until timestamptz,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT job_tasks_runtime_key_not_blank_chk
    CHECK (btrim(runtime_key) <> ''),
  CONSTRAINT job_tasks_status_chk
    CHECK (status IN ('PENDING', 'RUNNING', 'DONE', 'FAILED', 'SKIPPED')),
  CONSTRAINT job_tasks_type_chk
    CHECK (job_type IN ('public_task', 'notification_task', 'memory_compress')),
  CONSTRAINT job_tasks_subject_kind_chk
    CHECK (subject_kind IN ('persona_task', 'persona')),
  CONSTRAINT job_tasks_subject_coherence_chk
    CHECK (
      (job_type IN ('public_task', 'notification_task') AND subject_kind = 'persona_task')
      OR
      (job_type = 'memory_compress' AND subject_kind = 'persona')
    ),
  CONSTRAINT job_tasks_retry_non_negative_chk
    CHECK (retry_count >= 0 AND max_retries >= 0),
  CONSTRAINT job_tasks_payload_object_chk
    CHECK (jsonb_typeof(payload) = 'object')
);

-- 4. post/comment rewrite history
CREATE TABLE public.content_edit_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type text NOT NULL,
  target_id uuid NOT NULL,
  job_task_id uuid REFERENCES public.job_tasks(id) ON DELETE SET NULL,
  source_runtime text NOT NULL,
  source_kind text NOT NULL,
  source_id uuid,
  previous_snapshot jsonb NOT NULL,
  model_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT content_edit_history_target_type_chk
    CHECK (target_type IN ('post', 'comment')),
  CONSTRAINT content_edit_history_source_runtime_not_blank_chk
    CHECK (btrim(source_runtime) <> ''),
  CONSTRAINT content_edit_history_source_kind_not_blank_chk
    CHECK (btrim(source_kind) <> ''),
  CONSTRAINT content_edit_history_previous_snapshot_object_chk
    CHECK (jsonb_typeof(previous_snapshot) = 'object'),
  CONSTRAINT content_edit_history_model_metadata_object_chk
    CHECK (jsonb_typeof(model_metadata) = 'object')
);

-- 5. indexes
CREATE INDEX idx_personas_last_compressed_at
  ON public.personas(last_compressed_at ASC NULLS FIRST);

CREATE INDEX idx_job_tasks_claim_pending
  ON public.job_tasks(runtime_key, scheduled_at, created_at)
  WHERE status = 'PENDING';

CREATE INDEX idx_job_tasks_running_lease
  ON public.job_tasks(runtime_key, lease_until)
  WHERE status = 'RUNNING';

CREATE INDEX idx_job_tasks_subject_created
  ON public.job_tasks(subject_kind, subject_id, created_at DESC);

CREATE UNIQUE INDEX uq_job_tasks_active_dedupe
  ON public.job_tasks(runtime_key, dedupe_key)
  WHERE status IN ('PENDING', 'RUNNING');

CREATE INDEX idx_content_edit_history_target_created
  ON public.content_edit_history(target_type, target_id, created_at DESC);

CREATE INDEX idx_content_edit_history_job_task
  ON public.content_edit_history(job_task_id)
  WHERE job_task_id IS NOT NULL;

-- 6. initial seed
INSERT INTO public.job_runtime_state (runtime_key)
VALUES ('global')
ON CONFLICT (runtime_key) DO NOTHING;
```

## Field Notes

### `personas.last_compressed_at`

- source of truth for Memory tab query ordering
- should be updated only after a successful memory compression write
- keep `compression_state` for runtime heuristics, not canonical ordering

### `job_runtime_state.runtime_key`

- bound to `AI_AGENT_RUNTIME_STATE_KEY` for the current process
- `global` and `local` isolate queue claim/control only
- `local` may still write real business rows

### `job_tasks.dedupe_key`

- active dedupe only
- blocks duplicate inserts when an equivalent job is already `PENDING` or `RUNNING`
- does not block redo after terminal completion

Suggested dedupe basis:

- `public_task`: `public_task:${persona_task_id}`
- `notification_task`: `notification_task:${persona_task_id}`
- `memory_compress`: `memory_compress:${persona_id}`

### `job_tasks.payload`

Keep payload minimal and current-row oriented.

Suggested first shapes:

```json
{ "persona_task_id": "..." }
```

```json
{ "persona_id": "..." }
```

The worker should still load the latest DB row by `subject_kind/subject_id`.

### `content_edit_history.previous_snapshot`

This stores the overwritten content only.

Suggested shapes:

```json
{
  "schema_version": 1,
  "title": "Old post title",
  "body": "Old post body",
  "tags": ["tag-a", "tag-b"]
}
```

```json
{
  "schema_version": 1,
  "body": "Old comment body"
}
```

No `after_snapshot` is included in this draft.

## Deliberate Omissions

This draft does not add:

- `media` history
- `memory` history
- foreign keys from `job_tasks.subject_id` to multiple target tables
- trigger-based `updated_at` maintenance
- enum types; plain text + check constraints are enough for the first pass

## Follow-Up Implementation Notes

- runtime services should upsert/select `job_runtime_state` by `runtime_key`
- claim queries must filter by `runtime_key`
- active dedupe must also be scoped by `runtime_key`
- `content_edit_history` writes should happen inside the same persistence flow that updates `posts` or `comments`
