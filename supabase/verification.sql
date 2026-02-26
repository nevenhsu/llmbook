-- ============================================
-- Rebuild Verification Script
-- ============================================

-- 1) Extensions
select
  extname,
  extversion
from pg_extension
where extname in ('pgcrypto', 'vector')
order by extname;

-- 2) Core tables exist
select
  table_schema,
  table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'profiles',
    'admin_users',
    'personas',
    'boards',
    'tags',
    'posts',
    'post_tags',
    'poll_options',
    'votes',
    'comments',
    'saved_posts',
    'hidden_posts',
    'board_members',
    'board_moderators',
    'board_entity_bans',
    'media',
    'notifications',
    'heartbeat_checkpoints',
    'task_intents',
    'persona_tasks',
    'task_idempotency_keys',
    'task_transition_events',
    'ai_review_queue',
    'ai_review_events',
    'persona_memory',
    'persona_souls',
    'persona_long_memories',
    'persona_engine_config',
    'ai_policy_releases',
    'persona_llm_usage',
    'post_rankings'
  )
order by table_name;

-- 3) Critical columns / generated columns / vector
select
  table_name,
  column_name,
  data_type,
  udt_name,
  is_nullable
from information_schema.columns
where table_schema = 'public'
  and (
    (table_name = 'personas' and column_name in ('status', 'username'))
    or (table_name = 'posts' and column_name = 'fts')
    or (table_name = 'persona_long_memories' and column_name = 'embedding')
  )
order by table_name, column_name;

-- 4) Key foreign keys (including delayed votes.comment_id FK)
select
  tc.table_name,
  tc.constraint_name,
  kcu.column_name,
  ccu.table_name as foreign_table_name,
  ccu.column_name as foreign_column_name
from information_schema.table_constraints tc
join information_schema.key_column_usage kcu
  on tc.constraint_name = kcu.constraint_name
 and tc.table_schema = kcu.table_schema
join information_schema.constraint_column_usage ccu
  on ccu.constraint_name = tc.constraint_name
 and ccu.table_schema = tc.table_schema
where tc.table_schema = 'public'
  and tc.constraint_type = 'FOREIGN KEY'
  and (
    tc.table_name in ('votes', 'admin_users', 'persona_souls', 'persona_long_memories', 'persona_llm_usage')
    or ccu.table_name in ('comments', 'auth.users')
  )
order by tc.table_name, tc.constraint_name;

-- 5) RLS enabled check
select
  schemaname,
  tablename,
  rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in (
    'profiles',
    'admin_users',
    'personas',
    'boards',
    'tags',
    'posts',
    'post_tags',
    'poll_options',
    'votes',
    'comments',
    'saved_posts',
    'hidden_posts',
    'board_members',
    'board_moderators',
    'board_entity_bans',
    'media',
    'notifications',
    'heartbeat_checkpoints',
    'task_intents',
    'persona_tasks',
    'task_idempotency_keys',
    'task_transition_events',
    'ai_review_queue',
    'ai_review_events',
    'persona_memory',
    'persona_souls',
    'persona_long_memories',
    'persona_engine_config',
    'ai_policy_releases',
    'persona_llm_usage',
    'post_rankings'
  )
order by tablename;

-- 6) Public schema policies
select
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
from pg_policies
where schemaname = 'public'
order by tablename, policyname;

-- 7) Storage bucket exists and config matches
select
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
from storage.buckets
where id = 'media';

-- 8) Storage policies exist
select
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
from pg_policies
where schemaname = 'storage'
  and tablename = 'objects'
order by policyname;

-- 9) Seed data check: boards/tags/config
select 'boards' as item, count(*) as cnt from public.boards
union all
select 'tags' as item, count(*) as cnt from public.tags
union all
select 'persona_engine_config' as item, count(*) as cnt from public.persona_engine_config
union all
select 'ai_policy_releases' as item, count(*) as cnt from public.ai_policy_releases;

-- 10) Expected persona_engine_config keys
select key
from public.persona_engine_config
where key in (
  'llm_comment',
  'llm_post',
  'llm_long_form',
  'llm_vote_decision',
  'llm_image_gen',
  'llm_memory_eval',
  'llm_soul_update',
  'fallback_text_short',
  'fallback_text_long',
  'fallback_image',
  'fallback_system',
  'monthly_budget_usd'
)
order by key;

-- 11) Important triggers exist
select
  event_object_table as table_name,
  trigger_name,
  action_timing,
  event_manipulation
from information_schema.triggers
where trigger_schema = 'public'
  and trigger_name in (
    'on_auth_user_created',
    'trg_vote_post_score',
    'trg_vote_comment_score',
    'trg_set_comment_depth',
    'trg_update_comment_count',
    'trg_invalidate_ranking_on_vote',
    'trg_invalidate_ranking_on_comment'
  )
order by table_name, trigger_name;
