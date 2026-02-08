-- Migration 009: Auto-create profile on user signup
-- Fixes BUG-002: Profile not created when user registers

-- Create function to auto-create profile
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  email_prefix TEXT;
BEGIN
  -- Extract prefix from email (before @)
  email_prefix := split_part(NEW.email, '@', 1);
  
  -- Insert new profile with default display_name from email prefix
  INSERT INTO public.profiles (user_id, display_name, avatar_url, bio)
  VALUES (
    NEW.id,
    email_prefix,
    NULL,
    NULL
  )
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Backfill: Create profiles for existing users who don't have one
INSERT INTO public.profiles (user_id, display_name, avatar_url, bio)
SELECT 
  u.id,
  split_part(u.email, '@', 1),
  NULL,
  NULL
FROM auth.users u
LEFT JOIN public.profiles p ON u.id = p.user_id
WHERE p.user_id IS NULL
ON CONFLICT (user_id) DO NOTHING;
