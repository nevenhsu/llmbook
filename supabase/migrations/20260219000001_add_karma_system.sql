-- ============================================================================
-- Migration: Karma System for Profiles and Personas
-- Created: 2026-02-19
-- Description: Implement karma calculation system with materialized view
-- Formula: karma = sum(post_scores) + sum(comment_scores)
-- ============================================================================

-- ============================================================================
-- Step 1: Add karma column to personas table
-- ============================================================================

ALTER TABLE public.personas
ADD COLUMN IF NOT EXISTS karma int NOT NULL DEFAULT 0;

-- ============================================================================
-- Step 2: Create a table to track which users need karma refresh
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.karma_refresh_queue (
  user_id uuid REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  persona_id uuid REFERENCES public.personas(id) ON DELETE CASCADE,
  queued_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, persona_id),
  CONSTRAINT karma_refresh_queue_check CHECK (
    (user_id IS NOT NULL AND persona_id IS NULL) OR
    (user_id IS NULL AND persona_id IS NOT NULL)
  )
);

CREATE INDEX idx_karma_refresh_queue_queued ON public.karma_refresh_queue(queued_at);

-- ============================================================================
-- Step 3: Create materialized view for karma calculation
-- ============================================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS public.user_karma_stats AS
WITH profile_karma AS (
  -- Calculate karma for regular users from their posts
  SELECT 
    p.author_id as user_id,
    NULL::uuid as persona_id,
    COALESCE(SUM(p.score), 0) as post_karma,
    0 as comment_karma
  FROM public.posts p
  WHERE p.author_id IS NOT NULL
    AND p.status IN ('PUBLISHED', 'DELETED')
  GROUP BY p.author_id
  
  UNION ALL
  
  -- Calculate karma for regular users from their comments
  SELECT 
    c.author_id as user_id,
    NULL::uuid as persona_id,
    0 as post_karma,
    COALESCE(SUM(c.score), 0) as comment_karma
  FROM public.comments c
  WHERE c.author_id IS NOT NULL
    AND c.is_deleted = false
  GROUP BY c.author_id
),
persona_karma AS (
  -- Calculate karma for personas from their posts
  SELECT 
    NULL::uuid as user_id,
    p.persona_id,
    COALESCE(SUM(p.score), 0) as post_karma,
    0 as comment_karma
  FROM public.posts p
  WHERE p.persona_id IS NOT NULL
    AND p.status IN ('PUBLISHED', 'DELETED')
  GROUP BY p.persona_id
  
  UNION ALL
  
  -- Calculate karma for personas from their comments
  SELECT 
    NULL::uuid as user_id,
    c.persona_id,
    0 as post_karma,
    COALESCE(SUM(c.score), 0) as comment_karma
  FROM public.comments c
  WHERE c.persona_id IS NOT NULL
    AND c.is_deleted = false
  GROUP BY c.persona_id
)
SELECT 
  user_id,
  persona_id,
  SUM(post_karma) as post_karma,
  SUM(comment_karma) as comment_karma,
  SUM(post_karma) + SUM(comment_karma) as total_karma
FROM (
  SELECT * FROM profile_karma
  UNION ALL
  SELECT * FROM persona_karma
) combined
GROUP BY user_id, persona_id;

-- Create indexes on the materialized view
CREATE UNIQUE INDEX idx_user_karma_stats_user ON public.user_karma_stats(user_id) 
  WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX idx_user_karma_stats_persona ON public.user_karma_stats(persona_id) 
  WHERE persona_id IS NOT NULL;

-- ============================================================================
-- Step 4: Function to refresh karma for specific users/personas
-- ============================================================================

CREATE OR REPLACE FUNCTION public.refresh_karma(
  target_user_id uuid DEFAULT NULL,
  target_persona_id uuid DEFAULT NULL
)
RETURNS void AS $$
DECLARE
  v_total_karma int;
BEGIN
  -- Refresh the entire materialized view if no specific target
  IF target_user_id IS NULL AND target_persona_id IS NULL THEN
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.user_karma_stats;
    RETURN;
  END IF;
  
  -- Update specific user karma
  IF target_user_id IS NOT NULL THEN
    -- Calculate karma from posts
    WITH karma_calc AS (
      SELECT 
        COALESCE(SUM(p.score), 0) + COALESCE(SUM(c.score), 0) as total
      FROM public.profiles prof
      LEFT JOIN public.posts p ON p.author_id = prof.user_id 
        AND p.status IN ('PUBLISHED', 'DELETED')
      LEFT JOIN public.comments c ON c.author_id = prof.user_id 
        AND c.is_deleted = false
      WHERE prof.user_id = target_user_id
      GROUP BY prof.user_id
    )
    UPDATE public.profiles
    SET karma = COALESCE((SELECT total FROM karma_calc), 0)
    WHERE user_id = target_user_id;
  END IF;
  
  -- Update specific persona karma
  IF target_persona_id IS NOT NULL THEN
    WITH karma_calc AS (
      SELECT 
        COALESCE(SUM(p.score), 0) + COALESCE(SUM(c.score), 0) as total
      FROM public.personas pers
      LEFT JOIN public.posts p ON p.persona_id = pers.id 
        AND p.status IN ('PUBLISHED', 'DELETED')
      LEFT JOIN public.comments c ON c.persona_id = pers.id 
        AND c.is_deleted = false
      WHERE pers.id = target_persona_id
      GROUP BY pers.id
    )
    UPDATE public.personas
    SET karma = COALESCE((SELECT total FROM karma_calc), 0)
    WHERE id = target_persona_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Step 5: Function to refresh all karma from materialized view
-- ============================================================================

CREATE OR REPLACE FUNCTION public.refresh_all_karma()
RETURNS void AS $$
BEGIN
  -- Refresh materialized view first
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.user_karma_stats;
  
  -- Update profiles table from materialized view
  UPDATE public.profiles p
  SET karma = COALESCE(s.total_karma, 0)
  FROM public.user_karma_stats s
  WHERE p.user_id = s.user_id;
  
  -- Update personas table from materialized view
  UPDATE public.personas pers
  SET karma = COALESCE(s.total_karma, 0)
  FROM public.user_karma_stats s
  WHERE pers.id = s.persona_id;
  
  -- Clear the refresh queue
  TRUNCATE public.karma_refresh_queue;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Step 6: Function to process karma refresh queue
-- ============================================================================

CREATE OR REPLACE FUNCTION public.process_karma_refresh_queue()
RETURNS void AS $$
DECLARE
  v_record RECORD;
  v_processed_count int := 0;
BEGIN
  -- Process queued karma refreshes
  FOR v_record IN 
    SELECT DISTINCT user_id, persona_id 
    FROM public.karma_refresh_queue 
    ORDER BY queued_at
    LIMIT 1000  -- Process in batches
  LOOP
    PERFORM public.refresh_karma(v_record.user_id, v_record.persona_id);
    
    DELETE FROM public.karma_refresh_queue
    WHERE (user_id = v_record.user_id AND v_record.user_id IS NOT NULL)
       OR (persona_id = v_record.persona_id AND v_record.persona_id IS NOT NULL);
    
    v_processed_count := v_processed_count + 1;
  END LOOP;
  
  RAISE NOTICE 'Processed % karma refresh requests', v_processed_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Step 7: Trigger to queue karma refresh when scores change
-- ============================================================================

CREATE OR REPLACE FUNCTION public.queue_karma_refresh()
RETURNS TRIGGER AS $$
BEGIN
  -- For posts table
  IF TG_TABLE_NAME = 'posts' THEN
    -- Queue the author for karma refresh
    IF NEW.author_id IS NOT NULL THEN
      INSERT INTO public.karma_refresh_queue (user_id, persona_id)
      VALUES (NEW.author_id, NULL)
      ON CONFLICT (user_id, persona_id) DO NOTHING;
    END IF;
    
    IF NEW.persona_id IS NOT NULL THEN
      INSERT INTO public.karma_refresh_queue (user_id, persona_id)
      VALUES (NULL, NEW.persona_id)
      ON CONFLICT (user_id, persona_id) DO NOTHING;
    END IF;
    
    -- Also queue old author if post author changed
    IF TG_OP = 'UPDATE' AND OLD.author_id IS NOT NULL AND OLD.author_id != NEW.author_id THEN
      INSERT INTO public.karma_refresh_queue (user_id, persona_id)
      VALUES (OLD.author_id, NULL)
      ON CONFLICT (user_id, persona_id) DO NOTHING;
    END IF;
    
    IF TG_OP = 'UPDATE' AND OLD.persona_id IS NOT NULL AND OLD.persona_id != NEW.persona_id THEN
      INSERT INTO public.karma_refresh_queue (user_id, persona_id)
      VALUES (NULL, OLD.persona_id)
      ON CONFLICT (user_id, persona_id) DO NOTHING;
    END IF;
  END IF;
  
  -- For comments table
  IF TG_TABLE_NAME = 'comments' THEN
    IF NEW.author_id IS NOT NULL THEN
      INSERT INTO public.karma_refresh_queue (user_id, persona_id)
      VALUES (NEW.author_id, NULL)
      ON CONFLICT (user_id, persona_id) DO NOTHING;
    END IF;
    
    IF NEW.persona_id IS NOT NULL THEN
      INSERT INTO public.karma_refresh_queue (user_id, persona_id)
      VALUES (NULL, NEW.persona_id)
      ON CONFLICT (user_id, persona_id) DO NOTHING;
    END IF;
    
    IF TG_OP = 'UPDATE' AND OLD.author_id IS NOT NULL AND OLD.author_id != NEW.author_id THEN
      INSERT INTO public.karma_refresh_queue (user_id, persona_id)
      VALUES (OLD.author_id, NULL)
      ON CONFLICT (user_id, persona_id) DO NOTHING;
    END IF;
    
    IF TG_OP = 'UPDATE' AND OLD.persona_id IS NOT NULL AND OLD.persona_id != NEW.persona_id THEN
      INSERT INTO public.karma_refresh_queue (user_id, persona_id)
      VALUES (NULL, OLD.persona_id)
      ON CONFLICT (user_id, persona_id) DO NOTHING;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers
DROP TRIGGER IF EXISTS trigger_queue_karma_on_post_change ON public.posts;
CREATE TRIGGER trigger_queue_karma_on_post_change
AFTER INSERT OR UPDATE OF score ON public.posts
FOR EACH ROW
EXECUTE FUNCTION public.queue_karma_refresh();

DROP TRIGGER IF EXISTS trigger_queue_karma_on_comment_change ON public.comments;
CREATE TRIGGER trigger_queue_karma_on_comment_change
AFTER INSERT OR UPDATE OF score ON public.comments
FOR EACH ROW
EXECUTE FUNCTION public.queue_karma_refresh();

-- ============================================================================
-- Step 8: Initialize karma for existing users and personas
-- ============================================================================

-- Populate the materialized view with initial data
REFRESH MATERIALIZED VIEW public.user_karma_stats;

-- Update all existing profiles
UPDATE public.profiles p
SET karma = COALESCE(s.total_karma, 0)
FROM public.user_karma_stats s
WHERE p.user_id = s.user_id;

-- Update all existing personas
UPDATE public.personas pers
SET karma = COALESCE(s.total_karma, 0)
FROM public.user_karma_stats s
WHERE pers.id = s.persona_id;

-- ============================================================================
-- Comments and documentation
-- ============================================================================

COMMENT ON TABLE public.karma_refresh_queue IS 'Queue of users/personas whose karma needs recalculation';
COMMENT ON MATERIALIZED VIEW public.user_karma_stats IS 'Materialized view caching karma calculations for performance';
COMMENT ON FUNCTION public.refresh_karma(uuid, uuid) IS 'Refresh karma for a specific user or persona';
COMMENT ON FUNCTION public.refresh_all_karma() IS 'Refresh karma for all users and personas from materialized view';
COMMENT ON FUNCTION public.process_karma_refresh_queue() IS 'Process queued karma refresh requests in batches';
COMMENT ON COLUMN public.personas.karma IS 'Total karma = sum(post_scores) + sum(comment_scores)';
