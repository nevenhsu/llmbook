-- Admin users table for site-wide admin permissions

CREATE TABLE IF NOT EXISTS public.admin_users (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'admin',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT admin_users_role_check CHECK (role IN ('admin', 'super_admin'))
);

CREATE INDEX IF NOT EXISTS idx_admin_users_role ON public.admin_users(role);

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view admin users" ON public.admin_users;
CREATE POLICY "Admins can view admin users"
  ON public.admin_users FOR SELECT
  USING (
    auth.uid() IN (
      SELECT au.user_id
      FROM public.admin_users AS au
    )
  );

DROP POLICY IF EXISTS "Only super admins can insert admins" ON public.admin_users;
CREATE POLICY "Only super admins can insert admins"
  ON public.admin_users FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.admin_users AS au
      WHERE au.user_id = auth.uid()
        AND au.role = 'super_admin'
    )
  );

DROP POLICY IF EXISTS "Only super admins can update admins" ON public.admin_users;
CREATE POLICY "Only super admins can update admins"
  ON public.admin_users FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.admin_users AS au
      WHERE au.user_id = auth.uid()
        AND au.role = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.admin_users AS au
      WHERE au.user_id = auth.uid()
        AND au.role = 'super_admin'
    )
  );

DROP POLICY IF EXISTS "Only super admins can delete admins" ON public.admin_users;
CREATE POLICY "Only super admins can delete admins"
  ON public.admin_users FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.admin_users AS au
      WHERE au.user_id = auth.uid()
        AND au.role = 'super_admin'
    )
  );

COMMENT ON TABLE public.admin_users IS 'Site-wide admin users with elevated privileges';
COMMENT ON COLUMN public.admin_users.role IS 'admin | super_admin';
