-- ============================================================================
-- Migration: Add last_seen_at to profiles and personas
-- Created: 2026-02-19
-- Description: Track when users and AI personas were last active
-- ============================================================================

-- Add last_seen_at to profiles
ALTER TABLE public.profiles
ADD COLUMN last_seen_at timestamptz DEFAULT now();

-- Add last_seen_at to personas
ALTER TABLE public.personas
ADD COLUMN last_seen_at timestamptz DEFAULT now();

-- ============================================================================
-- Function: Update last_seen_at for profiles
-- ============================================================================
-- This function updates the last_seen_at timestamp whenever a user performs
-- an action like creating a post, comment, or vote.

CREATE OR REPLACE FUNCTION public.update_profile_last_seen()
RETURNS TRIGGER AS $$
BEGIN
  -- Update last_seen_at for the user (if author_id exists)
  IF NEW.author_id IS NOT NULL THEN
    UPDATE public.profiles
    SET last_seen_at = now()
    WHERE user_id = NEW.author_id;
  END IF;
  
  -- For votes table, use user_id instead of author_id
  IF TG_TABLE_NAME = 'votes' AND NEW.user_id IS NOT NULL THEN
    UPDATE public.profiles
    SET last_seen_at = now()
    WHERE user_id = NEW.user_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Triggers: Auto-update last_seen_at for user actions
-- ============================================================================

-- Trigger on posts
CREATE TRIGGER trigger_update_last_seen_on_post
AFTER INSERT ON public.posts
FOR EACH ROW
EXECUTE FUNCTION public.update_profile_last_seen();

-- Trigger on comments
CREATE TRIGGER trigger_update_last_seen_on_comment
AFTER INSERT ON public.comments
FOR EACH ROW
EXECUTE FUNCTION public.update_profile_last_seen();

-- Trigger on votes
CREATE TRIGGER trigger_update_last_seen_on_vote
AFTER INSERT ON public.votes
FOR EACH ROW
EXECUTE FUNCTION public.update_profile_last_seen();

-- ============================================================================
-- Function: Update last_seen_at for personas
-- ============================================================================
-- This function updates last_seen_at when a persona task completes successfully.

CREATE OR REPLACE FUNCTION public.update_persona_last_seen_on_task()
RETURNS TRIGGER AS $$
BEGIN
  -- Only update when task status changes to DONE
  IF NEW.status = 'DONE' AND (OLD.status IS NULL OR OLD.status != 'DONE') THEN
    UPDATE public.personas
    SET last_seen_at = now()
    WHERE id = NEW.persona_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Manual function for programmatic updates (if needed)
CREATE OR REPLACE FUNCTION public.update_persona_last_seen(persona_uuid uuid)
RETURNS void AS $$
BEGIN
  UPDATE public.personas
  SET last_seen_at = now()
  WHERE id = persona_uuid;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Trigger: Auto-update persona last_seen_at when task completes
-- ============================================================================

CREATE TRIGGER trigger_update_persona_last_seen_on_task
AFTER UPDATE ON public.persona_tasks
FOR EACH ROW
EXECUTE FUNCTION public.update_persona_last_seen_on_task();

-- ============================================================================
-- Indexes for performance
-- ============================================================================

CREATE INDEX idx_profiles_last_seen_at ON public.profiles(last_seen_at DESC);
CREATE INDEX idx_personas_last_seen_at ON public.personas(last_seen_at DESC);

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON COLUMN public.profiles.last_seen_at IS 'Last time the user performed an action (post, comment, vote)';
COMMENT ON COLUMN public.personas.last_seen_at IS 'Last time the persona executed a task';
COMMENT ON FUNCTION public.update_profile_last_seen() IS 'Auto-updates last_seen_at when user creates post/comment/vote';
COMMENT ON FUNCTION public.update_persona_last_seen(uuid) IS 'Manually update persona last_seen_at - call this when persona task completes';
