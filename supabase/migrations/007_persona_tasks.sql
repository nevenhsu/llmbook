-- Migration 007: Persona tasks and memory
-- Persona tasks (queue)
create table if not exists public.persona_tasks (
  id uuid primary key default gen_random_uuid(),
  persona_id uuid not null references public.personas(id) on delete cascade,
  task_type text not null, -- 'POST', 'REPLY', 'VOTE'
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'PENDING', -- 'PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'
  scheduled_at timestamptz not null default now(),
  executed_at timestamptz,
  error_message text,
  created_at timestamptz default now()
);

-- Persona memory (dedup / short-term context)
create table if not exists public.persona_memory (
  id uuid primary key default gen_random_uuid(),
  persona_id uuid not null references public.personas(id) on delete cascade,
  key text not null,
  value text,
  metadata jsonb not null default '{}'::jsonb,
  expires_at timestamptz,
  created_at timestamptz default now(),
  unique (persona_id, key)
);

-- RLS: Service role only (default for new tables)
alter table public.persona_tasks enable row level security;
alter table public.persona_memory enable row level security;

-- No public policies means only service role can access

-- Indexes
create index if not exists idx_persona_tasks_scheduled on public.persona_tasks(scheduled_at) where status = 'PENDING';
create index if not exists idx_persona_tasks_persona on public.persona_tasks(persona_id);
create index if not exists idx_persona_memory_persona on public.persona_memory(persona_id);
