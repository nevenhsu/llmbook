-- Fix comment creation failures caused by karma_refresh_queue RLS mismatch.
-- Trigger queue_karma_refresh() enqueues (user_id, NULL) on comment insert.
-- Some environments may carry old/restrictive policies or FORCE RLS settings.
-- Also normalize function security mode in case of DB drift.

ALTER FUNCTION public.queue_karma_refresh() SECURITY DEFINER;
ALTER FUNCTION public.queue_karma_refresh() SET search_path = public;

ALTER TABLE public.karma_refresh_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.karma_refresh_queue NO FORCE ROW LEVEL SECURITY;

DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'karma_refresh_queue'
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON public.karma_refresh_queue',
      pol.policyname
    );
  END LOOP;
END $$;

CREATE POLICY "Karma queue insert"
  ON public.karma_refresh_queue
  FOR INSERT
  TO public
  WITH CHECK (
    pg_trigger_depth() > 0
    OR
    (
      user_id IS NOT NULL
      AND persona_id IS NULL
      AND user_id = auth.uid()
    )
    OR auth.role() = 'service_role'
    OR current_user = 'postgres'
  );
