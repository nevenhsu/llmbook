-- Migration 20260330160000_orchestrator_runtime_lease_functions.sql
-- Add DB-backed claim/heartbeat/release helpers for the long-running orchestrator singleton lease.

CREATE OR REPLACE FUNCTION public.claim_orchestrator_runtime_lease(
  next_lease_owner text,
  lease_duration_seconds integer,
  allow_during_cooldown boolean DEFAULT false
)
RETURNS public.orchestrator_runtime_state
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  claimed_row public.orchestrator_runtime_state;
BEGIN
  UPDATE public.orchestrator_runtime_state
  SET
    lease_owner = next_lease_owner,
    lease_until = now() + make_interval(secs => GREATEST(COALESCE(lease_duration_seconds, 1), 1)),
    last_started_at = CASE
      WHEN lease_owner = next_lease_owner
        AND lease_until IS NOT NULL
        AND lease_until > now()
      THEN last_started_at
      ELSE now()
    END,
    updated_at = now()
  WHERE singleton_key = 'global'
    AND paused = false
    AND (
      lease_owner = next_lease_owner
      OR lease_until IS NULL
      OR lease_until <= now()
    )
    AND (
      allow_during_cooldown
      OR cooldown_until IS NULL
      OR cooldown_until <= now()
    )
  RETURNING * INTO claimed_row;

  RETURN claimed_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.heartbeat_orchestrator_runtime_lease(
  active_lease_owner text,
  lease_duration_seconds integer
)
RETURNS public.orchestrator_runtime_state
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  heartbeated_row public.orchestrator_runtime_state;
BEGIN
  UPDATE public.orchestrator_runtime_state
  SET
    lease_until = now() + make_interval(secs => GREATEST(COALESCE(lease_duration_seconds, 1), 1)),
    updated_at = now()
  WHERE singleton_key = 'global'
    AND paused = false
    AND lease_owner = active_lease_owner
    AND lease_until IS NOT NULL
    AND lease_until > now()
  RETURNING * INTO heartbeated_row;

  RETURN heartbeated_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.release_orchestrator_runtime_lease(
  active_lease_owner text,
  cooldown_minutes integer DEFAULT NULL
)
RETURNS public.orchestrator_runtime_state
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  released_row public.orchestrator_runtime_state;
BEGIN
  UPDATE public.orchestrator_runtime_state
  SET
    lease_owner = null,
    lease_until = null,
    cooldown_until = CASE
      WHEN cooldown_minutes IS NULL THEN cooldown_until
      ELSE now() + make_interval(mins => GREATEST(cooldown_minutes, 0))
    END,
    last_finished_at = now(),
    updated_at = now()
  WHERE singleton_key = 'global'
    AND lease_owner = active_lease_owner
  RETURNING * INTO released_row;

  RETURN released_row;
END;
$$;
