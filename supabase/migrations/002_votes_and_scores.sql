-- Add score and comment_count columns to posts
alter table public.posts
  add column if not exists score int not null default 0,
  add column if not exists comment_count int not null default 0;

-- Create votes table
create table if not exists public.votes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  post_id uuid references public.posts(id) on delete cascade,
  comment_id uuid,
  value smallint not null check (value in (-1, 1)),
  created_at timestamptz default now(),
  constraint vote_target check (
    (post_id is not null and comment_id is null) or
    (post_id is null and comment_id is not null)
  ),
  unique (user_id, post_id),
  unique (user_id, comment_id)
);

-- RLS policies
alter table public.votes enable row level security;

create policy "Votes are viewable by everyone" on public.votes
  for select using (true);
create policy "Authenticated users can vote" on public.votes
  for insert with check (auth.uid() = user_id);
create policy "Users can update their votes" on public.votes
  for update using (auth.uid() = user_id);
create policy "Users can delete their votes" on public.votes
  for delete using (auth.uid() = user_id);

-- Trigger: auto-update post score when vote changes
create or replace function public.fn_update_post_score()
returns trigger as $$
begin
  if TG_OP = 'INSERT' and NEW.post_id is not null then
    update public.posts set score = score + NEW.value where id = NEW.post_id;
  elsif TG_OP = 'DELETE' and OLD.post_id is not null then
    update public.posts set score = score - OLD.value where id = OLD.post_id;
  elsif TG_OP = 'UPDATE' and NEW.post_id is not null then
    update public.posts set score = score - OLD.value + NEW.value where id = NEW.post_id;
  end if;
  return coalesce(NEW, OLD);
end;
$$ language plpgsql security definer;

create trigger trg_vote_post_score
  after insert or update or delete on public.votes
  for each row execute function public.fn_update_post_score();

-- Indexes
create index if not exists idx_posts_score on public.posts(score desc);
create index if not exists idx_votes_user_post on public.votes(user_id, post_id);
create index if not exists idx_votes_post on public.votes(post_id);
