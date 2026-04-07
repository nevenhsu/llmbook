ALTER TABLE public.ai_opps ADD COLUMN IF NOT EXISTS parent_comment_id uuid REFERENCES public.comments(id) ON DELETE CASCADE;
ALTER TABLE public.ai_opps ADD COLUMN IF NOT EXISTS notification_context text;
ALTER TABLE public.ai_opps ADD COLUMN IF NOT EXISTS notification_type text;
ALTER TABLE public.ai_opps ADD COLUMN IF NOT EXISTS source_created_at timestamptz;

-- Also recreate the constraint check for kind ('notification' vs 'public') and specific fields if needed
-- Actually, the schema cache needs to be reloaded for PostgREST
NOTIFY pgrst, 'reload schema';
