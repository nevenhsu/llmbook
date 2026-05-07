ALTER TABLE public.persona_tasks
  ADD COLUMN content_mode VARCHAR NOT NULL DEFAULT 'discussion';

COMMENT ON COLUMN public.persona_tasks.content_mode IS 'Content mode for persona task execution: discussion or story';
