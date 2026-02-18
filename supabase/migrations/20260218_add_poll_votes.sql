-- Add poll_votes table for poll voting

CREATE TABLE IF NOT EXISTS public.poll_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  option_id uuid NOT NULL REFERENCES public.poll_options(id) ON DELETE CASCADE,
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, post_id),
  UNIQUE (user_id, option_id)
);

GRANT SELECT, INSERT, DELETE ON public.poll_votes TO authenticated;
GRANT SELECT ON public.poll_votes TO anon;

CREATE INDEX IF NOT EXISTS idx_poll_votes_post ON public.poll_votes(post_id);
CREATE INDEX IF NOT EXISTS idx_poll_votes_option ON public.poll_votes(option_id);
CREATE INDEX IF NOT EXISTS idx_poll_votes_user_post ON public.poll_votes(user_id, post_id);

CREATE OR REPLACE FUNCTION public.fn_poll_votes_set_post_id()
RETURNS TRIGGER AS $$
DECLARE
  v_post_id uuid;
BEGIN
  SELECT post_id INTO v_post_id
  FROM public.poll_options
  WHERE id = NEW.option_id;

  IF v_post_id IS NULL THEN
    RAISE EXCEPTION 'Invalid poll option';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.posts
    WHERE id = v_post_id
      AND post_type = 'poll'
  ) THEN
    RAISE EXCEPTION 'Post is not a poll';
  END IF;

  NEW.post_id := v_post_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.fn_update_poll_option_vote_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.poll_options
    SET vote_count = vote_count + 1
    WHERE id = NEW.option_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.poll_options
    SET vote_count = GREATEST(vote_count - 1, 0)
    WHERE id = OLD.option_id;
    RETURN OLD;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_poll_votes_set_post_id ON public.poll_votes;
CREATE TRIGGER trg_poll_votes_set_post_id
  BEFORE INSERT ON public.poll_votes
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_poll_votes_set_post_id();

DROP TRIGGER IF EXISTS trg_update_poll_option_vote_count ON public.poll_votes;
CREATE TRIGGER trg_update_poll_option_vote_count
  AFTER INSERT OR DELETE ON public.poll_votes
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_update_poll_option_vote_count();

ALTER TABLE public.poll_votes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their poll votes" ON public.poll_votes;
CREATE POLICY "Users can view their poll votes" ON public.poll_votes
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Authenticated users can vote on polls" ON public.poll_votes;
CREATE POLICY "Authenticated users can vote on polls" ON public.poll_votes
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.poll_options po
      JOIN public.posts p ON p.id = po.post_id
      WHERE po.id = poll_votes.option_id
        AND p.post_type = 'poll'
        AND p.status = 'PUBLISHED'
    )
  );

DROP POLICY IF EXISTS "Users can delete their poll votes" ON public.poll_votes;
CREATE POLICY "Users can delete their poll votes" ON public.poll_votes
  FOR DELETE USING (auth.uid() = user_id);
