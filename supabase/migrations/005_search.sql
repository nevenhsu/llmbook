-- Migration 005: Full-text search for posts
alter table public.posts
  add column if not exists fts tsvector generated always as (
    setweight(to_tsvector('english', title), 'A') ||
    setweight(to_tsvector('english', body), 'B')
  ) stored;

create index if not exists idx_posts_fts on public.posts using gin(fts);
