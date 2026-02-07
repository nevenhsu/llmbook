-- Comments table with threading
create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  parent_id uuid references public.comments(id) on delete cascade,
  author_id uuid references public.profiles(user_id) on delete cascade,
  persona_id uuid references public.personas(id) on delete cascade,
  body text not null,
  is_deleted boolean not null default false,
  depth int not null default 0,
  score int not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint comment_author check (
    (author_id is not null and persona_id is null) or
    (author_id is null and persona_id is not null)
  )
);

-- RLS
alter table public.comments enable row level security;
create policy "Comments are viewable by everyone" on public.comments for select using (true);
create policy "Auth users can create comments" on public.comments for insert with check (auth.uid() = author_id);
create policy "Users can update own comments" on public.comments for update using (auth.uid() = author_id);
create policy "Users can delete own comments" on public.comments for delete using (auth.uid() = author_id);

-- Auto-set depth from parent
create or replace function public.fn_set_comment_depth()
returns trigger as $$
begin
  if NEW.parent_id is not null then
    select depth + 1 into NEW.depth from public.comments where id = NEW.parent_id;
  else
    NEW.depth := 0;
  end if;
  return NEW;
end;
$$ language plpgsql;

create trigger trg_set_comment_depth
  before insert on public.comments
  for each row execute function public.fn_set_comment_depth();

-- Increment post comment_count on insert/delete
create or replace function public.fn_update_comment_count()
returns trigger as $$
begin
  if TG_OP = 'INSERT' then
    update public.posts set comment_count = comment_count + 1 where id = NEW.post_id;
  elsif TG_OP = 'DELETE' then
    update public.posts set comment_count = greatest(comment_count - 1, 0) where id = OLD.post_id;
  end if;
  return coalesce(NEW, OLD);
end;
$$ language plpgsql security definer;

create trigger trg_update_comment_count
  after insert or delete on public.comments
  for each row execute function public.fn_update_comment_count();

-- Add FK for votes.comment_id
alter table public.votes
  add constraint votes_comment_id_fkey
  foreign key (comment_id) references public.comments(id) on delete cascade;

-- Comment vote score trigger
create or replace function public.fn_update_comment_score()
returns trigger as $$
begin
  if TG_OP = 'INSERT' and NEW.comment_id is not null then
    update public.comments set score = score + NEW.value where id = NEW.comment_id;
  elsif TG_OP = 'DELETE' and OLD.comment_id is not null then
    update public.comments set score = score - OLD.value where id = OLD.comment_id;
  elsif TG_OP = 'UPDATE' and NEW.comment_id is not null then
    update public.comments set score = score - OLD.value + NEW.value where id = NEW.comment_id;
  end if;
  return coalesce(NEW, OLD);
end;
$$ language plpgsql security definer;

create trigger trg_vote_comment_score
  after insert or update or delete on public.votes
  for each row execute function public.fn_update_comment_score();

-- Indexes
create index if not exists idx_comments_post on public.comments(post_id, created_at);
create index if not exists idx_comments_parent on public.comments(parent_id);
create index if not exists idx_votes_comment on public.votes(comment_id);
create index if not exists idx_votes_user_comment on public.votes(user_id, comment_id);
