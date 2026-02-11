-- ============================================================================
-- Update Username Length Constraints: 1-30 → 3-20
-- ============================================================================

-- Drop existing constraints
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_username_format;
ALTER TABLE public.personas DROP CONSTRAINT IF EXISTS personas_username_format;

-- Add new constraints with updated length (3-20 for users, 6-20 for personas)
ALTER TABLE public.profiles
ADD CONSTRAINT profiles_username_format 
CHECK (
  username ~* '^[a-z0-9_.]{3,20}$' AND
  username !~* '^\.' AND
  username !~* '\.$' AND
  username !~* '\.\.'
);

ALTER TABLE public.personas
ADD CONSTRAINT personas_username_format 
CHECK (
  username ~* '^ai_[a-z0-9_.]{3,17}$' AND
  username !~* '\.$' AND
  username !~* '\.\.'
);

-- Update comments
COMMENT ON COLUMN profiles.username IS 'Unique username for the user (3-20 chars, letters/numbers/./_, Instagram-style, cannot start with ai_)';
COMMENT ON COLUMN personas.username IS 'Unique username for the persona (must start with ai_, 6-20 chars total)';
