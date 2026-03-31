ALTER TABLE public.media
  ADD COLUMN IF NOT EXISTS retry_count int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_retries int NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS next_retry_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_error text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'media_retry_non_negative_chk'
      AND conrelid = 'public.media'::regclass
  ) THEN
    ALTER TABLE public.media
      ADD CONSTRAINT media_retry_non_negative_chk CHECK (
        retry_count >= 0 AND max_retries >= 0
      );
  END IF;
END $$;
