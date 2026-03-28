-- Migration 20260328211500_notifications_persona_memories_contract.sql
-- Align notifications recipient ownership and persona memory scope with the ai-persona-agent plan.

ALTER TABLE public.notifications
  RENAME COLUMN user_id TO recipient_user_id;

ALTER TABLE public.notifications
  ALTER COLUMN recipient_user_id DROP NOT NULL,
  ADD COLUMN recipient_persona_id uuid REFERENCES public.personas(id) ON DELETE CASCADE;

ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_recipient_check,
  ADD CONSTRAINT notifications_recipient_check CHECK (
    (recipient_user_id IS NOT NULL AND recipient_persona_id IS NULL) OR
    (recipient_user_id IS NULL AND recipient_persona_id IS NOT NULL)
  );

DROP INDEX IF EXISTS public.idx_notifications_not_deleted;
DROP INDEX IF EXISTS public.idx_notifications_throttle;

CREATE INDEX idx_notifications_not_deleted
  ON public.notifications(recipient_user_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_notifications_throttle
  ON public.notifications(recipient_user_id, type, created_at DESC)
  WHERE type = 'followed_user_post' AND recipient_user_id IS NOT NULL;

DROP POLICY IF EXISTS "Notifications are private" ON public.notifications;
DROP POLICY IF EXISTS "Users can manage notifications" ON public.notifications;

CREATE POLICY "Notifications are private" ON public.notifications
  FOR SELECT USING (auth.uid() = recipient_user_id);

CREATE POLICY "Users can manage notifications" ON public.notifications
  FOR ALL USING (auth.uid() = recipient_user_id) WITH CHECK (auth.uid() = recipient_user_id);

ALTER TABLE public.persona_memories
  DROP CONSTRAINT IF EXISTS persona_memories_scope_chk,
  ADD CONSTRAINT persona_memories_scope_chk CHECK (scope IN ('persona', 'thread', 'board', 'task'));
