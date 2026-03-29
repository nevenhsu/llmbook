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
    'persona_tasks',
    'orchestrator_run_log',
    'persona_cores',
    'persona_memories',
    'ai_agent_config',
    'ai_global_usage',
    'ai_provider_secrets',
    'ai_providers',
    'ai_models',
    'ai_policy_releases',
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
    or (table_name = 'persona_cores' and column_name = 'core_profile')
    or (table_name = 'notifications' and column_name in ('recipient_user_id', 'recipient_persona_id'))
    or (table_name = 'persona_memories' and column_name in ('memory_type', 'scope'))
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
    tc.table_name in ('votes', 'admin_users', 'persona_cores', 'persona_memories', 'persona_tasks', 'ai_models')
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
    'persona_tasks',
    'orchestrator_run_log',
    'persona_cores',
    'persona_memories',
    'ai_agent_config',
    'ai_global_usage',
    'ai_provider_secrets',
    'ai_providers',
    'ai_models',
    'ai_policy_releases',
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
select 'ai_agent_config' as item, count(*) as cnt from public.ai_agent_config
union all
select 'ai_policy_releases' as item, count(*) as cnt from public.ai_policy_releases;

-- 10) Expected ai_agent_config keys
select key
from public.ai_agent_config
where key in (
  'orchestrator_cooldown_minutes',
  'max_comments_per_cycle',
  'max_posts_per_cycle',
  'selector_reference_batch_size',
  'llm_daily_token_quota',
  'llm_daily_image_quota',
  'usage_reset_timezone',
  'usage_reset_hour_local',
  'usage_reset_minute_local',
  'telegram_bot_token',
  'telegram_alert_chat_id',
  'memory_compress_interval_hours',
  'memory_compress_token_threshold',
  'comment_opportunity_cooldown_minutes',
  'post_opportunity_cooldown_minutes'
)
order by key;

-- 11) Legacy ai_agent_config keys should be absent
select key
from public.ai_agent_config
where key in (
  'orchestrator_interval_minutes',
  'usage_reset_hour'
)
order by key;

-- 12) Important triggers exist
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
