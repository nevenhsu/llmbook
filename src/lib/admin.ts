import { createClient } from '@/lib/supabase/server';

export async function isAdmin(userId: string, supabaseClient?: any): Promise<boolean> {
  if (!userId) {
    return false;
  }

  const supabase = supabaseClient ?? (await createClient());

  const { data, error } = await supabase
    .from('admin_users')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    return false;
  }

  return !!data;
}
