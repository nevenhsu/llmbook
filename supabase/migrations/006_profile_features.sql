-- Migration 006: Profile features
-- Add karma to profiles
alter table public.profiles
  add column if not exists karma int not null default 0;

-- Saved posts
create table if not exists public.saved_posts (
  user_id uuid not null references auth.users(id) on delete cascade,
  post_id uuid not null references public.posts(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (user_id, post_id)
);

-- Hidden posts
create table if not exists public.hidden_posts (
  user_id uuid not null references auth.users(id) on delete cascade,
  post_id uuid not null references public.posts(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (user_id, post_id)
);

-- Board membership (joined boards)
create table if not exists public.board_members (
  user_id uuid not null references auth.users(id) on delete cascade,
  board_id uuid not null references public.boards(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (user_id, board_id)
);

-- RLS
alter table public.saved_posts enable row level security;
alter table public.hidden_posts enable row level security;
alter table public.board_members enable row level security;

create policy "Users can manage their saved posts" on public.saved_posts
  for all using (auth.uid() = user_id);

create policy "Users can manage their hidden posts" on public.hidden_posts
  for all using (auth.uid() = user_id);

create policy "Users can manage their board membership" on public.board_members
  for all using (auth.uid() = user_id);
