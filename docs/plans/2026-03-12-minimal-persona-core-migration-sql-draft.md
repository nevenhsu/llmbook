# Minimal Persona Core Migration SQL Draft

**Purpose:** Draft the SQL needed to move from the current `persona_souls` + split memory tables design to the minimal model:

- `personas`
- `persona_cores`
- `persona_memories`
- `persona_tasks`
- existing business tables

This is a draft, not an applied migration.

## Target Changes

1. Create `persona_cores`
2. Create unified `persona_memories`
3. Backfill from:
   - `persona_souls`
   - `persona_memory`
   - `ai_thread_memories`
   - `persona_long_memories`
4. Extend `poll_votes` to support `persona_id`
5. Extend `persona_tasks.task_type` to support `poll_vote`
6. Drop old tables after runtime code switches

## SQL Draft

```sql
begin;

-- 1. persona_cores replaces persona_souls
create table public.persona_cores (
  id uuid primary key default gen_random_uuid(),
  persona_id uuid not null unique references public.personas(id) on delete cascade,
  core_profile jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint persona_cores_core_profile_object_chk check (jsonb_typeof(core_profile) = 'object')
);

create index idx_persona_cores_persona on public.persona_cores(persona_id);

comment on table public.persona_cores is
  'Reusable structured persona identity replacing legacy persona_souls.';

comment on column public.persona_cores.core_profile is
  'Persona core payload: identity_summary, values, aesthetic_profile, lived_context, creator_affinity, interaction_defaults, guardrails, reference_sources, reference_derivation, originalization_note.';

-- 2. unified persona_memories replaces persona_memory + ai_thread_memories + persona_long_memories
create table public.persona_memories (
  id uuid primary key default gen_random_uuid(),
  persona_id uuid not null references public.personas(id) on delete cascade,
  memory_type text not null,
  scope text not null,
  task_id uuid references public.persona_tasks(id) on delete set null,
  thread_id text,
  board_id uuid references public.boards(id) on delete cascade,
  memory_key text,
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  expires_at timestamptz,
  is_canonical boolean not null default false,
  importance real,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint persona_memories_memory_type_chk check (memory_type in ('long_memory', 'memory')),
  constraint persona_memories_scope_chk check (scope in ('persona', 'thread', 'task'))
);

create index idx_persona_memories_persona on public.persona_memories(persona_id);
create index idx_persona_memories_persona_type on public.persona_memories(persona_id, memory_type);
create index idx_persona_memories_thread on public.persona_memories(persona_id, thread_id) where thread_id is not null;
create index idx_persona_memories_expire on public.persona_memories(expires_at) where expires_at is not null;

comment on table public.persona_memories is
  'Unified persona memory table covering long_memory and short memory across persona/thread/task scopes.';

-- 3. backfill persona_souls -> persona_cores
insert into public.persona_cores (persona_id, core_profile, created_at, updated_at)
select
  ps.persona_id,
  ps.soul_profile as core_profile,
  ps.created_at,
  ps.updated_at
from public.persona_souls ps;

-- 4. backfill persona_memory -> persona_memories
insert into public.persona_memories (
  persona_id, memory_type, scope, memory_key, content, metadata, expires_at, created_at, updated_at
)
select
  pm.persona_id,
  'memory' as memory_type,
  'persona' as scope,
  pm.key as memory_key,
  coalesce(pm.value, '') as content,
  pm.context_data as metadata,
  pm.expires_at,
  pm.created_at,
  pm.created_at
from public.persona_memory pm;

-- 5. backfill ai_thread_memories -> persona_memories
insert into public.persona_memories (
  persona_id, memory_type, scope, thread_id, board_id, task_id, memory_key, content, metadata, expires_at, created_at, updated_at
)
select
  atm.persona_id,
  'memory' as memory_type,
  'thread' as scope,
  atm.thread_id,
  atm.board_id,
  null,
  atm.memory_key,
  atm.memory_value,
  atm.metadata,
  atm.expires_at,
  atm.created_at,
  atm.updated_at
from public.ai_thread_memories atm;

-- 6. backfill persona_long_memories -> persona_memories
insert into public.persona_memories (
  persona_id, memory_type, scope, task_id, board_id, content, metadata, is_canonical, importance, created_at, updated_at
)
select
  plm.persona_id,
  'long_memory' as memory_type,
  'persona' as scope,
  plm.source_action_id as task_id,
  null,
  plm.content,
  jsonb_build_object(
    'memory_category', plm.memory_category,
    'related_persona_id', plm.related_persona_id,
    'related_board_slug', plm.related_board_slug
  ),
  plm.is_canonical,
  plm.importance,
  plm.created_at,
  plm.updated_at
from public.persona_long_memories plm;

-- 7. extend persona_tasks to support poll_vote
alter table public.persona_tasks drop constraint if exists persona_tasks_type_check;

alter table public.persona_tasks
add constraint persona_tasks_type_check
check (task_type in ('comment', 'post', 'reply', 'vote', 'image_post', 'poll_post', 'poll_vote'));

-- 8. extend poll_votes so personas can vote on polls
alter table public.poll_votes
  add column persona_id uuid references public.personas(id) on delete cascade;

alter table public.poll_votes
  drop constraint if exists poll_votes_user_id_post_id_key;

alter table public.poll_votes
  drop constraint if exists poll_votes_user_id_option_id_key;

alter table public.poll_votes
  add constraint poll_votes_author_check check (
    (user_id is not null and persona_id is null) or
    (user_id is null and persona_id is not null)
  );

create unique index uq_poll_votes_user_post
  on public.poll_votes(user_id, post_id)
  where user_id is not null;

create unique index uq_poll_votes_persona_post
  on public.poll_votes(persona_id, post_id)
  where persona_id is not null;

create unique index uq_poll_votes_user_option
  on public.poll_votes(user_id, option_id)
  where user_id is not null;

create unique index uq_poll_votes_persona_option
  on public.poll_votes(persona_id, option_id)
  where persona_id is not null;

commit;
```

## Drop Phase Draft

Run only after runtime/admin code reads and writes the new tables:

```sql
begin;

drop table if exists public.persona_souls;
drop table if exists public.persona_memory;
drop table if exists public.ai_thread_memories;
drop table if exists public.persona_long_memories;

commit;
```

## Notes

- `personas.bio` stays as the human-readable summary and does not need migration.
- `persona_cores.core_profile` is intentionally a single JSONB payload to keep the first migration small.
- `persona_memories` intentionally keeps long and short memory in one table, separated by `memory_type`.
- Final generated content should continue writing directly to `posts`, `comments`, `votes`, `poll_options`, and `poll_votes`.
