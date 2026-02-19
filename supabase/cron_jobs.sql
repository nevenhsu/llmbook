-- ============================================================================
-- Cron Jobs Configuration
-- Requires pg_cron extension (available in Supabase)
-- ============================================================================

-- Enable pg_cron extension (Supabase Pro only)
-- Note: If you're on Supabase Free tier, you'll need to call these functions
-- manually or set up an external cron job (e.g., GitHub Actions, Vercel Cron)

-- ============================================================================
-- Job 1: Process karma refresh queue every 5 minutes
-- ============================================================================
-- This job processes the queue of users/personas that need karma recalculation
-- Triggered by post/comment score changes

SELECT cron.schedule(
  'process-karma-queue',          -- job name
  '*/5 * * * *',                   -- every 5 minutes
  $$SELECT public.process_karma_refresh_queue()$$
);

-- ============================================================================
-- Job 2: Full karma refresh every hour
-- ============================================================================
-- This job refreshes the materialized view and updates all karma values
-- Useful for catching any missed updates and ensuring data consistency

SELECT cron.schedule(
  'refresh-all-karma',             -- job name
  '0 * * * *',                     -- every hour at :00
  $$SELECT public.refresh_all_karma()$$
);

-- ============================================================================
-- Job 3: Full karma recalculation daily (optional, for verification)
-- ============================================================================
-- This is a heavier operation that recalculates everything from scratch
-- Run during low-traffic hours (e.g., 3 AM UTC)

SELECT cron.schedule(
  'daily-karma-verification',      -- job name
  '0 3 * * *',                     -- daily at 3:00 AM UTC
  $$
  BEGIN;
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.user_karma_stats;
    
    UPDATE public.profiles p
    SET karma = COALESCE(s.total_karma, 0)
    FROM public.user_karma_stats s
    WHERE p.user_id = s.user_id;
    
    UPDATE public.personas pers
    SET karma = COALESCE(s.total_karma, 0)
    FROM public.user_karma_stats s
    WHERE pers.id = s.persona_id;
    
  COMMIT;
  $$
);

-- ============================================================================
-- View active cron jobs
-- ============================================================================

-- To see all scheduled jobs:
-- SELECT * FROM cron.job;

-- To see job run history:
-- SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;

-- ============================================================================
-- Unscheduling jobs (if needed)
-- ============================================================================

-- To remove a job:
-- SELECT cron.unschedule('process-karma-queue');
-- SELECT cron.unschedule('refresh-all-karma');
-- SELECT cron.unschedule('daily-karma-verification');

-- ============================================================================
-- Manual triggers (for testing or Supabase Free tier)
-- ============================================================================

-- Process karma queue manually:
-- SELECT public.process_karma_refresh_queue();

-- Refresh all karma manually:
-- SELECT public.refresh_all_karma();

-- Refresh specific user karma:
-- SELECT public.refresh_karma('user-uuid-here', NULL);

-- Refresh specific persona karma:
-- SELECT public.refresh_karma(NULL, 'persona-uuid-here');
