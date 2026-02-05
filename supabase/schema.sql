-- Schema for AI Persona Sandbox (Supabase)

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  avatar_url text,
  bio text,
  created_at timestamptz default now()
);

create table if not exists public.boards (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  description text,
  created_at timestamptz default now()
);

create table if not exists public.tags (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  created_at timestamptz default now()
);

create table if not exists public.personas (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  slug text not null unique,
  avatar_url text,
  bio text not null,
  voice text,
  specialties text[] not null default '{}',
  traits jsonb not null default '{}'::jsonb,
  modules jsonb not null default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(user_id) on delete cascade,
  board_id uuid not null references public.boards(id) on delete restrict,
  title text not null,
  body text not null,
  status text not null default 'PUBLISHED',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.post_tags (
  post_id uuid not null references public.posts(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  primary key (post_id, tag_id)
);

create table if not exists public.media (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references public.posts(id) on delete set null,
  user_id uuid not null references auth.users(id) on delete cascade,
  url text not null,
  mime_type text not null,
  width int not null,
  height int not null,
  size_bytes int not null,
  created_at timestamptz default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz default now()
);

-- RLS
alter table public.profiles enable row level security;
alter table public.boards enable row level security;
alter table public.tags enable row level security;
alter table public.personas enable row level security;
alter table public.posts enable row level security;
alter table public.post_tags enable row level security;
alter table public.media enable row level security;
alter table public.notifications enable row level security;

-- Policies
create policy "Profiles are viewable by everyone" on public.profiles
  for select using (true);

create policy "Users can manage their profile" on public.profiles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Boards are viewable by everyone" on public.boards
  for select using (true);

create policy "Tags are viewable by everyone" on public.tags
  for select using (true);

create policy "Personas are viewable by everyone" on public.personas
  for select using (true);

create policy "Posts are viewable when published" on public.posts
  for select using (status = 'PUBLISHED');

create policy "Users can create posts" on public.posts
  for insert with check (auth.uid() = author_id);

create policy "Users can update their posts" on public.posts
  for update using (auth.uid() = author_id);

create policy "Users can delete their posts" on public.posts
  for delete using (auth.uid() = author_id);

create policy "Post tags are viewable by everyone" on public.post_tags
  for select using (true);

create policy "Users can manage post tags" on public.post_tags
  for insert with check (
    exists (
      select 1 from public.posts
      where public.posts.id = post_tags.post_id
        and public.posts.author_id = auth.uid()
    )
  );

create policy "Media is viewable by everyone" on public.media
  for select using (true);

create policy "Users can upload media" on public.media
  for insert with check (auth.uid() = user_id);

create policy "Users can update their media" on public.media
  for update using (auth.uid() = user_id);

create policy "Notifications are private" on public.notifications
  for select using (auth.uid() = user_id);

create policy "Users can manage notifications" on public.notifications
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Seed boards/tags
insert into public.boards (name, slug, description)
values
  ('Concept Art', 'concept-art', 'Visual explorations and sketches.'),
  ('Story Worlds', 'story-worlds', 'Worldbuilding drafts and lore.'),
  ('Character Lab', 'character-lab', 'Characters, bios, and arcs.')
on conflict (slug) do nothing;

insert into public.tags (name, slug)
values
  ('Feedback', 'feedback'),
  ('Draft', 'draft'),
  ('Moodboard', 'moodboard'),
  ('Sci-Fi', 'sci-fi'),
  ('Fantasy', 'fantasy')
on conflict (slug) do nothing;
