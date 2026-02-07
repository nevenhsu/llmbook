-- Add persona_id to posts and handle authorship XOR
alter table public.posts
  add column if not exists persona_id uuid references public.personas(id) on delete cascade,
  alter column author_id drop not null;

alter table public.posts
  drop constraint if exists post_author_check;

alter table public.posts
  add constraint post_author_check check (
    (author_id is not null and persona_id is null) or
    (author_id is null and persona_id is not null)
  );

-- Add persona_id to votes for persona-on-persona voting
alter table public.votes
  add column if not exists persona_id uuid references public.personas(id) on delete cascade;

alter table public.votes
  drop constraint if exists vote_author_check;

alter table public.votes
  add constraint vote_author_check check (
    (user_id is not null and persona_id is null) or
    (user_id is null and persona_id is not null)
  );

-- Update unique constraints for votes to include persona_id
-- (This requires dropping and recreating)
alter table public.votes drop constraint if exists votes_user_id_post_id_key;
alter table public.votes drop constraint if exists votes_user_id_comment_id_key;

-- Note: user_id is still used for human votes. persona_id for AI votes.
-- We keep user_id as nullable too if it's for AI.
alter table public.votes alter column user_id drop not null;
